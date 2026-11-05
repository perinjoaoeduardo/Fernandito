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

/** Ícone do cartão "O que vem no kit" (ver `ContentIconView`). */
export type ContentIcon = "can" | "cup" | "sticker";

export type Product = {
  sku: string;
  /** Endereço da página do produto: /comprar/<slug>. */
  slug: string;
  /** Selo da foto ("Pré-lançamento · Edição limitada"); sem ele, o padrão da loja. */
  badge?: string;
  /** Título da lista "O que vem…" (padrão: o da loja, "O que vem no kit"). */
  contentsTitle?: string;
  /** Produto montado de outros (ex.: pack = 6 latas): a baixa no Bling sai
   * dos componentes, porque o estoque do pack lá é calculado a partir deles. */
  stockComponents?: { sku: string; qty: number }[];
  name: string;
  /** Descrição curta, uma frase. */
  description: string;
  /** O que vem dentro (lista curta, mostrada na página de compra). */
  contents: { icon: ContentIcon; qty: string; label: string }[];
  priceCents: number;
  images: ProductImage[];
  /** Máximo por pedido. */
  maxQty: number;
  /** Peso e dimensões da embalagem pronta pra envio — usados na cotação de
   * frete (Melhor Envio). PLACEHOLDER: medir a caixa real. */
  shipping: { weightKg: number; widthCm: number; heightCm: number; lengthCm: number };
  /** Teto de unidades à venda, contado pelo PRÓPRIO site (não depende do
   * Bling): chegou nele, esgota. `null` = sem teto (só o estoque do Bling). */
  stockCap: number | null;
  active: boolean;
};

/** Preço de teste (só pro teste de R$ 1). */
export const TEST_PRICE =
  Number(process.env.NEXT_PUBLIC_PRECO_TESTE_CENTAVOS) > 0
    ? Number(process.env.NEXT_PUBLIC_PRECO_TESTE_CENTAVOS)
    : null;

export const PRODUCTS: Product[] = [
  {
    sku: "FERN-KIT-PRE",
    slug: "kit-pre-lancamento",
    name: "Kit Fernandito Pré-Lançamento",
    description:
      "A primeira leva do Fernandito. Pra ti que é fã e quer provar antes de todo mundo.",
    contents: [
      { icon: "can", qty: "2", label: "latas 350ml" },
      { icon: "cup", qty: "1", label: "copo Fernandito" },
      { icon: "sticker", qty: "5", label: "adesivos" },
    ],
    // R$ 89,90 (igual ao cadastro no Bling). Teste de R$ 1: a variável
    // NEXT_PUBLIC_PRECO_TESTE_CENTAVOS=100 na Vercel troca o preço (+ redeploy).
    // DESLIGAR depois do teste — o check-up (/api/loja/checkup) avisa.
    priceCents: TEST_PRICE ?? 8990,
    images: [
      // Fotos do press kit (public/images/kit, reduzidas pra 2000px; o
      // next/image entrega no tamanho de cada tela).
      {
        src: "/images/kit/kit-caixa.jpg",
        alt: "Kit Fernandito aberto: 2 latas, o copo e os adesivos na caixa com palha",
        placeholder: "Foto do kit",
      },
      {
        src: "/images/kit/kit-copo.jpg",
        alt: "Copo Fernandito com fernet com cola e gelo",
        placeholder: "Foto: copo",
      },
      {
        src: "/images/kit/kit-adesivos.jpg",
        alt: "Adesivos do Fernandito espalhados sobre fundo verde",
        placeholder: "Foto: adesivos",
      },
      {
        src: "/images/kit/kit-carta.jpg",
        alt: "Carta de boas-vindas que vai dentro do kit",
        placeholder: "Foto: carta",
      },
    ],
    // Por pedido (não existe limite por CPF): 10 kits.
    maxQty: 10,
    // Igual ao cadastro no Bling: caixa 19 × 19 × 6,5 cm, 1,2 kg.
    shipping: { weightKg: 1.2, widthCm: 19, heightCm: 6.5, lengthCm: 19 },
    // O teto conta os já vendidos: 54 da 1ª leva + 105 liberados (100 em 30/10,
    // +4 em 31/10, +1 em 1/11) = 159. O Bling começou com 108 (contagem
    // física): sobram 3 de reserva fora do site. Pra liberar mais: sobe este
    // número (sem passar do saldo do Bling).
    stockCap: 159,
    active: true,
  },
  {
    sku: "FERN-350-6",
    slug: "six-pack",
    // TESTE (branch sixpack): preço, texto, fotos e teto ainda a confirmar.
    name: "Six Pack Fernandito",
    badge: "Novo · Six pack",
    contentsTitle: "O que vem no pack",
    description:
      "Seis latas de Fernandito 350ml. Fernet y cola gelado, pronto pra abrir e dividir.",
    contents: [{ icon: "can", qty: "6", label: "latas 350ml" }],
    priceCents: 10000,
    images: [
      { src: null, alt: "Six pack de Fernandito com 6 latas", placeholder: "Foto do six pack" },
      { src: null, alt: "Latas de Fernandito geladas", placeholder: "Foto: latas" },
    ],
    // Até 6 packs por pedido.
    maxQty: 6,
    // Igual ao cadastro no Bling: caixa 24 × 14 × 16,5 cm, 2,5 kg.
    shipping: { weightKg: 2.5, widthCm: 24, heightCm: 16.5, lengthCm: 14 },
    // TESTE: teto provisório até a contagem das latas.
    stockCap: 20,
    // No Bling o pack é composição de 6 latas: a baixa sai das latas.
    stockComponents: [{ sku: "FERN-350", qty: 6 }],
    active: true,
  },
];

export const ACTIVE_PRODUCTS = PRODUCTS.filter((product) => product.active);

/** Produto ativo pelo SKU (inativo ou inexistente → undefined). */
export function getProduct(sku: string) {
  return ACTIVE_PRODUCTS.find((product) => product.sku === sku);
}

/** Qualquer produto do catálogo pelo SKU, ativo ou não (pedidos antigos). */
export function getProductAny(sku: string) {
  return PRODUCTS.find((product) => product.sku === sku);
}

/** Produto ativo pelo endereço da página (/comprar/<slug>). */
export function getProductBySlug(slug: string) {
  return ACTIVE_PRODUCTS.find((product) => product.slug === slug);
}

/** O produto em destaque na seção/página de compra. */
export const FEATURED_PRODUCT = ACTIVE_PRODUCTS[0];

/** Divide o nome em título e subtítulo na palavra com hífen
 * ("Kit Fernandito" + "Pré-Lançamento"). Sem hífen, só o título. */
export function splitName(name: string) {
  const words = name.split(" ");
  const at = words.findIndex((word) => word.includes("-"));
  if (at <= 0) return { main: name, sub: "" };
  return { main: words.slice(0, at).join(" "), sub: words.slice(at).join(" ") };
}
