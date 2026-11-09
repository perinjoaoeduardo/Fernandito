"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { syncManualSales } from "@/lib/bling/manual";
import { retryPendingBlingOrders } from "@/lib/bling/orders";
import { painelAuthed, painelLogin, painelLogout, passwordOk } from "@/lib/painel";
import { reconcileOpenOrders } from "@/lib/store/checkout";
import { advanceAllFulfillments, markLocalDelivered, markPosted } from "@/lib/store/fulfillment";
import { advanceAvulsos, markAvulsoPosted } from "@/lib/store/avulsos";
import { kvGet, kvSet, rateLimit } from "@/lib/store/kv";
import {
  PRODUCAO_BACKUP_V1,
  PRODUCAO_KEY,
  producaoSchema,
  type ProducaoData,
} from "@/lib/producao";

export async function entrar(_prev: { error: string } | null, form: FormData) {
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  // 8 tentativas a cada 10 min por IP.
  if (!(await rateLimit("painel-login", ip, 8, 600)))
    return { error: "Muitas tentativas. Espera uns minutos." };
  if (!passwordOk(String(form.get("senha") ?? ""))) return { error: "Senha errada." };
  await painelLogin(form.get("lembrar") === "on");
  redirect("/painel");
}

export async function sair() {
  await painelLogout();
  redirect("/painel");
}

/** Confere Pix abertos, reenvia a fila do Bling e empurra os envios. */
export async function atualizar() {
  if (!(await painelAuthed())) redirect("/painel");
  await reconcileOpenOrders().catch(() => {});
  await retryPendingBlingOrders().catch(() => {});
  await advanceAllFulfillments().catch(() => {});
  await advanceAvulsos().catch(() => {});
  await syncManualSales();
  redirect("/painel");
}

const backTo = (form: FormData) => {
  const back = String(form.get("back") ?? "");
  return back.startsWith("/painel") && !back.startsWith("//") ? back : "/painel";
};

/** "Já postei": tira de "Imprimir" e põe em "A caminho". */
export async function marcarPostado(form: FormData) {
  if (!(await painelAuthed())) redirect("/painel");
  const id = String(form.get("id") ?? "");
  if (!(await markAvulsoPosted(id))) await markPosted(id);
  redirect(backTo(form));
}

/** Entrega própria (Porto Alegre) feita: tira da lista "pra entregar". */
export async function marcarEntregue(form: FormData) {
  if (!(await painelAuthed())) redirect("/painel");
  await markLocalDelivered(String(form.get("id") ?? ""));
  // Volta pra mesma lista (filtro, busca e página) em que a pessoa estava.
  redirect(backTo(form));
}

/** Aba Produção: salva insumos, fornecedores, receita e plano (cadastro da equipe). */
export async function salvarProducao(
  data: ProducaoData,
): Promise<{ ok: boolean; error?: string; at?: string }> {
  if (!(await painelAuthed())) return { ok: false, error: "Sessão expirou. Entra de novo." };
  const parsed = producaoSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Algum campo ficou inválido." };
  const at = new Date().toISOString();
  // 1ª gravação no formato novo: guarda uma cópia do cadastro antigo.
  const before = await kvGet(PRODUCAO_KEY).catch(() => null);
  if (before && !before.includes('"versao":2'))
    await kvSet(PRODUCAO_BACKUP_V1, before).catch(() => {});
  await kvSet(PRODUCAO_KEY, JSON.stringify({ ...parsed.data, atualizadoEm: at }));
  return { ok: true, at };
}
