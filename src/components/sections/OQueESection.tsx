"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "@/lib/gsap";

// Textos curtos ("o que somos") revelados letra a letra, tipo máquina de
// escrever — combina com a Courier Prime (font-sans) já usada no corpo do
// site. A frase de fechamento usa o reveal por palavra padrão do resto do
// site (ver CartaSection/FooterSection), pra não ficar lento demais num
// bloco grande de display.
const PARAGRAPHS = [
  "Fernandito é uma bebida mista pronta pra beber: fernet e cola numa lata só, gaseificada, 8% vol.",
  "Sem coqueteleira, sem gelo, sem enrolação — só abrir e virar. O ritual gaúcho do fernet, do jeito que a vida moderna pede.",
];

const TYPE_STAGGER = 0.014;

export function OQueESection() {
  const p1Ref = useRef<HTMLParagraphElement>(null);
  const p2Ref = useRef<HTMLParagraphElement>(null);
  const statementRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const p1 = p1Ref.current;
    const p2 = p2Ref.current;
    const statement = statementRef.current;
    if (!p1 || !p2 || !statement) return;

    const reduceMotion = prefersReducedMotion();
    const splitInstances: SplitText[] = [];

    if (reduceMotion) {
      gsap.set([p1, p2, statement], { opacity: 1, y: 0 });
      return;
    }

    let chars: Element[] = [];
    let words: Element[] = [];
    try {
      const splitP1 = new SplitText(p1, { type: "chars" });
      const splitP2 = new SplitText(p2, { type: "chars" });
      const splitStatement = new SplitText(statement, { type: "words" });
      splitInstances.push(splitP1, splitP2, splitStatement);
      chars = [...splitP1.chars, ...splitP2.chars];
      words = splitStatement.words;
    } catch (err) {
      console.warn("[OQueESection] SplitText indisponível, usando fallback manual.", err);
      gsap.set([p1, p2, statement], { opacity: 1, y: 0 });
      return;
    }

    gsap.set(chars, { opacity: 0 });
    gsap.set(words, { opacity: 0, y: 20 });

    const tl = gsap.timeline({ paused: true });
    tl.to(chars, { opacity: 1, duration: 0.01, stagger: TYPE_STAGGER, ease: "none" }).to(
      words,
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.03, ease: "power3.out" },
      "+=0.2",
    );

    const trigger = ScrollTrigger.create({
      trigger: p1,
      start: "top 80%",
      once: true,
      onEnter: () => tl.play(),
    });

    return () => {
      trigger.kill();
      tl.kill();
      splitInstances.forEach((split) => split.revert());
    };
  }, []);

  return (
    <section
      id="o-que-e"
      aria-label="O que é o Fernandito"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-5xl gap-12 sm:grid-cols-[minmax(0,200px)_1fr] sm:items-start sm:gap-16">
        {/* Placeholder — aqui entra a arte da lata quando o asset chegar. */}
        <div className="border-fernandito-verde-escuro/25 mx-auto flex aspect-[3/7] w-36 shrink-0 items-center justify-center rounded-[2rem] border-2 border-dashed sm:mx-0 sm:w-full">
          <span className="text-label font-accent px-3 text-center uppercase opacity-50">
            lata
            <br />
            (aguardando arte)
          </span>
        </div>

        <div className="flex flex-col gap-6">
          <p ref={p1Ref} className="text-body-lg font-sans">
            {PARAGRAPHS[0]}
          </p>
          <p ref={p2Ref} className="text-body-lg font-sans">
            {PARAGRAPHS[1]}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-5xl sm:mt-20">
        <h2
          ref={statementRef}
          className="text-display-lg sm:text-display-xl font-serif leading-[0.95]"
        >
          Onde tomar fernet vira tão fácil quanto abrir uma lata.
        </h2>
      </div>
    </section>
  );
}

export default OQueESection;
