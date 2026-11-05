import { STORE } from "@/content/site";
import { ACTIVE_PRODUCTS } from "@/lib/catalog";
import { blingStock } from "@/lib/bling/orders";
import { stockRemaining } from "@/lib/store/stock";
import { ESPECIAL, ESPECIAL_SKU, hasEspecialCookie } from "@/lib/especial";

// Estoque público de cada produto ativo: `remaining` (selo "Restam X",
// `null` = não mostrar) e `soldOut` (mostra "Esgotado" e trava a compra).
// Vale o MENOR entre o teto do próprio site (catálogo, contado no Redis) e o
// saldo do Bling. No topo: `soldOut` = TODOS esgotados (menu, faixa e botões
// gerais da loja) e `remaining` = o do produto em destaque (compatível com a
// versão de um produto só). Guarda por 15 s em cada instância. Se nada
// responder, não trava a venda — o servidor confere de novo ao gerar o Pix.
//
// Link especial (src/lib/especial.ts): o navegador pede com `?especial=1` e,
// com o cookie certo, o kit vem do lote separado (sem cache, então o cache
// público nunca mistura).

type Stock = { remaining: number | null; soldOut: boolean };
const TTL_MS = 15_000;
const cache = globalThis as unknown as {
  __fernanditoStock?: { at: number; produtos: Record<string, Stock> };
};

export async function GET(request: Request) {
  if (!STORE.enabled || !ACTIVE_PRODUCTS.length)
    return Response.json({ error: "Loja fechada" }, { status: 404 });
  const especial =
    new URL(request.url).searchParams.has("especial") &&
    hasEspecialCookie(request.headers.get("cookie"));
  const hit = cache.__fernanditoStock;
  if (!especial && hit && Date.now() - hit.at < TTL_MS) return respond(hit.produtos, false);

  const skus = ACTIVE_PRODUCTS.map((p) => p.sku);
  const counterOf = (sku: string) => (especial && sku === ESPECIAL.sku ? ESPECIAL_SKU : sku);
  const [own, bling] = await Promise.all([
    Promise.all(skus.map((sku) => stockRemaining(counterOf(sku)).catch(() => null))),
    blingStock(skus).catch(() => null),
  ]);
  const produtos: Record<string, Stock> = {};
  skus.forEach((sku, i) => {
    const fromBling = bling ? Math.max(0, bling.get(sku) ?? 0) : null;
    const known = [own[i], fromBling].filter((n): n is number => n !== null);
    const remaining = known.length ? Math.min(...known) : null;
    produtos[sku] = { remaining, soldOut: remaining === 0 };
  });
  if (!especial) cache.__fernanditoStock = { at: Date.now(), produtos };
  return respond(produtos, especial);
}

function respond(produtos: Record<string, Stock>, especial: boolean) {
  const first = produtos[ACTIVE_PRODUCTS[0].sku];
  const all = Object.values(produtos);
  return Response.json(
    {
      remaining: first?.remaining ?? null,
      soldOut: all.length > 0 && all.every((s) => s.soldOut),
      produtos,
      ...(especial ? { especial: true } : {}),
    },
    {
      headers: {
        "Cache-Control": especial
          ? "private, no-store"
          : "public, s-maxage=15, stale-while-revalidate=30",
      },
    },
  );
}
