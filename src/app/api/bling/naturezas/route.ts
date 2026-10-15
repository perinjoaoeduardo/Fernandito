import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { bling, BLING_ADMIN_KEY } from "@/lib/bling/client";

// Consulta (só leitura) das naturezas de operação cadastradas no Bling, pra
// conferir a tributação: /api/bling/naturezas?key=<BLING_ADMIN_KEY>
// Sem a chave certa → 404. Com ?id=<n>, mostra o detalhe de uma.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const ok =
    BLING_ADMIN_KEY.length >= 16 &&
    key.length === BLING_ADMIN_KEY.length &&
    timingSafeEqual(Buffer.from(key), Buffer.from(BLING_ADMIN_KEY));
  if (!ok) return new Response("Não encontrado", { status: 404 });

  const id = request.nextUrl.searchParams.get("id");
  try {
    const data = /^\d+$/.test(id ?? "")
      ? await bling(`/naturezas-operacoes/${id}`)
      : await bling("/naturezas-operacoes?limite=100");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
