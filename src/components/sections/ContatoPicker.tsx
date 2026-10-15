"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { LEAD_FORMS, PAGES } from "@/content/site";
import { DURATION, EASE_BEZIER } from "@/lib/gsap";
import { ArrowRightIcon } from "@/components/ui/icons";
import { whatsappHref } from "@/components/ui/WhatsAppButton";
import { LeadForm } from "@/components/sections/LeadForm";

/**
 * Página Contato: a pessoa escolhe o motivo (chips) e só aí aparece o que
 * aquele motivo precisa — evento e revenda abrem as perguntas curtas
 * (`LEAD_FORMS`, viram lead + WhatsApp com a mensagem pronta); os outros
 * mostram direto o botão do WhatsApp já com a mensagem do motivo. Um lugar
 * só pra falar com a gente, nenhum WhatsApp genérico.
 */
export function ContatoPicker() {
  const reasons = PAGES.contato.reasons;
  const [active, setActive] = useState(reasons[0].key);
  const reduce = useReducedMotion();
  const reason = reasons.find((r) => r.key === active) ?? reasons[0];
  const form = reason.form ? LEAD_FORMS.forms.find((f) => f.key === reason.form) : null;
  const href = reason.message ? whatsappHref(reason.message) : null;

  return (
    <section
      aria-label="Escolha o motivo do contato"
      className="bg-fernandito-verde-medio text-fernandito-off-white w-full px-6 pb-20 sm:px-10 md:pb-28 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-label font-sans tracking-[0.14em] uppercase opacity-70">
          Sobre o que tu quer falar?
        </p>
        <div role="tablist" className="mt-4 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={r.key === active}
              onClick={() => setActive(r.key)}
              className={clsx(
                "duration-base ease-out-standard h-11 rounded-full px-5 font-sans text-[0.9rem] font-bold transition-colors",
                r.key === active
                  ? "bg-fernandito-off-white text-fernandito-verde-escuro"
                  : "ring-fernandito-off-white/30 hover:ring-fernandito-verde-claro hover:bg-fernandito-verde-escuro/30 ring-1",
              )}
            >
              {r.title}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={reason.key}
            role="tabpanel"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: DURATION.base, ease: EASE_BEZIER.outStandard }}
            className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14"
          >
            <div>
              <p className="font-rampart text-[clamp(2rem,3.4vw,2.8rem)] leading-[1.02]">
                {form ? form.title : reason.title}
              </p>
              <p className="text-body-lg mt-3 font-sans opacity-80">
                {form ? form.text : reason.text}
              </p>
            </div>
            {form ? (
              <LeadForm form={form} />
            ) : (
              <div className="bg-fernandito-off-white text-fernandito-verde-escuro rounded-3xl p-6 font-sans shadow-[0_30px_70px_rgba(20,28,18,0.35)] sm:p-8">
                <p className="text-label tracking-[0.1em] uppercase opacity-60">
                  A mensagem vai assim
                </p>
                <p className="font-accent text-body-lg mt-3">“{reason.message}”</p>
                <a
                  href={href ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio duration-base ease-out-standard mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.95rem] font-bold transition-colors"
                >
                  Chamar no WhatsApp
                  <ArrowRightIcon />
                </a>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

export default ContatoPicker;
