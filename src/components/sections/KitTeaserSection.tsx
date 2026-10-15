"use client";

import NextLink from "next/link";
import { FEATURED_PRODUCT, splitName } from "@/lib/catalog";
import { PAGES, SHOP_HREF } from "@/content/site";
import { Price } from "@/components/ui/Price";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * Chamada do kit na home (site completo): foto, nome, uma linha, preço e
 * "Ver o kit" → página /comprar, onde mora a compra de verdade. Bege
 * (contraste) logo depois da Hero; a foto inteira também é clicável.
 */
export function KitTeaserSection() {
  const product = FEATURED_PRODUCT;
  if (!product) return null;
  const { main } = splitName(product.name);
  return (
    <section
      id="kit"
      aria-labelledby="kit-titulo"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-20 sm:px-10 md:py-28 lg:px-16"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <NextLink
          href={SHOP_HREF}
          aria-label={`Ver o ${main}`}
          className="group bg-fernandito-verde-medio relative block aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-[0_30px_70px_rgba(36,48,34,0.25)]"
        >
          <div className="duration-slow ease-out-standard absolute inset-0 transition-transform group-hover:scale-[1.03]">
            <PhotoSlot
              image={product.images[0]}
              sizes="(max-width: 767px) 90vw, 45vw"
              placeholderClassName="bg-fernandito-verde-medio"
            />
          </div>
        </NextLink>
        <div className="flex flex-col items-start font-sans">
          <p className="font-accent text-label text-fernandito-verde-medio tracking-[0.18em] uppercase">
            {PAGES.kitTeaser.eyebrow}
          </p>
          <h2
            id="kit-titulo"
            className="font-rampart mt-3 text-[clamp(2.2rem,4vw,3.4rem)] leading-[1]"
          >
            {main}
          </h2>
          <p className="text-body-lg mt-4 max-w-md opacity-85">{product.description}</p>
          <p className="font-rampart mt-6 text-[clamp(1.9rem,2.6vw,2.3rem)] leading-none tabular-nums">
            <Price cents={product.priceCents} />
          </p>
          <NextLink
            href={SHOP_HREF}
            className="group bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio duration-base ease-out-standard mt-7 inline-flex h-12 items-center gap-2 rounded-full px-7 text-[0.95rem] font-bold transition-colors"
          >
            {PAGES.kitTeaser.cta}
            <span className="duration-base ease-out-standard transition-transform group-hover:translate-x-1">
              <ArrowRightIcon />
            </span>
          </NextLink>
        </div>
      </div>
    </section>
  );
}

export default KitTeaserSection;
