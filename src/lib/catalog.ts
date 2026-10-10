/**
 * Catálogo da loja. Os SKUs são IGUAIS aos cadastrados no Bling — é por
 * eles que o pedido vai ser criado lá (prompt de integração). Só produto com
 * `active: true` aparece no site.
 *
 * Preço SEMPRE em centavos (inteiro): R$ 100,00 = 10000.
 */

export type ProductImage = {
  /** `null` = placeholder verde com o nome (ver PhotoSlot). */
  src: string | null;
  alt: string;
  placeholder: string;
};

export type Product = {
  sku: string;
  name: string;
  /** Descrição curta, uma frase. */
  description: string;
  /** O que vem dentro (lista curta, mostrada na página de compra). */
  contents: string[];
  priceCents: number;
  images: ProductImage[];
  /** Máximo por pedido. */
  maxQty: number;
  /** Peso e dimensões da embalagem pronta pra envio — usados na cotação de
   * frete (Melhor Envio). PLACEHOLDER: medir a caixa real. */
  shipping: { weightKg: number; widthCm: number; heightCm: number; lengthCm: number };
  active: boolean;
};

export const PRODUCTS: Product[] = [
  {
    sku: "FERN-KIT-PRE",
    name: "Kit Fernandito Pré-Lançamento",
    description: "A primeira leva do Fernandito, num kit pra quem quer provar antes de todo mundo.",
    contents: ["2 latas de Fernandito 350ml", "1 copo Fernandito", "Adesivos"],
    priceCents: 10000,
    images: [
      {
        // PLACEHOLDER: trocar pela foto do kit.
        src: "/images/hero-rotulo.jpg",
        alt: "Rótulo do Fernandito sobre a mesa — foto provisória do kit pré-lançamento",
        placeholder: "Foto do kit",
      },
    ],
    maxQty: 5,
    shipping: { weightKg: 1.2, widthCm: 20, heightCm: 15, lengthCm: 20 },
    active: true,
  },
  {
    sku: "FERN-350-6",
    name: "Pack 6 latas",
    description: "Seis latas de Fernandito 350ml.",
    contents: ["6 latas de Fernandito 350ml"],
    priceCents: 10000,
    images: [{ src: null, alt: "Pack com 6 latas de Fernandito", placeholder: "Pack 6 latas" }],
    maxQty: 5,
    shipping: { weightKg: 2.4, widthCm: 25, heightCm: 13, lengthCm: 18 },
    // Liberado quando os kits de pré-lançamento acabarem.
    active: false,
  },
];

export const ACTIVE_PRODUCTS = PRODUCTS.filter((product) => product.active);

/** Produto ativo pelo SKU (inativo ou inexistente → undefined). */
export function getProduct(sku: string) {
  return ACTIVE_PRODUCTS.find((product) => product.sku === sku);
}

/** O produto em destaque na seção/página de compra. */
export const FEATURED_PRODUCT = ACTIVE_PRODUCTS[0];
