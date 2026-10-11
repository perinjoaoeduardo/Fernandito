import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { authorizeUrl, BLING_ADMIN_KEY, BLING_CONFIGURED } from "@/lib/bling/client";

// Conectar o site ao Bling (uma vez): /api/bling/connect?key=<BLING_ADMIN_KEY>
// → manda pra tela de autorização do Bling. Sem a chave certa → 404.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const ok =
    BLING_ADMIN_KEY.length >= 16 &&
    key.length === BLING_ADMIN_KEY.length &&
    timingSafeEqual(Buffer.from(key), Buffer.from(BLING_ADMIN_KEY));
  if (!ok) return new Response("Não encontrado", { status: 404 });
  if (!BLING_CONFIGURED)
    return new Response("Faltam BLING_CLIENT_ID / BLING_CLIENT_SECRET na Vercel.", { status: 503 });
  return Response.redirect(await authorizeUrl(), 302);
}
