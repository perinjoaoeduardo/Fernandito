"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { clsx } from "clsx";
import { Price } from "@/components/ui/Price";
import { faltaPara, promoAtiva, type Promo } from "@/lib/promo";
import { getProduct } from "@/lib/catalog";

/**
 * Relógio da promoção: `null` até montar no navegador (o HTML do servidor e o
 * 1º desenho ficam iguais), depois a hora de verdade, batendo a cada segundo
 * só enquanto tem promoção no ar.
 */
export function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hora só existe no navegador
    setAgora(Date.now());
    if (!ativo) return;
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [ativo]);
  return agora;
}

type ProdutoPreco = { priceCents: number; promo?: Promo };

/**
 * Preço do produto pra usar no lugar do <Price>: com promoção no ar, o preço
 * antigo riscado (menor) e o novo. Antes de montar, conta a promoção como no
 * ar (o caso normal enquanto ela existe); depois da hora, volta pro normal.
 */
export function PrecoProduto({ product }: { product: ProdutoPreco }) {
  const agora = useAgora(Boolean(product.promo));
  const promo = agora === null ? (product.promo ?? null) : promoAtiva(product, agora);
  if (!promo) return <Price cents={product.priceCents} />;
  return (
    <>
      <s className="mr-[0.35em] align-[0.2em] text-[0.55em] decoration-[0.08em] opacity-50">
        <span className="sr-only">De </span>
        <Price cents={product.priceCents} />
      </s>
      <span className="sr-only">por </span>
      <Price cents={promo.priceCents} />
    </>
  );
}

/** Selo da promoção + "termina em 05:12:09". Some sozinho quando acaba. */
export function PromoSelo({
  product,
  className,
  tom = "escuro",
}: {
  product: ProdutoPreco;
  className?: string;
  /** escuro = selo verde-escuro (fundo claro); claro = selo claro (fundo escuro). */
  tom?: "escuro" | "claro";
}) {
  const agora = useAgora(Boolean(product.promo));
  const promo = agora === null ? (product.promo ?? null) : promoAtiva(product, agora);
  if (!promo) return null;
  const falta = agora === null ? null : faltaPara(promo.fim, agora);
  return (
    <span className={clsx("inline-flex flex-wrap items-center gap-2 font-sans", className)}>
      <span
        className={clsx(
          "text-label inline-flex items-center rounded-full px-3 py-1 font-bold tracking-[0.14em] uppercase",
          tom === "escuro"
            ? "bg-fernandito-verde-escuro text-fernandito-off-white"
            : "bg-fernandito-off-white text-fernandito-verde-escuro",
        )}
      >
        {promo.selo}
      </span>
      <span className="text-label tracking-[0.08em] uppercase opacity-75" aria-live="off">
        {falta ? (
          <>
            termina em <span className="tabular-nums">{falta}</span>
          </>
        ) : (
          "só até meia-noite"
        )}
      </span>
    </span>
  );
}

/** O six pack (o produto da promoção de hoje), pra faixa do topo. */
const PRODUTO_FAIXA = getProduct("FERN-350-6");

/**
 * Faixa preta fixa no topo enquanto a promoção está no ar, em todas as
 * páginas: "BLACK FRIDAY · Six pack de R$ 94,99 por R$ 79,90 · termina em
 * 05:12:09 →", levando pro produto. Usa o mesmo espaço da faixa antiga
 * (`--announcement-h`): o menu desce junto. O `layout.tsx` já liga a classe
 * antes de pintar; daqui ela sai quando a promoção acaba.
 */
export function PromoBar() {
  const product = PRODUTO_FAIXA;
  const agora = useAgora(Boolean(product?.promo));
  const promo = !product
    ? null
    : agora === null
      ? (product.promo ?? null)
      : promoAtiva(product, agora);

  useEffect(() => {
    if (agora === null) return;
    document.documentElement.classList.toggle("has-announcement", Boolean(promo));
  }, [agora, promo]);

  if (!product || !promo) return null;
  const falta = agora === null ? null : faltaPara(promo.fim, agora);
  return (
    <NextLink
      href={`/comprar/${product.slug}`}
      aria-label={`${promo.selo}: six pack de ${(product.priceCents / 100).toFixed(2).replace(".", ",")} por ${(promo.priceCents / 100).toFixed(2).replace(".", ",")} reais, só até meia-noite`}
      className="fixed inset-x-0 top-0 z-[55] flex h-8 items-center justify-center gap-2 bg-[#0c0d0b] px-3 font-sans text-[11px] leading-none whitespace-nowrap text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[#1c1f1a] sm:gap-3 sm:text-[12.5px]"
    >
      <span className="font-bold tracking-[0.16em] uppercase">{promo.selo}</span>
      <span aria-hidden className="opacity-40">
        ·
      </span>
      <span>
        Six pack{" "}
        <s className="hidden opacity-55 sm:inline">
          <Price cents={product.priceCents} />
        </s>{" "}
        <span className="hidden sm:inline">por </span>
        <strong className="font-bold">
          <Price cents={promo.priceCents} />
        </strong>
      </span>
      <span aria-hidden className="opacity-40">
        ·
      </span>
      <span className="tabular-nums opacity-80">
        <span className="hidden sm:inline">termina em </span>
        {falta ?? "até 00h"}
      </span>
      <span aria-hidden className="hidden sm:inline">
        →
      </span>
    </NextLink>
  );
}
