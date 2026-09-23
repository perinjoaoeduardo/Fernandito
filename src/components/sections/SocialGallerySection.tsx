"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, EASE, prefersReducedMotion, supportsHover } from "@/lib/gsap";
import { Button } from "@/components/ui/Button";
import { InstagramIcon } from "@/components/ui/icons";

const CARD_COUNT = 7;
const CENTER_INDEX = 3;
// Índice 0-6 -> rotação final no leque.
const ROTATIONS = [-12, -8, -4, 0, 4, 8, 12];
const DROOP_STEP = 14; // px de translateY por "camada" de distância do centro
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
      className="border-fernandito-off-white relative aspect-[2/3] w-32 shrink-0 overflow-hidden border-[7px] shadow-[3px_3px_0_rgba(36,48,34,0.35)] [will-change:transform] sm:w-36 lg:w-44"
    >
      <div className={clsx("absolute inset-0 flex items-center justify-center", CARD_TONES[index])}>
        <span className="text-label text-fernandito-off-white font-sans uppercase">{label}</span>
      </div>
      {/* Textura de grão — mesma técnica do FooterSection, reaproveitada. */}
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
      {stamp && (
        <div
          aria-hidden="true"
          className="border-fernandito-off-white/70 text-fernandito-off-white font-accent absolute top-2 right-2 flex h-9 w-9 -rotate-[15deg] items-center justify-center rounded-full border text-[9px] uppercase"
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
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full overflow-hidden py-[15vh] sm:py-[18vh]"
    >
      <div className="mx-auto max-w-5xl px-6 text-center">
        <h2 className="text-display-xl font-serif leading-[0.9] uppercase">
          <span className="block">O que anda</span>
          <span className="block">rolando</span>
        </h2>
      </div>

      {/* Desktop — leque sobreposto */}
      <div className="relative mt-16 hidden items-end justify-center px-6 sm:mt-20 sm:flex">
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <div key={i} className={i === 0 ? undefined : "-ml-8 sm:-ml-10 lg:-ml-14"}>
            <PhotoCard
              index={i}
              cardRef={(el) => {
                fanCardRefs.current[i] = el;
              }}
            />
          </div>
        ))}
      </div>

      {/* Mobile — fileira com scroll-snap (leque não funciona em tela estreita) */}
      <div
        ref={mobileRowRef}
        className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [will-change:transform,opacity] sm:hidden"
      >
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <div key={i} className="snap-center" style={{ transform: `rotate(${ROTATIONS[i]}deg)` }}>
            <PhotoCard index={i} />
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 flex max-w-5xl flex-col items-center gap-4 px-6 text-center sm:mt-20">
        <p className="text-body-lg font-sans">Segue o Fernandito</p>
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
