import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { bling, BLING_ADMIN_KEY, BLING_CONFIGURED, isBlingConnected } from "@/lib/bling/client";
import { IS_PRODUCTION } from "@/lib/store/kv";

// Diagnóstico (só leitura, não cria nada) da ligação site → Bling:
// /api/bling/diagnostico?key=<BLING_ADMIN_KEY>. Sem a chave certa → 404.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const ok =
    BLING_ADMIN_KEY.length >= 16 &&
    key.length === BLING_ADMIN_KEY.length &&
    timingSafeEqual(Buffer.from(key), Buffer.from(BLING_ADMIN_KEY));
  if (!ok) return new Response("Não encontrado", { status: 404 });

  const env = (name: string) => process.env[name]?.trim() || null;
  let conectado = false;
  let leituraProduto: string;
  try {
    conectado = await isBlingConnected();
    const page = await bling<{ data: { id: number; nome: string }[] }>(
      "/produtos?codigos[]=FERN-KIT-PRE&limite=1",
    );
    leituraProduto = page.data[0] ? `ok: ${page.data[0].nome}` : "ok, mas o kit não foi achado";
  } catch (error) {
    leituraProduto = `falhou: ${(error as Error).message}`;
  }

  return Response.json(
    {
      ambiente: IS_PRODUCTION ? "produção" : "preview",
      appConfigurado: BLING_CONFIGURED,
      conectado,
      leituraProduto,
      enviaPedidosPraBling: IS_PRODUCTION || env("BLING_SYNC_PREVIEW") === "1",
      naturezaVendaId: env("BLING_NATUREZA_ID"),
      naturezaVendaEsperada: "15111699956",
      naturezaOk: env("BLING_NATUREZA_ID") === "15111699956",
      lojaId: env("BLING_LOJA_ID"),
      formaPagamentoId: env("BLING_FORMA_PAGAMENTO_ID"),
      situacaoId: env("BLING_SITUACAO_ID") ?? "15 (padrão: Em andamento)",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
