"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";

type Macro = {
  number: string;
  title: string;
  opening: string;
  development: string[];
  keyLine?: string;
  closing: string;
};

// Macro 1 (Crença) usa o texto final da marca. Macros 2-5 são
// placeholders — texto entre colchetes, fácil de localizar e trocar
// (basta editar os valores abaixo, a estrutura/animação não muda).
const MACROS: Macro[] = [
  {
    number: "01",
    title: "Crença",
    opening: "Existir é fácil. Difícil é se entregar a isso.",
    development: [
      "Existe entrega que é render-se. E existe entrega que é arte.",
      "Uma é desistir. A outra é dar-se por inteiro.",
    ],
    keyLine: "O que se entrega fácil não deixa gosto.",
    closing: "E foi essa crença que virou lata.",
  },
  {
    number: "02",
    title: "Prova",
    opening: "[PLACEHOLDER — cena moderna e humana, macro 2]",
    development: ["[PLACEHOLDER — linha 2 do macro 2]"],
    closing: "[PLACEHOLDER — fechamento macro 2]",
  },
  {
    number: "03",
    title: "Raiz",
    opening: "[PLACEHOLDER — resgate da raiz gaúcha, macro 3]",
    development: ["[PLACEHOLDER — linha 2 do macro 3]"],
    keyLine: "não queremos representar um lugar, queremos representar um jeito de viver.",
    closing: "[PLACEHOLDER — fechamento macro 3]",
  },
  {
    number: "04",
    title: "A bebida",
    opening: "[PLACEHOLDER — clímax sensorial, macro 4]",
    development: ["[PLACEHOLDER — fernet, cola, gole, lata, rótulo]"],
    closing: "[PLACEHOLDER — fechamento macro 4]",
  },
  {
    number: "05",
    title: "Fecho",
    opening: "[PLACEHOLDER — filtro rápido, não é pra todo mundo]",
    development: [],
    keyLine: "isso toma fernandito",
    closing: "pra quem não deixa passar",
  },
];

// Orçamento (em frações da "fatia" de 1 macro) para as fases de reveal.
// 0.6 pra revelar opening/development/keyLine/closing, 0.2 de leitura
// parada, 0.2 de saída — igual à proporção 0-60/60-80/80-100% do briefing.
const REVEAL_BUDGET = 0.6;
const HOLD_END = 0.8;

