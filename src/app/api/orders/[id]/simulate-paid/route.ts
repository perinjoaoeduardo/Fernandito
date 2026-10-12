import { CAN_SIMULATE_PAYMENT } from "@/lib/mercadopago";
import { markPaid } from "@/lib/store/checkout";
import { errorResponse, guard, json } from "@/lib/store/http";
import { getOrder, saveOrder } from "@/lib/store/orders";

// SÓ TESTE: marca o pedido como pago sem dinheiro nenhum. Existe só fora
// de produção e com Pix simulado ou credencial de teste (`TEST-…`) — no
// site no ar responde 404. Ver CAN_SIMULATE_PAYMENT.
export async function POST(request: Request, ctx: RouteContext<"/api/orders/[id]/simulate-paid">) {
  if (!CAN_SIMULATE_PAYMENT) return json({ error: "Não encontrado" }, 404);
  const blocked = await guard(request, "simulate", 10, 60);
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    console.warn(`[pedido ${id}] pagamento SIMULADO (teste)`);
    // Pagamento de mentira nunca pode virar pedido de verdade no Bling:
    // marca como simulado antes (syncOrderToBling ignora simulados).
    if (!order.simulated) await saveOrder({ ...order, simulated: true });
    await markPaid(id);
    return json({ status: "paid" });
  } catch (error) {
    return errorResponse(error);
  }
}
