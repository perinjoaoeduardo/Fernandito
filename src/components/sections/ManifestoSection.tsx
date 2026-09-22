"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

type Line = { type: "text"; text: string } | { type: "placeholder" };

// Manifesto reescrito como um poema contínuo — uma linha de cada vez, sem
// telas gigantes pinadas por "macro" (versão anterior). As duas últimas
// linhas se repetem de propósito: aqui dentro do fluxo, e de novo sozinhas
// no bloco de impacto logo abaixo (ver `FinaleBlock`).
const LINES: Line[] = [
  { type: "text", text: "Tem os que se entregam na fraqueza." },
  { type: "text", text: "Outros que se entregam na intenção." },
  { type: "text", text: "Domam." },
  { type: "text", text: "É sobre esse chão que nos criamos." },
  { type: "text", text: "Não para representar um lugar, nem para reinventar a bebida." },
  { type: "text", text: "Mas para dar forma a um espírito, colocar em lata um modo de viver." },
  { type: "text", text: "Valorizamos o sabor amargo, a espuma, o detalhe." },
  { type: "text", text: "Pra quem tem sede de uma boa bebida." },
  { type: "placeholder" },
  { type: "text", text: "Para esses, queremos ser. Queremos fazer parte." },
  { type: "text", text: "Não é para todos. Aceitamos assim." },
  { type: "text", text: "Mas, para os que não deixaram passar, esses fazem história." },
  { type: "text", text: "Tomam Fernandito." },
];

export function ManifestoSection() {
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const finaleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lines = lineRefs.current.filter((el): el is HTMLElement => Boolean(el));
    const finale = finaleRef.current;
    if (!lines.length || !finale) return;

    if (prefersReducedMotion()) {
      gsap.set(lines, { opacity: 1, y: 0 });
      gsap.set(finale, { opacity: 1, scale: 1 });
      return;
    }

    gsap.set(lines, { opacity: 0, y: 24 });
    gsap.set(finale, { opacity: 0, scale: 0.85 });

    const triggers = lines.map((line) =>
      ScrollTrigger.create({
        trigger: line,
        start: "top 80%",
        once: true,
        onEnter: () => gsap.to(line, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }),
      }),
    );

    // Bloco de impacto — entra num "novo scroll" separado, sozinho e com
    // zoom (scale 0.85 -> 1), pra pontuar o fim do manifesto.
    triggers.push(
      ScrollTrigger.create({
        trigger: finale,
        start: "top 65%",
        once: true,
        onEnter: () =>
          gsap.to(finale, { opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" }),
      }),
    );

    return () => triggers.forEach((trigger) => trigger.kill());
  }, []);

  return (
    <section
      id="manifesto"
      aria-label="Manifesto"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-[8vh] sm:py-[10vh]"
    >
      <h2 className="sr-only">Manifesto</h2>

      <div className="mx-auto flex max-w-2xl flex-col gap-[4vh] sm:gap-[5vh]">
        {LINES.map((line, i) =>
          line.type === "placeholder" ? (
            <div
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className="border-fernandito-verde-escuro/25 mx-auto flex h-32 w-full max-w-xl items-center justify-center rounded-2xl border-2 border-dashed sm:h-40"
            >
              <span className="text-label font-accent px-6 text-center uppercase opacity-50">
                cenas e sensorial de ser Fernandito
                <br />
                (encontro, rolê — aguardando conteúdo)
              </span>
            </div>
          ) : (
            <p
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className="text-display-md text-center font-serif leading-[1.1] [will-change:transform,opacity]"
            >
              {line.text}
            </p>
          ),
        )}
      </div>

      {/* Bloco de impacto — repete as duas últimas linhas, sozinhas e
          grandes, numa "tela" própria logo depois do poema. Único momento
          "gigante" da seção, de propósito — contraste com o resto do poema,
          que fica num tamanho mais contido pra não pesar o scroll. */}
      <div
        ref={finaleRef}
        className="mt-[6vh] flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center [will-change:transform,opacity] sm:min-h-[80vh]"
      >
        <p className="text-display-md sm:text-display-lg font-serif leading-[1.05]">
          Mas, para os que não deixaram passar, esses fazem história.
        </p>
        <p className="text-display-lg sm:text-display-xl font-serif leading-[0.95] italic">
          Tomam Fernandito.
        </p>
      </div>
    </section>
  );
}

export default ManifestoSection;
