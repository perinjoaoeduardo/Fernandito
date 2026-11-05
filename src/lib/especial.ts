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
 * Fechar: trocar o código (env `LINK_ESPECIAL_CODIGO`) ou pôr `cap: 0`.
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
  /** Kits liberados no link (os que sobraram no estoque). */
  cap: 4,
} as const;

/** SKU "virtual" do lote especial no contador de estoque. */
export const ESPECIAL_SKU = `${ESPECIAL.sku}@especial`;

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
