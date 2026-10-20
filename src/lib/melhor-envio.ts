import "server-only";
import { createHash } from "node:crypto";
import type { ShippingItem, ShippingOption } from "@/lib/shipping";
import { IS_PRODUCTION, kvGet, kvReleaseLock, kvSet, kvSetNX } from "@/lib/store/kv";

/**
 * Cotação de frete no Melhor Envio — SÓ NO SERVIDOR (o token não pode ir
 * pro navegador). Usada pela rota `/api/frete` (tela) e pelo checkout no
 * servidor (que recalcula o frete antes de gerar o Pix).
 *
 * Variáveis:
 * - `MELHOR_ENVIO_TOKEN`: token gerado no painel do Melhor Envio
 *   (Integrações → Permissões de acesso → Gerar token, com "shipping-calculate").
 * - `MELHOR_ENVIO_CEP_ORIGEM`: CEP de onde sai o produto (padrão 90430-131).
 * - `MELHOR_ENVIO_SANDBOX=1`: usa o ambiente de testes (token do sandbox).
 * - `MELHOR_ENVIO_USER_AGENT`: "Nome (e-mail de contato técnico)" — o
 *   Melhor Envio pede isso em toda chamada.
 *
 * Sem token: fora de produção → cotação SIMULADA (valores fictícios);
 * em produção → erro, e o checkout usa a tabela fixa por região.
 *
 * A cotação fica 1h no Redis (mesmo CEP + mesmos itens = mesma cotação):
 * o preço que a pessoa viu na tela é o que o servidor confere depois.
 */

// Token de reserva (variável da Vercel). O principal é o salvo no Redis pela
// autorização (/api/melhorenvio/connect), que se RENOVA SOZINHO — ver `meToken`.
const ENV_TOKEN = process.env.MELHOR_ENVIO_TOKEN?.trim() || "";

const TOKENS_KEY = "me:tokens";
type MeTokens = { accessToken: string; refreshToken: string | null; expiresAt: number };
// Renova quando faltar menos que isso pra vencer (o token vale ~30 dias; o
// cron diário e as próprias chamadas garantem que nunca chega a vencer).
const RENEW_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

async function readMeTokens(): Promise<MeTokens | null> {
  try {
    const raw = await kvGet(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as MeTokens) : null;
  } catch {
    return null;
  }
}

export async function saveMeTokens(t: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}) {
  const tokens: MeTokens = {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiresAt: Date.now() + (t.expires_in ?? 30 * 86400) * 1000,
  };
  await kvSet(TOKENS_KEY, JSON.stringify(tokens));
  return tokens;
}

async function refreshMeTokens(current: MeTokens): Promise<MeTokens> {
  if (!current.refreshToken) return current;
  const owner = crypto.randomUUID();
  if (!(await kvSetNX("me:refresh-lock", owner, 30))) return current; // outra instância renovando
  try {
    const latest = (await readMeTokens()) ?? current;
    if (latest.expiresAt - Date.now() > RENEW_BEFORE_MS) return latest;
    const clientId = process.env.MELHOR_ENVIO_CLIENT_ID?.trim();
    const secret = process.env.MELHOR_ENVIO_SECRET?.trim();
    if (!clientId || !secret) throw new Error("Client ID/Secret do Melhor Envio não configurados");
    const response = await fetch(`${OAUTH_BASE}/oauth/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: latest.refreshToken,
        client_id: clientId,
        client_secret: secret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Melhor Envio ${response.status} ao renovar o token`);
    const saved = await saveMeTokens(await response.json());
    console.info("[melhor envio] token renovado sozinho");
    return saved;
  } finally {
    await kvReleaseLock("me:refresh-lock", owner).catch(() => {});
  }
}

/** Token pra usar agora: o do Redis (renovado sozinho perto de vencer) ou, sem ele, o da variável. */
export async function meToken(): Promise<string> {
  let tokens = await readMeTokens();
  if (tokens && tokens.expiresAt - Date.now() < RENEW_BEFORE_MS) {
    tokens = await refreshMeTokens(tokens).catch((error: Error) => {
      console.error("[melhor envio] renovação falhou:", error.message);
      return tokens;
    });
  }
  if (tokens && tokens.expiresAt > Date.now()) return tokens.accessToken;
  return ENV_TOKEN;
}

