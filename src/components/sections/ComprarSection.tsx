"use client";

import { clsx } from "clsx";
import { openNotify } from "@/lib/notify";
import NextLink from "next/link";
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
import { useStock } from "@/components/cart/useStock";
import { WHATSAPP_HREF } from "@/components/ui/WhatsAppButton";
import { getLenis } from "@/lib/lenis";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";

const CONTENT_ICONS: Record<ContentIcon, ReactNode> = {
  can: <CanIcon className="h-4 w-4" />,
  cup: <CupIcon className="h-4 w-4" />,
  sticker: <StickerIcon className="h-4 w-4" />,
};

/** Só mostra o selo quando o estoque está baixo (acima disso não é urgência). */
const STOCK_BADGE_MAX = 30;

/**
 * Compra do produto em destaque (hoje o Kit Pré-Lançamento): galeria com
 * etiqueta "Pré-lançamento", nome (digitado, como os títulos do site), o
 * que vem no kit em etiquetas pequenas, preço, quantidade e "Adicionar ao
 * carrinho". A foto é a protagonista; o texto fica enxuto. Usada na home (âncora
 * #comprar, pré-lançamento) e na página /comprar (site completo; aí o
 * nome vira o h1).
 */
export function ComprarSection({
  headingLevel = "h2",
  standalone = false,
}: {
  headingLevel?: "h1" | "h2";
  /** Página /comprar: mais espaço no topo (menu flutuante) e "← Início". */
  standalone?: boolean;
}) {
  const product = FEATURED_PRODUCT;
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const { remaining, soldOut } = useStock();
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

  // Encaixe no computador: a seção ocupa exatamente a tela (abaixo da faixa
  // do topo). Quando a rolagem PARA com o kit quase encaixado (a menos de
  // 30% da tela), a página desliza até ele ficar inteiro e centralizado —
  // só fundo bege, foto e informações. Longe disso, não mexe em nada.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    let timer: number | undefined;
    let snapping = false;
    const barHeight = () =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--announcement-h")) ||
      0;
    const settle = () => {
      if (!desktop.matches || snapping) return;
      const distance = section.getBoundingClientRect().top - barHeight();
      if (Math.abs(distance) < 2 || Math.abs(distance) > window.innerHeight * 0.3) return;
      snapping = true;
      const target = window.scrollY + distance;
      const release = window.setTimeout(() => (snapping = false), 1000);
      const lenis = getLenis();
      if (lenis) {
        lenis.scrollTo(target, {
          duration: 0.8,
          onComplete: () => {
            window.clearTimeout(release);
            snapping = false;
          },
        });
      } else {
        window.scrollTo({ top: target, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 180);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, []);

  // Parallax ligado à rolagem (scrub), nos dois sentidos: a etiqueta e os
  // blocos de texto deslizam em velocidades um pouco diferentes da foto ao
  // entrar e ao sair da tela — nada "carimba" nem some no meio da leitura.
  // Ao entrar eles também clareiam (só na faixa de baixo da tela). A foto
  // desfaz um zoom leve conforme sobe. Sem animação sob reduced-motion.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;
    const image = section.querySelector<HTMLElement>("[data-gallery-image]");
    const stamp = section.querySelector<HTMLElement>("[data-stamp]");
    const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", section);
    const all = [image, stamp, ...items].filter(Boolean) as HTMLElement[];
    const tweens: gsap.core.Animation[] = [];

    if (image)
      tweens.push(
        gsap.fromTo(
          image,
          { scale: 1.06 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: image,
              start: "top bottom",
              end: "center center",
              scrub: 0.6,
            },
          },
        ),
      );
    // Etiqueta e textos: um parallax só, ligado à seção, em duas fases —
    // entrando (do pé da tela até a seção encaixar no topo) eles sobem até a
    // posição certa (y = 0) e, saindo, continuam subindo. Assim, com o kit
    // encaixado na tela, tudo fica exatamente alinhado (texto no meio da
    // foto). Cada bloco anda um tiquinho mais que o anterior: profundidade.
    const enter = window.innerHeight;
    const leave = section.offsetHeight;
    const drift = gsap.timeline({
      scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.6 },
    });
    const moving = [stamp, ...items].filter(Boolean) as HTMLElement[];
    moving.forEach((el, i) => {
      const distance = el === stamp ? 36 : 36 + (i - 1) * 8;
      drift
        .fromTo(el, { y: distance }, { y: 0, ease: "none", duration: enter }, 0)
        .to(el, { y: -distance * 0.6, ease: "none", duration: leave }, enter);
    });
    tweens.push(drift);
    items.forEach((item) => {
      tweens.push(
        gsap.fromTo(
          item,
          { opacity: 0 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: { trigger: item, start: "top bottom", end: "top 78%", scrub: 0.4 },
          },
        ),
      );
    });

    return () => {
      tweens.forEach((t) => {
        t.scrollTrigger?.kill();
        t.kill();
      });
      gsap.set(all, { clearProps: "opacity,transform" });
    };
  }, [product]);

  if (!product) return null;
  const maxQty = remaining && remaining > 0 ? Math.min(product.maxQty, remaining) : product.maxQty;
  const showStock = remaining !== null && remaining > 0 && remaining <= STOCK_BADGE_MAX;
  const { main: title } = splitName(product.name);
  const addToCart = () => {
    if (soldOut) return openNotify();
    add(product.sku, qty);
    setQty(1);
  };

  return (
    <section
      ref={sectionRef}
      id="comprar"
      aria-label={STORE.eyebrow}
      className={clsx(
        "bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 sm:px-10 lg:flex lg:min-h-[calc(100svh-var(--announcement-h))] lg:items-center lg:px-16 lg:pb-12",
        standalone
          ? "pt-[calc(8rem+var(--announcement-h))] pb-20 md:pb-28 lg:flex-col lg:justify-center lg:pt-28"
          : "py-20 md:py-28 lg:pt-24",
      )}
    >
      {standalone && (
        <div className="mx-auto mb-12 w-full max-w-6xl lg:mb-14">
          <NextLink
            href="/"
            className="text-label duration-base ease-out-standard inline-flex items-center gap-2 font-sans tracking-[0.1em] uppercase opacity-60 transition-opacity hover:opacity-100"
          >
            <span aria-hidden="true">←</span> Início
          </NextLink>
        </div>
      )}
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16 xl:gap-20">
        <div className="w-full max-w-xl lg:max-w-none">
          <ProductGallery
            images={product.images}
            seal={
              <span
                data-stamp
                className="bg-fernandito-verde-escuro text-fernandito-off-white ring-fernandito-off-white pointer-events-none absolute -top-4 -left-3 z-10 flex origin-top-left rotate-[-6deg] flex-col items-center gap-0.5 rounded-xl px-4 py-2.5 text-center uppercase shadow-[0_10px_24px_rgba(36,48,34,0.35)] ring-[3px] sm:-top-5 sm:-left-5"
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

        <div className="flex max-w-lg flex-col items-start font-sans lg:pb-24">
          <TypewriterText
            as={headingLevel}
            text={title}
            mode="play"
            caret={false}
            start="top 85%"
            charsPerSecond={20}
            delay={0.3}
            className="font-rampart text-[clamp(2.1rem,3.4vw,2.9rem)] leading-[1]"
          />
          <p data-reveal className="text-body mt-4 max-w-[33rem] opacity-85">
            {product.description}
          </p>

          {/* O que vem no kit: lista curta, um detalhe — não compete com a foto. */}
          <div data-reveal className="mt-7">
            <p className="text-label tracking-[0.12em] uppercase opacity-60">
              {STORE.contentsTitle}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2 xl:flex-nowrap">
              {product.contents.map((item) => (
                <li
                  key={item.label}
                  className="border-fernandito-verde-escuro/15 text-label inline-flex h-8 items-center gap-2 rounded-full border bg-white/30 pr-3.5 pl-2.5 leading-none tracking-[0.06em] whitespace-nowrap uppercase"
                >
                  {/* Ícone como bloco (sem a sobra de linha de um span
                      inline) e o texto descido um tico: as maiúsculas da
                      Courier ficam acima do centro da caixa da fonte. */}
                  <span className="text-fernandito-verde-medio flex shrink-0 items-center">
                    {CONTENT_ICONS[item.icon]}
                  </span>
                  <span className="flex translate-y-[0.08em] items-baseline gap-1.5 leading-none">
                    <span className="font-bold">{item.qty}</span>
                    <span>{item.label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-rampart text-[clamp(1.9rem,2.6vw,2.3rem)] leading-none tabular-nums">
              <Price cents={product.priceCents} />
            </p>
            {soldOut && (
              <span className="bg-fernandito-verde-escuro text-fernandito-off-white text-label inline-flex items-center rounded-full px-3 py-1 tracking-[0.12em] uppercase">
                {STORE.soldOut}
              </span>
            )}
            {showStock && !soldOut && (
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
            <div className={clsx("self-start", soldOut && "hidden")}>
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
              {soldOut ? STORE.notifyCta : STORE.addToCart}
            </Button>
          </div>
          {soldOut && (
            <p data-reveal className="text-body mt-3 max-w-md opacity-80">
              {STORE.soldOutText}
            </p>
          )}

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
          className="bg-fernandito-off-white text-fernandito-verde-escuro duration-base ease-out-standard flex h-12 items-center rounded-full px-6 font-sans text-[0.8125rem] font-bold tracking-[0.06em] uppercase transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          {soldOut ? "Me avisa" : STORE.stickyCta}
        </button>
      </div>
    </section>
  );
}

export default ComprarSection;
