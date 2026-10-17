import "server-only";
import { createHash } from "node:crypto";
import type { ShippingItem, ShippingOption } from "@/lib/shipping";
import { IS_PRODUCTION, kvGet, kvSet } from "@/lib/store/kv";

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

export const TOKEN = process.env.MELHOR_ENVIO_TOKEN?.trim() || "";
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
/** Transportadoras que aparecem no checkout (nome da empresa no Melhor Envio).
 * Só Jadlog: postagem num ponto só (agência escolhida no painel do Melhor Envio). */
export const ALLOWED_CARRIERS = ["Jadlog"];
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
  const cacheKey = `frete:${createHash("sha1")
    .update(JSON.stringify({ cep, items, origin: ORIGIN_CEP, real: Boolean(TOKEN) }))
    .digest("hex")}`;
  try {
    const cached = await kvGet(cacheKey);
    if (cached) return JSON.parse(cached) as ShippingOption[];
  } catch {
    // Sem banco: cota de novo.
  }

  let options: ShippingOption[];
  if (TOKEN) options = await quoteReal(cep, items);
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

async function quoteReal(cep: string, items: ShippingItem[]): Promise<ShippingOption[]> {
  const response = await fetch(`${BASE}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
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
    .filter((s) =>
      ALLOWED_CARRIERS.some((c) => c.toLowerCase() === s.company?.name?.trim().toLowerCase()),
    )
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
];

/** URL de callback — tem que ser IGUAL à cadastrada no app do Melhor Envio. */
export const REDIRECT_URI =
  process.env.MELHOR_ENVIO_REDIRECT_URI?.trim() ||
  "https://fernandito.com.br/api/melhorenvio/callback";

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
