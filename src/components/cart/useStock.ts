"use client";

import { useEffect, useState } from "react";

export type StockState = { remaining: number | null; soldOut: boolean };
type StockData = StockState & { produtos: Record<string, StockState> };

// Uma consulta por página (todos que usam o hook dividem a mesma).
let pending: Promise<StockData> | null = null;
let pendingAt = 0;
const EMPTY: StockData = { remaining: null, soldOut: false, produtos: {} };

function load(): Promise<StockData> {
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
      .then((data: Partial<StockData> | null) => ({
        remaining: typeof data?.remaining === "number" ? data.remaining : null,
        soldOut: data?.soldOut === true,
        produtos: data?.produtos ?? {},
      }))
      .catch(() => EMPTY);
  }
  return pending;
}

/**
 * Estoque (/api/estoque: o menor entre o teto do site e o Bling).
 * - `useStock()`: a loja toda — `soldOut` só quando TODOS os produtos esgotaram
 *   (menu, faixa, botões gerais de "Comprar").
 * - `useStock(sku)`: um produto (página do produto).
 * - `useStock(skus)`: `soldOut` se QUALQUER um deles esgotou (carrinho/checkout).
 * Sem resposta → `soldOut: false` (não trava a venda à toa; o servidor
 * confere de novo ao gerar o Pix).
 */
export function useStock(which?: string | string[]): StockState {
  const [data, setData] = useState<StockData>(EMPTY);
  useEffect(() => {
    let alive = true;
    void load().then((s) => alive && setData(s));
    return () => {
      alive = false;
    };
  }, []);
  if (typeof which === "string") return data.produtos[which] ?? { remaining: null, soldOut: false };
  if (Array.isArray(which)) {
    const list = which.map((sku) => data.produtos[sku]).filter(Boolean);
    return { remaining: null, soldOut: list.some((s) => s.soldOut) };
  }
  return { remaining: data.remaining, soldOut: data.soldOut };
}
