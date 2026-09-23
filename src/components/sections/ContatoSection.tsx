"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { Parallax } from "@/components/ui/Parallax";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

/**
 * CTA de contato, tela dividida: texto à esquerda (título escrito à máquina
 * + botão), imagem à direita com parallax no scroll. No celular a imagem
 * vai pra baixo do texto, com o mesmo parallax.
 */
export function ContatoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const cta = ctaRef.current;
    const image = imageRef.current;
    if (!section || !cta || !image || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cta,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          ease: "power2.out",
          scrollTrigger: { trigger: cta, start: "top 95%", end: "top 78%", scrub: 0.5 },
        },
      );
      // Imagem 120% da altura da moldura: desliza de cima pra baixo e
      // desfaz um leve zoom enquanto a seção atravessa a tela.
      gsap.fromTo(
        image,
        { yPercent: -8, scale: 1.08 },
        {
          yPercent: 8,
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="contato"
      aria-label="Contato"
      className="bg-fernandito-verde-medio text-fernandito-off-white grid w-full md:min-h-screen md:grid-cols-2"
    >
      <div className="flex flex-col items-start justify-center px-6 py-24 sm:px-10 md:py-32 lg:px-16">
        <Parallax speed={40}>
          <TypewriterText
            text="Quer Fernandito no teu rolê?"
            start="top 95%"
            end="top 30%"
            className="font-rampart max-w-[13ch] text-[clamp(2.5rem,5vw,5rem)] leading-[1] tracking-[0.01em]"
          />
          <TypewriterText
            as="p"
            text="Bar, festa, evento ou só curiosidade — chama a gente no WhatsApp que a gente responde."
            caret={false}
            start="top 95%"
            end="top 50%"
            className="text-body-lg mt-8 max-w-md font-sans"
          />
          <div ref={ctaRef} className="mt-10">
            <WhatsAppButton background="verde-escuro">Chamar no WhatsApp</WhatsAppButton>
          </div>
        </Parallax>
      </div>

      {/* Metade da imagem — placeholder; com a foto real, trocar o miolo
          por `<Image fill className="object-cover" />` dentro do wrapper
          com parallax. */}
      <div className="relative aspect-[4/5] overflow-hidden md:aspect-auto">
        <div
          ref={imageRef}
          role="img"
          aria-label="Fernandito no rolê"
          className="bg-fernandito-verde-escuro absolute inset-x-0 -top-[10%] flex h-[120%] items-center justify-center [will-change:transform]"
        >
          <span className="text-label font-sans tracking-[0.12em] uppercase opacity-70">
            Foto contato
          </span>
          <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
        </div>
      </div>
    </section>
  );
}

export default ContatoSection;
