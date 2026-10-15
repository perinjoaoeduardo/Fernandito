"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { clsx } from "clsx";
import { PERGUNTAS } from "@/content/site";
import { DURATION, EASE_BEZIER } from "@/lib/gsap";

/**
 * Perguntas frequentes — onde moram os fatos do produto (lata 350 ml, 8%,
 * entrega, Pix, 18+). Fundo verde-escuro (profundidade, junto do verde),
 * título à esquerda e respostas em sanfona à direita; o "+" vira "–" em
 * verde-claro. Uma aberta por vez; a primeira começa aberta.
 */
export function PerguntasSection() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section
      id="perguntas"
      aria-labelledby="perguntas-titulo"
      className="bg-fernandito-verde-escuro text-fernandito-off-white w-full px-6 py-20 sm:px-10 md:py-28 lg:px-16"
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <p className="font-accent text-label text-fernandito-off-white/60 tracking-[0.18em] uppercase">
            {PERGUNTAS.eyebrow}
          </p>
          <h2
            id="perguntas-titulo"
            className="font-rampart mt-3 text-[clamp(2.1rem,4vw,3.2rem)] leading-[1.02] text-balance"
          >
            {PERGUNTAS.title}
          </h2>
        </div>

        <ul className="border-fernandito-off-white/15 border-t font-sans">
          {PERGUNTAS.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} className="border-fernandito-off-white/15 border-b">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`pergunta-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="group flex w-full items-center justify-between gap-6 py-5 text-left"
                  >
                    <span className="text-body-lg duration-base ease-out-standard font-bold transition-opacity group-hover:opacity-80">
                      {item.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "text-fernandito-verde-claro duration-base ease-out-standard text-[1.5rem] leading-none brightness-150 transition-transform",
                        isOpen && "rotate-45",
                      )}
                    >
                      +
                    </span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`pergunta-${i}`}
                      className="overflow-hidden"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: DURATION.base, ease: EASE_BEZIER.outStandard }}
                    >
                      <p className="text-body max-w-[60ch] pb-6 opacity-75">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default PerguntasSection;
