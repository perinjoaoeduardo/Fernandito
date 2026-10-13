"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEATURED_PRODUCT, splitName, type ContentIcon } from "@/lib/catalog";
import { Price } from "@/components/ui/Price";
import { STORE } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { ProductGallery } from "@/components/sections/ProductGallery";
import { CanIcon, CupIcon, StickerIcon } from "@/components/ui/icons";
import { QtyStepper } from "@/components/cart/QtyStepper";
import { useCart } from "@/components/cart/CartProvider";
import { WHATSAPP_HREF } from "@/components/ui/WhatsAppButton";
import { gsap, ScrollTrigger, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";

const CONTENT_ICONS: Record<ContentIcon, ReactNode> = {
  can: <CanIcon />,
  cup: <CupIcon />,
  sticker: <StickerIcon />,
};

/** Estoque real do kit (Bling) via /api/estoque; `null` = não mostrar. */
function useStockLeft() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/estoque", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { remaining?: number | null } | null) => {
        if (typeof data?.remaining === "number") setRemaining(data.remaining);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return remaining;
}

/** Só mostra o selo quando o estoque está baixo (acima disso não é urgência). */
const STOCK_BADGE_MAX = 30;

/**
 * Compra do produto em destaque (hoje o Kit Pré-Lançamento): foto com selo,
 * nome, o que vem, preço, quantidade e "Adicionar ao carrinho". Usada na
 * home (âncora #comprar) e na página /comprar (aí o nome vira o h1).
 */
