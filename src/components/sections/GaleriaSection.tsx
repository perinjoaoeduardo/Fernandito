"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

type PhotoCard = {
  type: "photo";
  label: string;
  tone: string;
  aspect: string;
  width: string;
  offset: number; // px de deslocamento vertical — dá o ar "desalinhado" de mosaico
};

type QuoteCard = { type: "quote" };

type Card = PhotoCard | QuoteCard;

// Fotos ainda não chegaram — placeholders no mesmo espírito do resto do
// site (rótulo + tom de verde variando). O cartão de citação fica bem no
// meio da trilha, coincidindo com a troca de cor de fundo (ver `onUpdate`).
const CARDS: Card[] = [
  {
    type: "photo",
    label: "FOTO 01",
    tone: "bg-fernandito-verde-medio",
    aspect: "aspect-[3/4]",
    width: "w-56 sm:w-64",
    offset: 20,
  },
  {
    type: "photo",
    label: "FOTO 02",
    tone: "bg-fernandito-verde-claro",
    aspect: "aspect-[4/5]",
    width: "w-64 sm:w-72",
    offset: -40,
  },
  {
    type: "photo",
    label: "FOTO 03",
    tone: "bg-fernandito-verde-medio/85",
    aspect: "aspect-square",
    width: "w-52 sm:w-60",
    offset: 50,
  },
  { type: "quote" },
  {
    type: "photo",
    label: "FOTO 04",
    tone: "bg-fernandito-verde-claro/90",
    aspect: "aspect-[4/5]",
    width: "w-64 sm:w-72",
    offset: -30,
  },
  {
    type: "photo",
    label: "FOTO 05",
    tone: "bg-fernandito-verde-medio",
    aspect: "aspect-[3/4]",
    width: "w-56 sm:w-64",
    offset: 40,
  },
  {
    type: "photo",
    label: "FOTO 06",
    tone: "bg-fernandito-verde-claro",
    aspect: "aspect-square",
    width: "w-52 sm:w-60",
    offset: -20,
  },
];

const BG_DARK: [number, number, number] = [36, 48, 34]; // verde-escuro
const BG_LIGHT: [number, number, number] = [230, 230, 203]; // off-white

function mixRgb(from: [number, number, number], to: [number, number, number], t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return `rgb(${from.map((v, i) => Math.round(v + (to[i] - v) * clamped)).join(", ")})`;
}

function QuoteBlock() {
  return (
    <div className="bg-fernandito-off-white text-fernandito-verde-escuro flex h-72 w-64 shrink-0 flex-col justify-between rounded-md p-6 shadow-[3px_3px_0_rgba(36,48,34,0.35)] sm:h-80 sm:w-72">
      <p className="text-body-lg font-serif italic">O que se entrega fácil não deixa gosto.</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
      <img
        src="/logo/fernandito-moeda.svg"
        alt=""
        aria-hidden="true"
        className="ml-auto h-14 w-14 -rotate-6 opacity-90"
      />
    </div>
  );
}

function PhotoCardEl({ card }: { card: PhotoCard }) {
  return (
    <div
      style={{ marginTop: card.offset }}
      className={clsx(
        "border-fernandito-off-white relative shrink-0 overflow-hidden border-[7px] shadow-[3px_3px_0_rgba(36,48,34,0.35)]",
        card.aspect,
        card.width,
      )}
    >
      <div className={clsx("absolute inset-0 flex items-center justify-center", card.tone)}>
        <span className="text-label text-fernandito-off-white font-sans uppercase">
          {card.label}
        </span>
      </div>
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
    </div>
  );
}

export function GaleriaSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mobileRowRef = useRef<HTMLDivElement>(null);

  // Desktop — igual ao "shrink-to-card" da Hero: section mais alta que a
  // viewport, cartão `sticky top-0`, e um ScrollTrigger com `scrub` (sem
  // `pin`, o sticky nativo já resolve isso) traduz a trilha horizontalmente
  // conforme rola. A cor de fundo troca de verde-escuro pra off-white
  // concentrada no meio do percurso, onde fica o cartão de citação.
  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const track = trackRef.current;
    if (!section || !sticky || !track) return;

    const isDesktop = window.matchMedia("(min-width: 640px)").matches;
    if (prefersReducedMotion() || !isDesktop) return;

    const maxTranslate = Math.max(0, track.scrollWidth - sticky.clientWidth);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const progress = self.progress;
        gsap.set(track, { x: -progress * maxTranslate });

        // Troca de cor concentrada no meio do percurso (0.35 → 0.65).
        const colorT = (progress - 0.35) / 0.3;
        gsap.set(sticky, { backgroundColor: mixRgb(BG_DARK, BG_LIGHT, colorT) });
      },
    });

    return () => trigger.kill();
  }, []);

  // Mobile / reduced-motion — fileira com scroll-snap, fundo fixo, sem
  // translação por scroll; só um fade-in simples ao entrar na tela.
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
      onEnter: () => gsap.to(row, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }),
    });

    return () => trigger.kill();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="galeria"
      aria-label="Galeria"
      className="relative w-full motion-safe:sm:h-[250vh]"
    >
      {/* Desktop — pin horizontal + troca de cor */}
      <div
        ref={stickyRef}
        className="bg-fernandito-verde-escuro hidden h-screen w-full items-center overflow-hidden motion-safe:sm:sticky motion-safe:sm:top-0 motion-safe:sm:flex"
      >
        <div
          ref={trackRef}
          className="flex w-max shrink-0 items-center gap-8 px-[10vw] [will-change:transform]"
        >
          {CARDS.map((card, i) =>
            card.type === "quote" ? <QuoteBlock key={i} /> : <PhotoCardEl key={i} card={card} />,
          )}
        </div>
      </div>

      {/* Mobile / reduced-motion — fileira com scroll-snap nativo */}
      <div className="bg-fernandito-verde-escuro w-full overflow-hidden py-16 motion-safe:sm:hidden">
        <div
          ref={mobileRowRef}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 [will-change:transform,opacity]"
        >
          {CARDS.map((card, i) => (
            <div key={i} className="shrink-0 snap-center">
              {card.type === "quote" ? <QuoteBlock /> : <PhotoCardEl card={card} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GaleriaSection;
