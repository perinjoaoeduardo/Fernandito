"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, EASE, prefersReducedMotion, supportsHover } from "@/lib/gsap";
import { Parallax } from "@/components/ui/Parallax";
import { Button } from "@/components/ui/Button";
import { InstagramIcon } from "@/components/ui/icons";
import { TypewriterText } from "@/components/ui/TypewriterText";

const CARD_COUNT = 7;
const CENTER_INDEX = 3;
// Índice 0-6 -> rotação final no leque.
const ROTATIONS = [-12, -8, -4, 0, 4, 8, 12];
const DROOP_STEP = 16; // px de translateY por "camada" de distância do centro
const HOVER_PUSH = 15; // px que os vizinhos se afastam ao abrir espaço
const BASE_Z = 10;

// Variação sutil de tom entre os 7 placeholders, pra não ficarem idênticos.
const CARD_TONES = [
  "bg-fernandito-verde-medio",
  "bg-fernandito-verde-medio/85",
  "bg-fernandito-verde-claro",
  "bg-fernandito-verde-medio",
  "bg-fernandito-verde-claro/90",
  "bg-fernandito-verde-medio/85",
  "bg-fernandito-verde-medio",
];

// 2 selos decorativos — índices fixos (não Math.random, pra não divergir
// entre SSR e hydration), estilo carimbo torto.
const STAMPS: Record<number, string> = { 1: "★", 5: "TOMA" };

function distanceFromCenter(index: number) {
  return Math.abs(index - CENTER_INDEX);
}

function baseScale(index: number) {
  return index === CENTER_INDEX ? 1.1 : 1;
}

