"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DURATION, EASE_BEZIER } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis";
import { formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { CloseIcon } from "@/components/ui/icons";
import { QtyStepper } from "@/components/cart/QtyStepper";
import { useCart } from "@/components/cart/CartProvider";

/**
 * Gaveta do carrinho: desliza da direita (off-white, texto verde-escuro),
 * com véu verde-escuro por trás. Abre sozinha ao adicionar um item. Fecha no
 * ×, no véu ou com Esc; enquanto aberta, a rolagem da página para (Lenis).
 */
export function CartDrawer() {
  const { lines, subtotalCents, isOpen, close, setQty, remove } = useCart();
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
            className="bg-fernandito-verde-escuro/60 absolute inset-0"
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
            className="bg-fernandito-off-white text-fernandito-verde-escuro absolute inset-y-0 right-0 flex w-full max-w-md flex-col shadow-[-24px_0_60px_rgba(36,48,34,0.35)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={transition}
          >
            <header className="border-fernandito-verde-escuro/15 flex items-center justify-between border-b px-6 pt-[calc(1.25rem+var(--announcement-h))] pb-5">
              <h2 className="font-rampart text-[1.75rem] leading-none">Carrinho</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Fechar carrinho"
                className="duration-base ease-out-standard hover:bg-fernandito-verde-escuro/10 focus-visible:outline-fernandito-verde-medio flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2"
              >
                <CloseIcon />
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
                <ul className="flex-1 overflow-y-auto px-6 py-2">
                  {lines.map((line) => (
                    <li
                      key={line.sku}
                      className="border-fernandito-verde-escuro/10 flex gap-4 border-b py-5 last:border-b-0"
                    >
                      <div className="bg-fernandito-verde-medio relative h-24 w-20 shrink-0 overflow-hidden rounded-lg">
                        <PhotoSlot
                          image={line.product.images[0]}
                          sizes="80px"
                          placeholderClassName="bg-fernandito-verde-medio"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 font-sans">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-body leading-snug font-bold">{line.product.name}</p>
                          <p className="text-body whitespace-nowrap tabular-nums">
                            {formatBRL(line.lineTotalCents)}
                          </p>
                        </div>
                        <p className="text-label uppercase opacity-60">
                          {formatBRL(line.product.priceCents)} cada
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-3">
                          <QtyStepper
                            size="sm"
                            value={line.qty}
                            max={line.product.maxQty}
                            onChange={(qty) => setQty(line.sku, qty)}
                            label={`Quantidade de ${line.product.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => remove(line.sku)}
                            className="text-label duration-base ease-out-standard hover:text-fernandito-verde-medio uppercase underline underline-offset-4 opacity-70 transition-colors hover:opacity-100"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <footer className="border-fernandito-verde-escuro/15 flex flex-col gap-4 border-t px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] font-sans">
                  <div className="flex items-baseline justify-between">
                    <span className="text-body">Subtotal</span>
                    <span className="text-body-lg font-bold tabular-nums">
                      {formatBRL(subtotalCents)}
                    </span>
                  </div>
                  <p className="text-label uppercase opacity-60">Frete calculado no checkout</p>
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
                  <p className="text-label text-center uppercase opacity-60">
                    Venda proibida para menores de 18 anos
                  </p>
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
