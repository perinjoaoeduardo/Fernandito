"use server";

import { painelAuthed } from "@/lib/painel";
import {
  autorizarNota,
  descartarNota,
  extrairRascunho,
  planejar,
  prepararNota,
  rascunhoSchema,
  type Plano,
  type Prep,
  type Rascunho,
} from "@/lib/notas";

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<Res<T>> {
  if (!(await painelAuthed())) return { ok: false, error: "Sessão expirou. Entre de novo." };
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: (error as Error).message || "Deu erro." };
  }
}

/** Lê o texto colado com a IA e devolve os campos preenchidos. */
export async function lerTexto(texto: string): Promise<Res<Rascunho>> {
  return guard(() => {
    if (!texto.trim()) throw new Error("Cole algum texto.");
    return extrairRascunho(texto);
  });
}

/** Confere as regras (natureza, campos faltando) sem mexer em nada. */
export async function conferir(rascunho: Rascunho): Promise<Res<Plano>> {
  return guard(async () => planejar(rascunhoSchema.parse(rascunho)));
}

/** Cria cliente, pedido e nota em RASCUNHO no Bling (nada vai pra Sefaz). */
export async function preparar(rascunho: Rascunho): Promise<Res<Prep>> {
  return guard(() => prepararNota(rascunho, "painel"));
}

/** Manda a nota pra Sefaz, baixa o estoque, compra a etiqueta, lança nas caixas. */
export async function autorizar(id: string): Promise<Res<Prep>> {
  return guard(() => autorizarNota(id));
}

export async function descartar(id: string): Promise<Res<Prep>> {
  return guard(() => descartarNota(id));
}
