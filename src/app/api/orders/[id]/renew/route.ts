import { renewOrder } from "@/lib/store/checkout";
import { errorResponse, guard, json } from "@/lib/store/http";
import { getOrder } from "@/lib/store/orders";

// Pix expirou → "Gerar novo Pix": novo pedido com os mesmos dados.
export async function POST(request: Request, ctx: RouteContext<"/api/orders/[id]/renew">) {
  const blocked = await guard(request, "pix", 8, 10 * 60);
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    if (order.status === "paid") return json({ id: order.id, status: "paid" });
    if (order.status === "pending") return json({ error: "Este Pix ainda está valendo" }, 409);
    const fresh = await renewOrder(order);
    return json({ id: fresh.id }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
