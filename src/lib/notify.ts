"use client";

/** Abre o modal "me avisa" (NotifyModal, no layout). */
export const NOTIFY_EVENT = "fernandito:avisa";

/** Textos do modal pra um produto (ex.: six pack "em breve"); sem nada, o padrão
 * (kit esgotado). `produto` vai junto no contato salvo (painel). */
export type NotifyContext = { kicker?: string; title?: string; text?: string; produto?: string };

export function openNotify(context?: NotifyContext) {
  window.dispatchEvent(
    new CustomEvent<NotifyContext | undefined>(NOTIFY_EVENT, { detail: context }),
  );
}
