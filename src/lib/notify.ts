"use client";

/** Abre o modal "me avisa do próximo lote" (NotifyModal, no layout). */
export const NOTIFY_EVENT = "fernandito:avisa";

export function openNotify() {
  window.dispatchEvent(new Event(NOTIFY_EVENT));
}
