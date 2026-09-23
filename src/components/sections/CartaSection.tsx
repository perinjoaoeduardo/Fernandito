"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { Parallax } from "@/components/ui/Parallax";
import { FlipCard } from "@/components/ui/FlipCard";
import { TypewriterText } from "@/components/ui/TypewriterText";

const SIGNATURES = ["João", "Lorenzo", "Nando", "Matheus"];

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
        { autoAlpha: 0, y: 160, rotate: -6, scale: 0.9 },
        {
          autoAlpha: 1,
          y: 0,
          rotate: 0,
          scale: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: wrap, start: "top 100%", end: "top 45%", scrub: 0.7 },
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
          scrollTrigger: { trigger: wrap, start: "top 50%", end: "top 32%", scrub: 0.4 },
        },
      );
    }, wrap);

    return () => ctx.revert();
  }, []);

  // ── Frente: preservada do que já existia (texto, assinaturas, selo). ──
  const front = (
    <>
      <blockquote className="text-body sm:text-body-lg flex flex-col gap-5 font-sans sm:gap-6">
        <p>
          A gente acredita numa vida que não se entrega fácil. Que escolhe o caminho difícil porque
          é nele que mora o gosto de verdade.
        </p>
        <p>
          Fernandito nasceu de uma crença simples: existe entrega que é render-se, e existe entrega
          que é arte. A gente escolheu o segundo caminho — e essa lata é prova disso.
        </p>
      </blockquote>

      <p className="text-body mt-10 font-sans sm:mt-12">Com brio, de Porto Alegre,</p>

      {/* No celular, grade 2×2 (não cabem 4 numa linha sem passar por baixo
          do selo); a partir de sm, uma linha só com folga pro selo. */}
      <div className="mt-4 grid w-fit grid-cols-2 gap-x-8 gap-y-1 pb-6 sm:flex sm:flex-wrap sm:items-baseline sm:pr-24 sm:pb-0">
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
      <div className="text-fernandito-verde-escuro ease-out-standard absolute -right-3 -bottom-4 aspect-square w-24 rotate-[8deg] drop-shadow-[0_4px_10px_rgba(36,48,34,0.25)] transition-transform duration-500 [will-change:transform] group-hover:-translate-y-1 group-hover:rotate-[11deg] sm:-right-5 sm:-bottom-6 sm:w-28 lg:-right-6 lg:-bottom-8 lg:w-[120px]">
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
          className="text-fernandito-off-white font-rampart-stamp pointer-events-none absolute top-4 right-4 rotate-[-14deg] text-sm tracking-[0.2em] opacity-[0.1]"
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
    // -mt (só com animação): o fim do palco da galeria é bege vazio embaixo
    // da última foto, da mesma cor desta seção — puxar o Manifesto pra cima
    // sobrepõe esse vazio em vez de deixar um vão enorme entre os dois. Sob
    // prefers-reduced-motion a galeria vira grid e não pode ter sobreposição.
    // A faixa sobreposta (--overlap) é transparente: um fundo bege sólido
    // ali cortava a sombra da última foto numa linha reta.
    <section
      id="manifesto"
      aria-label="Manifesto"
      className="bg-fernandito-off-white text-fernandito-verde-escuro relative w-full overflow-x-clip pt-8 pb-24 [--overlap:16vh] motion-safe:-mt-[var(--overlap)] motion-safe:bg-transparent motion-safe:bg-[linear-gradient(to_bottom,transparent_var(--overlap),#e6e6cb_var(--overlap))] sm:py-32 sm:[--overlap:12vh]"
    >
      <div className="mx-auto flex max-w-4xl justify-center px-6 text-center">
        <Parallax speed={40}>
          <TypewriterText
            text="Nosso manifesto"
            className="font-rampart text-[clamp(1.625rem,3vw,2.25rem)] leading-[1.1] tracking-[0.06em]"
          />
        </Parallax>
      </div>

      {/* 830px ≈ 720 + 15%: o cartão é o protagonista da seção. */}
      <Parallax speed={-25}>
        <div
          ref={cardWrapRef}
          className="mx-auto mt-6 max-w-[830px] px-6 [will-change:transform] sm:mt-8"
        >
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
      </Parallax>
    </section>
  );
}

export default CartaSection;
