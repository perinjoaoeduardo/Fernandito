"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

// Palavras que completam "... Feito com ___." — o clima é sempre de
// entrega/caráter, ecoando a Crença do Manifesto ("O que se entrega fácil
// não deixa gosto"). A primeira se repete no fim da lista de render pra
// fechar o loop do roller sem costura (ver `LOOP_WORDS` abaixo).
const WORDS = [
  "Brio",
  "Intenção",
  "Teimosia",
  "Amargor",
  "Insistência",
  "Paciência",
  "Coragem",
  "Liberdade",
  "Inquietação",
  "Independência",
];

// O ponto final anda junto com a palavra (faz parte do mesmo `<span>`) —
// se ficasse solto depois do componente, ele grudaria na borda da caixa de
// largura fixa e apareceria "flutuando" longe da palavra curta da vez.
const LOOP_WORDS = [...WORDS, WORDS[0]].map((word) => `${word}.`);

const HOLD_SECONDS = 1.8;
const STEP_SECONDS = 0.7;

// Cada palavra ocupa exatamente 1 linha de `1.4em` (ver `h-[1.4em]` nos spans
// abaixo — folga extra em relação a `1.2em` porque a Rampart Stamp tem
// métricas de ascendente/descendente maiores que o normal; sem essa folga
// e `leading-none`, a palavra vizinha vazava por baixo/cima do recorte). O
// roller sobe uma linha por vez em `em` (não `yPercent`, que seria
// relativo à altura TOTAL da trilha inteira, não de um item).
const LINE_HEIGHT_EM = 1.4;

export function RotatingWord() {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    if (!wrapper || !track) return;

    let tl: gsap.core.Timeline | null = null;
    let cancelled = false;

    // A largura da caixa acompanha a palavra da vez, em vez de ficar travada
    // na palavra mais larga da lista — senão a frase inteira (centralizada)
    // fica visivelmente fora do meio da tela nas palavras curtas.
    // Espera as fontes carregarem antes de medir: com a fonte de fallback as
    // larguras saem erradas.
    const setup = () => {
      if (cancelled) return;
      const widths = wordRefs.current.map((el) => el?.offsetWidth ?? 0);
      if (!widths.length) return;

      gsap.set(wrapper, { width: widths[0] });

      if (prefersReducedMotion()) {
        gsap.set(track, { y: 0 });
        return;
      }

      tl = gsap.timeline({ repeat: -1, delay: HOLD_SECONDS });

      WORDS.forEach((_, i) => {
        const step = i + 1;
        tl!.to(
          track,
          { y: `${-step * LINE_HEIGHT_EM}em`, duration: STEP_SECONDS, ease: "power3.inOut" },
          `+=${HOLD_SECONDS}`,
        );
        tl!.to(
          wrapper,
          { width: widths[step], duration: STEP_SECONDS, ease: "power3.inOut" },
          "<",
        );

        if (step === WORDS.length) {
          // A última posição real é uma cópia da primeira palavra — o pulo
          // instantâneo de volta ao topo (sem transição) fica invisível.
          tl!.set(track, { y: 0 }, `+=${HOLD_SECONDS}`);
          tl!.set(wrapper, { width: widths[0] }, "<");
        }
      });
    };

    if (document.fonts?.status === "loaded") {
      setup();
    } else {
      document.fonts?.ready.then(setup);
    }

    return () => {
      cancelled = true;
      tl?.kill();
    };
  }, []);

  return (
    <span
      ref={wrapperRef}
      aria-live="off"
      className="relative inline-block h-[1.4em] overflow-hidden align-middle"
    >
      <span ref={trackRef} className="flex flex-col items-start">
        {LOOP_WORDS.map((word, i) => (
          <span
            key={`${word}-${i}`}
            ref={(el) => {
              wordRefs.current[i] = el;
            }}
            aria-hidden={i !== 0}
            className="font-rampart-stamp flex h-[1.4em] shrink-0 items-center font-bold leading-none whitespace-nowrap"
          >
            {word}
          </span>
        ))}
      </span>
      <span className="sr-only">{WORDS.join(", ")}</span>
    </span>
  );
}

export default RotatingWord;
