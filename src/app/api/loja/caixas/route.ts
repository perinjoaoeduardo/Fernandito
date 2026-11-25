import { z } from "zod";
import { adminKeyOf } from "@/lib/admin-key";
import { isAdmin } from "@/lib/leads";
import {
  efeitos,
  listarCaixas,
  registroCaixaSchema,
  resumoCaixas,
  salvarCaixas,
  TIPOS_CAIXA,
} from "@/lib/caixas";

/**
 * Caixas da equipe por link (com a senha), pra lançar de fora do painel:
 *   GET  /api/loja/caixas?key=…                → saldos + histórico (JSON)
 *   GET  /api/loja/caixas?key=…&lote=<JSON>    → grava os lançamentos do lote
 *   POST /api/loja/caixas  (corpo = lote JSON) → idem
 * Cada lançamento leva um `id` fixo: abrir o mesmo link de novo NÃO duplica.
 */
const loteSchema = z
  .array(
    registroCaixaSchema.omit({ criadoEm: true }).extend({ id: z.string().regex(/^[\w-]{3,40}$/) }),
  )
  .min(1)
  .max(50);

async function lancar(raw: unknown) {
  const parsed = loteSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json({ erro: "Lote inválido", detalhes: parsed.error.issues }, { status: 400 });
  const atual = await listarCaixas();
  const existentes = new Set(atual.map((r) => r.id));
  const novos = parsed.data
    .filter((r) => !existentes.has(r.id))
    .map((r) => ({
      ...r,
      para: r.tipo === "passou" && r.para !== r.pessoa ? r.para : null,
      criadoEm: new Date().toISOString(),
    }));
  if (novos.length) await salvarCaixas([...atual, ...novos]);
  const todos = [...atual, ...novos];
  return Response.json({
    ok: true,
    gravados: novos.length,
    jaExistiam: parsed.data.length - novos.length,
    saldos: resumoCaixas(todos).map((s) => ({ pessoa: s.pessoa, saldo: s.saldo })),
  });
}

export async function GET(request: Request) {
  if (!isAdmin(adminKeyOf(request))) return new Response("Não encontrado", { status: 404 });
  const lote = new URL(request.url).searchParams.get("lote");
  if (lote) {
    let data: unknown;
    try {
      data = JSON.parse(lote);
    } catch {
      return Response.json({ erro: "lote: JSON inválido" }, { status: 400 });
    }
    return lancar(data);
  }
  const registros = await listarCaixas();
  return Response.json({
    saldos: resumoCaixas(registros),
    registros: registros.map((r) => ({
      ...r,
      oQue: TIPOS_CAIXA[r.tipo].label,
      efeitoNoSaldo: efeitos(r),
    })),
  });
}

export async function POST(request: Request) {
  if (!isAdmin(adminKeyOf(request))) return new Response("Não encontrado", { status: 404 });
  return lancar(await request.json().catch(() => null));
}
