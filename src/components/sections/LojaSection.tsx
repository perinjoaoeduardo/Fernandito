"use client";

import { clsx } from "clsx";
import NextLink from "next/link";
import { useEffect, useRef } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";
import { ACTIVE_PRODUCTS, splitName, type Product } from "@/lib/catalog";
import { STORE } from "@/content/site";
import { Price } from "@/components/ui/Price";
import { ArrowRightIcon } from "@/components/ui/icons";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { useStock } from "@/components/cart/useStock";

function ProductCard({ product, index }: { product: Product; index: number }) {
  const { soldOut } = useStock(product.sku);
  const comingSoon = Boolean(product.comingSoon);
  // Só o nome (o selo da foto já diz "Pré-lançamento" / "Novo").
  const title = product.shortName ?? splitName(product.name).main;
  const href = `/comprar/${product.slug}`;
  const badge = product.badge ?? STORE.badge;
  return (
    <li data-card>
      <NextLink
        href={href}
        className="group focus-visible:outline-fernandito-verde-medio block h-full rounded-[1.75rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <article className="duration-base ease-out-standard flex h-full flex-col transition-transform group-hover:-translate-y-1">
          <div className="duration-base ease-out-standard relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] shadow-[0_24px_50px_rgba(36,48,34,0.18)] transition-shadow group-hover:shadow-[0_32px_64px_rgba(36,48,34,0.26)] lg:aspect-[5/4]">
            <div
              className={clsx(
                "duration-slow ease-out-standard absolute inset-0 transition-transform group-hover:scale-[1.03]",
                soldOut && "opacity-70 grayscale-[0.5]",
              )}
            >
              {/* Parallax (GSAP) aqui dentro; o zoom do hover fica no pai. */}
              <div data-card-photo className="absolute inset-0">
                <PhotoSlot
                  image={product.images[0]}
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  eager={index === 0}
                  placeholderClassName="bg-fernandito-verde-medio text-fernandito-off-white"
                />
              </div>
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
          {/* Ritmo: foto → 20px → nome + preço (mesma linha) → 4px → o que vem
              → 16px → botão. Uma hierarquia só: nome manda, preço acompanha,
              o resto sussurra. */}
          <div className="mt-5 flex flex-col font-sans">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-rampart text-[clamp(1.7rem,2.6vw,2.2rem)] leading-[1]">
                {title}
              </h2>
              <p
                className={clsx(
                  "font-rampart text-[1.5rem] leading-none whitespace-nowrap tabular-nums",
                  soldOut && "opacity-45",
                )}
              >
                <Price cents={product.priceCents} />
              </p>
            </div>
            <p className="text-label mt-1.5 tracking-[0.12em] uppercase opacity-60">
              {product.contents.map((c) => `${c.qty} ${c.label}`).join(" · ")}
            </p>
            {soldOut || comingSoon ? (
              // Mesmo botão do "Comprar", em verde-escuro desbotado: desativado,
              // não chama mais que o produto à venda.
              <span className="bg-fernandito-verde-escuro/35 text-fernandito-off-white/80 mt-4 inline-flex h-12 w-full cursor-default items-center justify-center rounded-full px-6 text-[1rem] font-bold tracking-[0.02em] transition-colors">
                {comingSoon ? STORE.comingSoon : STORE.soldOut}
              </span>
            ) : (
              <span className="bg-fernandito-verde-escuro text-fernandito-off-white group-hover:bg-fernandito-verde-medio duration-base ease-out-standard mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[1rem] font-bold tracking-[0.02em] transition-colors">
                Comprar
                <span className="duration-base ease-out-standard transition-transform group-hover:translate-x-1">
                  <ArrowRightIcon />
                </span>
              </span>
            )}
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
  const ref = useRef<HTMLElement>(null);

  // Movimento no mesmo idioma do site: o título entra subindo; cada cartão
  // aparece subindo quando chega na tela (os já visíveis entram em cascata),
  // e a foto desfaz um zoom leve conforme sobe (parallax, scrub). Sem nada
  // disso sob prefers-reduced-motion.
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const head = gsap.utils.toArray<HTMLElement>("[data-head]", root);
    const cards = gsap.utils.toArray<HTMLElement>("[data-card]", root);
    const tweens: gsap.core.Animation[] = [
      gsap.fromTo(
        head,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: DURATION.enter, ease: EASE.outStandard, stagger: 0.08 },
      ),
    ];
    cards.forEach((card, i) => {
      tweens.push(
        gsap.fromTo(
          card,
          { opacity: 0, y: 36 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION.enter,
            ease: EASE.outStandard,
            delay: 0.15 + (i % 2) * 0.1,
            scrollTrigger: { trigger: card, start: "top 92%", once: true },
          },
        ),
      );
      const photo = card.querySelector<HTMLElement>("[data-card-photo]");
      if (photo)
        tweens.push(
          gsap.fromTo(
            photo,
            { scale: 1.08 },
            {
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                start: "top bottom",
                end: "center center",
                scrub: 0.6,
              },
            },
          ),
        );
    });
    return () => {
      tweens.forEach((t) => {
        t.scrollTrigger?.kill();
        t.kill();
      });
      gsap.set([...head, ...cards], { clearProps: "opacity,transform" });
    };
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby="loja-title"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 pt-[calc(6.5rem+var(--announcement-h))] pb-16 sm:px-10 md:pb-28 lg:px-16"
    >
      <div className="mx-auto w-full max-w-6xl">
        {/* Sem "← Início": o menu já leva pra home. */}
        <h1
          id="loja-title"
          data-head
          className="font-rampart text-[clamp(2.2rem,4.5vw,3.2rem)] leading-[0.95]"
        >
          Loja
        </h1>
        <p data-head className="text-body mt-2 font-sans opacity-80">
          Escolhe o teu Fernandito.
        </p>
        <ul className="mt-7 grid gap-10 sm:grid-cols-2 lg:gap-12">
          {list.map((product, i) => (
            <ProductCard key={product.sku} product={product} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}

export default LojaSection;