/** Pro painel: de onde vem o token e quando vence. */
export async function meTokenStatus() {
  const tokens = await readMeTokens();
  if (tokens)
    return {
      origem: "autorização (renova sozinho)",
      venceEm: new Date(tokens.expiresAt).toISOString(),
      renovavel: Boolean(tokens.refreshToken),
    };
  return {
    origem: ENV_TOKEN ? "variável MELHOR_ENVIO_TOKEN (NÃO renova)" : "nenhum",
    venceEm: null,
    renovavel: false,
  };
}
// `MELHOR_ENVIO_API_URL` só pra teste local (um Melhor Envio falso).
export const BASE =
  process.env.MELHOR_ENVIO_API_URL?.trim() ||
  (process.env.MELHOR_ENVIO_SANDBOX === "1"
    ? "https://sandbox.melhorenvio.com.br"
    : "https://www.melhorenvio.com.br");
export const USER_AGENT =
  process.env.MELHOR_ENVIO_USER_AGENT?.trim() || "Fernandito (https://fernandito.com.br)";
export const ORIGIN_CEP = (process.env.MELHOR_ENVIO_CEP_ORIGEM?.trim() || "90430131").replace(
  /\D/g,
  "",
);
const CACHE_SECONDS = 60 * 60;
/** Transportadoras do checkout (nome da empresa no Melhor Envio). As 4 postam
 * no mesmo ponto Pegaki (Av. Benjamin Constant, 917, escolhido no painel do
 * Melhor Envio, 20/10). Correios não: não levam bebida alcoólica. */
export const ALLOWED_CARRIERS = ["Jadlog", "J&T Express", "Loggi", "LATAM Cargo"];
// O nome varia no Melhor Envio ("JeT", "J&T", "Latam Cargo"...): compara assim.
const CARRIER_MATCH = [/jadlog/i, /j\s*(&|e)\s*t/i, /loggi/i, /latam/i];

/** A transportadora é uma das liberadas? */
export function isAllowedCarrier(name: string | undefined) {
  return Boolean(name && CARRIER_MATCH.some((re) => re.test(name)));
}
// Mostra no máximo as N opções mais baratas.
const MAX_OPTIONS = 4;

type MeService = {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  error?: string;
  delivery_range?: { min: number; max: number };
  custom_delivery_range?: { min: number; max: number };
  company?: { name?: string };
};

export async function quoteMelhorEnvio(
  destinationCep: string,
  items: ShippingItem[],
): Promise<ShippingOption[]> {
  const cep = destinationCep.replace(/\D/g, "");
  const token = await meToken();
  const cacheKey = `frete:${createHash("sha1")
    .update(JSON.stringify({ cep, items, origin: ORIGIN_CEP, real: Boolean(token) }))
    .digest("hex")}`;
  try {
    const cached = await kvGet(cacheKey);
    if (cached) return JSON.parse(cached) as ShippingOption[];
  } catch {
    // Sem banco: cota de novo.
  }

  let options: ShippingOption[];
  if (token) options = await quoteReal(cep, items, token);
  else if (!IS_PRODUCTION) options = quoteMock(cep, items);
  else throw new Error("Melhor Envio não configurado (MELHOR_ENVIO_TOKEN)");

  if (options.length === 0) throw new Error("Melhor Envio sem opções pra esse CEP");
  try {
    await kvSet(cacheKey, JSON.stringify(options), CACHE_SECONDS);
  } catch {
    // Sem banco: segue sem cache.
  }
  return options;
}

