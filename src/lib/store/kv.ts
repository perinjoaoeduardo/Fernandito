import "server-only";

/**
 * Banco da loja: Upstash Redis pela API REST (sem SDK — é só `fetch`).
 *
 * Na Vercel: Storage/Marketplace → Upstash for Redis → conectar ao projeto.
 * A integração cria `KV_REST_API_URL` / `KV_REST_API_TOKEN` (ou
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, se criado direto
 * no Upstash) — os dois pares funcionam.
 *
 * Sem essas variáveis e FORA de produção (local e preview), cai num Map em
 * memória, só pra conseguir ver as telas. Em memória os dados somem quando
 * o servidor reinicia e, na Vercel, não são compartilhados entre
 * instâncias — serve pra olhar, não pra testar de verdade. Em produção sem
 * banco → erro (`StoreUnavailableError`), nunca memória.
 */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";
export const HAS_REDIS = Boolean(URL_ && TOKEN);

export class StoreUnavailableError extends Error {
  constructor() {
    super("Banco de pedidos não configurado (KV_REST_API_URL / KV_REST_API_TOKEN)");
  }
}

type Command = (string | number)[];

async function redis<T>(commands: Command[]): Promise<T[]> {
  const response = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
  const data = (await response.json()) as { result?: T; error?: string }[];
  return data.map((entry) => {
    if (entry.error) throw new Error(`Redis: ${entry.error}`);
    return entry.result as T;
  });
}

// ── Memória (só fora de produção, sem Redis) ───────────────────────────────
type MemEntry = { value: string; expiresAt: number | null };
const globalMem = globalThis as unknown as { __fernanditoKv?: Map<string, MemEntry> };
const mem = (globalMem.__fernanditoKv ??= new Map());

function memGet(key: string) {
  const entry = mem.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
    mem.delete(key);
    return null;
  }
  return entry.value;
}

function inMemory() {
  if (HAS_REDIS) return false;
  if (IS_PRODUCTION) throw new StoreUnavailableError();
  return true;
}

// ── API mínima usada pela loja ─────────────────────────────────────────────

export async function kvGet(key: string): Promise<string | null> {
  if (inMemory()) return memGet(key);
  const [value] = await redis<string | null>([["GET", key]]);
  return value;
}

/** Grava (com validade opcional em segundos). */
export async function kvSet(key: string, value: string, ttlSeconds?: number) {
  if (inMemory()) {
    mem.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    return;
  }
  await redis([ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value]]);
}

/** Grava só se a chave ainda não existe. `true` = gravou (foi o primeiro). */
export async function kvSetNX(key: string, value: string, ttlSeconds: number) {
  if (inMemory()) {
    if (memGet(key) !== null) return false;
    mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  const [result] = await redis<string | null>([["SET", key, value, "NX", "EX", ttlSeconds]]);
  return result === "OK";
}

/**
 * Rate limit por janela fixa: no máximo `limit` chamadas por `windowSeconds`
 * pra cada `id` (normalmente o IP). `true` = pode seguir.
 */
export async function rateLimit(bucket: string, id: string, limit: number, windowSeconds: number) {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${bucket}:${id}:${window}`;
  if (inMemory()) {
    const count = Number(memGet(key) ?? 0) + 1;
    mem.set(key, { value: String(count), expiresAt: Date.now() + windowSeconds * 1000 });
    return count <= limit;
  }
  const [count] = await redis<number>([
    ["INCR", key],
    ["EXPIRE", key, windowSeconds],
  ]);
  return count <= limit;
}
