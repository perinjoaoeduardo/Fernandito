import type { NextRequest } from "next/server";
import { exchangeCode } from "@/lib/melhor-envio";

// Volta da autorização do Melhor Envio. Confere o `state`, troca o `code`
// pelo token e mostra o token UMA vez, pra colar na Vercel como
// MELHOR_ENVIO_TOKEN. Nada é salvo no servidor.

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;line-height:1.5;color:#243022;background:#e6e6cb}textarea{width:100%;font:13px ui-monospace,monospace;padding:8px}</style></head><body><h1>${title}</h1>${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie":
          "me_oauth_state=; Path=/api/melhorenvio; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("me_oauth_state")?.value;

  if (!code || !state || !expected || state !== expected) {
    return page(
      "Autorização inválida",
      '<p>Comece de novo por <a href="/api/melhorenvio/connect">/api/melhorenvio/connect</a>, no mesmo navegador.</p>',
      400,
    );
  }

  try {
    const token = await exchangeCode(code);
    const days = token.expires_in ? Math.round(token.expires_in / 86400) : null;
    return page(
      "Melhor Envio conectado",
      `<p>Copie o token abaixo e cole na Vercel como <b>MELHOR_ENVIO_TOKEN</b> (Production e Preview). Depois faça um redeploy.</p>
<textarea rows="8" readonly onclick="this.select()">${escape(token.access_token)}</textarea>
${days ? `<p>Validade: cerca de ${days} dias. Depois disso, repita este processo.</p>` : ""}
<p>Esta página não salva nada. Feche depois de copiar.</p>`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    return page("Falha ao conectar", `<p>${escape(message)}</p>`, 502);
  }
}
