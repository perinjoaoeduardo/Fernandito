import { after } from "next/server";
import { housekeeping, refreshOrder } from "@/lib/store/checkout";
import { errorResponse, guard, json } from "@/lib/store/http";
import { getOrder } from "@/lib/store/orders";

// Polling da tela do Pix (~4s). Devolve só o status (+ expiração).
export async function GET(request: Request, ctx: RouteContext<"/api/orders/[id]/status">) {
  const blocked = await guard(request, "status", 60, 60);
  if (blocked) return blocked;
  // Depois da resposta: confere Pix abertos e reenvia o que falhou no Bling.
  after(housekeeping);
  try {
    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    const current = await refreshOrder(order);
    return json({ status: current.status, expiresAt: current.pix?.expiresAt ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
