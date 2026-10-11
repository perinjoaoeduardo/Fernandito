import { orderSchema } from "@/lib/order";
import { createPixOrder } from "@/lib/store/checkout";
import { errorResponse, guard, json } from "@/lib/store/http";
import { publicOrder } from "@/lib/store/orders";

// Cria o pedido + Pix. O corpo é o pedido do checkout; tudo é validado
// (zod) e recalculado no servidor — ver src/lib/store/checkout.ts.
export async function POST(request: Request) {
  const blocked = await guard(request, "pix", 8, 10 * 60);
  if (blocked) return blocked;

  const idempotencyKey = request.headers.get("x-idempotency-key") ?? "";
  if (!/^[\w-]{16,64}$/.test(idempotencyKey)) return json({ error: "Requisição inválida" }, 400);

  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Dados do pedido inválidos", code: "invalid" }, 400);

  try {
    const order = await createPixOrder(parsed.data, idempotencyKey);
    return json({ order: publicOrder(order) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
