import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/leads";
import { kvDel, kvSMembers } from "@/lib/store/kv";

/**
 * Limpa os alertas do painel (a caixa vermelha) depois que o problema foi
 * resolvido à mão. Só apaga os alertas: pedidos, estoque e o resto ficam.
 * /api/loja/limpar-alertas?key=<BLING_ADMIN_KEY>              → só conta
 * /api/loja/limpar-alertas?key=<BLING_ADMIN_KEY>&apagar=1    → limpa
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isAdmin(params.get("key"))) return new Response("Não encontrado", { status: 404 });
  const alertas = await kvSMembers("loja:alertas");
  if (params.get("apagar") !== "1") {
    return Response.json({
      alertas: alertas.length,
      aviso: "Nada foi apagado. Acrescente &apagar=1",
    });
  }
  await kvDel("loja:alertas");
  return Response.json({ alertas: alertas.length, apagado: true });
}
