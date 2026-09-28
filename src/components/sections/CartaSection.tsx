"use client";

import { useEffect, useRef } from "react";
import { gsap, EASE, SCRUB, prefersReducedMotion } from "@/lib/gsap";
import { Parallax } from "@/components/ui/Parallax";
import { FlipCard } from "@/components/ui/FlipCard";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { MANIFESTO } from "@/content/site";

export function CartaSection() {
  const cardWrapRef = useRef<HTMLDivElement>(null);

  // Entrada do cartão presa ao scroll: sobe inclinado e "assenta na mesa",
  // e no fim o selo é carimbado por cima (escala grande → 1, com rebote).
  // A animação fica num wrapper em volta do FlipCard — o ElevatedCard lá
  // dentro já usa transform próprio no hover e no flip.
  useEffect(() => {
    const wrap = cardWrapRef.current;
    if (!wrap || prefersReducedMotion()) return;
    // O conteúdo da frente existe duas vezes no DOM (sizer invisível + face
    // real), então o selo é pego por atributo, não por ref.
    const seals = wrap.querySelectorAll<HTMLElement>("[data-seal]");

    const ctx = gsap.context(() => {
      gsap.fromTo(
        wrap,
        // opacity, não autoAlpha: com visibility:hidden o cartão (que é um
        // botão, gira com Enter) saía da ordem do Tab.
        { opacity: 0, y: 160, rotate: -6, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          rotate: 0,
          scale: 1,
          ease: EASE.outStandard,
          scrollTrigger: { trigger: wrap, start: "top 100%", end: "top 45%", scrub: SCRUB.soft },
        },
      );
      gsap.fromTo(
        seals,
        { autoAlpha: 0, scale: 2.2, rotate: -30 },
        {
          autoAlpha: 1,
          scale: 1,
          rotate: 0,
          ease: "back.out(2.2)",
          scrollTrigger: { trigger: wrap, start: "top 50%", end: "top 32%", scrub: SCRUB.tight },
        },
      );
    }, wrap);

    return () => ctx.revert();
  }, []);

  // ── Frente: preservada do que já existia (texto, assinaturas, selo). ──
  const front = (
    <>
      <blockquote className="text-body sm:text-body-lg flex flex-col gap-5 font-sans sm:gap-6">
        {MANIFESTO.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </blockquote>

      <p className="text-body mt-10 font-sans sm:mt-12">{MANIFESTO.closing}</p>

      {/* No celular, grade 2×2 (não cabem 4 numa linha sem passar por baixo
          do selo); a partir de sm, uma linha só com folga pro selo. */}
      <div className="mt-4 grid w-fit grid-cols-2 gap-x-8 gap-y-1 pb-6 sm:flex sm:flex-wrap sm:items-baseline sm:pr-24 sm:pb-0">
        {MANIFESTO.signatures.map((name) => (
          <span key={name} className="text-body sm:text-body-lg font-accent">
            {name}
          </span>
        ))}
      </div>

      {/* Selo — a rotação extra no hover agora é CSS puro (group-hover),
          não GSAP+ref: o FlipCard renderiza esse conteúdo duas vezes (um
          "sizer" invisível pra altura + a face real), então um ref aqui
          resolveria pra uma cópia arbitrária das duas. */}
      <div className="text-fernandito-verde-escuro ease-out-standard absolute -right-2 -bottom-4 aspect-square w-24 rotate-[8deg] drop-shadow-[0_4px_10px_rgba(36,48,34,0.25)] transition-transform duration-500 [will-change:transform] group-hover:-translate-y-1 group-hover:rotate-[11deg] sm:-right-5 sm:-bottom-6 sm:w-28 lg:-right-6 lg:-bottom-8 lg:w-[120px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- raster estático de tamanho fixo, next/image não traz benefício */}
        <img
          data-seal
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
      <div className="relative w-full flex-1 overflow-hidden rounded-sm [filter:sepia(0.35)_saturate(1.4)]">
        <PhotoSlot
          image={MANIFESTO.back.photo}
          sizes="(max-width: 767px) 90vw, 780px"
          placeholderClassName="bg-fernandito-verde-medio"
        />
        {/* Carimbo decorativo, puramente ilustrativo. */}
        <span
          aria-hidden="true"
          className="text-fernandito-off-white font-rampart-stamp pointer-events-none absolute top-4 right-4 rotate-[-14deg] text-sm tracking-[0.2em] opacity-[0.1]"
        >
          * FERNANDITO *
        </span>
      </div>
      <p className="text-label text-fernandito-verde-escuro/70 font-sans uppercase">
        {MANIFESTO.back.caption}
      </p>
    </div>
  );

  return (
    <section
      id="manifesto"
      aria-label="Manifesto"
      className="bg-fernandito-off-white text-fernandito-verde-escuro relative w-full overflow-x-clip pt-16 pb-24 sm:py-24"
    >
      <div className="mx-auto flex max-w-4xl justify-center px-6 text-center">
        {/* Parallax no título só no computador. */}
        <Parallax speed={40} touch={false}>
          <TypewriterText
            text={MANIFESTO.title}
            className="font-rampart text-[clamp(1.625rem,3.4vw,2.625rem)] leading-[1.1] tracking-[0.06em]"
          />
        </Parallax>
      </div>

      {/* Cartão de até 782px (≈ 680 + 15%): o protagonista da seção. A
          margem lateral cresce a partir de sm (48px) porque o selo fica
          pendurado ~20px pra fora do cartão — com 24px ele era cortado pela
          borda da tela entre 640 e 830px. max-w 878 = 782 + 2 × 48. */}
      <Parallax speed={-25}>
        <div
          ref={cardWrapRef}
          className="mx-auto mt-6 max-w-[878px] px-6 [will-change:transform] sm:mt-12 sm:px-12"
        >
          <FlipCard
            front={front}
            back={back}
            frontFlipLabel={MANIFESTO.flipLabel}
            backFlipLabel={MANIFESTO.flipBackLabel}
            frontLabel="o texto"
            backLabel="os fundadores"
            elevation="md"
            rotateOnHover
            cardClassName="rounded-md bg-[#F5F5E9]"
          />
        </div>
      </Parallax>
    </section>
  );
}

export default CartaSection;
