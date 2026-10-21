import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isAdmin } from "@/lib/leads";
import { BLING_ADMIN_KEY } from "@/lib/bling/client";

/**
 * Login do painel interno (/painel): a pessoa digita a mesma senha do admin
 * (`BLING_ADMIN_KEY`) e o navegador guarda um cookie com uma assinatura
 * dela — a senha em si nunca fica no cookie nem na URL. Cookie httpOnly,
 * só HTTPS, 12 h.
 */
export const PAINEL_COOKIE = "fernandito_painel";
export const PAINEL_TTL = 60 * 60 * 12;

const sign = () => createHmac("sha256", BLING_ADMIN_KEY).update("painel-v1").digest("hex");

export function passwordOk(password: string | null) {
  return isAdmin(password);
}

export async function painelAuthed() {
  if (BLING_ADMIN_KEY.length < 16) return false;
  const value = (await cookies()).get(PAINEL_COOKIE)?.value;
  const expected = sign();
  if (!value || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function painelLogin() {
  (await cookies()).set(PAINEL_COOKIE, sign(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/painel",
    maxAge: PAINEL_TTL,
  });
}

export async function painelLogout() {
  (await cookies()).delete({ name: PAINEL_COOKIE, path: "/painel" });
}
