"use client";

import { clsx } from "clsx";
import NextLink from "next/link";
import { ACTIVE_PRODUCTS, splitName, type Product } from "@/lib/catalog";
import { STORE } from "@/content/site";
import { Price } from "@/components/ui/Price";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { useStock } from "@/components/cart/useStock";

/** Só mostra "Restam X" quando o estoque está baixo. */
const STOCK_BADGE_MAX = 30;

function ProductCard({ product, index }: { product: Product; index: number }) {
  const { remaining, soldOut } = useStock(product.sku);
  const { main, sub } = splitName(product.name);
  const href = `/comprar/${product.slug}`;
  const low = !soldOut && remaining !== null && remaining > 0 && remaining <= STOCK_BADGE_MAX;
  const badge = product.badge ?? STORE.badge;
  return (
    <li>
      <NextLink
        href={href}
        className="group focus-visible:outline-fernandito-verde-medio block h-full rounded-[1.75rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <article className="flex h-full flex-col">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] shadow-[0_24px_50px_rgba(36,48,34,0.18)] lg:aspect-[5/4]">
            <div
              className={clsx(
                "duration-slow ease-out-standard absolute inset-0 transition-transform group-hover:scale-[1.03]",
                soldOut && "opacity-70 grayscale-[0.5]",
              )}
            >
              <PhotoSlot
                image={product.images[0]}
                sizes="(min-width: 1024px) 40vw, 90vw"
                eager={index === 0}
                placeholderClassName="bg-fernandito-verde-medio text-fernandito-off-white"
              />
            </div>
            <span className="bg-fernandito-verde-escuro text-fernandito-off-white ring-fernandito-off-white font-rampart-stamp absolute top-4 left-4 rotate-[-4deg] rounded-xl px-3 py-1.5 text-[0.85rem] leading-none tracking-[0.1em] uppercase ring-[3px]">
              {badge.split(" · ")[0]}
            </span>
            {soldOut && (
              <span className="bg-fernandito-off-white text-fernandito-verde-escuro text-label absolute right-4 bottom-4 rounded-full px-3 py-1 font-bold tracking-[0.14em] uppercase">
                {STORE.soldOut}
              </span>
            )}
          </div>
          <div className="mt-5 flex flex-1 flex-col font-sans">
            <h2 className="font-rampart text-[clamp(1.7rem,2.6vw,2.2rem)] leading-[1]">{main}</h2>
            {sub && <p className="text-label mt-1 tracking-[0.12em] uppercase opacity-60">{sub}</p>}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
              <p className="font-rampart text-[1.9rem] leading-none tabular-nums">
                <Price cents={product.priceCents} />
              </p>
              {low && (
                <span className="border-fernandito-verde-medio/30 bg-fernandito-verde-medio/10 text-label inline-flex items-center gap-2 rounded-full border px-3 py-1 tracking-[0.08em] uppercase">
                  <span
                    aria-hidden="true"
                    className="bg-fernandito-verde-medio h-1.5 w-1.5 animate-pulse rounded-full"
                  />
                  {remaining === 1
                    ? STORE.stockLast
                    : STORE.stockLeft.replace("{n}", String(remaining))}
                </span>
              )}
            </div>
            <span
              className={clsx(
                "duration-base ease-out-standard mt-4 inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[0.95rem] font-bold tracking-[0.02em] transition-colors",
                soldOut
                  ? "border-fernandito-verde-escuro/30 text-fernandito-verde-escuro/70 border-[1.5px]"
                  : "bg-fernandito-verde-escuro text-fernandito-off-white group-hover:bg-fernandito-verde-medio",
              )}
            >
              {soldOut ? "Esgotado · ver como foi" : "Ver e comprar"}
            </span>
          </div>
        </article>
      </NextLink>
    </li>
  );
}

/**
 * Loja (/comprar): os produtos lado a lado. O que esgotou continua aqui,
 * com o selo "Esgotado" (mostra que rolou); cada cartão abre a página do
 * produto (/comprar/<slug>). Os à venda vêm primeiro.
 */
export function LojaSection({ order }: { order?: string[] }) {
  const list = order
    ? order.map((sku) => ACTIVE_PRODUCTS.find((p) => p.sku === sku)!).filter(Boolean)
    : ACTIVE_PRODUCTS;
  return (
    <section
      aria-labelledby="loja-title"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 pt-[calc(8rem+var(--announcement-h))] pb-20 sm:px-10 md:pb-28 lg:px-16"
    >
      <div className="mx-auto w-full max-w-6xl">
        <NextLink
          href="/"
          className="text-label duration-base ease-out-standard inline-flex items-center gap-2 font-sans tracking-[0.1em] uppercase opacity-60 transition-opacity hover:opacity-100"
        >
          <span aria-hidden="true">←</span> Início
        </NextLink>
        <h1
          id="loja-title"
          className="font-rampart mt-8 text-[clamp(2.4rem,5vw,3.6rem)] leading-[0.95]"
        >
          Loja
        </h1>
        <p className="text-body mt-3 max-w-lg font-sans opacity-80">
          Fernandito direto de Porto Alegre pra tua geladeira.
        </p>
        <ul className="mt-12 grid gap-12 sm:grid-cols-2 lg:gap-16">
          {list.map((product, i) => (
            <ProductCard key={product.sku} product={product} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}

export default LojaSection;
