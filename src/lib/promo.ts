/**
 * Promoção com hora pra acabar (ex.: Black Friday). Vale no navegador (preço
 * na tela, carrinho) e no SERVIDOR (o Pix, o pedido, o Bling e a nota usam o
 * `precoAtual` na hora de gerar o Pix). Passou do `fim`, volta sozinho pro
 * preço normal, sem deploy.
 *
 * Pra criar uma: `promo` no produto em src/lib/catalog.ts. Pra encerrar antes
 * da hora: tira o `promo` (ou adianta o `fim`).
 */
export type Promo = {
  /** Preço da promoção, em centavos. */
  priceCents: number;
  /** Quando acaba (ISO com fuso). Ex.: meia-noite de Brasília = "…T00:00:00-03:00". */
  fim: string;
  /** Selo na tela ("Black Friday"). */
  selo: string;
};

type ComPromo = { priceCents: number; promo?: Promo };

/** A promoção que vale agora (ou null). */
export function promoAtiva(p: ComPromo, now = Date.now()): Promo | null {
  return p.promo && now < Date.parse(p.promo.fim) ? p.promo : null;
}

/** Preço que vale agora: o da promoção, se estiver no ar; senão o normal. */
export function precoAtual(p: ComPromo, now = Date.now()): number {
  return promoAtiva(p, now)?.priceCents ?? p.priceCents;
}

/** "05:12:09" até o fim (ou null se já acabou). */
export function faltaPara(fim: string, now = Date.now()): string | null {
  const ms = Date.parse(fim) - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
