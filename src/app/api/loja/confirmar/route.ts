import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/leads";
import { markPaid, MANUAL_SET } from "@/lib/store/checkout";
import { kvSRem } from "@/lib/store/kv";
import { getOrder, saveOrder } from "@/lib/store/orders";
import { releaseStock } from "@/lib/store/stock";

/**
 * Plano B (Pix na chave da conta): depois de ver o comprovante E o dinheiro
 * na conta, confirmar o pedido:
 *   /api/loja/confirmar?key=<BLING_ADMIN_KEY>&pedido=<id>&acao=pago
 * → vira PAGO e segue pro Bling como qualquer pedido. Desistiu/não pagou:
 *   &acao=cancelar → cancela e devolve as unidades pro estoque.
 * Só vale pra pedidos "manual" (os do Mercado Pago se confirmam sozinhos).
 *
 * Pedido de TESTE já pago (ensaio geral): &acao=estornar → devolve a unidade
 * pro estoque do site e tira o pedido da fila de nota/etiqueta. O pedido
 * continua "pago" no registro (o marcador de pago nunca volta atrás).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isAdmin(params.get("key"))) return new Response("Não encontrado", { status: 404 });
  const id = params.get("pedido") ?? "";
  const action = params.get("acao");
  const order = await getOrder(id);
  if (!order) return Response.json({ erro: "Pedido não encontrado" }, { status: 404 });
  if (action === "estornar") {
    if (order.status !== "paid")
      return Response.json({ erro: `Só pedido pago (está "${order.status}")` }, { status: 409 });
    await releaseStock(order.id);
    await kvSRem("fulfill:queue", order.id);
    return Response.json({ ok: true, pedido: order.id, estoque: "devolvido", fila: "removido" });
  }
  if (order.status !== "manual")
    return Response.json(
      { erro: `Esse pedido não é Pix manual (está "${order.status}")` },
      { status: 409 },
    );

  if (action === "pago") {
    const paid = await markPaid(order.id);
    return Response.json({ ok: true, pedido: order.id, status: paid?.status });
  }
  if (action === "cancelar") {
    await saveOrder({ ...order, status: "cancelled" });
    await releaseStock(order.id);
    await kvSRem(MANUAL_SET, order.id);
    return Response.json({ ok: true, pedido: order.id, status: "cancelled" });
  }
  return Response.json({
    pedido: order.id,
    nome: order.customer.name,
    totalReais: order.totalCents / 100,
    criadoEm: order.createdAt,
    comoConfirmar: "adicionar &acao=pago (dinheiro conferido na conta) ou &acao=cancelar",
  });
}
