import "server-only";
import { STORE } from "@/content/site";
import { rateLimit, StoreUnavailableError } from "@/lib/store/kv";
import { PaymentUnavailableError } from "@/lib/mercadopago";
import { CheckoutError } from "@/lib/store/checkout";

/** IP de quem chamou (na Vercel vem no x-forwarded-for). */
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Loja desligada → 404; rate limit estourado → 429. `null` = pode seguir. */
export async function guard(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
) {
  if (!STORE.enabled) return json({ error: "Loja fechada" }, 404);
  try {
    if (!(await rateLimit(bucket, clientIp(request), limit, windowSeconds)))
      return json({ error: "Muitas tentativas. Espera um pouco e tenta de novo." }, 429);
  } catch (error) {
    return errorResponse(error);
  }
  return null;
}

/** Erro → resposta. Mensagem detalhada só no log, nunca pro navegador. */
export function errorResponse(error: unknown) {
  if (error instanceof CheckoutError)
    return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof StoreUnavailableError || error instanceof PaymentUnavailableError) {
    console.error("[loja]", error.message);
    return json({ error: "Pagamento indisponível no momento. Tenta de novo mais tarde." }, 503);
  }
  console.error("[loja] erro inesperado:", (error as Error)?.message ?? error);
  return json({ error: "Não deu pra gerar o Pix agora. Tenta de novo em instantes." }, 502);
}
