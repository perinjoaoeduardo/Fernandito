import { timingSafeEqual } from "node:crypto";
import { isBlingConnected, refreshTokens } from "@/lib/bling/client";
import { retryPendingBlingOrders } from "@/lib/bling/orders";

// Cron diário (vercel.json): renova o token do Bling (o refresh token vence
// se ficar sem uso) e reenvia pedidos pagos que falharam. A Vercel manda
// `Authorization: Bearer <CRON_SECRET>`.
function authorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return new Response("Não autorizado", { status: 401 });
  if (!(await isBlingConnected())) return Response.json({ connected: false });
  try {
    await refreshTokens(true);
  } catch (error) {
    console.error("[cron bling] renovação falhou:", (error as Error).message);
  }
  const retried = await retryPendingBlingOrders();
  return Response.json({ connected: true, retried });
}
