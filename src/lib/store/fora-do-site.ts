import "server-only";
import { kvMGet, kvSet } from "@/lib/store/kv";

/**
 * Entregas FORA do site sem etiqueta (brinde ou venda manual lidos da nota
 * do Bling, entregues em mãos): o painel mostra "Entregar em mãos" e o botão
 * "Marcar entregue" grava aqui a data, por número da nota.
 */
const norm = (nf: string) => String(Number(String(nf).replace(/\D/g, "")) || 0);
const key = (nf: string) => `fora:entregue:${norm(nf)}`;
const TTL = 60 * 60 * 24 * 400;

/** Notas (pelo número) já marcadas como entregues → data da marcação. */
export async function entreguesFora(nfs: string[]): Promise<Map<string, string>> {
  if (!nfs.length) return new Map();
  const values = await kvMGet(...nfs.map(key));
  const out = new Map<string, string>();
  nfs.forEach((nf, i) => {
    if (values[i]) out.set(norm(nf), values[i]!);
  });
  return out;
}

export async function markNfDelivered(nf: string) {
  if (norm(nf) === "0") return;
  await kvSet(key(nf), new Date().toISOString(), TTL);
}
