"use client";

import { useEffect, useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  SplitText,
  EASE,
  prefersReducedMotion,
  supportsHover,
} from "@/lib/gsap";
import { ElevatedCard } from "@/components/ui/ElevatedCard";

const SIGNATURES = ["João", "Lorenzo", "Nando", "Matheus"];

const SEAL_BASE_ROTATION = 8;
const SEAL_HOVER_ROTATION = SEAL_BASE_ROTATION + 3;

export function CartaSection() {
  const epigraphRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);

  // Parte 1 — reveal da epígrafe por palavra.
  useEffect(() => {
    const epigraph = epigraphRef.current;
    if (!epigraph) return;

    const reduceMotion = prefersReducedMotion();

    if (reduceMotion) {
      gsap.set(epigraph, { opacity: 1 });
      return;
    }

    const splitInstances: SplitText[] = [];
    let words: Element[] = [];

    try {
      const split = new SplitText(epigraph, { type: "words", aria: "none" });
      splitInstances.push(split);
      words = split.words;
    } catch (err) {
      console.warn("[CartaSection] SplitText indisponível, usando fallback manual.", err);
      const text = epigraph.textContent ?? "";
      epigraph.innerHTML = "";
      const tokens = text.split(" ");
      words = tokens.map((word, idx) => {
        const span = document.createElement("span");
        span.textContent = idx < tokens.length - 1 ? `${word}\u00A0` : word;
        span.style.display = "inline-block";
        epigraph.appendChild(span);
        return span;
      });
    }

    gsap.set(words, { opacity: 0, y: 20 });

    const trigger = ScrollTrigger.create({
      trigger: epigraph,
      start: "top 80%",
      once: true,
      onEnter: () => {
        gsap.to(words, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.03,
          ease: "power3.out",
        });
      },
    });

    return () => {
      trigger.kill();
      splitInstances.forEach((split) => split.revert());
    };
  }, []);

  // O selo reage ao hover do cartão com leve atraso/rotação extra — a
  // elevação do cartão em si agora é o ElevatedCard (ver JSX abaixo).
  useEffect(() => {
    const card = cardRef.current;
    const seal = sealRef.current;
    if (!card || !seal) return;
    if (prefersReducedMotion() || !supportsHover()) return;

    const handleEnter = () => {
      gsap.to(seal, {
        rotate: SEAL_HOVER_ROTATION,
        y: -4,
        duration: 0.4,
        delay: 0.05,
        ease: EASE.outStandard,
      });
    };

    const handleLeave = () => {
      gsap.to(seal, {
        rotate: SEAL_BASE_ROTATION,
        y: 0,
        duration: 0.4,
        delay: 0.05,
        ease: EASE.outStandard,
      });
    };

    card.addEventListener("mouseenter", handleEnter);
    card.addEventListener("mouseleave", handleLeave);

    return () => {
      card.removeEventListener("mouseenter", handleEnter);
      card.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <section
      id="carta"
      aria-label="Carta"
      className="bg-fernandito-off-white text-fernandito-verde-escuro relative w-full py-24 sm:py-32"
    >
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2
          ref={epigraphRef}
          className="text-display-lg sm:text-display-xl font-serif leading-[0.95] tracking-[-0.02em]"
        >
          A gente não inventou essa entrega. Só deu nome, lata e forma.
        </h2>
      </div>

      <div className="mx-auto mt-16 max-w-[720px] px-6 sm:mt-24">
        <ElevatedCard
          ref={cardRef}
          elevation="md"
          rotateOnHover
          className="relative rounded-md bg-[#F5F5E9] p-6 sm:p-8 lg:p-12"
        >
          <blockquote className="text-body-lg flex flex-col gap-6 font-sans">
            <p>
              A gente acredita numa vida que não se entrega fácil. Que escolhe o caminho difícil
              porque é nele que mora o gosto de verdade.
            </p>
            <p>
              Fernandito nasceu de uma crença simples: existe entrega que é render-se, e existe
              entrega que é arte. A gente escolheu o segundo caminho — e essa lata é prova disso.
            </p>
          </blockquote>

          <p className="text-body mt-12 font-sans">Com brio, de Porto Alegre,</p>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            {SIGNATURES.map((name) => (
              <span key={name} className="text-body-lg font-serif italic">
                {name}
              </span>
            ))}
          </div>

          <div
            ref={sealRef}
            className="absolute -right-3 -bottom-4 aspect-square w-24 rotate-[8deg] drop-shadow-[0_4px_10px_rgba(36,48,34,0.25)] [will-change:transform] sm:-right-5 sm:-bottom-6 sm:w-28 lg:-right-6 lg:-bottom-8 lg:w-[120px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- raster estático de tamanho fixo, next/image não traz benefício */}
            <img
              src="/logo/fernandito-moeda.webp"
              alt="Selo Fernandito"
              width={256}
              height={258}
              loading="lazy"
              decoding="async"
              className="h-full w-full"
            />
          </div>
        </ElevatedCard>
      </div>
    </section>
  );
}

export default CartaSection;
