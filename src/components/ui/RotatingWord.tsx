"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

// Palavras que completam "Feito com ___." — o clima é sempre de
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

// Cada linha ocupa exatamente `1.4em` (ver `h-[1.4em]` nos spans abaixo —
// folga extra em relação a `1.2em` porque a Rampart Stamp tem métricas de
// ascendente/descendente maiores que o normal; sem essa folga e
// `leading-none`, a linha vizinha vazava por cima/baixo do recorte). O
// roller sobe uma linha por vez em `em` (não `yPercent`, que seria
// relativo à altura TOTAL da trilha inteira, não de um item).
const LINE_HEIGHT_EM = 1.4;

/**
 * A FRASE INTEIRA ("Feito com ___.") rola como um bloco só — não apenas a
 * palavra dentro de um "Feito com" fixo. Antes disso, a caixa da palavra
 * também animava a própria LARGURA (pra acompanhar palavras de tamanhos
 * diferentes) ao mesmo tempo que a trilha animava a posição vertical: duas
 * tweens paralelas em propriedades de naturezas diferentes (largura mexe no
 * layout, na thread principal; posição vertical é só `transform`, no
 * compositor) — às vezes dessincronizavam visualmente e a palavra parecia
 * entrar "em diagonal". Como agora cada linha é a frase inteira, cada uma
 * ocupa a largura toda do bloco e se centraliza sozinha (`items-center` no
 * flex) — não precisa mais medir nem animar largura nenhuma.
 */
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
        // A última posição real é uma cópia da primeira frase — o pulo
        // instantâneo de volta ao topo (sem transição) fica invisível.
        tl.set(track, { y: 0 }, `+=${HOLD_SECONDS}`);
      }
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <span aria-live="off" className="relative block h-[1.4em] overflow-hidden">
      <span ref={trackRef} className="flex flex-col items-center">
        {LOOP_WORDS.map((word, i) => (
          <span
            key={`${word}-${i}`}
            aria-hidden={i !== 0}
            className="flex h-[1.4em] shrink-0 items-center justify-center gap-1.5 leading-none whitespace-nowrap"
          >
            <span className="font-rampart-sans">Feito com</span>
            <span className="font-rampart-stamp font-bold">{word}.</span>
          </span>
        ))}
      </span>
      <span className="sr-only">Feito com {WORDS.join(". Feito com ")}.</span>
    </span>
  );
}

export default RotatingWord;
