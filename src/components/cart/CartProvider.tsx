"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getProduct, PRODUCTS, type Product } from "@/lib/catalog";
import { precoAtual } from "@/lib/promo";

/**
 * Carrinho: itens (SKU + quantidade), gaveta aberta/fechada e totais.
 * Persiste em localStorage (com try/catch — sem storage, o carrinho só não
 * sobrevive ao recarregar). SKU inativo/inexistente some ao carregar.
 */

const STORAGE_KEY = "fernandito:cart:v1";

export type CartLine = { sku: string; qty: number };
/** `unitPriceCents` = preço que vale agora (com promoção, se tiver). */
export type CartEntry = CartLine & {
  product: Product;
  unitPriceCents: number;
  lineTotalCents: number;
};

type CartContextValue = {
  lines: CartEntry[];
  count: number;
  subtotalCents: number;
  /** false até ler o localStorage (evita piscar "vazio" no primeiro quadro). */
  ready: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (sku: string, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function clampQty(sku: string, qty: number) {
  const product = getProduct(sku);
  if (!product) return 0;
  return Math.max(0, Math.min(product.maxQty, Math.floor(qty)));
}

function readStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is CartLine => typeof l?.sku === "string" && typeof l?.qty === "number")
      .map((l) => ({ sku: l.sku, qty: clampQty(l.sku, l.qty) }))
      .filter((l) => l.qty > 0);
  } catch {
    return [];
  }
}

function writeStorage(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // modo privado / storage bloqueado: segue sem persistir
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Hora usada no preço do carrinho; vira sozinha quando uma promoção acaba
  // (o carrinho aberto à meia-noite volta pro preço normal).
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const fins = PRODUCTS.flatMap((p) => (p.promo ? [Date.parse(p.promo.fim)] : []))
      .filter((t) => t > agora)
      .sort((a, b) => a - b);
    if (!fins.length) return;
    const t = window.setTimeout(
      () => setAgora(Date.now()),
      Math.min(fins[0] - agora + 500, 2 ** 31 - 1),
    );
    return () => window.clearTimeout(t);
  }, [agora]);

  useEffect(() => {
    // Leitura única do storage no cliente (não dá pra fazer no useState
    // inicial sem quebrar a hidratação do HTML do servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(readStorage());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeStorage(lines);
  }, [lines, ready]);

  const add = useCallback((sku: string, qty = 1) => {
    setLines((current) => {
      const existing = current.find((l) => l.sku === sku);
      const nextQty = clampQty(sku, (existing?.qty ?? 0) + qty);
      if (nextQty <= 0) return current;
      return existing
        ? current.map((l) => (l.sku === sku ? { ...l, qty: nextQty } : l))
        : [...current, { sku, qty: nextQty }];
    });
    setIsOpen(true);
  }, []);

  const setQty = useCallback((sku: string, qty: number) => {
    setLines((current) =>
      current
        .map((l) => (l.sku === sku ? { ...l, qty: clampQty(sku, qty) } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const remove = useCallback((sku: string) => {
    setLines((current) => current.filter((l) => l.sku !== sku));
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const entries: CartEntry[] = lines.flatMap((line) => {
      const product = getProduct(line.sku);
      if (!product) return [];
      const unitPriceCents = precoAtual(product, agora);
      return [{ ...line, product, unitPriceCents, lineTotalCents: unitPriceCents * line.qty }];
    });
    return {
      lines: entries,
      count: entries.reduce((sum, e) => sum + e.qty, 0),
      subtotalCents: entries.reduce((sum, e) => sum + e.lineTotalCents, 0),
      ready,
      isOpen,
      open,
      close,
      add,
      setQty,
      remove,
      clear,
    };
  }, [lines, ready, isOpen, open, close, add, setQty, remove, clear, agora]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart precisa estar dentro do <CartProvider>");
  return context;
}
