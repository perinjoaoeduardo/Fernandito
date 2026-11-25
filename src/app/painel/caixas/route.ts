import { painelAuthed } from "@/lib/painel";
import { efeitos, listarCaixas, resumoCaixas, TIPOS_CAIXA } from "@/lib/caixas";

/**
 * "Baixar histórico" da aba Caixas da equipe: tudo num JSON só (saldo de
 * cada pessoa + cada lançamento com o texto colado), pronto pra conferir ou
 * passar pra uma IA analisar.
 */
export async function GET() {
  if (!(await painelAuthed())) return new Response("Não encontrado", { status: 404 });
  const registros = await listarCaixas();
  const body = {
    geradoEm: new Date().toISOString(),
    unidade: "caixa = six pack",
    saldos: resumoCaixas(registros),
    registros: registros
      .sort((a, b) => (a.data + a.criadoEm).localeCompare(b.data + b.criadoEm))
      .map((r) => ({
        ...r,
        oQue: TIPOS_CAIXA[r.tipo].label,
        efeitoNoSaldo: efeitos(r),
      })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="caixas-da-equipe.json"',
      "Cache-Control": "no-store",
    },
  });
}
