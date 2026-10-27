"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { syncManualSales } from "@/lib/bling/manual";
import { retryPendingBlingOrders } from "@/lib/bling/orders";
import { painelAuthed, painelLogin, painelLogout, passwordOk } from "@/lib/painel";
import { reconcileOpenOrders } from "@/lib/store/checkout";
import { advanceAllFulfillments, markLocalDelivered } from "@/lib/store/fulfillment";
import { rateLimit } from "@/lib/store/kv";

export async function entrar(_prev: { error: string } | null, form: FormData) {
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  // 8 tentativas a cada 10 min por IP.
  if (!(await rateLimit("painel-login", ip, 8, 600)))
    return { error: "Muitas tentativas. Espera uns minutos." };
  if (!passwordOk(String(form.get("senha") ?? ""))) return { error: "Senha errada." };
  await painelLogin();
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
  await syncManualSales();
  redirect("/painel");
}

/** Entrega própria (Porto Alegre) feita: tira da lista "pra entregar". */
export async function marcarEntregue(form: FormData) {
  if (!(await painelAuthed())) redirect("/painel");
  await markLocalDelivered(String(form.get("id") ?? ""));
  // Volta pra mesma lista (filtro, busca e página) em que a pessoa estava.
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/painel") && !back.startsWith("//") ? back : "/painel");
}
