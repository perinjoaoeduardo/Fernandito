"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "@/lib/gsap";
import { FlipCard } from "@/components/ui/FlipCard";
import { SectionLabel } from "@/components/ui/SectionLabel";

const SIGNATURES = ["João", "Lorenzo", "Nando", "Matheus"];

export function CartaSection() {
  const epigraphRef = useRef<HTMLHeadingElement>(null);

  // Reveal da epígrafe por palavra.
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
        span.textContent = idx < tokens.length - 1 ? `${word} ` : word;
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

  // ── Frente: preservada do que já existia (texto, assinaturas, selo). ──
  const front = (
    <>
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

      {/* pr-*: as assinaturas quebram antes de chegar no selo (canto
          inferior direito) em vez de passar por baixo dele no celular. */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 pr-20 sm:gap-x-8 sm:pr-24">
        {SIGNATURES.map((name) => (
          <span key={name} className="text-body sm:text-body-lg font-accent">
            {name}
          </span>
        ))}
      </div>

      {/* Selo — a rotação extra no hover agora é CSS puro (group-hover),
          não GSAP+ref: o FlipCard renderiza esse conteúdo duas vezes (um
          "sizer" invisível pra altura + a face real), então um ref aqui
          resolveria pra uma cópia arbitrária das duas. */}
      <div
        className="text-fernandito-verde-escuro absolute -right-3 -bottom-4 aspect-square w-24 rotate-[8deg] drop-shadow-[0_4px_10px_rgba(36,48,34,0.25)] transition-transform duration-500 ease-out-standard [will-change:transform] group-hover:-translate-y-1 group-hover:rotate-[11deg] sm:-right-5 sm:-bottom-6 sm:w-28 lg:-right-6 lg:-bottom-8 lg:w-[120px]"
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
    </>
  );

  // ── Verso: foto dos fundadores (placeholder até a foto real chegar). ──
  const back = (
    <div className="flex h-full flex-col gap-4">
      {/* Filtro sépia/saturação leve sobre o placeholder sólido — proposital:
          prepara o tom duotone esverdeado retrô que a foto real vai ganhar
          quando entrar (ver DESIGN_SYSTEM.md, "Assets de logo"). */}
      <div
        role="img"
        aria-label="Foto dos fundadores do Fernandito"
        className="bg-fernandito-verde-medio relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-sm [filter:sepia(0.35)_saturate(1.4)]"
      >
        <span className="text-label text-fernandito-off-white font-sans uppercase opacity-90">
          Foto fundadores
        </span>
        {/* Carimbo decorativo, puramente ilustrativo. */}
        <span
          aria-hidden="true"
          className="text-fernandito-off-white pointer-events-none absolute top-4 right-4 rotate-[-14deg] font-rampart-stamp text-sm tracking-[0.2em] opacity-[0.1]"
        >
          * FERNANDITO *
        </span>
      </div>
      <p className="text-label text-fernandito-verde-escuro/70 font-sans uppercase">
        João · Lorenzo · Nando · Matheus — Porto Alegre, 2026
      </p>
    </div>
  );

  return (
    <section
      id="manifesto"
      aria-label="Manifesto"
      className="bg-fernandito-off-white text-fernandito-verde-escuro relative w-full py-24 sm:py-32"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <SectionLabel index="03" className="mb-8">
          Manifesto
        </SectionLabel>
        <h2
          ref={epigraphRef}
          className="text-display-md font-rampart max-w-3xl leading-[1.05] tracking-[0.01em] text-balance"
        >
          A gente não inventou essa entrega. Só deu nome, lata e forma.
        </h2>
      </div>

      <div className="mx-auto mt-14 max-w-[720px] px-6 sm:mt-20">
        <FlipCard
          front={front}
          back={back}
          frontLabel="o texto"
          backLabel="os fundadores"
          elevation="md"
          rotateOnHover
          cardClassName="rounded-md bg-[#F5F5E9]"
        />
      </div>
    </section>
  );
}

export default CartaSection;
