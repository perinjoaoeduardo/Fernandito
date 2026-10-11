import "server-only";
import { kvDel, kvGet, kvSet, kvSetNX } from "@/lib/store/kv";

/**
 * Cliente da API v3 do Bling (OAuth 2) — SÓ NO SERVIDOR.
 *
 * Variáveis (Vercel → Settings → Environment Variables):
 * - `BLING_CLIENT_ID` / `BLING_CLIENT_SECRET`: do aplicativo criado na
 *   Central de Extensões do Bling (Área do integrador → Criar aplicativo).
 *   No app, "Link de redirecionamento" = https://fernandito.com.br/api/bling/callback
 * - `BLING_ADMIN_KEY`: uma senha qualquer, longa — protege /api/bling/connect.
 *
 * Conectar (uma vez): abrir
 *   https://fernandito.com.br/api/bling/connect?key=<BLING_ADMIN_KEY>
 * → autorizar no Bling → volta pro callback, que guarda os tokens no Redis.
 *
 * Tokens: o de acesso dura ~6h e é renovado sozinho com o refresh token
 * (que muda a cada renovação — por isso fica no Redis, nunca em variável).
 * O cron diário (/api/cron/bling) renova mesmo sem vendas, pro refresh token
 * não vencer. Produção e preview precisam usar o MESMO Redis.
 */

const OAUTH_AUTHORIZE = "https://www.bling.com.br/Api/v3/oauth/authorize";
// `BLING_API_URL` só pra teste local (um Bling falso); em produção, vazio.
const API = process.env.BLING_API_URL?.trim() || "https://api.bling.com.br/Api/v3";
const OAUTH_TOKEN = `${API}/oauth/token`;

const CLIENT_ID = process.env.BLING_CLIENT_ID?.trim() || "";
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET?.trim() || "";
export const BLING_ADMIN_KEY = process.env.BLING_ADMIN_KEY?.trim() || "";
export const BLING_CONFIGURED = Boolean(CLIENT_ID && CLIENT_SECRET);

const TOKENS_KEY = "bling:tokens";

type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };

export class BlingError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

export class BlingNotConnectedError extends BlingError {
  constructor() {
    super("Bling não conectado (abrir /api/bling/connect)");
  }
}

/** Link pra autorizar o app no Bling (o `state` volta no callback). */
export async function authorizeUrl() {
  const state = crypto.randomUUID();
  await kvSet(`bling:state:${state}`, "1", 10 * 60);
  const params = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, state });
  return `${OAUTH_AUTHORIZE}?${params}`;
}

export async function consumeState(state: string) {
  if (!/^[\w-]{10,64}$/.test(state)) return false;
  const ok = (await kvGet(`bling:state:${state}`)) !== null;
  if (ok) await kvDel(`bling:state:${state}`);
  return ok;
}

async function requestTokens(body: Record<string, string>): Promise<Tokens> {
  const response = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "1.0",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: { description?: string } | string;
  } | null;
  if (!response.ok || !data?.access_token || !data.refresh_token) {
    const detail = typeof data?.error === "string" ? data.error : data?.error?.description;
    throw new BlingError(
      `OAuth Bling ${response.status}: ${detail ?? "sem detalhes"}`,
      response.status,
    );
  }
  const tokens: Tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // Renova 5 min antes de vencer.
    expiresAt: Date.now() + ((data.expires_in ?? 21600) - 300) * 1000,
  };
  await kvSet(TOKENS_KEY, JSON.stringify(tokens));
  return tokens;
}

/** Callback do OAuth: troca o `code` pelos tokens e guarda. */
export function exchangeCode(code: string) {
  return requestTokens({ grant_type: "authorization_code", code });
}

async function readTokens(): Promise<Tokens | null> {
  const raw = await kvGet(TOKENS_KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export async function isBlingConnected() {
  return BLING_CONFIGURED && (await readTokens()) !== null;
}

/** Renova com o refresh token (com trava, pra duas renovações não brigarem). */
export async function refreshTokens(force = false): Promise<Tokens> {
  const current = await readTokens();
  if (!current) throw new BlingNotConnectedError();
  if (!force && current.expiresAt > Date.now()) return current;
  if (!(await kvSetNX("bling:refresh-lock", "1", 30))) {
    // Outra requisição está renovando: espera e lê o resultado dela.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const fresh = await readTokens();
    if (fresh && fresh.expiresAt > Date.now()) return fresh;
    throw new BlingError("Renovação do token do Bling em andamento");
  }
  try {
    return await requestTokens({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
    });
  } finally {
    await kvDel("bling:refresh-lock");
  }
}

/**
 * Chamada autenticada à API. Token vencido/recusado → renova e tenta 1x.
 * O Bling limita ~3 req/s; a loja faz poucas chamadas por pedido.
 */
export async function bling<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  retried = false,
): Promise<T> {
  if (!BLING_CONFIGURED) throw new BlingNotConnectedError();
  const tokens = await refreshTokens();
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (response.status === 401 && !retried) {
    await refreshTokens(true);
    return bling<T>(path, init, true);
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const error = (data as { error?: { description?: string; fields?: { msg?: string }[] } })
      ?.error;
    const fields = error?.fields
      ?.map((f) => f.msg)
      .filter(Boolean)
      .join("; ");
    throw new BlingError(
      `Bling ${response.status} em ${path}: ${error?.description ?? "erro"}${fields ? ` (${fields})` : ""}`,
      response.status,
    );
  }
  return data as T;
}
