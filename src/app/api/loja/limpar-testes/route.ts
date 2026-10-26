import type { NextRequest } from "next/server";
import { ACTIVE_PRODUCTS } from "@/lib/catalog";
import { isAdmin, listLeads } from "@/lib/leads";
import { ALL_SET, MANUAL_SET } from "@/lib/store/checkout";
import { kvDel, kvSMembers } from "@/lib/store/kv";
import { getOrder } from "@/lib/store/orders";

/**
 * Limpa os dados de TESTE do site antes de abrir a venda (painel, contagem de
 * estoque, contatos de teste). Só mexe no banco do site (Redis): o Bling NÃO
 * é tocado (as notas e pedidos de lá ficam como estão).
 *
 * /api/loja/limpar-testes?key=<BLING_ADMIN_KEY>             → só mostra o que seria apagado
 * /api/loja/limpar-testes?key=<BLING_ADMIN_KEY>&apagar=1   → apaga
 *
 * Apaga: todos os pedidos do site (pagos, simulados, vencidos) e os avisos
 * ligados a eles, a fila de reenvio ao Bling, os alertas, os contatos
 * (formulário e lista "me avisa") e zera a contagem de kits reservados.
 * Não use depois que a venda abrir: apaga pedidos de verdade também.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isAdmin(params.get("key"))) return new Response("Não encontrado", { status: 404 });
  const apagar = params.get("apagar") === "1";

  const ids = await kvSMembers(ALL_SET);
  const orders = (await Promise.all(ids.map(getOrder))).filter((o) => o !== null);
  const leads = await listLeads();
  const resumo = {
    pedidos: orders.length,
    pagos: orders.filter((o) => o.status === "paid").length,
    simulados: orders.filter((o) => o.simulated).length,
    contatos: leads.length,
    apagado: apagar,
  };
  if (!apagar) {
    return Response.json({
      ...resumo,
      aviso: "Nada foi apagado. Pra apagar: acrescente &apagar=1",
    });
  }

  for (const id of ids) {
    for (const key of [
      `order:${id}`,
      `paid:${id}`,
      `fulfill:${id}`,
      `stock:hold:${id}`,
      `email:paid:${id}`,
      `email:posted:${id}`,
      `paid-hook:${id}`,
    ]) {
      await kvDel(key);
    }
  }
  for (const set of [
    ALL_SET,
    MANUAL_SET,
    "orders:open",
    "fulfill:queue",
    "bling:retry",
    "loja:alertas",
  ]) {
    await kvDel(set);
  }
  for (const lead of leads) await kvDel(`lead:${lead.id}`);
  await kvDel("leads");
  // Kits reservados: zera (produção e preview) e esquece a conferência do Bling.
  for (const product of ACTIVE_PRODUCTS) {
    await kvDel(`stock:held:${product.sku}`);
    await kvDel(`stock:held:preview:${product.sku}`);
  }
  await kvDel("bling:manual");

  return Response.json({ ...resumo, ok: true });
}
