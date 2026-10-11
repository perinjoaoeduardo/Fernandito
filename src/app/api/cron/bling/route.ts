import { isBlingConnected, refreshTokens } from "@/lib/bling/client";
import { retryPendingBlingOrders } from "@/lib/bling/orders";

// Cron diário (vercel.json): renova o token do Bling (o refresh token vence
// se ficar sem uso) e reenvia pedidos pagos que falharam. A Vercel manda
// `Authorization: Bearer <CRON_SECRET>`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
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