async function quoteReal(
  cep: string,
  items: ShippingItem[],
  token: string,
): Promise<ShippingOption[]> {
  const response = await fetch(`${BASE}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      from: { postal_code: ORIGIN_CEP },
      to: { postal_code: cep },
      products: items.map((item, index) => ({
        id: String(index + 1),
        width: item.widthCm,
        height: item.heightCm,
        length: item.lengthCm,
        weight: item.weightKg,
        insurance_value: item.priceCents / 100,
        quantity: item.qty,
      })),
      options: { receipt: false, own_hand: false },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Melhor Envio ${response.status}`);
  const services = (await response.json()) as MeService[];
  return services
    .filter((s) => !s.error && (s.custom_price ?? s.price))
    .filter((s) => isAllowedCarrier(s.company?.name))
    .map((s) => {
      const days = s.custom_delivery_range ?? s.delivery_range ?? { min: 0, max: 0 };
      return {
        id: `me-${s.id}`,
        service: s.name,
        carrier: s.company?.name ?? "Transportadora",
        priceCents: Math.round(Number(s.custom_price ?? s.price) * 100),
        days: { min: days.min, max: days.max },
        source: "melhor-envio" as const,
      };
    })
    .sort((a, b) => a.priceCents - b.priceCents)
    .slice(0, MAX_OPTIONS);
}

/** SIMULADO (sem token, fora de produção): valores fictícios, só pra tela. */
function quoteMock(cep: string, items: ShippingItem[]): ShippingOption[] {
  const weight = items.reduce((sum, item) => sum + item.weightKg * item.qty, 0);
  const distance = Math.min(
    3,
    Math.round(Math.abs(Number(cep[0] ?? 9) - Number(ORIGIN_CEP[0])) / 3),
  );
  const base = 1800 + distance * 450 + Math.round(weight * 300);
  return [
    {
      id: "me-mock-pac",
      service: "PAC (simulado)",
      carrier: "Correios",
      priceCents: base,
      days: { min: 5 + distance, max: 8 + distance },
      source: "melhor-envio",
    },
    {
      id: "me-mock-sedex",
      service: "SEDEX (simulado)",
      carrier: "Correios",
      priceCents: Math.round(base * 1.7),
      days: { min: 2 + Math.ceil(distance / 2), max: 4 + Math.ceil(distance / 2) },
      source: "melhor-envio",
    },
  ];
}

// ── Autorização (OAuth) — gera o MELHOR_ENVIO_TOKEN pelo app da Área Dev ──
// Abrir /api/melhorenvio/connect → autorizar → /callback mostra o token.

export const ME_BASE_URL = "https://melhorenvio.com.br";
// Teste local: o Melhor Envio falso também responde o /oauth/token.
const OAUTH_BASE = process.env.MELHOR_ENVIO_API_URL?.trim() || ME_BASE_URL;
export const ME_USER_AGENT = USER_AGENT;
// Cálculo + compra automática da etiqueta (carrinho → pagar com o saldo →
// gerar → rastreio/impressão). Mudou a lista? Gerar o token de novo.
export const ME_SCOPES = [
  "shipping-calculate",
  "cart-read",
  "cart-write",
  "orders-read",
  "shipping-checkout",
  "shipping-generate",
  "shipping-print",
  "shipping-tracking",
  "shipping-cancel",
  // Só leitura, pro check-up: dados da conta (/me) e saldo (/me/balance).
  "users-read",
  "transactions-read",
];

/** URL de callback — tem que ser IGUAL à cadastrada no app do Melhor Envio.
 * No preview, o endereço fixo da branch (VERCEL_BRANCH_URL, não muda a cada
 * deploy): a autorização começa e termina no mesmo site, senão o `state`
 * (cookie) não confere. O check-up mostra qual é. */
export const REDIRECT_URI =
  process.env.MELHOR_ENVIO_REDIRECT_URI?.trim() ||
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL
    ? `https://${process.env.VERCEL_BRANCH_URL}/api/melhorenvio/callback`
    : "https://fernandito.com.br/api/melhorenvio/callback");

/** Troca o `code` da autorização pelo token de acesso (vale ~30 dias). */
export async function exchangeCode(code: string) {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID?.trim();
  const secret = process.env.MELHOR_ENVIO_SECRET?.trim();
  if (!clientId || !secret) throw new Error("Client ID/Secret não configurados");
  const response = await fetch(`${ME_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": ME_USER_AGENT,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: secret,
      redirect_uri: REDIRECT_URI,
      code,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Melhor Envio ${response.status}: ${await response.text()}`);
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}
