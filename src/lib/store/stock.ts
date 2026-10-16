import "server-only";
import { getProduct } from "@/lib/catalog";
import { IS_PRODUCTION, kvEval, kvGet, kvSet } from "@/lib/store/kv";
import { raiseAlert } from "@/lib/store/orders";

/**
 * Trava de estoque do PRÓPRIO site, que não depende do Bling.
 *
 * Cada produto com `stockCap` (catálogo) tem um contador no Redis,
 * `stock:held:<sku>` = unidades em Pix aberto + vendidas. Gerar o Pix
 * RESERVA as unidades (atômico: duas pessoas comprando a última unidade ao
 * mesmo tempo → só uma consegue); Pix vencido/cancelado DEVOLVE. Pago fica.
 * O contador nunca passa do teto. Cada pedido guarda o que reservou em
 * `stock:hold:<id>` ("sku:qtd,..." ou "released"), então reservar/devolver
 * duas vezes não conta em dobro.
 */

type Line = { sku: string; qty: number };

// Preview e produção podem usar o mesmo banco: o teste nunca gasta o
// estoque de verdade.
const ENV = IS_PRODUCTION ? "" : "preview:";
const counter = (sku: string) => `stock:held:${ENV}${sku}`;
const holdKey = (orderId: string) => `stock:hold:${orderId}`;
const HOLD_TTL = 60 * 60 * 24 * 400;

const encode = (lines: Line[]) => lines.map((l) => `${l.sku}:${l.qty}`).join(",");
function decode(value: string): Line[] {
  return value
    .split(",")
    .filter(Boolean)
    .map((part) => {
      const [sku, qty] = part.split(":");
      return { sku, qty: Number(qty) };
    });
}

// Só os produtos com teto entram na conta.
function capped(lines: Line[]) {
  return lines
    .map((l) => ({ ...l, cap: getProduct(l.sku)?.stockCap ?? null }))
    .filter((l): l is Line & { cap: number } => l.cap !== null);
}

// KEYS: contadores..., hold. ARGV: qtds..., tetos..., valor do hold, força (1/0), ttl.
// Retorno: 1 reservou · 0 já estava reservado · -i faltou o item i.
const RESERVE = `
local n = #KEYS - 1
local hold = KEYS[#KEYS]
local current = redis.call("GET", hold)
if current and current ~= "released" then return 0 end
local force = ARGV[2*n + 2] == "1"
if not force then
  for i = 1, n do
    local held = tonumber(redis.call("GET", KEYS[i]) or "0")
    if held + tonumber(ARGV[i]) > tonumber(ARGV[n + i]) then return -i end
  end
end
for i = 1, n do redis.call("INCRBY", KEYS[i], ARGV[i]) end
redis.call("SET", hold, ARGV[2*n + 1], "EX", ARGV[2*n + 3])
return 1`;

// KEYS: hold, contadores... ARGV: qtds... · devolve 1 se devolveu.
const RELEASE = `
local current = redis.call("GET", KEYS[1])
if not current or current == "released" then return 0 end
for i = 2, #KEYS do
  local left = redis.call("DECRBY", KEYS[i], ARGV[i - 1])
  if left < 0 then redis.call("SET", KEYS[i], 0) end
end
redis.call("SET", KEYS[1], "released", "KEEPTTL")
return 1`;

export class OutOfStockError extends Error {
  constructor(
    public sku: string,
    public remaining: number,
  ) {
    super(`Sem estoque de ${sku} (restam ${remaining})`);
  }
}

/** Unidades ainda livres de um SKU com teto (`null` = sem teto). */
export async function stockRemaining(sku: string): Promise<number | null> {
  const cap = getProduct(sku)?.stockCap ?? null;
  if (cap === null) return null;
  const held = Number((await kvGet(counter(sku))) ?? 0);
  return Math.max(0, cap - held);
}

/**
 * Reserva as unidades do pedido (antes de gerar o Pix). Sem estoque →
 * `OutOfStockError`. `force` (pagamento que chegou depois do Pix vencer):
 * reserva mesmo passando do teto — o dinheiro já entrou — e gera alerta.
 */
export async function reserveStock(orderId: string, items: Line[], force = false) {
  const lines = capped(items);
  if (!lines.length) return;
  const keys = [...lines.map((l) => counter(l.sku)), holdKey(orderId)];
  const args = [
    ...lines.map((l) => l.qty),
    ...lines.map((l) => l.cap),
    encode(lines),
    force ? "1" : "0",
    HOLD_TTL,
  ];
  let result = await kvEval(RESERVE, keys, args);
  if (result === null) result = await reserveInMemory(orderId, lines, force);
  const code = Number(result);
  if (code < 0) {
    const line = lines[-code - 1];
    throw new OutOfStockError(line.sku, (await stockRemaining(line.sku)) ?? 0);
  }
  if (force && code === 1)
    for (const line of lines) {
      const left = await stockRemaining(line.sku);
      if (left === 0)
        await raiseAlert(
          orderId,
          `pago depois de vencer: estoque de ${line.sku} pode ter passado do teto`,
        );
    }
}

/** Devolve o que o pedido reservou (Pix vencido/cancelado). Repetir não conta em dobro. */
export async function releaseStock(orderId: string) {
  const hold = await kvGet(holdKey(orderId));
  if (!hold || hold === "released") return;
  const lines = decode(hold);
  const result = await kvEval(
    RELEASE,
    [holdKey(orderId), ...lines.map((l) => counter(l.sku))],
    lines.map((l) => l.qty),
  );
  if (result === null) {
    for (const line of lines) {
      const held = Number((await kvGet(counter(line.sku))) ?? 0);
      await kvSet(counter(line.sku), String(Math.max(0, held - line.qty)));
    }
    await kvSet(holdKey(orderId), "released", HOLD_TTL);
  }
}

// Sem Redis (só local/preview): mesma regra, sem atomicidade.
async function reserveInMemory(orderId: string, lines: (Line & { cap: number })[], force: boolean) {
  const current = await kvGet(holdKey(orderId));
  if (current && current !== "released") return 0;
  if (!force)
    for (const [i, line] of lines.entries()) {
      const held = Number((await kvGet(counter(line.sku))) ?? 0);
      if (held + line.qty > line.cap) return -(i + 1);
    }
  for (const line of lines) {
    const held = Number((await kvGet(counter(line.sku))) ?? 0);
    await kvSet(counter(line.sku), String(held + line.qty));
  }
  await kvSet(holdKey(orderId), encode(lines), HOLD_TTL);
  return 1;
}
