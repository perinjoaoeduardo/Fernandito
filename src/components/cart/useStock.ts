"use client";

import { useEffect, useState } from "react";

export type StockState = { remaining: number | null; soldOut: boolean };

// Uma consulta por página (todos que usam o hook dividem a mesma).
let pending: Promise<StockState> | null = null;
let pendingAt = 0;

function load(): Promise<StockState> {
  if (!pending || Date.now() - pendingAt > 30_000) {
    pendingAt = Date.now();
    // Link especial (src/lib/especial.ts, `ESPECIAL.flag`): pede o estoque do
    // lote separado. O nome do cookie fica aqui pra não levar o módulo (e o
    // código) pro navegador.
    const especial = document.cookie
      .split(";")
      .some((c) => c.trim() === "fernandito_especial_on=1");
    pending = fetch(especial ? "/api/estoque?especial=1" : "/api/estoque")
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
