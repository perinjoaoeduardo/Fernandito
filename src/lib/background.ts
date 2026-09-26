/**
 * Cor de fundo que está de fato na tela num ponto: sobe a árvore a partir
 * do elemento naquele ponto até achar um `background-color` não
 * transparente (a maioria dos wrappers não define fundo próprio). Usado pelo
 * menu, pelo cursor e pela cor da barra do Safari, pra reagirem a qualquer
 * seção, presente ou futura, sem marcar cada uma à mão.
 *
 * `elementFromPoint` pula elementos com `pointer-events: none` (o próprio
 * cursor, as camadas da galeria), então o resultado é o fundo por trás
 * deles.
 */
export type SampledBackground = { css: string; light: boolean };

// Acima disso (0–255, luminância percebida) o fundo conta como claro: o
// off-white passa, o verde-claro não.
const LIGHT_LUMINANCE_THRESHOLD = 150;

export function backgroundAt(x: number, y: number): SampledBackground | null {
  let node: Element | null = document.elementFromPoint(x, y);
  while (node) {
    const css = getComputedStyle(node).backgroundColor;
    const match = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (match && match[4] !== "0") {
      const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      return { css, light: luminance > LIGHT_LUMINANCE_THRESHOLD };
    }
    node = node.parentElement;
  }
  return null;
}
