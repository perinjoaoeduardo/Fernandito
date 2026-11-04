import type { NextRequest } from "next/server";
import { bling } from "@/lib/bling/client";
import { getFulfillment } from "@/lib/store/fulfillment";

/**
 * PDF da nota fiscal (DANFE) do pedido, pra quem tem o link do pedido.
 * O link do Bling expira, então não fica guardado: a cada clique busca um
 * novo na nota do pedido e manda o navegador pra ele.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[\w-]{6,40}$/.test(id)) return new Response("Não encontrado", { status: 404 });
  const f = await getFulfillment(id);
  if (!f?.invoice.id || !f.invoice.key)
    return new Response("Nota ainda não emitida", { status: 404 });
  try {
    const nfe = await bling<{ data: { linkPDF?: string; linkDanfe?: string } }>(
      `/nfe/${f.invoice.id}`,
    );
    const url = nfe.data.linkPDF ?? nfe.data.linkDanfe;
    if (!url) return new Response("Nota ainda sem PDF", { status: 404 });
    return Response.redirect(url, 302);
  } catch {
    return new Response("Não deu pra buscar a nota agora. Tenta de novo em instantes.", {
      status: 502,
    });
  }
}
