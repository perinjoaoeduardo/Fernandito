"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

/**
 * CTA de contato entre o Manifesto e o "O que anda rolando". Pergunta,
 * título e texto se escrevem à máquina presos ao scroll, em faixas
 * encadeadas; o botão sobe no fim.
 */
export function ContatoSection() {
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cta = ctaRef.current;
    if (!cta || prefersReducedMotion()) return;
    const tween = gsap.fromTo(
      cta,
      { autoAlpha: 0, y: 24, scale: 0.96 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        ease: "power2.out",
        scrollTrigger: { trigger: cta, start: "top 92%", end: "top 75%", scrub: 0.5 },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <section
      id="contato"
      aria-label="Contato"
      className="bg-fernandito-verde-medio text-fernandito-off-white w-full px-6 py-28 sm:py-40"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <TypewriterText
          as="p"
          text="Se interessou?"
          caret={false}
          start="top 85%"
          end="top 65%"
          className="text-body-lg font-accent tracking-[0.04em] opacity-70"
        />
        <TypewriterText
          text="Quer Fernandito no teu rolê?"
          start="top 80%"
          end="top 45%"
          className="font-rampart mt-5 text-[clamp(2.25rem,6.5vw,6rem)] leading-[1] tracking-[0.01em] text-balance"
        />
        <TypewriterText
          as="p"
          text="Bar, festa, evento ou só curiosidade — chama a gente no WhatsApp que a gente responde."
          caret={false}
          start="top 85%"
          end="top 60%"
          className="text-body-lg mt-8 max-w-xl font-sans text-balance"
        />
        <div ref={ctaRef} className="mt-10">
          <WhatsAppButton background="verde-escuro">Chamar no WhatsApp</WhatsAppButton>
        </div>
      </div>
    </section>
  );
}

export default ContatoSection;
