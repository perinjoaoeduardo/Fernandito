import { adminKeyOf } from "@/lib/admin-key";
import { isAdmin } from "@/lib/leads";
import { PRODUCAO_KEY } from "@/lib/producao";
import { kvGet } from "@/lib/store/kv";

/**
 * Exportar a aba Produção do painel (só leitura): insumos, fornecedores,
 * cotações, pedidos de compra, compras, movimentos de estoque, lotes e receita,
 * exatamente como estão gravados. Pra conferir ou levar pro Bling.
 *   /api/loja/producao?key=<BLING_ADMIN_KEY>  → baixa producao-fernandito.json
 */
export async function GET(request: Request) {
  if (!isAdmin(adminKeyOf(request))) return new Response("Não encontrado", { status: 404 });
  const raw = await kvGet(PRODUCAO_KEY);
  if (!raw) return Response.json({ erro: "Nada salvo na Produção ainda" }, { status: 404 });
  return new Response(raw, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="producao-fernandito.json"',
      "Cache-Control": "no-store",
    },
  });
}
