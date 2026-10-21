import { NextRequest } from "next/server";
import { GET as pedidosCsv } from "@/app/api/loja/pedidos/route";
import { BLING_ADMIN_KEY } from "@/lib/bling/client";
import { painelAuthed } from "@/lib/painel";

/** Planilha de pedidos pra quem já entrou no painel (sem a senha na URL). */
export async function GET(request: NextRequest) {
  if (!(await painelAuthed())) return new Response("Não encontrado", { status: 404 });
  const url = new URL("/api/loja/pedidos", request.url);
  url.searchParams.set("key", BLING_ADMIN_KEY);
  if (request.nextUrl.searchParams.get("todos") === "1") url.searchParams.set("todos", "1");
  return pedidosCsv(new NextRequest(url));
}
