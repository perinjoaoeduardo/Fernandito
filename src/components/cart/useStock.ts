"use client";

import { useEffect, useState } from "react";

export type StockState = { remaining: number | null; soldOut: boolean };

// Uma consulta por página (todos que usam o hook dividem a mesma).
let pending: Promise<StockState> | null = null;
let pendingAt = 0;

function load(): Promise<StockState> {
  if (!pending || Date.now() - pendingAt > 30_000) {
    pendingAt = Date.now();
    pending = fetch("/api/estoque")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Partial<StockState> | null) => ({
        remaining: typeof data?.remaining === "number" ? data.remaining : null,
        soldOut: data?.soldOut === true,
      }))
      .catch(() => ({ remaining: null, soldOut: false }));
  }
  return pending;
}

/**
 * Estoque do kit (/api/estoque: o menor entre o teto do site e o Bling).
 * Sem resposta → `soldOut: false` (não trava a venda à toa; o servidor
 * confere de novo ao gerar o Pix).
 */
export function useStock(): StockState {
  const [state, setState] = useState<StockState>({ remaining: null, soldOut: false });
  useEffect(() => {
    let alive = true;
    void load().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
