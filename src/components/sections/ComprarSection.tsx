"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEATURED_PRODUCT, type ContentIcon } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";
import { LOCAL_DELIVERY, formatDays } from "@/lib/shipping";
import { STORE } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { ProductGallery } from "@/components/sections/ProductGallery";
import { BoxIcon, CanIcon, CupIcon, PixIcon, StickerIcon, TruckIcon } from "@/components/ui/icons";
import { QtyStepper } from "@/components/cart/QtyStepper";
import { useCart } from "@/components/cart/CartProvider";
import { WHATSAPP_HREF } from "@/components/ui/WhatsAppButton";

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
  const buyRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLParagraphElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  // Barra fixa do celular: aparece quando o botão de compra já passou por
  // cima da tela e o fim do bloco (aviso de 18 anos) ainda não chegou — assim
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

  if (!product) return null;
  const Heading = headingLevel;
  const maxQty = remaining && remaining > 0 ? Math.min(product.maxQty, remaining) : product.maxQty;
  const showStock = remaining !== null && remaining > 0 && remaining <= STOCK_BADGE_MAX;
  const addToCart = () => {
    add(product.sku, qty);
    setQty(1);
  };

  return (
    <section
      id="comprar"
      aria-label={STORE.eyebrow}
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-20 sm:px-10 md:py-28 lg:px-16"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16">
        {/* Galeria com o selo de edição limitada, estilo carimbo. */}
        <ProductGallery images={product.images}>
          <span className="bg-fernandito-verde-escuro text-fernandito-off-white font-accent text-label absolute top-5 left-5 rotate-[-4deg] rounded-full px-4 py-2 tracking-[0.12em] uppercase shadow-[0_6px_16px_rgba(36,48,34,0.3)]">
            {STORE.badge}
          </span>
        </ProductGallery>

        <div className="flex flex-col items-start font-sans">
          <p className="font-accent text-label tracking-[0.16em] uppercase opacity-70">
            {STORE.eyebrow}
          </p>
          <Heading className="font-rampart mt-3 text-[clamp(2rem,3.6vw,3rem)] leading-[1.05] text-balance">
            {/* Palavra com hífen não quebra no meio ("Pré-/Lançamento"). */}
            {product.name.split(" ").map((word, i) => (
              <span key={i} className={word.includes("-") ? "whitespace-nowrap" : undefined}>
                {i > 0 && " "}
                {word}
              </span>
            ))}
          </Heading>
          <p className="text-body-lg mt-5 max-w-md">{product.description}</p>

          <h3 className="text-label mt-8 tracking-[0.08em] uppercase opacity-70">
            {STORE.contentsTitle}
          </h3>
          <ul className="mt-3 grid w-full grid-cols-3 gap-3">
            {product.contents.map((item) => (
              <li
                key={item.label}
                className="border-fernandito-verde-escuro/20 flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center"
              >
                <span className="bg-fernandito-verde-medio text-fernandito-off-white flex h-11 w-11 items-center justify-center rounded-full">
                  {CONTENT_ICONS[item.icon]}
                </span>
                <span className="text-label leading-snug">{item.label}</span>
              </li>
            ))}
          </ul>

          <p className="font-rampart mt-8 text-[clamp(2rem,3.4vw,2.75rem)] leading-none tabular-nums">
            {formatBRL(product.priceCents)}
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

          <div ref={buyRef} className="mt-4 flex flex-wrap items-center gap-4">
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

          <ul className="text-body mt-5 flex flex-col gap-2.5">
            <TrustItem icon={<PixIcon />}>{STORE.trust.pix}</TrustItem>
            <TrustItem icon={<TruckIcon />}>
              {STORE.trust.localPrefix} · {formatBRL(LOCAL_DELIVERY.priceCents)} ·{" "}
              {formatDays(LOCAL_DELIVERY.days)}
            </TrustItem>
            <TrustItem icon={<BoxIcon />}>{STORE.trust.other}</TrustItem>
          </ul>

          <p
            ref={endRef}
            className="text-label border-fernandito-verde-escuro/30 mt-6 rounded-full border px-4 py-2 tracking-[0.08em] uppercase"
          >
            {STORE.ageNotice}
          </p>

          {WHATSAPP_HREF && (
            <p className="text-body mt-6 opacity-80">
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
          {formatBRL(product.priceCents)}
        </p>
        <Button variant="primary" onClick={addToCart}>
          {STORE.stickyCta}
        </Button>
      </div>
    </section>
  );
}

function TrustItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-fernandito-verde-medio mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

export default ComprarSection;
