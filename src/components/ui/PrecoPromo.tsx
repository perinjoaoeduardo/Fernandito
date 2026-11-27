"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { clsx } from "clsx";
import { Price } from "@/components/ui/Price";
import { faltaPara, promoAtiva, type Promo } from "@/lib/promo";

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

/**
 * Chamada da promoção no Hero (fundo escuro): "Black Friday · Six pack de
 * R$ 94,99 por R$ 79,90 · termina em 05:12:09", levando pro produto.
 * Some sozinha quando acaba.
 */
export function HeroPromo({
  product,
  href,
  nome,
  className,
}: {
  product: ProdutoPreco;
  href: string;
  nome: string;
  className?: string;
}) {
  const agora = useAgora(Boolean(product.promo));
  const promo = agora === null ? (product.promo ?? null) : promoAtiva(product, agora);
  if (!promo) return null;
  const falta = agora === null ? null : faltaPara(promo.fim, agora);
  return (
    <NextLink
      href={href}
      className={clsx(
        "group border-fernandito-off-white/25 bg-fernandito-off-white/10 text-fernandito-off-white hover:bg-fernandito-off-white/20 duration-base ease-out-standard inline-flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-3xl border px-4 py-2 font-sans text-[0.8125rem] backdrop-blur-sm transition-colors",
        className,
      )}
    >
      <span className="bg-fernandito-off-white text-fernandito-verde-escuro rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-[0.14em] uppercase">
        {promo.selo}
      </span>
      <span>
        {nome} de{" "}
        <s className="opacity-60">
          <Price cents={product.priceCents} />
        </s>{" "}
        por{" "}
        <strong className="font-bold">
          <Price cents={promo.priceCents} />
        </strong>
      </span>
      <span className="tracking-[0.06em] uppercase opacity-70">
        {falta ? (
          <>
            termina em <span className="tabular-nums">{falta}</span>
          </>
        ) : (
          "só até meia-noite"
        )}
      </span>
    </NextLink>
  );
}
