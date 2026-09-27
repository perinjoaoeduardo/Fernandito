"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";
import { MARQUEE } from "@/content/site";

// Frase curta, só o essencial de marca — nada de texto regulatório aqui
// (isso mora em /legal/avisos). `font-accent` (Special Elite, o mesmo dos
// carimbos da SocialGallerySection), pra faixa ter voz tipográfica própria.
// Fundo verde-claro: separa visualmente do rodapé verde-escuro logo abaixo.
const MARQUEE_PHRASE = MARQUEE.phrases.map((phrase) => `${phrase} · `).join("");

// Repetido várias vezes pra garantir que uma "metade" da trilha já seja mais
// larga que qualquer viewport razoável — condição pro loop (que volta ao
// início a cada metade da trilha) ficar perfeitamente contínuo, sem
// "buraco" em telas muito largas.
const MARQUEE_TRACK_TEXT = MARQUEE_PHRASE.repeat(12);

const BASE_SPEED = 90; // px/s em repouso
const MAX_BOOST = 4; // rolando rápido, até 5× a velocidade base
const BOOST_DECAY = 0.94; // por quadro (60fps): o empurrão some em ~1s

function Marquee() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const driftRef = useRef<HTMLDivElement>(null);

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
      onEnter: () =>
        gsap.to(container, { opacity: 1, duration: DURATION.enter, ease: EASE.outStandard }),
    });

    // Loop movido à mão num ticker (não uma tween infinita): assim dá pra
    // mudar direção e velocidade a qualquer momento. Anda BASE_SPEED px/s
    // pra esquerda; rolar dá um empurrão proporcional à velocidade da
    // rolagem (até MAX_BOOST × mais rápido) que decai sozinho, e rolar pra
    // cima inverte o sentido até a pessoa voltar a descer.
    let half = track.scrollWidth / 2;
    let wrapX = gsap.utils.wrap(-half, 0);
    const setX = gsap.quickSetter(track, "x", "px");
    let x = 0;
    let direction = 1;
    let boost = 0;
    let visible = false;

    const tick = (_time: number, deltaTime: number) => {
      if (!visible) return;
      boost *= Math.pow(BOOST_DECAY, deltaTime / 16.67);
      x = wrapX(x - direction * BASE_SPEED * (1 + boost) * (deltaTime / 1000));
      setX(x);
    };
    gsap.ticker.add(tick);

    const velocityTrigger = ScrollTrigger.create({
      trigger: container,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => {
        visible = self.isActive;
      },
      onUpdate: (self) => {
        direction = self.direction;
        boost = Math.max(boost, Math.min(MAX_BOOST, Math.abs(self.getVelocity()) / 400));
      },
      // A largura da trilha muda com o tamanho da fonte (clamp com vw).
      onRefresh: (self) => {
        visible = self.isActive;
        half = track.scrollWidth / 2;
        wrapX = gsap.utils.wrap(-half, 0);
      },
    });

    // Parallax horizontal: além do loop, a faixa inteira desliza pro lado
    // enquanto atravessa a tela — anda junto com a rolagem.
    const drift = driftRef.current
      ? gsap.fromTo(
          driftRef.current,
          { x: 80 },
          {
            x: -80,
            ease: "none",
            scrollTrigger: {
              trigger: container,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        )
      : null;

    return () => {
      fadeTrigger.kill();
      gsap.ticker.remove(tick);
      velocityTrigger.kill();
      drift?.scrollTrigger?.kill();
      drift?.kill();
    };
  }, []);

  return (
    // translate-y 0.15em: na Special Elite a linha reserva ~30% da altura
    // pras descendentes (asc 1440 / desc 608 de 2048); com o texto todo em
    // caixa-alta, o centro das maiúsculas fica 0.15em acima do centro da
    // faixa. O deslocamento compensa isso exatamente.
    <div
      ref={containerRef}
      aria-hidden="true"
      className="flex items-center overflow-hidden py-3 sm:py-4"
    >
      <div ref={driftRef} className="shrink-0 [will-change:transform]">
        <div ref={trackRef} className="flex w-max shrink-0 [will-change:transform]">
          <span className="text-fernandito-off-white font-accent translate-y-[0.15em] pr-6 text-[clamp(1.25rem,2.4vw,1.875rem)] leading-none tracking-[0.02em] whitespace-nowrap uppercase">
            {MARQUEE_TRACK_TEXT}
          </span>
          <span className="text-fernandito-off-white font-accent translate-y-[0.15em] pr-6 text-[clamp(1.25rem,2.4vw,1.875rem)] leading-none tracking-[0.02em] whitespace-nowrap uppercase">
            {MARQUEE_TRACK_TEXT}
          </span>
        </div>
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
