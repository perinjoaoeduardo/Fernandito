"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEATURED_PRODUCT, splitName, type ContentIcon } from "@/lib/catalog";
import { Price } from "@/components/ui/Price";
import { STORE } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { KitSeal } from "@/components/ui/KitSeal";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { ProductGallery } from "@/components/sections/ProductGallery";
import { CanIcon, CupIcon, StickerIcon } from "@/components/ui/icons";
import { QtyStepper } from "@/components/cart/QtyStepper";
import { useCart } from "@/components/cart/CartProvider";
import { WHATSAPP_HREF } from "@/components/ui/WhatsAppButton";
import { gsap, ScrollTrigger, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";

const CONTENT_ICONS: Record<ContentIcon, ReactNode> = {
  can: <CanIcon className="h-7 w-7" />,
  cup: <CupIcon className="h-7 w-7" />,
  sticker: <StickerIcon className="h-7 w-7" />,
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
 * Compra do produto em destaque (hoje o Kit Pré-Lançamento): galeria com
 * selo de carimbo, nome (digitado, como os títulos do site), o que vem no
 * kit, preço, quantidade e "Adicionar ao carrinho". Usada na home (âncora
 * #comprar) e na página /comprar (aí o nome vira o h1).
 */
export function ComprarSection({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const product = FEATURED_PRODUCT;
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const remaining = useStockLeft();
  const sectionRef = useRef<HTMLElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  // Barra fixa do celular: aparece enquanto a pessoa está vendo o kit mas o
  // botão de compra de verdade ainda está ABAIXO da tela (ex.: olhando as
  // fotos). Quando o botão aparece — ou já ficou pra trás — ela some.
  useEffect(() => {
    const section = sectionRef.current;
    const buy = buyRef.current;
    if (!section || !buy) return;
    let sectionIn = false;
    let buyBelow = false;
    const update = () => setShowSticky(sectionIn && buyBelow);
    const sectionObserver = new IntersectionObserver(([e]) => {
      sectionIn = e.isIntersecting;
      update();
    });
    const buyObserver = new IntersectionObserver(([e]) => {
      buyBelow = !e.isIntersecting && e.boundingClientRect.top > 0;
      update();
    });
    sectionObserver.observe(section);
    buyObserver.observe(buy);
    return () => {
      sectionObserver.disconnect();
      buyObserver.disconnect();
    };
  }, [product]);

  // Entrada com as animações que o site já usa: a foto aparece desfazendo
  // um zoom leve (como a do Contato), as miniaturas e os blocos de texto
  // sobem em cascata (`DURATION.enter` + `EASE.outStandard`), o nome se
  // digita (TypewriterText) e o selo "carimba" (`back.out(2.2)`, como os
  // selos da Carta). Tudo uma vez, ao entrar na tela. Sem animação sob
  // prefers-reduced-motion.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;
    const image = section.querySelector<HTMLElement>("[data-gallery-image]");
    const thumbs = gsap.utils.toArray<HTMLElement>("[data-gallery-thumb]", section);
    const seal = section.querySelector<HTMLElement>("[data-seal]");
    const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", section);
    const all = [image, seal, ...thumbs, ...items].filter(Boolean) as HTMLElement[];

    if (image) gsap.set(image, { opacity: 0, scale: 1.06 });
    if (seal) gsap.set(seal, { autoAlpha: 0, scale: 2.2, rotate: -30 });
    gsap.set([...thumbs, ...items], { opacity: 0, y: 24 });

    const tl = gsap.timeline({ paused: true });
    if (image) tl.to(image, { opacity: 1, scale: 1, duration: 1.1, ease: EASE.outStandard }, 0);
    tl.to(
      thumbs,
      { opacity: 1, y: 0, duration: DURATION.enter, ease: EASE.outStandard, stagger: 0.06 },
      0.35,
    );
    if (seal)
      tl.to(seal, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.6, ease: "back.out(2.2)" }, 0.7);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top 75%",
      once: true,
      onEnter: () => tl.play(),
    });
    // Os blocos de texto entram conforme chegam na tela (no celular eles
    // ficam abaixo da foto).
    const batch = ScrollTrigger.batch(items, {
      start: "top 92%",
      once: true,
      interval: 0.1,
      onEnter: (els) =>
        gsap.to(els, {
          opacity: 1,
          y: 0,
          duration: DURATION.enter,
          ease: EASE.outStandard,
          stagger: 0.08,
          delay: 0.15,
        }),
    });

    return () => {
      trigger.kill();
      batch.forEach((t) => t.kill());
      tl.kill();
      gsap.set(all, { clearProps: "opacity,visibility,transform" });
    };
  }, [product]);

  if (!product) return null;
  const maxQty = remaining && remaining > 0 ? Math.min(product.maxQty, remaining) : product.maxQty;
  const showStock = remaining !== null && remaining > 0 && remaining <= STOCK_BADGE_MAX;
  const { main: title } = splitName(product.name);
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
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-20 xl:gap-24">
        <div className="w-full max-w-xl lg:max-w-none">
          <ProductGallery
            images={product.images}
            seal={
              <div
                data-seal
                className="absolute -top-4 -right-3 sm:-top-6 sm:-right-6 lg:-top-8 lg:-right-8"
              >
                <KitSeal text={STORE.badge} className="h-28 w-28 sm:h-36 sm:w-36" />
              </div>
            }
          />
        </div>

        <div className="flex flex-col items-start font-sans">
          <p
            data-reveal
            className="font-accent text-label text-fernandito-verde-medio tracking-[0.18em] uppercase"
          >
            {STORE.kitEyebrow}
          </p>
          <TypewriterText
            as={headingLevel}
            text={title}
            mode="play"
            start="top 85%"
            charsPerSecond={20}
            delay={0.3}
            className="font-rampart mt-3 text-[clamp(2.5rem,4.6vw,4rem)] leading-[0.98]"
          />
          <p data-reveal className="text-body-lg mt-5 max-w-md">
            {product.description}
          </p>

          {/* O que vem no kit: ficha única, três colunas. */}
          <div data-reveal className="mt-9 w-full max-w-md">
            <p className="text-label tracking-[0.1em] uppercase opacity-70">
              {STORE.contentsTitle}
            </p>
            <ul className="border-fernandito-verde-escuro/15 divide-fernandito-verde-escuro/15 mt-3 grid grid-cols-3 divide-x overflow-hidden rounded-2xl border bg-white/35">
              {product.contents.map((item) => (
                <li
                  key={item.label}
                  className="duration-base ease-out-standard flex flex-col items-center px-2 pt-5 pb-4 text-center transition-colors hover:bg-white/45"
                >
                  <span className="text-fernandito-verde-medio">{CONTENT_ICONS[item.icon]}</span>
                  <span className="font-rampart mt-2 text-[2.75rem] leading-none tabular-nums">
                    {item.qty}
                  </span>
                  <span className="text-label mt-1.5 leading-snug tracking-[0.06em] uppercase opacity-75">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-rampart text-[clamp(2.5rem,4vw,3.25rem)] leading-none tabular-nums">
              <Price cents={product.priceCents} />
            </p>
            {showStock && (
              <span className="border-fernandito-verde-medio/30 bg-fernandito-verde-medio/10 text-label inline-flex items-center gap-2 rounded-full border px-3 py-1.5 tracking-[0.08em] uppercase">
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

          <div
            ref={buyRef}
            data-reveal
            className="mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="self-start">
              <QtyStepper
                value={qty}
                max={maxQty}
                onChange={setQty}
                label={`Quantidade de ${product.name}`}
              />
            </div>
            <Button
              variant="primary"
              onClick={addToCart}
              className="w-full !py-3.5 whitespace-nowrap sm:w-auto sm:flex-1"
            >
              {STORE.addToCart}
            </Button>
          </div>

          {WHATSAPP_HREF && (
            <p data-reveal className="text-label mt-5 tracking-[0.04em] opacity-75">
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

      {/* Barra de compra flutuante — só no celular, quando o botão sai da
          tela. Mesmo desenho do menu (barra escura, cantos redondos). */}
      <div
        aria-hidden={!showSticky}
        inert={!showSticky}
        className={clsx(
          "bg-fernandito-verde-escuro/95 text-fernandito-off-white duration-slow ease-out-standard fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-4 rounded-full py-2 pr-2 pl-6 shadow-[0_16px_40px_rgba(20,28,18,0.4)] transition-[transform,opacity] md:hidden",
          showSticky ? "translate-y-0 opacity-100" : "translate-y-[150%] opacity-0",
        )}
      >
        <p className="font-rampart text-[1.6rem] leading-none tabular-nums">
          <Price cents={product.priceCents} />
        </p>
        <button
          type="button"
          onClick={addToCart}
          className="bg-fernandito-off-white text-fernandito-verde-escuro duration-base ease-out-standard flex h-12 items-center rounded-full px-6 font-sans text-[0.8125rem] font-bold tracking-[0.06em] uppercase transition-transform active:scale-[0.97]"
        >
          {STORE.stickyCta}
        </button>
      </div>
    </section>
  );
}

export default ComprarSection;
