import { NextResponse, type NextRequest } from "next/server";
import { ACESSO } from "@/content/site";

/**
 * Acesso por convite (ver `ACESSO` em src/content/site.ts). Sem o cookie do
 * convite, as páginas do site vão pra /em-breve. Ficam sempre abertas: API
 * (webhooks, callbacks), painel, a página do pedido (o link do e-mail pode
 * abrir em outro aparelho) e os textos legais.
 */
const COOKIE = "fernandito_convite";
const CODE = process.env.CONVITE_CODIGO?.trim() || "brio2026";
const OPEN = ["/em-breve", "/pedido", "/painel", "/termos", "/privacidade", "/trocas"];

export function proxy(request: NextRequest) {
  if (!ACESSO.restrito) return NextResponse.next();
  const { pathname, searchParams } = request.nextUrl;

  // Link de convite: grava o cookie e volta pra mesma página sem o código.
  if (searchParams.get("convite") === CODE) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("convite");
    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE, "1", {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
    return response;
  }

  // Arquivos (imagem, fonte, vídeo, ícone, robots.txt...) passam direto.
  if (pathname.includes(".")) return NextResponse.next();
  if (request.cookies.get(COOKIE)?.value === "1") return NextResponse.next();
  if (OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/em-breve";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Fora: API (webhooks e callbacks) e os arquivos do Next/Vercel.
  matcher: ["/((?!api/|_next/|_vercel/).*)"],
};
