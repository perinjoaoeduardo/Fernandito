import { NextRequest, NextResponse } from "next/server";
import { labelsPrintUrl } from "@/lib/melhor-envio-label";
import { painelAuthed } from "@/lib/painel";

/**
 * "Imprimir todas" do painel: /painel/etiquetas?envios=<id>,<id>,… → um PDF
 * só, do Melhor Envio, com todas as etiquetas. Abre em outra aba.
 */
export async function GET(request: NextRequest) {
  if (!(await painelAuthed())) return new Response("Não encontrado", { status: 404 });
  const ids = (request.nextUrl.searchParams.get("envios") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[\w-]{1,64}$/.test(s))
    .slice(0, 100);
  if (!ids.length) return new Response("Nenhuma etiqueta", { status: 400 });
  try {
    const url = await labelsPrintUrl(ids);
    if (!url) return new Response("O Melhor Envio não devolveu o PDF", { status: 502 });
    return NextResponse.redirect(url);
  } catch (error) {
    return new Response(`Melhor Envio: ${(error as Error).message}`, { status: 502 });
  }
}
