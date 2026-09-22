"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion, supportsHover } from "@/lib/gsap";

const SIGNATURES = ["João", "Lorenzo", "Nando", "Matheus"];

const SEAL_BASE_ROTATION = 8;
const SEAL_HOVER_ROTATION = SEAL_BASE_ROTATION + 3;

const SHADOW_REST = "0 4px 12px rgba(36,48,34,0.08)";
const SHADOW_HOVER = "0 20px 40px rgba(36,48,34,0.18)";

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
      const split = new SplitText(epigraph, { type: "words" });
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

  // Elevação no hover — cartão sobe/rotaciona, selo reage com leve atraso.
  useEffect(() => {
    const card = cardRef.current;
    const seal = sealRef.current;
    if (!card || !seal) return;
    if (prefersReducedMotion() || !supportsHover()) return;

    const handleEnter = () => {
      gsap.to(card, {
        y: -8,
        rotate: -1.5,
        boxShadow: SHADOW_HOVER,
        duration: 0.4,
        ease: "power2.out",
      });
      gsap.to(seal, {
        rotate: SEAL_HOVER_ROTATION,
        y: -4,
        duration: 0.4,
        delay: 0.05,
        ease: "power2.out",
      });
    };

    const handleLeave = () => {
      gsap.to(card, {
        y: 0,
        rotate: 0,
        boxShadow: SHADOW_REST,
        duration: 0.4,
        ease: "power2.out",
      });
      gsap.to(seal, {
        rotate: SEAL_BASE_ROTATION,
        y: 0,
        duration: 0.4,
        delay: 0.05,
        ease: "power2.out",
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
        <div
          ref={cardRef}
          data-cursor-hover
          className="relative rounded-md bg-[#F5F5E9] p-6 shadow-[0_4px_12px_rgba(36,48,34,0.08)] [will-change:transform,box-shadow] sm:p-8 lg:p-12"
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
            className="carta-seal-edge absolute -right-3 -bottom-4 aspect-square w-24 rotate-[8deg] bg-white p-1.5 shadow-[0_4px_10px_rgba(36,48,34,0.15)] [will-change:transform] sm:-right-5 sm:-bottom-6 sm:w-28 lg:-right-6 lg:-bottom-8 lg:w-[120px]"
          >
            <div
              role="img"
              aria-label="Placeholder de foto do selo — foto real a definir (paisagem gaúcha, pôr do sol, cavalo ou a lata em cena)"
              className="carta-seal-edge bg-fernandito-verde-medio flex h-full w-full items-center justify-center text-center"
            >
              <span
                aria-hidden="true"
                className="text-label text-fernandito-off-white px-2 font-sans leading-tight uppercase"
              >
                Foto selo
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CartaSection;