export function ComprarSection({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const product = FEATURED_PRODUCT;
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const remaining = useStockLeft();
  const sectionRef = useRef<HTMLElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  // Barra fixa do celular: aparece quando o botão de compra já passou por
  // cima da tela e o fim do bloco (fim do bloco) ainda não chegou — assim
  // não cobre o rodapé nem aparece antes da hora.
  useEffect(() => {
    const buy = buyRef.current;
    const end = endRef.current;
    if (!buy || !end) return;
    let buyAbove = false;
    let endBelow = true;
    const update = () => setShowSticky(buyAbove && endBelow);
    const buyObserver = new IntersectionObserver(([e]) => {
      buyAbove = !e.isIntersecting && e.boundingClientRect.bottom < 0;
      update();
    });
    const endObserver = new IntersectionObserver(([e]) => {
      endBelow = !e.isIntersecting && e.boundingClientRect.top > 0;
      update();
    });
    buyObserver.observe(buy);
    endObserver.observe(end);
    return () => {
      buyObserver.disconnect();
      endObserver.disconnect();
    };
  }, [product]);

  // Entrada dos blocos ao chegarem na tela (mesma voz do resto do site:
  // `DURATION.enter` + `EASE.outStandard`, só sobe e aparece, em cascata) e o
  // selo "carimba" por último. Sem animação sob prefers-reduced-motion.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;
    const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", section);
    const badge = section.querySelector<HTMLElement>("[data-stamp]");
    gsap.set(items, { opacity: 0, y: 24 });
    const triggers: ScrollTrigger[] = ScrollTrigger.batch(items, {
      start: "top 92%",
      once: true,
      interval: 0.1,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: DURATION.enter,
          ease: EASE.outStandard,
          stagger: 0.08,
          clearProps: "opacity,transform",
        }),
    });
    if (badge) {
      gsap.set(badge, { opacity: 0, scale: 1.5, rotate: -14 });
      triggers.push(
        ScrollTrigger.create({
          trigger: badge,
          start: "top 92%",
          once: true,
          onEnter: () =>
            gsap.to(badge, {
              opacity: 1,
              scale: 1,
              rotate: -4,
              duration: DURATION.slow,
              delay: 0.5,
              ease: "back.out(2.2)",
              clearProps: "opacity,transform",
            }),
        }),
      );
    }
    return () => {
      triggers.forEach((trigger) => trigger.kill());
      gsap.set([...items, ...(badge ? [badge] : [])], { clearProps: "opacity,transform" });
    };
  }, [product]);

  if (!product) return null;
  const Heading = headingLevel;
  const maxQty = remaining && remaining > 0 ? Math.min(product.maxQty, remaining) : product.maxQty;
  const showStock = remaining !== null && remaining > 0 && remaining <= STOCK_BADGE_MAX;
  const { main: titleMain, sub: titleSub } = splitName(product.name);
  const addToCart = () => {
    add(product.sku, qty);
    setQty(1);
  };

  return (
    <section
      ref={sectionRef}
      id="comprar"
      aria-label={STORE.eyebrow}
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-20 sm:px-10 md:py-28 lg:px-16"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16">
        {/* Galeria com o selo de edição limitada, estilo carimbo. */}
        <ProductGallery images={product.images}>
          {/* Selo estilo carimbo: linha 1 grande, linha 2 menor, aro interno
              claro e sombra marcada (maior que o anterior, pra chamar o olho). */}
          <span
            data-stamp
            className="bg-fernandito-verde-escuro text-fernandito-off-white font-accent ring-fernandito-off-white/35 absolute top-4 left-4 flex origin-top-left rotate-[-4deg] flex-col items-center gap-0.5 rounded-2xl px-5 py-3 text-center uppercase shadow-[0_10px_24px_rgba(36,48,34,0.4)] ring-2 ring-inset sm:top-6 sm:left-6 sm:px-7 sm:py-4"
          >
            <span className="font-rampart-stamp text-[clamp(1.05rem,2.4vw,1.5rem)] leading-none tracking-[0.1em]">
              {STORE.badge.split(" · ")[0]}
            </span>
            {STORE.badge.includes(" · ") && (
              <span className="text-[0.7rem] tracking-[0.2em] opacity-85 sm:text-xs">
                ★ {STORE.badge.split(" · ")[1]} ★
              </span>
            )}
          </span>
        </ProductGallery>

        <div className="flex flex-col items-start font-sans">
          <p data-reveal className="font-accent text-label tracking-[0.16em] uppercase opacity-70">
            {STORE.eyebrow}
          </p>
          <Heading
            data-reveal
            className="font-rampart mt-3 text-[clamp(2rem,3.5vw,3.1rem)] leading-[1.02]"
          >
            {/* Título em duas linhas de propósito: o nome ("Kit Fernandito") e,
                embaixo, o que ele é ("Pré-lançamento"), em verde-médio. */}
            <span className="block">{titleMain}</span>
            {titleSub && (
              <span className="text-fernandito-verde-medio block whitespace-nowrap">
                {" "}
                {titleSub}
              </span>
            )}
          </Heading>
          <p data-reveal className="text-body-lg mt-5 max-w-md">
            {product.description}
          </p>

          <h3 data-reveal className="text-label mt-8 tracking-[0.08em] uppercase opacity-70">
            {STORE.contentsTitle}
          </h3>
          <ul className="mt-4 grid w-full grid-cols-3 gap-3 sm:gap-4">
            {product.contents.map((item) => (
              <li
                key={item.label}
                data-reveal
                className="bg-fernandito-verde-escuro/[0.05] border-fernandito-verde-escuro/15 duration-base ease-out-standard hover:border-fernandito-verde-medio hover:bg-fernandito-verde-escuro/[0.09] flex flex-col items-center rounded-2xl border px-2 pt-5 pb-4 text-center transition-[background-color,border-color,transform] hover:-translate-y-1"
              >
                <span className="bg-fernandito-verde-medio text-fernandito-off-white flex h-11 w-11 items-center justify-center rounded-full">
                  {CONTENT_ICONS[item.icon]}
                </span>
                <span className="font-rampart mt-3 text-[clamp(2rem,3.4vw,2.75rem)] leading-none tabular-nums">
                  {item.qty}
                </span>
                <span className="text-label mt-2 leading-snug tracking-[0.06em] uppercase opacity-80">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <p
            data-reveal
            className="font-rampart mt-8 text-[clamp(2rem,3.4vw,2.75rem)] leading-none tabular-nums"
          >
            <Price cents={product.priceCents} />
          </p>

          {showStock && (
            <p className="font-accent text-label mt-4 tracking-[0.12em] uppercase">
              <span
                aria-hidden="true"
                className="bg-fernandito-verde-medio mr-2 inline-block h-2 w-2 rounded-full align-middle"
              />
              {remaining === 1
                ? STORE.stockLast
                : STORE.stockLeft.replace("{n}", String(remaining))}
            </p>
          )}

          <div ref={buyRef} data-reveal className="mt-4 flex flex-wrap items-center gap-4">
            <QtyStepper
              value={qty}
              max={maxQty}
              onChange={setQty}
              label={`Quantidade de ${product.name}`}
            />
            <Button variant="primary" onClick={addToCart}>
              {STORE.addToCart}
            </Button>
          </div>
          {/* Marca o fim do bloco (a barra fixa do celular some aqui). */}
          <div ref={endRef} aria-hidden="true" className="h-px w-full" />

          {WHATSAPP_HREF && (
            <p data-reveal className="text-body mt-6 opacity-80">
              {STORE.helpPrefix}{" "}
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-fernandito-verde-medio duration-base ease-out-standard underline underline-offset-4 transition-colors"
              >
                {STORE.helpLink}
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Barra de compra fixa — só no celular, quando o botão sai da tela. */}
      <div
        aria-hidden={!showSticky}
        inert={!showSticky}
        className={clsx(
          "bg-fernandito-off-white border-fernandito-verde-escuro/20 duration-base ease-out-standard fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-[transform,box-shadow] md:hidden",
          showSticky
            ? "translate-y-0 shadow-[0_-8px_24px_rgba(36,48,34,0.18)]"
            : "translate-y-full",
        )}
      >
        <p className="font-rampart text-2xl leading-none tabular-nums">
          <Price cents={product.priceCents} />
        </p>
        <Button variant="primary" onClick={addToCart}>
          {STORE.stickyCta}
        </Button>
      </div>
    </section>
  );
}
