"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "@/lib/gsap";
import { Parallax } from "@/components/ui/Parallax";

// Textos curtos ("o que somos") revelados letra a letra, tipo máquina de
// escrever — combina com a Courier Prime (font-sans) já usada no corpo do
// site. Preso ao scroll via `scrub` (ver useEffect abaixo), não um "toca
// uma vez": avança enquanto rola pra baixo, volta se rolar pra cima. A
// frase de fechamento mora na MESMA coluna dos parágrafos (não vira um
// bloco gigante à parte) e usa a mesma máquina de escrever, só que num
// tamanho bem mais contido — estilo do segundo bloco da home da Lassie,
// onde a frase de efeito fica logo abaixo do texto curto, não domina a
// tela sozinha.
const PARAGRAPHS = [
  "Fernandito é uma bebida mista pronta pra beber: fernet e cola numa lata só, gaseificada, 8% vol.",
  "Sem coqueteleira, sem gelo, sem enrolação — só abrir e virar. O ritual gaúcho do fernet, do jeito que a vida moderna pede.",
];

const STATEMENT = "Onde tomar fernet vira tão fácil quanto abrir uma lata.";

const TYPE_STAGGER = 0.014;

export function OQueESection() {
  const columnRef = useRef<HTMLDivElement>(null);
  const p1Ref = useRef<HTMLParagraphElement>(null);
  const p2Ref = useRef<HTMLParagraphElement>(null);
  const statementRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const column = columnRef.current;
    const p1 = p1Ref.current;
    const p2 = p2Ref.current;
    const statement = statementRef.current;
    if (!column || !p1 || !p2 || !statement) return;

    const reduceMotion = prefersReducedMotion();
    const splitInstances: SplitText[] = [];

    if (reduceMotion) {
      gsap.set([p1, p2, statement], { opacity: 1 });
      return;
    }

    let chars: Element[] = [];
    try {
      // "words,chars": cada palavra vira um inline-block próprio, então a
      // quebra de linha só acontece entre palavras. Só "chars" deixava o
      // navegador quebrar no meio da palavra ("qu / anto").
      const splitP1 = new SplitText(p1, { type: "words,chars", aria: "none" });
      const splitP2 = new SplitText(p2, { type: "words,chars", aria: "none" });
      const splitStatement = new SplitText(statement, { type: "words,chars", aria: "none" });
      splitInstances.push(splitP1, splitP2, splitStatement);
      chars = [...splitP1.chars, ...splitP2.chars, ...splitStatement.chars];
    } catch (err) {
      console.warn("[OQueESection] SplitText indisponível, usando fallback manual.", err);
      gsap.set([p1, p2, statement], { opacity: 1 });
      return;
    }

    gsap.set(chars, { opacity: 0 });

    // Preso ao scroll (scrub), não um "dispara e esquece": a máquina de
    // escrever avança enquanto você rola pra baixo E volta letra por letra
    // se você rolar pra cima — mesma lógica de "aparece e some conforme
    // rola" que o resto do site usa pros títulos grandes. Uma trilha só
    // (parágrafos + frase de fechamento juntos), não dois triggers
    // separados — lê como um bloco de texto contínuo, não duas animações
    // independentes.
    const trigger = ScrollTrigger.create({
      trigger: column,
      // Termina quando o fim da coluna entra na tela (bottom 85%): o texto
      // tem que estar todo escrito enquanto a seção ainda está à vista,
      // não só quando ela já está saindo por cima.
      start: "top 90%",
      end: "bottom 85%",
      scrub: 0.4,
      animation: gsap.timeline().to(chars, { opacity: 1, stagger: TYPE_STAGGER, ease: "none" }),
    });

    return () => {
      trigger.kill();
      splitInstances.forEach((split) => split.revert());
    };
  }, []);

  return (
    <section
      id="o-que-e"
      aria-label="O que é o Fernandito"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[minmax(0,200px)_1fr] md:items-center md:gap-16">
        {/* Placeholder — aqui entra a arte da lata quando o asset chegar.
            Parallax: lata atrás (mais lenta), texto na frente. */}
        <Parallax speed={-50}>
          <div className="border-fernandito-verde-escuro/25 mx-auto flex aspect-[3/7] w-32 shrink-0 items-center justify-center rounded-[2rem] border-2 border-dashed md:mx-0 md:w-full">
            <span className="text-label font-accent px-3 text-center uppercase opacity-80">
              lata
              <br />
              (aguardando arte)
            </span>
          </div>
        </Parallax>

        <Parallax speed={30}>
          <div ref={columnRef} className="flex flex-col gap-6">
            <p ref={p1Ref} className="text-body-lg font-sans">
              {PARAGRAPHS[0]}
            </p>
            <p ref={p2Ref} className="text-body-lg font-sans">
              {PARAGRAPHS[1]}
            </p>
            <h2
              ref={statementRef}
              className="text-display-sm font-rampart mt-4 leading-[1.15] tracking-[0.01em] text-balance"
            >
              {STATEMENT}
            </h2>
          </div>
        </Parallax>
      </div>
    </section>
  );
}

export default OQueESection;
