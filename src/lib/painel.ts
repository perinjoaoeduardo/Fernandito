import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/leads";
import { BLING_ADMIN_KEY } from "@/lib/bling/client";

/**
 * Login do painel interno (/painel): a pessoa digita a mesma senha do admin
 * (`BLING_ADMIN_KEY`) e o navegador guarda um cookie com uma assinatura
 * dela — a senha em si nunca fica no cookie nem na URL. Cookie httpOnly,
 * só HTTPS. Dura 12 h, ou 30 dias se a pessoa marcar "manter conectado"
 * neste aparelho. O prazo vai DENTRO do valor assinado (`validade.assinatura`)
 * e o servidor confere — mexer no cookie não estica nada. Trocar a senha do
 * admin (`BLING_ADMIN_KEY`) derruba todo mundo de uma vez.
 */
export const PAINEL_COOKIE = "fernandito_painel";
export const PAINEL_TTL = 60 * 60 * 12;
export const PAINEL_TTL_LEMBRAR = 60 * 60 * 24 * 30;

const sign = (exp: number) =>
  createHmac("sha256", BLING_ADMIN_KEY).update(`painel-v2.${exp}`).digest("hex");

export function passwordOk(password: string | null) {
  return isAdmin(password);
}

export async function painelAuthed() {
  if (BLING_ADMIN_KEY.length < 16) return false;
  const value = (await cookies()).get(PAINEL_COOKIE)?.value;
  const [expText, signature = ""] = (value ?? "").split(".");
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = sign(exp);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function painelLogin(remember = false) {
  const ttl = remember ? PAINEL_TTL_LEMBRAR : PAINEL_TTL;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  (await cookies()).set(PAINEL_COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/painel",
    maxAge: ttl,
  });
}

export async function painelLogout() {
  (await cookies()).delete({ name: PAINEL_COOKIE, path: "/painel" });
}
