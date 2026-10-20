import { timingSafeEqual } from "node:crypto";
import { isBlingConnected, refreshTokens } from "@/lib/bling/client";
import { retryPendingBlingOrders } from "@/lib/bling/orders";
import { reconcileOpenOrders } from "@/lib/store/checkout";
import { advanceAllFulfillments } from "@/lib/store/fulfillment";
import { isAdmin } from "@/lib/leads";
import { meToken } from "@/lib/melhor-envio";

// Cron diário (vercel.json): confere no Mercado Pago os Pix abertos, renova
// o token do Bling (o refresh token vence se ficar sem uso) e reenvia
// pedidos pagos que falharam. A Vercel manda
// `Authorization: Bearer <CRON_SECRET>`. Pra rodar à mão (ensaio, preview —
// lá a Vercel não agenda nada): /api/cron/bling?key=<BLING_ADMIN_KEY>.
function authorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  const manual = isAdmin(new URL(request.url).searchParams.get("key"));
  if (!manual && !authorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return new Response("Não autorizado", { status: 401 });
  // Renova o token do Melhor Envio se estiver perto de vencer.
  await meToken().catch(() => "");
  const reconciled = await reconcileOpenOrders().catch((error: Error) => {
    console.error("[cron] conferência de Pix falhou:", error.message);
    return [];
  });
  if (!(await isBlingConnected())) return Response.json({ connected: false, reconciled });
  try {
    await refreshTokens(true);
  } catch (error) {
    console.error("[cron bling] renovação falhou:", (error as Error).message);
  }
  const retried = await retryPendingBlingOrders();
  const shipping = await advanceAllFulfillments().catch((error: Error) => error.message);
  return Response.json({ connected: true, reconciled, retried, shipping });
}
