"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DURATION, EASE_BEZIER } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis";
import { formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { splitName } from "@/lib/catalog";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { CloseIcon } from "@/components/ui/icons";
import { QtyStepper } from "@/components/cart/QtyStepper";
import { useCart } from "@/components/cart/CartProvider";

/**
 * Gaveta do carrinho: container flutuante (cantos arredondados, afastado das
 * bordas) que desliza da direita (off-white, texto verde-escuro), com véu
 * verde-escuro e blur por trás. Abre sozinha ao adicionar um item. Fecha no
 * ×, no véu ou com Esc; enquanto aberta, a rolagem da página para (Lenis).
 */
export function CartDrawer() {
  const { lines, count, subtotalCents, isOpen, close, setQty, remove } = useCart();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const lenis = getLenis();
    lenis?.stop();
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus?.();
    };
  }, [isOpen, close]);

  const transition = { duration: DURATION.slow, ease: EASE_BEZIER.outStandard };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            aria-hidden="true"
            className="bg-fernandito-verde-escuro/45 absolute inset-0 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={close}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Carrinho"
            data-lenis-prevent
            className="bg-fernandito-off-white text-fernandito-verde-escuro ring-fernandito-off-white/40 absolute top-3 right-3 bottom-3 flex w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden rounded-3xl shadow-[0_24px_70px_rgba(24,32,22,0.45)] ring-1 sm:top-4 sm:right-4 sm:bottom-4"
            initial={{ x: "calc(100% + 2rem)", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "calc(100% + 2rem)", opacity: 0.6 }}
            transition={transition}
          >
            <header className="border-fernandito-verde-escuro/15 flex h-[4.5rem] shrink-0 items-center justify-between border-b px-6">
              <div className="flex items-baseline gap-3">
                <h2 className="font-rampart text-[1.75rem] leading-none">Carrinho</h2>
                {count > 0 && (
                  <span className="text-label font-sans uppercase opacity-60">
                    {count} {count === 1 ? "item" : "itens"}
                  </span>
                )}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Fechar carrinho"
                className="duration-base ease-out-standard hover:bg-fernandito-verde-escuro/10 border-fernandito-verde-escuro/20 focus-visible:outline-fernandito-verde-medio flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </header>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-start justify-center gap-6 px-6">
                <p className="font-accent text-body-lg">Teu carrinho está vazio.</p>
                <Button variant="secondary" onClick={close}>
                  Continuar navegando
                </Button>
              </div>
            ) : (
              <>
                <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5">
                  {lines.map((line) => {
                    const { main, sub } = splitName(line.product.name);
                    return (
                      <li
                        key={line.sku}
                        className="bg-fernandito-verde-escuro/[0.05] border-fernandito-verde-escuro/10 flex gap-4 rounded-2xl border p-3"
                      >
                        <div className="bg-fernandito-verde-medio relative h-28 w-24 shrink-0 overflow-hidden rounded-xl">
                          <PhotoSlot
                            image={line.product.images[0]}
                            sizes="96px"
                            placeholderClassName="bg-fernandito-verde-medio"
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col font-sans">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-rampart text-[1.15rem] leading-[1.1]">{main}</p>
                              {sub && (
                                <p className="font-rampart text-fernandito-verde-medio text-[1.15rem] leading-[1.1]">
                                  {sub}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => remove(line.sku)}
                              aria-label={`Remover ${line.product.name}`}
                              className="text-label duration-base ease-out-standard hover:text-fernandito-verde-medio shrink-0 uppercase underline underline-offset-4 opacity-60 transition-colors hover:opacity-100"
                            >
                              Remover
                            </button>
                          </div>
                          <p className="text-label mt-1 uppercase opacity-60">
                            {formatBRL(line.product.priceCents)} cada
                          </p>
                          <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                            <QtyStepper
                              size="sm"
                              value={line.qty}
                              max={line.product.maxQty}
                              onChange={(qty) => setQty(line.sku, qty)}
                              label={`Quantidade de ${line.product.name}`}
                            />
                            <p className="text-body-lg font-bold whitespace-nowrap tabular-nums">
                              {formatBRL(line.lineTotalCents)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <footer className="border-fernandito-verde-escuro/15 flex shrink-0 flex-col gap-4 border-t px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] font-sans">
                  <div>
                    <div className="flex items-end justify-between">
                      <span className="text-label uppercase opacity-70">Subtotal</span>
                      <span className="font-rampart text-[2rem] leading-none tabular-nums">
                        <Price cents={subtotalCents} />
                      </span>
                    </div>
                    <p className="text-label mt-1.5 text-right uppercase opacity-60">
                      Frete calculado no checkout
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => {
                      close();
                      router.push("/checkout");
                    }}
                  >
                    Finalizar compra
                  </Button>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export default CartDrawer;
