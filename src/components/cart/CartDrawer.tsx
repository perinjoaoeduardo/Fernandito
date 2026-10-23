"use client";

import { AnimatePresence, motion } from "framer-motion";
import { curtainNavigate } from "@/lib/page-transition";
import { openNotify } from "@/lib/notify";
import { useStock } from "@/components/cart/useStock";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DURATION, EASE_BEZIER } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis";
import { formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { splitName } from "@/lib/catalog";
import { SHOP_HREF, STORE } from "@/content/site";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { ArrowRightIcon, CloseIcon, TrashIcon } from "@/components/ui/icons";
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
  const { soldOut } = useStock();
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
            <header className="border-fernandito-verde-escuro/12 flex h-[4.5rem] shrink-0 items-center justify-between border-b pr-4 pl-6">
              <div className="flex items-center gap-3">
                <h2 className="font-rampart translate-y-[0.06em] text-[1.75rem] leading-none">
                  Carrinho
                </h2>
                {count > 0 && (
                  <span className="bg-fernandito-verde-medio text-fernandito-off-white flex h-6 min-w-6 items-center justify-center rounded-full px-2 font-sans text-[0.75rem] font-bold tabular-nums">
                    {count}
                  </span>
                )}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Fechar carrinho"
                className="duration-base ease-out-standard hover:bg-fernandito-verde-escuro/10 focus-visible:outline-fernandito-verde-medio flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </header>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 16, rotate: -14 }}
                  animate={{ opacity: 1, y: 0, rotate: -6 }}
                  transition={{ ...transition, delay: 0.15 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- raster pequeno de tamanho fixo */}
                  <img
                    src="/logo/fernandito-selo.webp"
                    alt=""
                    width={640}
                    height={653}
                    decoding="async"
                    className="cart-empty-horse h-auto w-24 drop-shadow-[0_10px_18px_rgba(20,28,18,0.25)]"
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transition, delay: 0.25 }}
                  className="mt-6 flex flex-col items-center"
                >
                  <p className="font-rampart text-[1.6rem] leading-[1.05] text-balance">
                    O tordilho tá sem carga
                  </p>
                  <p className="text-body mt-2 max-w-[17rem] font-sans opacity-75">
                    Que tal levar umas latas de fernet y cola?
                  </p>
                  <Button
                    variant="primary"
                    className="mt-6"
                    onClick={() => {
                      close();
                      curtainNavigate(() =>
                        router.push(SHOP_HREF, { scroll: !SHOP_HREF.includes("#") }),
                      );
                    }}
                  >
                    Ver o kit
                  </Button>
                </motion.div>
              </div>
            ) : (
              <>
                <ul className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                  {lines.map((line, i) => {
                    const { main, sub } = splitName(line.product.name);
                    return (
                      <motion.li
                        key={line.sku}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...transition, delay: 0.15 + i * 0.05 }}
                        className="ring-fernandito-verde-escuro/[0.07] flex gap-3.5 rounded-2xl bg-white/50 p-2.5 ring-1"
                      >
                        <div className="bg-fernandito-verde-medio relative h-[6.5rem] w-[5rem] shrink-0 overflow-hidden rounded-xl">
                          <PhotoSlot
                            image={line.product.images[0]}
                            sizes="80px"
                            placeholderClassName="bg-fernandito-verde-medio"
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col py-0.5 font-sans">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-rampart text-[1.15rem] leading-none">{main}</p>
                              <p className="mt-1.5 flex flex-col gap-0.5 text-[0.7rem] leading-tight tracking-[0.04em] opacity-60">
                                {sub && <span className="uppercase">{sub}</span>}
                                <span>{formatBRL(line.product.priceCents)} cada</span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => remove(line.sku)}
                              aria-label={`Remover ${line.product.name}`}
                              className="hover:bg-fernandito-verde-escuro/10 duration-base ease-out-standard -mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-50 transition-[background-color,opacity] hover:opacity-100"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center justify-between gap-3 pt-2.5">
                            <QtyStepper
                              size="sm"
                              value={line.qty}
                              max={line.product.maxQty}
                              onChange={(qty) => setQty(line.sku, qty)}
                              label={`Quantidade de ${line.product.name}`}
                            />
                            <p className="font-rampart text-[1.3rem] leading-none whitespace-nowrap tabular-nums">
                              <Price cents={line.lineTotalCents} />
                            </p>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>

                <footer className="border-fernandito-verde-escuro/12 flex shrink-0 flex-col gap-4 border-t px-6 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] font-sans">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-label tracking-[0.1em] uppercase opacity-70">Subtotal</p>
                      <p className="text-label mt-1 opacity-55">Frete calculado no checkout</p>
                    </div>
                    <p className="font-rampart text-[2.1rem] leading-none tabular-nums">
                      <Price cents={subtotalCents} />
                    </p>
                  </div>
                  {soldOut ? (
                    <>
                      <p className="border-fernandito-verde-escuro/15 bg-fernandito-verde-escuro/[0.05] text-body rounded-2xl border px-4 py-3 leading-snug">
                        <b>{STORE.soldOut}.</b> {STORE.soldOutText}
                      </p>
                      <Button
                        variant="primary"
                        className="w-full !py-4"
                        onClick={() => {
                          close();
                          openNotify();
                        }}
                      >
                        {STORE.notifyCta}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      className="w-full !py-4"
                      onClick={() => {
                        close();
                        curtainNavigate(() => router.push("/checkout"));
                      }}
                    >
                      <span className="flex items-center gap-2">
                        Finalizar compra
                        <ArrowRightIcon />
                      </span>
                    </Button>
                  )}
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
