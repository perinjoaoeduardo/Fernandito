"use client";

import { useEffect, useRef } from "react";
import { gsap, EASE, SCRUB, prefersReducedMotion } from "@/lib/gsap";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { CONTATO } from "@/content/site";

/**
 * CTA de contato, tela dividida: texto à esquerda (título escrito à máquina
 * + botão), imagem à direita com parallax no scroll. No celular a imagem
 * vai pra baixo do texto, com o mesmo parallax.
 */
export function ContatoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const cta = ctaRef.current;
    const image = imageRef.current;
    const frame = frameRef.current;
    if (!section || !cta || !image || !frame || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cta,
        // opacity, não autoAlpha: com visibility:hidden o botão saía da
        // ordem do Tab e quem navega pelo teclado não chegava nele.
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          ease: EASE.outStandard,
          // Mesmo gatilho dos textos (a seção), logo depois do parágrafo
          // terminar de se escrever — o botão é o último da sequência.
          scrollTrigger: { trigger: section, start: "top 8%", end: "top -4%", scrub: SCRUB.base },
        },
      );
      // Entrada suave da imagem: só um fade longo, somado ao parallax e ao
      // zoom leve que já existem por dentro. (Já foi uma cortina de
      // clip-path abrindo de baixo pra cima — agressiva demais.)
      gsap.fromTo(
        frame,
        { opacity: 0 },
        {
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: frame, start: "top 95%", end: "top 45%", scrub: SCRUB.base },
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
        <TypewriterText
          text={CONTATO.title}
          triggerSelector="#contato"
          start="top 90%"
          end="top 30%"
          className="font-rampart max-w-[13ch] text-[clamp(2.5rem,5vw,5rem)] leading-[1] tracking-[0.01em]"
        />
        <TypewriterText
          as="p"
          text={CONTATO.text}
          caret={false}
          triggerSelector="#contato"
          start="top 30%"
          end="top 5%"
          className="text-body-lg mt-8 max-w-md font-sans"
        />
        <div ref={ctaRef} className="mt-10">
          <WhatsAppButton background="verde-escuro">{CONTATO.cta}</WhatsAppButton>
        </div>
      </div>

      {/* Metade da imagem (foto em `src/content/site.ts`), 120% da altura
          da moldura pra sobrar margem pro parallax. */}
      <div ref={frameRef} className="relative aspect-[4/5] overflow-hidden md:aspect-auto">
        <div
          ref={imageRef}
          className="absolute inset-x-0 -top-[10%] h-[120%] [will-change:transform]"
        >
          <PhotoSlot
            image={CONTATO.photo}
            sizes="(max-width: 767px) 100vw, 50vw"
            placeholderClassName="bg-fernandito-verde-escuro"
          />
          <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
        </div>
      </div>
    </section>
  );
}

export default ContatoSection;
