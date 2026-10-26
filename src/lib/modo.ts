import "server-only";
import { headers } from "next/headers";
import { ACESSO } from "@/content/site";
import { HEADER_PUBLICO } from "@/lib/acesso";

/** Esta visita vê a versão pública (pré-lançamento, sem loja)? */
export async function isPublico() {
  if (!ACESSO.restrito) return false;
  return (await headers()).get(HEADER_PUBLICO) === "1";
}