function PhotoCard({
  index,
  cardRef,
}: {
  index: number;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const label = `FOTO ${String(index + 1).padStart(2, "0")}`;
  const stamp = STAMPS[index];

  return (
    <div
      ref={cardRef}
      data-cursor-hover
      role="img"
      aria-label={`Fernandito no Instagram — foto ${index + 1}`}
      className="relative aspect-[4/5] w-56 shrink-0 overflow-hidden rounded-2xl shadow-[0_18px_40px_rgba(36,48,34,0.22)] [will-change:transform] sm:w-60 lg:w-44 xl:w-48"
    >
      <div className={clsx("absolute inset-0 flex items-center justify-center", CARD_TONES[index])}>
        <span className="text-label text-fernandito-off-white font-sans uppercase">{label}</span>
      </div>
      {/* Textura de grão — mesma técnica do FooterSection, reaproveitada. */}
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
      {stamp && (
        <div
          aria-hidden="true"
          className="border-fernandito-off-white/70 text-fernandito-off-white font-accent absolute top-3 right-3 flex h-10 w-10 -rotate-[15deg] items-center justify-center rounded-full border text-[9px] uppercase"
        >
          {stamp}
        </div>
      )}
    </div>
  );
}

export function SocialGallerySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const fanCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mobileRowRef = useRef<HTMLDivElement>(null);

  // Leque desktop: as fotos começam empilhadas no centro (uma pilha de
  // fotos em cima da mesa) e se abrem em leque conforme rola — preso ao
  // scroll (scrub), fecha de volta se rolar pra cima.
  useEffect(() => {
    const section = sectionRef.current;
    const cards = fanCardRefs.current;
    if (!section || cards.some((card) => !card)) return;
    const fan = cards[0]?.parentElement?.parentElement;
    if (!fan) return;

    const final = (i: number) => ({
      x: 0,
      scale: baseScale(i),
      y: distanceFromCenter(i) * DROOP_STEP,
      rotate: ROTATIONS[i],
    });

    cards.forEach((card, i) => {
      if (card) gsap.set(card, { zIndex: BASE_Z - distanceFromCenter(i) });
    });

    if (prefersReducedMotion()) {
      cards.forEach((card, i) => card && gsap.set(card, final(i)));
      return;
    }

    // Distância até a posição do card central — recalculada no refresh
    // (o leque só existe em lg+, a medida muda com a largura).
    const stackX = (i: number) => {
      const wrappers = cards.map((c) => c?.parentElement as HTMLElement);
      return wrappers[CENTER_INDEX].offsetLeft - wrappers[i].offsetLeft;
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: fan,
        start: "top 90%",
        end: "top 35%",
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
    cards.forEach((card, i) => {
      if (!card) return;
      tl.fromTo(
        card,
        { x: () => stackX(i), y: 40, rotate: (i - CENTER_INDEX) * 3, scale: 0.92 },
        { ...final(i), ease: "power2.out" },
        0,
      );
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  // Hover: card sob o cursor se endireita e cresce; vizinhos abrem espaço.
  useEffect(() => {
    if (prefersReducedMotion() || !supportsHover()) return;
    const cards = fanCardRefs.current;
    const cleanups: (() => void)[] = [];

    cards.forEach((card, i) => {
      if (!card) return;
      const left = i > 0 ? cards[i - 1] : null;
      const right = i < CARD_COUNT - 1 ? cards[i + 1] : null;

      const handleEnter = () => {
        gsap.set(card, { zIndex: 50 });
        gsap.to(card, {
          rotate: 0,
          scale: baseScale(i) + 0.08,
          duration: 0.35,
          ease: "power2.out",
        });
        if (left) gsap.to(left, { x: -HOVER_PUSH, duration: 0.35, ease: "power2.out" });
        if (right) gsap.to(right, { x: HOVER_PUSH, duration: 0.35, ease: "power2.out" });
      };
      const handleLeave = () => {
        gsap.to(card, {
          rotate: ROTATIONS[i],
          scale: baseScale(i),
          duration: 0.35,
          ease: "power2.out",
          onComplete: () => gsap.set(card, { zIndex: BASE_Z - distanceFromCenter(i) }),
        });
        if (left) gsap.to(left, { x: 0, duration: 0.35, ease: "power2.out" });
        if (right) gsap.to(right, { x: 0, duration: 0.35, ease: "power2.out" });
      };

      card.addEventListener("mouseenter", handleEnter);
      card.addEventListener("mouseleave", handleLeave);
      cleanups.push(() => {
        card.removeEventListener("mouseenter", handleEnter);
        card.removeEventListener("mouseleave", handleLeave);
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  // Mobile: fileira com scroll-snap entra com um fade simples (sem cascata
  // por card — a fileira inteira é um único bloco visual aqui).
  useEffect(() => {
    const row = mobileRowRef.current;
    if (!row) return;

    if (prefersReducedMotion()) {
      gsap.set(row, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(row, { opacity: 0, y: 30 });
    const trigger = ScrollTrigger.create({
      trigger: row,
      start: "top 85%",
      once: true,
      onEnter: () => gsap.to(row, { opacity: 1, y: 0, duration: 0.7, ease: EASE.outStandard }),
    });

    return () => trigger.kill();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="social"
      aria-label="Redes sociais"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full overflow-hidden py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
        <Parallax speed={40}>
          <TypewriterText
            text="O que anda rolando"
            className="font-rampart text-[clamp(1.75rem,4vw,3rem)] leading-[1.05] tracking-[0.02em] text-balance"
          />
        </Parallax>
      </div>

      {/* Desktop (lg+) — leque sobreposto. Abaixo de 1024px o leque não
          cabe sem cortar as pontas, então vira a fileira com snap. */}
      <Parallax speed={-30} className="hidden lg:block">
        <div className="relative mt-12 hidden items-end justify-center px-6 lg:flex">
          {Array.from({ length: CARD_COUNT }).map((_, i) => (
            <div key={i} className={i === 0 ? undefined : "lg:-ml-14 xl:-ml-16"}>
              <PhotoCard
                index={i}
                cardRef={(el) => {
                  fanCardRefs.current[i] = el;
                }}
              />
            </div>
          ))}
        </div>
      </Parallax>

      {/* Mobile/tablet — fileira com scroll-snap */}
      <div
        ref={mobileRowRef}
        className="mt-10 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-6 pt-4 pb-8 [will-change:transform,opacity] sm:gap-6 lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <div
            key={i}
            className="snap-center"
            style={{ transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}
          >
            <PhotoCard index={i} />
          </div>
        ))}
      </div>

      <Parallax
        speed={20}
        className="mx-auto mt-8 flex max-w-5xl flex-col items-center px-6 text-center lg:mt-16"
      >
        <Button
          as="a"
          href="https://www.instagram.com/toma.fernandito/"
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          icon={<InstagramIcon />}
          iconPosition="left"
          // O nome acessível precisa CONTER o texto visível — senão quem usa
          // controle por voz fala "@toma.fernandito" e o comando não casa.
          aria-label="@toma.fernandito — seguir no Instagram, abre em nova aba"
        >
          @toma.fernandito
        </Button>
      </Parallax>
    </section>
  );
}

export default SocialGallerySection;
