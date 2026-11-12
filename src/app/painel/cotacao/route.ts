import { NextRequest } from "next/server";
import { painelAuthed } from "@/lib/painel";
import { reshipQuote } from "@/lib/store/fulfillment";

/**
 * Cotação do modal "Etiqueta nova": /painel/cotacao?pedido=<id> → as
 * transportadoras que o site libera, com preço e prazo, e quais já falharam
 * naquele pedido. Só quem está logado no painel.
 */
export async function GET(request: NextRequest) {
  if (!(await painelAuthed())) return new Response("Não encontrado", { status: 404 });
  const id = request.nextUrl.searchParams.get("pedido") ?? "";
  if (!/^[\w-]{6,40}$/.test(id)) return new Response("Pedido inválido", { status: 400 });
  try {
    return Response.json(await reshipQuote(id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ erro: (error as Error).message }, { status: 502 });
  }
}
