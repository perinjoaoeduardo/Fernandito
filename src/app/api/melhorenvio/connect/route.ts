import { ME_BASE_URL, ME_SCOPES, REDIRECT_URI } from "@/lib/melhor-envio";

// Início da autorização do Melhor Envio (uso único, pelo dono da conta).
// Abrir https://fernandito.com.br/api/melhorenvio/connect → login no Melhor
// Envio → Autorizar → volta pro /callback, que mostra o token.

export async function GET() {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID?.trim();
  if (!clientId) return new Response("MELHOR_ENVIO_CLIENT_ID não configurado", { status: 500 });

  const state = crypto.randomUUID();
  const url = new URL(`${ME_BASE_URL}/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ME_SCOPES.join(" "));
  url.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": `me_oauth_state=${state}; Path=/api/melhorenvio; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      "Cache-Control": "no-store",
    },
  });
}
