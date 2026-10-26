import { NextResponse, type NextRequest } from "next/server";
import { ACESSO } from "@/content/site";
import { HEADER_PUBLICO } from "@/lib/acesso";

/**
 * Acesso por convite (ver `ACESSO` em src/content/site.ts). Quem não tem o
 * cookie do convite vê a versão pública (o pré-lançamento de antes, sem
 * loja): o proxy marca a visita com o cabeçalho `x-fernandito-publico` e o
 * site (layout e home) se monta nessa versão. Ficam sempre abertos: API
 * (webhooks, callbacks, fora do matcher), painel, a página do pedido (o link
 * do e-mail pode abrir em outro aparelho) e os textos legais.
 */
const COOKIE = "fernandito_convite";
const CODE = process.env.CONVITE_CODIGO?.trim() || "brio2026";
const OPEN = ["/painel", "/pedido", "/termos", "/privacidade", "/trocas"];

export function proxy(request: NextRequest) {
  // Sempre sobrescreve: um cabeçalho vindo de fora nunca vale.
  const headers = new Headers(request.headers);
  headers.delete(HEADER_PUBLICO);
  if (!ACESSO.restrito) return NextResponse.next({ request: { headers } });

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
  if (pathname.includes(".")) return NextResponse.next({ request: { headers } });
  if (request.cookies.get(COOKIE)?.value === "1")
    return NextResponse.next({ request: { headers } });

  // Sem convite, as páginas do site (menos as abertas) levam pra home pública.
  if (pathname !== "/" && !OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  headers.set(HEADER_PUBLICO, "1");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Fora: API (webhooks e callbacks) e os arquivos do Next/Vercel.
  matcher: ["/((?!api/|_next/|_vercel/).*)"],
};
