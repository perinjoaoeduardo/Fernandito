"use server";

import { painelAuthed } from "@/lib/painel";
import {
  autorizarNota,
  conferirNota,
  descartarNota,
  extrairRascunho,
  prepararNota,
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

/** Confere tudo (regras, estoque, cadastro, frete, saldo) sem criar nada. */
export async function conferir(rascunho: Rascunho): Promise<Res<Plano>> {
  return guard(() => conferirNota(rascunho));
}

/** Cria cliente, pedido e nota em RASCUNHO no Bling (nada vai pra Sefaz). */
export async function preparar(
  rascunho: Rascunho,
  freteId: string | null,
  confirmaRepetida: boolean,
): Promise<Res<Prep>> {
  return guard(() => prepararNota(rascunho, { freteId, confirmaRepetida }));
}

/** Manda a nota pra Sefaz, baixa o estoque e compra a etiqueta (envio). */
export async function autorizar(id: string): Promise<Res<Prep>> {
  return guard(() => autorizarNota(id));
}

export async function descartar(id: string): Promise<Res<Prep>> {
  return guard(() => descartarNota(id));
}