function setupPinnedExperience(
  section: HTMLElement,
  macros: HTMLElement[],
  dots: (HTMLSpanElement | null)[],
  numberEl: HTMLSpanElement | null,
  splitInstances: SplitText[],
) {
  const tl = gsap.timeline();

  macros.forEach((macroEl, i) => {
    const base = i;

    const opening = macroEl.querySelector<HTMLElement>('[data-role="opening"]');
    const devLines = Array.from(macroEl.querySelectorAll<HTMLElement>('[data-role="dev"]'));
    const keyLine = macroEl.querySelector<HTMLElement>('[data-role="keyline"]');
    const closing = macroEl.querySelector<HTMLElement>('[data-role="closing"]');

    gsap.set(macroEl, { opacity: 1, y: 0 });
    if (keyLine) gsap.set(keyLine, { opacity: 0, scale: 1.05 });
    if (closing) gsap.set(closing, { opacity: 0, y: 20 });
    devLines.forEach((el) => gsap.set(el, { opacity: 0, y: 20 }));

    // Split da linha de abertura por palavra. SplitText é gratuito desde o
    // gsap 3.13 (sem Club GreenSock) — fallback abaixo só por segurança.
    let words: Element[] = [];
    if (opening) {
      try {
        const split = new SplitText(opening, { type: "words" });
        splitInstances.push(split);
        words = split.words;
      } catch (err) {
        console.warn("[ManifestoSection] SplitText indisponível, usando fallback manual.", err);
        const text = opening.textContent ?? "";
        opening.innerHTML = "";
        const tokens = text.split(" ");
        words = tokens.map((word, idx) => {
          const span = document.createElement("span");
          span.textContent = idx < tokens.length - 1 ? `${word}\u00A0` : word;
          span.style.display = "inline-block";
          opening.appendChild(span);
          return span;
        });
      }
      gsap.set(words, { opacity: 0, y: 30 });
    }

    // Fases dinâmicas: cada macro reparte o orçamento de 60% entre só as
    // partes que ele realmente tem (evita "buraco" parado quando falta
    // development ou keyLine, como no macro 05).
    const parts: { weight: number; build: (start: number, duration: number) => void }[] = [];

    parts.push({
      weight: 1,
      build: (start, duration) => {
        if (!words.length) return;
        tl.to(
          words,
          {
            opacity: 1,
            y: 0,
            duration: Math.max(duration * 0.7, 0.05),
            stagger: duration / words.length,
            ease: "power4.out",
          },
          base + start,
        );
      },
    });

    if (devLines.length > 0) {
      parts.push({
        weight: 1,
        build: (start, duration) => {
          const each = duration / devLines.length;
          devLines.forEach((el, k) => {
            tl.to(
              el,
              { opacity: 1, y: 0, duration: Math.max(each * 0.7, 0.05), ease: "power2.out" },
              base + start + k * each,
            );
          });
        },
      });
    }

    if (keyLine) {
      parts.push({
        weight: 1.2,
        build: (start, duration) => {
          tl.to(keyLine, { opacity: 1, scale: 1, duration, ease: "power3.out" }, base + start);
        },
      });
    }

    parts.push({
      weight: 0.8,
      build: (start, duration) => {
        if (!closing) return;
        tl.to(closing, { opacity: 1, y: 0, duration, ease: "power2.out" }, base + start);
      },
    });

    const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
    let cursor = 0;
    parts.forEach((part) => {
      const duration = (part.weight / totalWeight) * REVEAL_BUDGET;
      part.build(cursor, duration);
      cursor += duration;
    });

    // Saída: o macro inteiro sai (fade + y pra cima). Duração um pouco
    // maior que a janela nominal pra sobrepor com a entrada do próximo
    // macro e criar o crossfade (exceto no último, que só sai).
    const isLast = i === macros.length - 1;
    tl.to(
      macroEl,
      { opacity: 0, y: -60, duration: isLast ? 0.2 : 0.3, ease: "power2.in" },
      base + HOLD_END,
    );
  });

  const updateIndicators = (progress: number) => {
    const activeIndex = Math.min(macros.length - 1, Math.floor(progress * macros.length));
    dots.forEach((dot, idx) => {
      if (!dot) return;
      gsap.set(dot, {
        opacity: idx === activeIndex ? 1 : 0.25,
        scale: idx === activeIndex ? 1.4 : 1,
      });
    });
    if (numberEl) numberEl.textContent = `${MACROS[activeIndex].number} / 05`;
  };

  const pinTrigger = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${window.innerHeight * macros.length}`,
    pin: true,
    scrub: 1,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (self) => updateIndicators(self.progress),
  });

  // Sincroniza o indicador com macro 1 no load, sem depender do usuário já
  // ter scrollado (onUpdate só dispara a partir da primeira mudança real).
  updateIndicators(0);

  return () => {
    pinTrigger.kill();
    tl.kill();
  };
}

function setupFallbackExperience(macros: HTMLElement[]) {
  const triggers: ScrollTrigger[] = [];

  macros.forEach((macroEl) => {
    const children = macroEl.querySelectorAll<HTMLElement>(
      '[data-role="opening"], [data-role="dev"], [data-role="keyline"], [data-role="closing"]',
    );
    gsap.set(children, { opacity: 1, y: 0, scale: 1 });
    gsap.set(macroEl, { opacity: 0, y: 30 });

    triggers.push(
      ScrollTrigger.create({
        trigger: macroEl,
        start: "top 85%",
        once: true,
        onEnter: () => {
          gsap.to(macroEl, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" });
        },
      }),
    );
  });

  return () => {
    triggers.forEach((trigger) => trigger.kill());
  };
}

export function ManifestoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const macroRefs = useRef<(HTMLElement | null)[]>([]);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const splitInstances: SplitText[] = [];
    const macros = macroRefs.current.filter((el): el is HTMLElement => Boolean(el));
    const mm = gsap.matchMedia();

    mm.add(
      {
        isDesktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        isFallback: "(max-width: 767px), (prefers-reduced-motion: reduce)",
      },
      (context) => {
        const isDesktop = Boolean(context.conditions?.isDesktop);
        if (isDesktop) {
          return setupPinnedExperience(
            section,
            macros,
            dotRefs.current,
            numberRef.current,
            splitInstances,
          );
        }
        return setupFallbackExperience(macros);
      },
    );

    return () => {
      mm.revert();
      splitInstances.forEach((split) => split.revert());
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="manifesto"
      aria-label="Manifesto"
      className="bg-fernandito-off-white text-fernandito-verde-escuro relative w-full md:motion-safe:h-screen md:motion-safe:overflow-hidden"
    >
      <h2 className="sr-only">Manifesto</h2>

      {/* Indicador único (número + dots), só no modo pinado desktop — os
          números por-macro (abaixo) ficam ocultos aqui pra não se
          sobreporem visualmente durante o crossfade entre macros. */}
      <span
        ref={numberRef}
        aria-hidden="true"
        className="text-label absolute top-6 left-6 z-10 hidden font-sans tracking-[0.08em] uppercase opacity-60 md:motion-safe:block"
      >
        01 / 05
      </span>

      <div
        aria-hidden="true"
        className="hidden md:motion-safe:absolute md:motion-safe:top-1/2 md:motion-safe:right-8 md:motion-safe:z-10 md:motion-safe:flex md:motion-safe:-translate-y-1/2 md:motion-safe:flex-col md:motion-safe:gap-3"
      >
        {MACROS.map((macro, i) => (
          <span
            key={macro.number}
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            className="bg-fernandito-verde-escuro h-2 w-2 rounded-full opacity-25"
          />
        ))}
      </div>

      {MACROS.map((macro, i) => (
        <article
          key={macro.number}
          ref={(el) => {
            macroRefs.current[i] = el;
          }}
          className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 py-24 [will-change:transform,opacity] md:motion-safe:absolute md:motion-safe:inset-0 md:motion-safe:h-screen md:motion-safe:min-h-0 md:motion-safe:py-0"
        >
          <span className="text-label absolute top-6 left-6 font-sans tracking-[0.08em] uppercase opacity-60 md:motion-safe:hidden">
            {macro.number} / 05
          </span>

          <div className="flex max-w-4xl flex-col items-center gap-8">
            <h3
              data-role="opening"
              className="text-display-lg text-center font-serif [will-change:transform,opacity]"
            >
              {macro.opening}
            </h3>

            {macro.development.length > 0 && (
              <div className="flex flex-col gap-4">
                {macro.development.map((line, k) => (
                  <p
                    key={k}
                    data-role="dev"
                    className="text-display-md text-center font-sans [will-change:transform,opacity]"
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}

            {macro.keyLine && (
              <p
                data-role="keyline"
                className="text-display-md text-fernandito-verde-medio md:text-display-lg text-center font-serif underline decoration-2 underline-offset-8 [will-change:transform,opacity]"
              >
                {macro.keyLine}
              </p>
            )}

            <p
              data-role="closing"
              className="text-body-lg mt-12 self-end text-right font-serif italic [will-change:transform,opacity]"
            >
              {macro.closing}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}

export default ManifestoSection;
