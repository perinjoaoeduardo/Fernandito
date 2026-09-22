"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

// Palavras que completam "Fernet feito com ___." — o clima é sempre de
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

const LOOP_WORDS = [...WORDS, WORDS[0]];

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
  const trackRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    if (prefersReducedMotion()) {
      gsap.set(track, { y: 0 });
      return;
    }

    const tl = gsap.timeline({ repeat: -1, delay: HOLD_SECONDS });

    WORDS.forEach((_, i) => {
      const step = i + 1;
      tl.to(
        track,
        { y: `${-step * LINE_HEIGHT_EM}em`, duration: STEP_SECONDS, ease: "power3.inOut" },
        `+=${HOLD_SECONDS}`,
      );
      if (step === WORDS.length) {
        // A última posição real é uma cópia da primeira palavra — o pulo
        // instantâneo de volta ao topo (sem transição) fica invisível.
        tl.set(track, { y: 0 }, `+=${HOLD_SECONDS}`);
      }
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <span aria-live="off" className="relative inline-block h-[1.4em] overflow-hidden align-bottom">
      <span ref={trackRef} className="flex flex-col">
        {LOOP_WORDS.map((word, i) => (
          <span
            key={`${word}-${i}`}
            aria-hidden={i !== 0}
            className="font-rampart-stamp flex h-[1.4em] items-center font-bold leading-none whitespace-nowrap"
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
