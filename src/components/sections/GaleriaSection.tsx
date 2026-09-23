"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";
import { SectionLabel } from "@/components/ui/SectionLabel";

// `ratio` = largura/altura do card; `h` = altura como fração da altura do
// palco (desktop). Proporções e alturas variam pra dar ritmo editorial ao
// trilho, mas o espaçamento entre cards é sempre o mesmo (ver `layout`).
type Photo = { label: string; tone: string; ratio: number; h: number };

const PHOTOS: Photo[] = [
  { label: "Foto 01", tone: "bg-fernandito-verde-medio", ratio: 4 / 5, h: 0.64 },
  { label: "Foto 02", tone: "bg-fernandito-verde-claro", ratio: 3 / 4, h: 0.52 },
  { label: "Foto 03", tone: "bg-fernandito-verde-medio/70", ratio: 4 / 3, h: 0.5 },
  { label: "Foto 04", tone: "bg-fernandito-verde-claro/85", ratio: 4 / 5, h: 0.66 },
  { label: "Foto 05", tone: "bg-fernandito-verde-medio", ratio: 3 / 4, h: 0.54 },
  { label: "Foto 06", tone: "bg-fernandito-verde-claro/70", ratio: 4 / 3, h: 0.48 },
  { label: "Foto 07", tone: "bg-fernandito-verde-medio/85", ratio: 4 / 5, h: 0.6 },
];

const TOTAL = String(PHOTOS.length).padStart(2, "0");
const RADIUS = 20;
// Trilho anda 1.25px na horizontal por px rolado — rápido o bastante pra
// não arrastar, sem pular foto.
const SPEED = 1.25;
const PARALLAX = 7; // xPercent da imagem dentro do card (±)

function layout(stageW: number, stageH: number) {
  const mobile = stageW < 768;
  const gap = mobile ? stageW * 0.06 : Math.max(40, stageW * 0.035);
  const maxW = stageW * (mobile ? 0.78 : 0.42);
  const sizes = PHOTOS.map((p) => {
    let h = stageH * (mobile ? p.h * 0.85 : p.h);
    let w = h * p.ratio;
    if (w > maxW) {
      w = maxW;
      h = w / p.ratio;
    }
    return { w, h };
  });
  const lefts: number[] = [];
  sizes.reduce((acc, s) => {
    lefts.push(acc);
    return acc + s.w + gap;
  }, 0);
  return { gap, sizes, lefts };
}

/** Miolo de cada card — hoje placeholder; com a foto real, trocar o
 * conteúdo por `<Image fill className="object-cover" />` mantendo o wrapper
 * (ele é mais largo que o card pra sobrar margem pro parallax). */
function PhotoFill({ photo, innerRef }: { photo: Photo; innerRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={innerRef}
      className={clsx(
        "absolute inset-y-0 -left-[10%] flex w-[120%] items-center justify-center [will-change:transform]",
        photo.tone,
      )}
    >
      <span className="text-label text-fernandito-off-white font-sans tracking-[0.12em] uppercase opacity-80">
        {photo.label}
      </span>
    </div>
  );
}

