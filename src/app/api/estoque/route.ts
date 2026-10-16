import { STORE } from "@/content/site";
import { FEATURED_PRODUCT } from "@/lib/catalog";
import { blingStock } from "@/lib/bling/orders";
import { stockRemaining } from "@/lib/store/stock";

// Estoque público do kit: `remaining` (selo "Restam X", `null` = não
// mostrar) e `soldOut` (site mostra "Esgotado" e trava a compra). Vale o
// MENOR entre o teto do próprio site (catálogo, contado no Redis) e o saldo
// do Bling. Guarda por 15 s em cada instância. Se nada responder, não
// trava a venda — o servidor confere de novo na hora de gerar o Pix.

const TTL_MS = 15_000;
const cache = globalThis as unknown as {
  __fernanditoStock?: { at: number; remaining: number | null };
};

export async function GET() {
  if (!STORE.enabled || !FEATURED_PRODUCT)
    return Response.json({ error: "Loja fechada" }, { status: 404 });
  const hit = cache.__fernanditoStock;
  if (hit && Date.now() - hit.at < TTL_MS) return respond(hit.remaining);

  const sku = FEATURED_PRODUCT.sku;
  const [own, bling] = await Promise.all([
    stockRemaining(sku).catch(() => null),
    blingStock([sku]).then((stock) => (stock ? Math.max(0, stock.get(sku) ?? 0) : null)),
  ]);
  const known = [own, bling].filter((n): n is number => n !== null);
  const remaining = known.length ? Math.min(...known) : null;
  cache.__fernanditoStock = { at: Date.now(), remaining };
  return respond(remaining);
}

function respond(remaining: number | null) {
  return Response.json(
    { remaining, soldOut: remaining === 0 },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
  );
}
