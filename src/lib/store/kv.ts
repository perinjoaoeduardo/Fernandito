import "server-only";
import Redis from "ioredis";

/**
 * Banco da loja: Redis por conexão TCP (pacote `ioredis`).
 *
 * Na Vercel: Storage → Redis (ou Marketplace → Upstash/Redis Cloud) →
 * conectar ao projeto. A integração cria UMA variável com a string de
 * conexão completa (usuário, senha, host e porta) — hoje chamada
 * `KV_REDIS_URL` (o prefixo escolhido na instalação pode gerar outro nome;
 * também aceita `REDIS_URL`, o nome mais comum fora da Vercel).
 *
 * Sem essa variável e FORA de produção (local e preview), cai num Map em
 * memória, só pra conseguir ver as telas. Em memória os dados somem quando
 * o servidor reinicia e, na Vercel, não são compartilhados entre
 * instâncias — serve pra olhar, não pra testar de verdade. Em produção sem
 * banco → erro (`StoreUnavailableError`), nunca memória.
 */

const REDIS_URL = process.env.KV_REDIS_URL || process.env.REDIS_URL || "";

export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";
export const HAS_REDIS = Boolean(REDIS_URL);

export class StoreUnavailableError extends Error {
  constructor() {
    super("Banco de pedidos não configurado (KV_REDIS_URL)");
  }
}

// Reaproveita a conexão entre chamadas na mesma instância "quente" da
// função serverless — abrir uma conexão nova a cada chamada seria lento.
const globalRedis = globalThis as unknown as { __fernanditoRedis?: Redis };

function client(): Redis {
  if (!globalRedis.__fernanditoRedis) {
    const redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    redis.on("error", (error) => console.error("[redis] erro de conexão:", error.message));
    // `rediss://` = conexão criptografada (TLS). `redis://` passa os dados
    // dos pedidos sem criptografia pela internet — avisa no log.
    if (REDIS_URL.startsWith("redis://"))
      console.warn("[redis] conexão SEM TLS (redis://): ative TLS no provedor e use rediss://");
    globalRedis.__fernanditoRedis = redis;
  }
  return globalRedis.__fernanditoRedis;
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
  return client().get(key);
}

/** Grava (com validade opcional em segundos). */
export async function kvSet(key: string, value: string, ttlSeconds?: number) {
  if (inMemory()) {
    mem.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    return;
  }
  if (ttlSeconds) await client().set(key, value, "EX", ttlSeconds);
  else await client().set(key, value);
}

/** Grava só se a chave ainda não existe. `true` = gravou (foi o primeiro). */
export async function kvSetNX(key: string, value: string, ttlSeconds: number) {
  if (inMemory()) {
    if (memGet(key) !== null) return false;
    mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  const result = await client().set(key, value, "EX", ttlSeconds, "NX");
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
  const count = await client().incr(key);
  await client().expire(key, windowSeconds);
  return count <= limit;
}

// ── Conjuntos (fila de pedidos a reenviar pro Bling) ───────────────────────

export async function kvSAdd(key: string, member: string) {
  if (inMemory()) {
    const set = new Set<string>(JSON.parse(memGet(key) ?? "[]"));
    set.add(member);
    mem.set(key, { value: JSON.stringify([...set]), expiresAt: null });
    return;
  }
  await client().sadd(key, member);
}

export async function kvSRem(key: string, member: string) {
  if (inMemory()) {
    const set = new Set<string>(JSON.parse(memGet(key) ?? "[]"));
    set.delete(member);
    mem.set(key, { value: JSON.stringify([...set]), expiresAt: null });
    return;
  }
  await client().srem(key, member);
}

export async function kvSMembers(key: string): Promise<string[]> {
  if (inMemory()) return JSON.parse(memGet(key) ?? "[]") as string[];
  return client().smembers(key);
}

export async function kvDel(key: string) {
  if (inMemory()) {
    mem.delete(key);
    return;
  }
  await client().del(key);
}

/** Solta uma trava só se ainda for nossa (mesmo valor) — atômico no Redis. */
export async function kvReleaseLock(key: string, owner: string) {
  if (inMemory()) {
    if (memGet(key) === owner) mem.delete(key);
    return;
  }
  await client().eval(
    'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
    1,
    key,
    owner,
  );
}
