import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { advanceFulfillment } from "@/lib/store/fulfillment";

/**
 * Aviso do Melhor Envio (etiqueta paga, gerada, postada, entregue…).
 * Cadastrar no app "Fernandito" da Área Dev: URL
 * https://fernandito.com.br/api/melhorenvio/webhook. Valida o
 * `X-ME-Signature` (HMAC-SHA256 do corpo com o MELHOR_ENVIO_SECRET, em
 * base64) e só usa o aviso pra saber QUAL pedido conferir — o estado real é
 * sempre lido de novo na API do Melhor Envio.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.MELHOR_ENVIO_SECRET?.trim() || "";
  const signature = request.headers.get("x-me-signature") ?? "";
  const expected = secret ? createHmac("sha256", secret).update(raw).digest("base64") : "";
  const ok =
    Boolean(secret && signature) &&
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!ok) return Response.json({ error: "assinatura inválida" }, { status: 401 });

  const body = JSON.parse(raw || "{}") as {
    event?: string;
    data?: { id?: string; tags?: { tag?: string }[] };
  };
  const orderId = body.data?.tags?.map((t) => t.tag).find((t) => t && /^[\w-]{6,40}$/.test(t));
  console.info(
    `[webhook me] ${body.event ?? "?"} · envio ${body.data?.id ?? "?"} · pedido ${orderId ?? "?"}`,
  );
  if (orderId) after(() => advanceFulfillment(orderId).then(() => undefined));
  return Response.json({ ok: true });
}
