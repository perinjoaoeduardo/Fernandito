"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion, supportsHover } from "@/lib/gsap";

const MARQUEE_PHRASE =
  "TOMA FERNANDITO • FERNET COM COLA • 350ml • 8% • BEBIDA ALCOÓLICA MISTA GASEIFICADA • RS 002594-1.000127 • ";

type Stat = { value: number; suffix: string; label: string };

const STATS: Stat[] = [
  { value: 350, suffix: "", label: "ML POR LATA" },
  { value: 8, suffix: "%", label: "TEOR ALCOÓLICO" },
  { value: 1, suffix: "", label: "ORIGEM — PORTO ALEGRE, RS" },
  { value: 1, suffix: "", label: "SABOR — FERNET COM COLA" },
];

const SPEC_ROWS = [
  { label: "CLASSIFICAÇÃO", value: "Bebida Alcoólica Mista Gaseificada" },
  { label: "VOLUME", value: "350ml" },
  { label: "TEOR", value: "8% v/v" },
  {
    label: "INGREDIENTES",
    value:
      "água, fernet, açúcar, gás carbônico, corante caramelo IV, conservantes (sorbato de potássio e benzoato de sódio), acidulantes (ácido fosfórico e ácido cítrico) e aroma",
  },
  { label: "ALÉRGICOS", value: "contém glúten. Pode conter aveia, cevada e trigo." },
  { label: "REGISTRO MAPA", value: "RS 002594-1.000127" },
  {
    label: "PRODUZIDO POR",
    value: "Al Capone Indústria e Comércio de Bebidas Ltda. Porto Alegre / RS",
  },
];

const REGULATORY_TEXT =
  "Colorido e aromatizado artificialmente. Sabor artificial de cola. Evite o consumo excessivo de álcool. Proibida a venda para menores de 18 anos.";

// Repetido várias vezes pra garantir que uma "metade" da trilha já seja mais
// larga que qualquer viewport razoável — condição pro loop xPercent:-50 ficar
// perfeitamente contínuo (sem "buraco" em telas muito largas).
const MARQUEE_TRACK_TEXT = MARQUEE_PHRASE.repeat(6);

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
      className="bg-fernandito-verde-escuro flex h-[10vh] items-center overflow-hidden md:h-[15vh]"
    >
      <div ref={trackRef} className="flex w-max shrink-0 [will-change:transform]">
        <span className="text-display-lg text-fernandito-off-white pr-8 font-serif whitespace-nowrap">
          {MARQUEE_TRACK_TEXT}
        </span>
        <span className="text-display-lg text-fernandito-off-white pr-8 font-serif whitespace-nowrap">
          {MARQUEE_TRACK_TEXT}
        </span>
      </div>
    </div>
  );
}

export function FichaTecnicaSection() {
  const revealAnchorRef = useRef<HTMLDivElement>(null);
  const statRootRefs = useRef<(HTMLDivElement | null)[]>([]);
  const statValueRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const statLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Entrada: números fazem count-up em sequência, depois a ficha completa
  // revela linha a linha — tudo numa única timeline pra garantir a ordem
  // "stats primeiro, tabela depois" (as duas colunas ficam lado a lado, então
  // triggers independentes por elemento disparariam ao mesmo tempo).
  useEffect(() => {
    const anchor = revealAnchorRef.current;
    if (!anchor) return;

    const values = statValueRefs.current;
    const labels = statLabelRefs.current;
    const rows = rowRefs.current.filter((el): el is HTMLDivElement => Boolean(el));

    if (prefersReducedMotion()) {
      STATS.forEach((stat, i) => {
        const el = values[i];
        if (el) el.textContent = `${stat.value}${stat.suffix}`;
      });
      gsap.set(labels, { opacity: 1, y: 0 });
      gsap.set(rows, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(labels, { opacity: 0, y: 12 });
    gsap.set(rows, { opacity: 0, y: 15 });
    STATS.forEach((stat, i) => {
      const el = values[i];
      if (el) el.textContent = `0${stat.suffix}`;
    });

    const counters = STATS.map(() => ({ value: 0 }));
    const tl = gsap.timeline({
      scrollTrigger: { trigger: anchor, start: "top 75%", once: true },
    });

    STATS.forEach((stat, i) => {
      const valueEl = values[i];
      const labelEl = labels[i];
      tl.to(
        counters[i],
        {
          value: stat.value,
          duration: 1.2,
          ease: "power2.out",
          onUpdate: () => {
            if (valueEl) valueEl.textContent = `${Math.round(counters[i].value)}${stat.suffix}`;
          },
        },
        i * 0.15,
      );
      if (labelEl) {
        tl.to(labelEl, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, i * 0.15 + 1.0);
      }
    });

    tl.to(rows, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" }, "+=0.2");

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  // Hover "carinho tipográfico" nos números — desktop only.
  useEffect(() => {
    if (prefersReducedMotion() || !supportsHover()) return;

    const cleanups = statRootRefs.current.map((root, i) => {
      if (!root) return () => {};
      const valueEl = statValueRefs.current[i];

      const handleEnter = () => {
        gsap.to(root, { scale: 1.03, duration: 0.3, ease: "power2.out" });
        if (valueEl) gsap.to(valueEl, { color: "#405139", duration: 0.3, ease: "power2.out" });
      };
      const handleLeave = () => {
        gsap.to(root, { scale: 1, duration: 0.3, ease: "power2.out" });
        if (valueEl) gsap.to(valueEl, { color: "#243022", duration: 0.3, ease: "power2.out" });
      };

      root.addEventListener("mouseenter", handleEnter);
      root.addEventListener("mouseleave", handleLeave);
      return () => {
        root.removeEventListener("mouseenter", handleEnter);
        root.removeEventListener("mouseleave", handleLeave);
      };
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return (
    <section
      id="ficha-tecnica"
      className="bg-fernandito-verde-claro text-fernandito-verde-escuro min-h-[120vh] w-full"
    >
      <h2 className="sr-only">Ficha Técnica</h2>

      <Marquee />

      <div
        ref={revealAnchorRef}
        className="mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 py-24 sm:px-8 md:grid-cols-2 lg:px-12"
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              ref={(el) => {
                statRootRefs.current[i] = el;
              }}
              className="flex flex-col gap-2 [will-change:transform]"
            >
              <p
                ref={(el) => {
                  statValueRefs.current[i] = el;
                }}
                className="text-display-xl font-serif"
              >
                {stat.value}
                {stat.suffix}
              </p>
              <span
                ref={(el) => {
                  statLabelRefs.current[i] = el;
                }}
                className="text-label font-sans tracking-[0.08em] uppercase"
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div>
          <dl className="flex flex-col">
            {SPEC_ROWS.map((row, i) => (
              <div
                key={row.label}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className="border-fernandito-verde-escuro/15 flex flex-col gap-1 border-b py-4 [will-change:transform] sm:flex-row sm:gap-6"
              >
                <dt className="text-label w-full shrink-0 font-sans tracking-[0.08em] uppercase sm:w-40">
                  {row.label}
                </dt>
                <dd className="text-body font-serif">{row.value}</dd>
              </div>
            ))}
            <div
              ref={(el) => {
                rowRefs.current[SPEC_ROWS.length] = el;
              }}
              className="pt-4 [will-change:transform]"
            >
              <span className="text-label font-sans tracking-[0.08em] uppercase">
                Indústria brasileira
              </span>
            </div>
          </dl>

          <p className="text-label mt-8 font-sans opacity-70">{REGULATORY_TEXT}</p>
        </div>
      </div>
    </section>
  );
}

export default FichaTecnicaSection;
