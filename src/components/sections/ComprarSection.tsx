"use client";

import { useState } from "react";
import { FEATURED_PRODUCT } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";
import { STORE } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { QtyStepper } from "@/components/cart/QtyStepper";
import { useCart } from "@/components/cart/CartProvider";
import { WHATSAPP_HREF } from "@/components/ui/WhatsAppButton";

/**
 * Compra do produto em destaque (hoje o Kit Pré-Lançamento): foto com selo,
 * nome, o que vem, preço, quantidade e "Adicionar ao carrinho". Usada na
 * home (âncora #comprar) e na página /comprar (aí o nome vira o h1).
 */
export function ComprarSection({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const product = FEATURED_PRODUCT;
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  if (!product) return null;
  const Heading = headingLevel;

  return (
    <section
      id="comprar"
      aria-label={STORE.eyebrow}
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-20 sm:px-10 md:py-28 lg:px-16"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-16">
        {/* Foto com o selo de edição limitada, estilo carimbo. */}
        <div className="relative">
          <div className="bg-fernandito-verde-medio relative aspect-[4/5] overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(36,48,34,0.25)]">
            <PhotoSlot
              image={product.images[0]}
              sizes="(max-width: 767px) 90vw, 45vw"
              placeholderClassName="bg-fernandito-verde-medio"
            />
          </div>
          <span className="bg-fernandito-verde-escuro text-fernandito-off-white font-accent text-label absolute top-5 left-5 rotate-[-4deg] rounded-full px-4 py-2 tracking-[0.12em] uppercase shadow-[0_6px_16px_rgba(36,48,34,0.3)]">
            {STORE.badge}
          </span>
        </div>

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
          <ul className="text-body mt-3 flex flex-col gap-1.5">
            {product.contents.map((item) => (
              <li key={item} className="flex items-baseline gap-2">
                <span
                  aria-hidden="true"
                  className="bg-fernandito-verde-medio h-1.5 w-1.5 shrink-0 translate-y-[-0.15em] rounded-full"
                />
                {item}
              </li>
            ))}
          </ul>

          <p className="font-rampart mt-8 text-[clamp(2rem,3.4vw,2.75rem)] leading-none tabular-nums">
            {formatBRL(product.priceCents)}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <QtyStepper
              value={qty}
              max={product.maxQty}
              onChange={setQty}
              label={`Quantidade de ${product.name}`}
            />
            <Button
              variant="primary"
              onClick={() => {
                add(product.sku, qty);
                setQty(1);
              }}
            >
              {STORE.addToCart}
            </Button>
          </div>

          <p className="text-label border-fernandito-verde-escuro/30 mt-6 rounded-full border px-4 py-2 tracking-[0.08em] uppercase">
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
    </section>
  );
}

export default ComprarSection;
