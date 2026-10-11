import type { NextRequest } from "next/server";
import { consumeState, exchangeCode } from "@/lib/bling/client";

// Volta do Bling depois de autorizar: troca o `code` pelos tokens.
function page(title: string, text: string, status = 200) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><body style="font-family:system-ui;padding:2rem;max-width:36rem;margin:auto;background:#e5e5cc;color:#26331f"><h1>${title}</h1><p>${text}</p></body>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state") ?? "";
  if (!code || !(await consumeState(state)))
    return page("Link inválido", "Abre de novo o link de conexão (/api/bling/connect).", 400);
  try {
    await exchangeCode(code);
    return page(
      "Bling conectado ✓",
      "Pronto: os pedidos pagos no site vão virar pedidos de venda no Bling.",
    );
  } catch (error) {
    console.error("[bling] falha ao conectar:", (error as Error).message);
    return page(
      "Não deu pra conectar",
      "Confere o Client ID/Secret na Vercel e tenta de novo.",
      502,
    );
  }
}
