import { refreshOrder, renewOrder, syncPayment } from "@/lib/store/checkout";
import { errorResponse, guard, json } from "@/lib/store/http";
import { getOrder } from "@/lib/store/orders";

// Pix expirou → "Gerar novo Pix": novo pedido com os mesmos dados.
export async function POST(request: Request, ctx: RouteContext<"/api/orders/[id]/renew">) {
  const blocked = await guard(request, "pix", 8, 10 * 60);
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const stored = await getOrder(id);
    if (!stored) return json({ error: "Pedido não encontrado" }, 404);
    // Confere no Mercado Pago uma última vez antes de gerar outro Pix — se
    // pagou no último segundo, não cobra duas vezes.
    // (Pedido já marcado como vencido também: o banco pode ter confirmado
    // depois.) Sem conseguir conferir → não gera outro Pix agora.
    let order = await refreshOrder(stored);
    if (
      order.status !== "paid" &&
      order.status !== "pending" &&
      order.mpPaymentId &&
      !order.simulated
    ) {
      try {
        order = (await syncPayment(order.mpPaymentId)) ?? order;
      } catch {
        return json(
          { error: "Ainda estamos conferindo o pagamento. Tenta de novo em instantes." },
          409,
        );
      }
    }
    if (order.status === "paid") return json({ id: order.id, status: "paid" });
    if (order.status === "pending")
      return json(
        { error: "Ainda estamos conferindo o pagamento. Tenta de novo em instantes." },
        409,
      );
    const fresh = await renewOrder(order);
    return json({ id: fresh.id }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
