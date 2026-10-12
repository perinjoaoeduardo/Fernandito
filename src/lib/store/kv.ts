import "server-only";
import Redis from "ioredis";

/**
 * Banco da loja (pedidos, trava do token do Bling, limites de tentativas…).
 * Dois jeitos de conectar, nesta ordem de preferência:
 *
 * 1. REST por HTTPS (Upstash): sempre criptografado e sem limite de conexões
 *    simultâneas — o certo pra função serverless. Variáveis (a integração
 *    "Upstash" da Vercel cria sozinha): `KV_REST_API_URL` + `KV_REST_API_TOKEN`,
 *    ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Se na
 *    instalação foi escolhido outro prefixo (ex.: `LOJA`), vale qualquer par
 *    `<PREFIXO>_REST_API_URL` + `<PREFIXO>_REST_API_TOKEN`.
 * 2. TCP (`ioredis`): `KV_REDIS_URL` ou `REDIS_URL`. Reserva — funciona, mas
 *    tem limite de conexões e, conforme o provedor, não é criptografado.
 *
 * Sem nenhum dos dois e FORA de produção (local e preview), cai num Map em
 * memória, só pra conseguir ver as telas. Em memória os dados somem quando
 * o servidor reinicia e, na Vercel, não são compartilhados entre
 * instâncias — serve pra olhar, não pra testar de verdade. Em produção sem
 * banco → erro (`StoreUnavailableError`), nunca memória.
 */

type Rest = { url: string; token: string };

/** Acha o par REST nas variáveis de ambiente (qualquer prefixo). */
function findRest(): Rest | null {
  const env = process.env;
  const known = [
    [env.KV_REST_API_URL, env.KV_REST_API_TOKEN],
    [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN],
  ];
  for (const key of Object.keys(env)) {
    const match = /^(.+)_REST_API_URL$/.exec(key);
    if (match) known.push([env[key], env[`${match[1]}_REST_API_TOKEN`]]);
  }
  for (const [url, token] of known) {
    if (url?.trim() && token?.trim())
      return { url: url.trim().replace(/\/+$/, ""), token: token.trim() };
  }
  return null;
}

const REST = findRest();
const REDIS_URL = process.env.KV_REDIS_URL || process.env.REDIS_URL || "";

export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";
export const HAS_REDIS = Boolean(REST || REDIS_URL);

export class StoreUnavailableError extends Error {
  constructor() {
    super("Banco de pedidos não configurado (KV_REST_API_URL + KV_REST_API_TOKEN)");
  }
}

type Command = (string | number)[];

// ── REST (HTTPS) ───────────────────────────────────────────────────────────
async function restPipeline(rest: Rest, commands: Command[]): Promise<unknown[]> {
  const response = await fetch(`${rest.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rest.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
  const data = (await response.json()) as { result?: unknown; error?: string }[];
  return data.map((entry) => {
    if (entry.error) throw new Error(`Redis: ${entry.error}`);
    return entry.result;
  });
}

// ── TCP (ioredis) ──────────────────────────────────────────────────────────
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
      console.warn("[redis] conexão SEM TLS (redis://): use o Upstash (REST/HTTPS) ou rediss://");
    globalRedis.__fernanditoRedis = redis;
  }
  return globalRedis.__fernanditoRedis;
}

async function tcpPipeline(commands: Command[]): Promise<unknown[]> {
  const pipeline = client().pipeline();
  for (const [name, ...args] of commands) pipeline.call(String(name), ...args.map(String));
  const results = await pipeline.exec();
  return (results ?? []).map(([error, result]) => {
    if (error) throw error;
    return result;
  });
}

/** Roda os comandos (numa viagem só) pelo caminho configurado. */
function run(commands: Command[]): Promise<unknown[]> {
  return REST ? restPipeline(REST, commands) : tcpPipeline(commands);
}

// ── Memória (só fora de produção, sem banco) ───────────────────────────────
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
  const [value] = await run([["GET", key]]);
  return (value as string | null) ?? null;
}

/** Grava (com validade opcional em segundos). */
export async function kvSet(key: string, value: string, ttlSeconds?: number) {
  if (inMemory()) {
    mem.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    return;
  }
  await run([ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value]]);
}

/** Grava só se a chave ainda não existe. `true` = gravou (foi o primeiro). */
export async function kvSetNX(key: string, value: string, ttlSeconds: number) {
  if (inMemory()) {
    if (memGet(key) !== null) return false;
    mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  const [result] = await run([["SET", key, value, "EX", ttlSeconds, "NX"]]);
  return result === "OK";
}

// Conta e define a validade num comando só (1 comando = mais barato e sem
// janela entre os dois). A validade é posta só na 1ª chamada da janela.
const RATE_SCRIPT =
  'local c = redis.call("INCR", KEYS[1]) if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end return c';

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
  const [count] = await run([["EVAL", RATE_SCRIPT, 1, key, windowSeconds]]);
  return Number(count) <= limit;
}

// ── Conjuntos (fila de pedidos a reenviar pro Bling) ───────────────────────

export async function kvSAdd(key: string, member: string) {
  if (inMemory()) {
    const set = new Set<string>(JSON.parse(memGet(key) ?? "[]"));
    set.add(member);
    mem.set(key, { value: JSON.stringify([...set]), expiresAt: null });
    return;
  }
  await run([["SADD", key, member]]);
}

export async function kvSRem(key: string, member: string) {
  if (inMemory()) {
    const set = new Set<string>(JSON.parse(memGet(key) ?? "[]"));
    set.delete(member);
    mem.set(key, { value: JSON.stringify([...set]), expiresAt: null });
    return;
  }
  await run([["SREM", key, member]]);
}

export async function kvSMembers(key: string): Promise<string[]> {
  if (inMemory()) return JSON.parse(memGet(key) ?? "[]") as string[];
  const [members] = await run([["SMEMBERS", key]]);
  return (members as string[] | null) ?? [];
}

export async function kvDel(key: string) {
  if (inMemory()) {
    mem.delete(key);
    return;
  }
  await run([["DEL", key]]);
}

/** Solta uma trava só se ainda for nossa (mesmo valor) — atômico no Redis. */
export async function kvReleaseLock(key: string, owner: string) {
  if (inMemory()) {
    if (memGet(key) === owner) mem.delete(key);
    return;
  }
  await run([
    [
      "EVAL",
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
      1,
      key,
      owner,
    ],
  ]);
}
