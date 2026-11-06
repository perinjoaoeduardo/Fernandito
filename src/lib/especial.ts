/**
 * Link especial: libera um lote pequeno separado (ex.: os últimos kits) só
 * pra quem recebe o link, com o site esgotado pra todo mundo.
 *
 * O link é qualquer página do site com `?acesso=<código>`:
 *   https://fernandito.com.br/comprar?acesso=<código>
 * O proxy (src/proxy.ts) grava o cookie e tira o código da barra. Daí em
 * diante, pra essa pessoa, o kit mostra o estoque do lote especial e o Pix
 * reserva desse lote (contador próprio, teto `cap`), sem tocar no público.
 * Compra, Pix, Bling, nota e etiqueta: tudo igual a um pedido normal.
 *
 * Fechar: trocar o código (env `LINK_ESPECIAL_CODIGO`) ou pôr `cap: 0` no último lote.
 */
export const ESPECIAL = {
  param: "acesso",
  code: process.env.LINK_ESPECIAL_CODIGO?.trim() || "y82hz96ccr",
  /** Cookie com o código (só o servidor lê). */
  cookie: "fernandito_especial",
  /** Cookie sem segredo que o navegador lê pra pedir o estoque especial. */
  flag: "fernandito_especial_on",
  maxAgeSeconds: 60 * 60 * 24 * 30,
  sku: "FERN-KIT-PRE",
} as const;

/**
 * Lotes do link, cada um com seu contador (o último é o que vende agora).
 * Lote novo = contador zerado com o teto exato do que sobrou, sem depender de
 * quantos o lote anterior vendeu. Os antigos ficam aqui só pra devolver Pix
 * vencido no contador certo e pro painel contar o que já saiu.
 *   1º (05/11): 4 kits — 2 vendidos (Gabriel Welter #148, Victor M. #149).
 *   2º (06/11): os 2 últimos kits pré-venda. Vendeu esses, acabou.
 */
export const ESPECIAL_LOTES = [
  { sku: `${ESPECIAL.sku}@especial`, cap: 4 },
  { sku: `${ESPECIAL.sku}@especial-2`, cap: 2 },
] as const;

/** SKU "virtual" do lote especial que vende agora, no contador de estoque. */
export const ESPECIAL_SKU = ESPECIAL_LOTES[ESPECIAL_LOTES.length - 1].sku;

/** Teto de um lote do link (`null` se o SKU não é de lote). */
export const especialCap = (sku: string): number | null =>
  ESPECIAL_LOTES.find((l) => l.sku === sku)?.cap ?? null;

export const isEspecialCode = (value: string | undefined | null) =>
  Boolean(value) && value === ESPECIAL.code;

/** Lê o cookie do link especial de um cabeçalho `Cookie`. */
export function hasEspecialCookie(cookieHeader: string | null) {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ESPECIAL.cookie) return isEspecialCode(decodeURIComponent(rest.join("=")));
  }
  return false;
}
