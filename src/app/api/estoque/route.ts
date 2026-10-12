import { STORE } from "@/content/site";
import { FEATURED_PRODUCT } from "@/lib/catalog";
import { blingStock } from "@/lib/bling/orders";

// Estoque público do kit (selo "Restam X unidades"). Só devolve um número,
// nada além disso. Guarda o valor por 60 s em cada instância, então o Bling
// não é chamado a cada visita. Bling fora do ar/desconectado → `remaining:
// null` e o site simplesmente não mostra o selo.

const TTL_MS = 60_000;
const cache = globalThis as unknown as {
  __fernanditoStock?: { at: number; remaining: number | null };
};

export async function GET() {
  if (!STORE.enabled || !FEATURED_PRODUCT)
    return Response.json({ error: "Loja fechada" }, { status: 404 });
  const hit = cache.__fernanditoStock;
  if (hit && Date.now() - hit.at < TTL_MS) return respond(hit.remaining);

  const stock = await blingStock([FEATURED_PRODUCT.sku]);
  const remaining = stock ? Math.max(0, stock.get(FEATURED_PRODUCT.sku) ?? 0) : null;
  cache.__fernanditoStock = { at: Date.now(), remaining };
  return respond(remaining);
}

function respond(remaining: number | null) {
  return Response.json(
    { remaining },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
