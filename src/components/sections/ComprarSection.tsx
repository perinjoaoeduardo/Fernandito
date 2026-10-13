"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEATURED_PRODUCT, splitName, type ContentIcon } from "@/lib/catalog";
import { Price } from "@/components/ui/Price";
import { STORE } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { ProductGallery } from "@/components/sections/ProductGallery";
import { CanIcon, CupIcon, StickerIcon } from "@/components/ui/icons";
import { QtyStepper } from "@/components/cart/QtyStepper";
import { useCart } from "@/components/cart/CartProvider";
import { WHATSAPP_HREF } from "@/components/ui/WhatsAppButton";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";

const CONTENT_ICONS: Record<ContentIcon, ReactNode> = {
  can: <CanIcon className="h-4 w-4" />,
  cup: <CupIcon className="h-4 w-4" />,
  sticker: <StickerIcon className="h-4 w-4" />,
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
 * etiqueta "Pré-lançamento", nome (digitado, como os títulos do site), o
 * que vem no kit em etiquetas pequenas, preço, quantidade e "Adicionar ao
 * carrinho". A foto é a protagonista; o texto fica enxuto. Usada na home (âncora
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

  // Animação de rolagem nos dois sentidos: os blocos sobem e aparecem ao
  // entrar na tela (descendo OU subindo a página) e somem de leve ao sair,
  // pra entrarem de novo na volta. A foto desfaz um zoom leve e o selo
  // "carimba". Mesma voz do site (`DURATION.enter` + `EASE.outStandard`).
  // O nome se digita uma vez só (TypewriterText). Sem animação sob
  // prefers-reduced-motion.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;
    const image = section.querySelector<HTMLElement>("[data-gallery-image]");
    const thumbs = gsap.utils.toArray<HTMLElement>("[data-gallery-thumb]", section);
    const stamp = section.querySelector<HTMLElement>("[data-stamp]");
    const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", section);
    const all = [image, stamp, ...thumbs, ...items].filter(Boolean) as HTMLElement[];
    const toggle = "play reverse play reverse";
    const tweens: gsap.core.Tween[] = [];

    if (image)
      tweens.push(
        gsap.fromTo(
          image,
          { opacity: 0, scale: 1.06 },
          {
            opacity: 1,
            scale: 1,
            duration: 1.1,
            ease: EASE.outStandard,
            scrollTrigger: {
              trigger: image,
              start: "top 85%",
              end: "bottom 10%",
              toggleActions: toggle,
            },
          },
        ),
      );
    if (thumbs.length)
      tweens.push(
        gsap.fromTo(
          thumbs,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION.enter,
            ease: EASE.outStandard,
            stagger: 0.06,
            scrollTrigger: {
              trigger: thumbs[0],
              start: "top 95%",
              end: "bottom 5%",
              toggleActions: toggle,
            },
          },
        ),
      );
    if (stamp)
      tweens.push(
        gsap.fromTo(
          stamp,
          { autoAlpha: 0, scale: 1.5, rotate: -14 },
          {
            autoAlpha: 1,
            scale: 1,
            rotate: -4,
            duration: 0.6,
            delay: 0.4,
            ease: "back.out(2.2)",
            scrollTrigger: {
              trigger: image ?? stamp,
              start: "top 85%",
              end: "bottom 10%",
              toggleActions: toggle,
            },
          },
        ),
      );
    items.forEach((item, i) =>
      tweens.push(
        gsap.fromTo(
          item,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION.enter,
            ease: EASE.outStandard,
            delay: Math.min(i, 3) * 0.06,
            scrollTrigger: {
              trigger: item,
              start: "top 92%",
              end: "bottom 8%",
              toggleActions: toggle,
            },
          },
        ),
      ),
    );

    return () => {
      tweens.forEach((t) => {
        t.scrollTrigger?.kill();
        t.kill();
      });
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
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16 xl:gap-20">
        <div className="w-full max-w-xl lg:max-w-none">
          <ProductGallery
            images={product.images}
            seal={
              <span
                data-stamp
                className="bg-fernandito-verde-escuro text-fernandito-off-white ring-fernandito-off-white/35 pointer-events-none absolute top-4 left-4 flex origin-top-left rotate-[-4deg] flex-col items-center gap-0.5 rounded-xl px-4 py-2.5 text-center uppercase shadow-[0_8px_20px_rgba(36,48,34,0.35)] ring-1 ring-inset sm:top-5 sm:left-5"
              >
                <span className="font-rampart-stamp text-[1rem] leading-none tracking-[0.1em] sm:text-[1.1rem]">
                  {STORE.badge.split(" · ")[0]}
                </span>
                {STORE.badge.includes(" · ") && (
                  <span className="font-accent text-[0.6rem] tracking-[0.2em] opacity-85">
                    {STORE.badge.split(" · ")[1]}
                  </span>
                )}
              </span>
            }
          />
        </div>

        <div className="flex max-w-md flex-col items-start font-sans">
          <TypewriterText
            as={headingLevel}
            text={title}
            mode="play"
            start="top 85%"
            charsPerSecond={20}
            delay={0.3}
            className="font-rampart text-[clamp(2.1rem,3.4vw,2.9rem)] leading-[1]"
          />
          <p data-reveal className="text-body mt-4 max-w-sm opacity-85">
            {product.description}
          </p>

          {/* O que vem no kit: lista curta, um detalhe — não compete com a foto. */}
          <div data-reveal className="mt-7">
            <p className="text-label tracking-[0.12em] uppercase opacity-60">
              {STORE.contentsTitle}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {product.contents.map((item) => (
                <li
                  key={item.label}
                  className="border-fernandito-verde-escuro/15 text-label inline-flex items-center gap-2 rounded-full border bg-white/30 py-1.5 pr-3.5 pl-2.5 tracking-[0.06em] uppercase"
                >
                  <span className="text-fernandito-verde-medio">{CONTENT_ICONS[item.icon]}</span>
                  <span>
                    <span className="font-bold tabular-nums">{item.qty}</span> {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-rampart text-[clamp(1.9rem,2.6vw,2.3rem)] leading-none tabular-nums">
              <Price cents={product.priceCents} />
            </p>
            {showStock && (
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

          <div
            ref={buyRef}
            data-reveal
            className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:items-center"
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
              className="w-full !py-3 whitespace-nowrap sm:w-auto sm:flex-1"
            >
              {STORE.addToCart}
            </Button>
          </div>

          {WHATSAPP_HREF && (
            <p data-reveal className="text-label mt-4 tracking-[0.04em] opacity-70">
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