export function GaleriaSection() {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const introRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const stage = stageRef.current;
    const track = trackRef.current;
    const intro = introRef.current;
    const chrome = chromeRef.current;
    const counter = counterRef.current;
    const bar = barRef.current;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    const inners = innerRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!stage || !track || !intro || !chrome || !counter || !bar) return;
    if (cards.length !== PHOTOS.length) return;

    let ctx: gsap.Context | null = null;

    const build = () => {
      ctx?.revert();
      ctx = gsap.context(() => {
        const stageW = stage.clientWidth;
        const stageH = stage.clientHeight;
        const { gap, sizes, lefts } = layout(stageW, stageH);
        const last = PHOTOS.length - 1;

        // Card 0 começa ocupando o palco inteiro (foto "inteira"); os demais
        // já no tamanho final, logo à direita dele — fora da tela até o
        // card 0 encolher e "puxar" a fileira pra dentro.
        // `gap` direto no style: o CSSPlugin do GSAP não aplica column-gap.
        track.style.gap = `${gap}px`;
        gsap.set(track, { x: 0 });
        gsap.set(cards[0], { width: stageW, height: stageH, borderRadius: 0 });
        cards.slice(1).forEach((card, i) => {
          gsap.set(card, { width: sizes[i + 1].w, height: sizes[i + 1].h, borderRadius: RADIUS });
        });
        gsap.set(inners, { xPercent: PARALLAX });
        gsap.set(chrome, { autoAlpha: 0 });
        gsap.set(bar, { scaleX: 0 });

        const xStart = stageW / 2 - sizes[0].w / 2;
        const xEnd = stageW / 2 - (lefts[last] + sizes[last].w / 2);
        const p1 = stageH * 0.9;
        const p2 = (xStart - xEnd) / SPEED;

        let current = 0;
        const updateCounter = () => {
          const x = Number(gsap.getProperty(track, "x"));
          let best = 0;
          let bestDist = Infinity;
          for (let i = 0; i <= last; i++) {
            const d = Math.abs(x + lefts[i] + sizes[i].w / 2 - stageW / 2);
            if (d < bestDist) {
              bestDist = d;
              best = i;
            }
          }
          if (best !== current) {
            current = best;
            counter.textContent = String(best + 1).padStart(2, "0");
          }
        };

        const tl = gsap.timeline({ defaults: { ease: "none" }, onUpdate: updateCounter });

        // Fase 1 — a foto inteira encolhe até virar card, centralizada.
        tl.to(
          cards[0],
          { width: sizes[0].w, height: sizes[0].h, borderRadius: RADIUS, duration: p1, ease: "power2.inOut" },
          0,
        )
          .to(track, { x: xStart, duration: p1, ease: "power2.inOut" }, 0)
          .to(intro, { autoAlpha: 0, y: -24, duration: p1 * 0.35, ease: "power1.in" }, 0)
          .to(chrome, { autoAlpha: 1, duration: p1 * 0.25 }, p1 * 0.75)
          // Fase 2 — trilho anda pra esquerda até a última foto centralizar.
          .to(track, { x: xEnd, duration: p2 }, p1)
          .to(inners, { xPercent: -PARALLAX, duration: p1 + p2 }, 0)
          .to(bar, { scaleX: 1, duration: p1 + p2 }, 0);

        ScrollTrigger.create({
          trigger: stage,
          start: "top top",
          end: `+=${p1 + p2}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          animation: tl,
        });
      }, stage);
    };

    build();

    // Rebuild só quando a LARGURA muda — no celular a barra de endereço
    // muda a altura a cada rolagem e reconstruir nisso travaria o scroll.
    let lastW = window.innerWidth;
    let timer: number | undefined;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        build();
        ScrollTrigger.refresh();
      }, 200);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
      ctx?.revert();
      track.style.gap = "";
    };
  }, []);

  return (
    <section id="galeria" aria-label="Galeria" className="bg-fernandito-verde-escuro relative w-full">
      {/* ── Animado (some sob prefers-reduced-motion) ── */}
      <div
        ref={stageRef}
        className="text-fernandito-off-white relative h-[100svh] w-full overflow-hidden motion-reduce:hidden"
      >
        <div ref={trackRef} className="absolute inset-y-0 left-0 flex items-center [will-change:transform]">
          {PHOTOS.map((photo, i) => (
            <div
              key={photo.label}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              role="img"
              aria-label={`Galeria Fernandito — ${photo.label.toLowerCase()}`}
              className={clsx(
                "relative shrink-0 overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.3)]",
                // Tamanhos antes do JS montar (SSR): card 0 já é a foto
                // inteira, o resto fica fora da tela à direita.
                i === 0 ? "h-full w-screen" : "aspect-[4/5] h-[55%] rounded-[20px]",
              )}
            >
              <PhotoFill
                photo={photo}
                innerRef={(el) => {
                  innerRefs.current[i] = el;
                }}
              />
            </div>
          ))}
        </div>

        {/* Abertura sobre a foto inteira — some enquanto ela encolhe. */}
        <div
          ref={introRef}
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-6 pt-32 pb-10 sm:px-10 sm:pb-14 lg:px-16"
        >
          <SectionLabel index="02" className="mb-5">
            Galeria
          </SectionLabel>
          <h2 className="font-rampart text-display-lg max-w-3xl leading-[0.95] tracking-[0.01em]">
            Onde a lata anda
          </h2>
          <p className="text-label mt-6 flex items-center gap-2 font-sans tracking-[0.12em] uppercase opacity-80">
            Role pra ver
            <span aria-hidden="true">↓</span>
          </p>
        </div>

        {/* Orientação durante o trilho: rótulo, contador e progresso. */}
        <div
          ref={chromeRef}
          className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-6 sm:px-10 sm:pb-8 lg:px-16"
        >
          <div className="flex items-end justify-between">
            <SectionLabel index="02">Galeria</SectionLabel>
            <p className="text-label font-accent tracking-[0.12em]" aria-hidden="true">
              <span ref={counterRef}>01</span>
              <span className="opacity-50"> / {TOTAL}</span>
            </p>
          </div>
          <div className="bg-fernandito-off-white/15 mt-4 h-px w-full overflow-hidden">
            <div ref={barRef} className="bg-fernandito-off-white h-full w-full origin-left" />
          </div>
        </div>
      </div>

      {/* ── prefers-reduced-motion: grid estático, sem pin nem scroll ── */}
      <div className="text-fernandito-off-white hidden px-6 py-24 motion-reduce:block">
        <div className="mx-auto max-w-5xl">
          <SectionLabel index="02" className="mb-5">
            Galeria
          </SectionLabel>
          <h2 className="font-rampart text-display-md mb-12 leading-[1]">Onde a lata anda</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
            {PHOTOS.map((photo) => (
              <div
                key={photo.label}
                role="img"
                aria-label={`Galeria Fernandito — ${photo.label.toLowerCase()}`}
                className="relative aspect-[4/5] overflow-hidden rounded-[20px]"
              >
                <PhotoFill photo={photo} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default GaleriaSection;
