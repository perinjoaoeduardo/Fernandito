"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

// Frase curta, só o essencial de marca — nada de texto regulatório aqui
// (isso mora em /legal/avisos). `font-accent` (Special Elite, o mesmo dos
// carimbos da SocialGallerySection), pra faixa ter voz tipográfica própria.
// Fundo verde-claro: separa visualmente do rodapé verde-escuro logo abaixo.
const MARQUEE_PHRASE = "TOMA FERNANDITO · FERNET Y COLA · ";

// Repetido várias vezes pra garantir que uma "metade" da trilha já seja mais
// larga que qualquer viewport razoável — condição pro loop xPercent:-50 ficar
// perfeitamente contínuo (sem "buraco" em telas muito largas).
const MARQUEE_TRACK_TEXT = MARQUEE_PHRASE.repeat(12);

function Marquee() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    if (prefersReducedMotion()) {
      gsap.set(container, { opacity: 1 });
      return;
    }

    gsap.set(container, { opacity: 0 });
    const fadeTrigger = ScrollTrigger.create({
      trigger: container,
      start: "top 90%",
      once: true,
      onEnter: () => gsap.to(container, { opacity: 1, duration: 0.6, ease: "power1.out" }),
    });

    // Velocidade constante (px/s) independente da largura da trilha, pra não
    // acelerar/desacelerar quando o texto repetido mudar de tamanho.
    const pixelsPerSecond = 90;
    const trackHalfWidth = track.scrollWidth / 2;
    const loop = gsap.to(track, {
      xPercent: -50,
      duration: trackHalfWidth / pixelsPerSecond,
      ease: "none",
      repeat: -1,
    });

    return () => {
      fadeTrigger.kill();
      loop.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="flex items-center overflow-hidden py-3 sm:py-4"
    >
      <div ref={trackRef} className="flex w-max shrink-0 [will-change:transform]">
        <span className="text-fernandito-off-white font-accent pr-6 text-[clamp(1.25rem,2.4vw,1.875rem)] leading-none tracking-[0.02em] whitespace-nowrap uppercase">
          {MARQUEE_TRACK_TEXT}
        </span>
        <span className="text-fernandito-off-white font-accent pr-6 text-[clamp(1.25rem,2.4vw,1.875rem)] leading-none tracking-[0.02em] whitespace-nowrap uppercase">
          {MARQUEE_TRACK_TEXT}
        </span>
      </div>
    </div>
  );
}

export function FichaTecnicaSection() {
  return (
    <section id="ficha-tecnica" className="bg-fernandito-verde-claro w-full">
      <h2 className="sr-only">Ficha Técnica</h2>
      <Marquee />
    </section>
  );
}

export default FichaTecnicaSection;
