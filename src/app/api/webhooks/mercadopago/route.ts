import { after, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/mercadopago";
import { housekeeping, syncPayment } from "@/lib/store/checkout";
import { json } from "@/lib/store/http";

/**
 * Webhook do Mercado Pago (confirmação oficial do pagamento).
 * 1. Valida o x-signature com MERCADOPAGO_WEBHOOK_SECRET — inválido → 401.
 * 2. Busca o pagamento NA API (nunca confia no corpo) e, se aprovado,
 *    marca o pedido como pago. Idempotente: repetir o evento não duplica
 *    nada (markPaid só muda uma vez e onOrderPaid roda uma vez só).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    type?: string;
    action?: string;
    data?: { id?: string | number };
  } | null;
  const params = request.nextUrl.searchParams;
  const dataId = params.get("data.id") ?? (body?.data?.id != null ? String(body.data.id) : null);
  const type = params.get("type") ?? body?.type ?? "";

  const valid = verifyWebhookSignature({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
  });
  // Depois da resposta: confere Pix abertos e reenvia o que falhou no Bling.
  after(housekeeping);

  if (!valid) {
    console.warn("[webhook mp] assinatura inválida");
    return json({ error: "assinatura inválida" }, 401);
  }

  // Só interessa pagamento (API atual) ou order (API nova); o resto
  // (merchant_order etc.) é ignorado com 200.
  if ((type !== "payment" && type !== "order") || !dataId) return json({ ok: true });

  try {
    const order = await syncPayment(dataId);
    console.info(
      `[webhook mp] pagamento ${dataId} → pedido ${order?.id ?? "?"} (${order?.status ?? "-"})`,
    );
    return json({ ok: true });
  } catch (error) {
    // 5xx: o Mercado Pago tenta de novo mais tarde.
    console.error("[webhook mp] erro:", (error as Error).message);
    return json({ error: "erro ao processar" }, 500);
  }
}
