"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, EASE, prefersReducedMotion, supportsHover } from "@/lib/gsap";
import { Button } from "@/components/ui/Button";
import { InstagramIcon } from "@/components/ui/icons";
import { SectionLabel } from "@/components/ui/SectionLabel";

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
      className="relative aspect-[4/5] w-56 shrink-0 overflow-hidden rounded-2xl shadow-[0_18px_40px_rgba(36,48,34,0.22)] [will-change:transform] sm:w-60 lg:w-48 xl:w-56"
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

  // Entrada em cascata do centro pras bordas — leque desktop.
  useEffect(() => {
    const section = sectionRef.current;
    const cards = fanCardRefs.current;
    if (!section || cards.some((card) => !card)) return;

    const reduceMotion = prefersReducedMotion();

    if (reduceMotion) {
      cards.forEach((card, i) => {
        if (!card) return;
        gsap.set(card, {
          opacity: 1,
          scale: baseScale(i),
          y: distanceFromCenter(i) * DROOP_STEP,
          rotate: ROTATIONS[i],
          zIndex: BASE_Z - distanceFromCenter(i),
        });
      });
      return;
    }

    cards.forEach((card, i) => {
      if (!card) return;
      gsap.set(card, {
        opacity: 0,
        scale: 0.7,
        y: 40,
        rotate: 0,
        zIndex: BASE_Z - distanceFromCenter(i),
      });
    });

    const tl = gsap.timeline({ paused: true });
    cards.forEach((card, i) => {
      if (!card) return;
      const d = distanceFromCenter(i);
      tl.to(
        card,
        {
          opacity: 1,
          scale: baseScale(i),
          y: d * DROOP_STEP,
          rotate: ROTATIONS[i],
          duration: 0.7,
          ease: "back.out(1.4)",
        },
        d * 0.08,
      );
    });

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top 75%",
      once: true,
      onEnter: () => tl.play(),
    });

    return () => {
      trigger.kill();
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
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full overflow-hidden py-24 sm:py-32"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
        <SectionLabel index="05" className="mb-8">
          Instagram
        </SectionLabel>
        <h2 className="text-display-lg font-rampart leading-[0.95] tracking-[0.01em]">
          <span className="block">O que anda</span>
          <span className="block">rolando</span>
        </h2>
        <p className="text-body-lg mt-6 max-w-md font-sans text-balance opacity-80">
          Os rolês, as latas e quem tá junto — direto do nosso Instagram.
        </p>
      </div>

      {/* Desktop (lg+) — leque sobreposto. Abaixo de 1024px o leque não
          cabe sem cortar as pontas, então vira a fileira com snap. */}
      <div className="relative mt-20 hidden items-end justify-center px-6 lg:flex">
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <div key={i} className={i === 0 ? undefined : "lg:-ml-16 xl:-ml-[4.5rem]"}>
            <PhotoCard
              index={i}
              cardRef={(el) => {
                fanCardRefs.current[i] = el;
              }}
            />
          </div>
        ))}
      </div>

      {/* Mobile/tablet — fileira com scroll-snap */}
      <div
        ref={mobileRowRef}
        className="mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pt-4 pb-8 [scrollbar-width:none] [will-change:transform,opacity] sm:gap-6 lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <div key={i} className="snap-center" style={{ transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}>
            <PhotoCard index={i} />
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 flex max-w-5xl flex-col items-center gap-3 px-6 text-center lg:mt-24">
        <p className="text-body font-accent tracking-[0.04em] uppercase">Segue o Fernandito</p>
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
      </div>
    </section>
  );
}

export default SocialGallerySection;
