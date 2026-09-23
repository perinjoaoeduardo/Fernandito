"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

const LINES = ["Se interessou?", "Quer Fernandito", "no teu rolê?"];

/**
 * CTA de contato entre o Manifesto e o "O que anda rolando". As linhas do
 * título sobem de trás de uma máscara presas ao scroll (scrub — voltam se
 * rolar pra cima) e a moeda gira conforme a seção atravessa a tela.
 */
export function ContatoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const body = bodyRef.current;
    const coin = coinRef.current;
    const lines = lineRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (!section || !body || !coin || lines.length === 0) return;
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({
          scrollTrigger: { trigger: section, start: "top 75%", end: "center 55%", scrub: 0.6 },
        })
        .fromTo(lines, { yPercent: 110 }, { yPercent: 0, stagger: 0.25, ease: "power2.out" })
        .fromTo(body, { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: "power2.out" }, "-=0.2");

      gsap.fromTo(
        coin,
        { rotate: -40, y: 60 },
        {
          rotate: 320,
          y: -60,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.8 },
        },
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="contato"
      aria-label="Contato"
      className="bg-fernandito-verde-medio text-fernandito-off-white relative w-full overflow-hidden px-6 py-28 sm:py-36"
    >
      <div
        ref={coinRef}
        aria-hidden="true"
        className="pointer-events-none absolute right-6 bottom-10 w-24 opacity-90 drop-shadow-[0_10px_24px_rgba(36,48,34,0.35)] [will-change:transform] sm:right-[6vw] sm:bottom-16 sm:w-36 lg:w-48"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- raster estático de tamanho fixo, next/image não traz benefício */}
        <img
          src="/logo/fernandito-moeda.webp"
          alt=""
          width={256}
          height={258}
          loading="lazy"
          decoding="async"
          className="h-auto w-full"
        />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <SectionLabel index="04" className="mb-10">
          Contato
        </SectionLabel>

        <h2 className="font-rampart text-[clamp(2.25rem,7vw,6.5rem)] leading-[0.95] tracking-[0.01em]">
          {/* pt na máscara: sem ela o overflow-hidden cortava acentos acima
              da caixa-alta (o circunflexo de "ROLÊ" sumia). */}
          {LINES.map((line, i) => (
            <span key={line} className="block overflow-hidden pt-[0.14em] pb-[0.04em]">
              <span
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                className={
                  i === 0
                    ? "text-fernandito-off-white/60 block [will-change:transform]"
                    : "block [will-change:transform]"
                }
              >
                {line}
              </span>
            </span>
          ))}
        </h2>

        <div ref={bodyRef} className="mt-10 flex max-w-xl flex-col items-start gap-8">
          <p className="text-body-lg font-sans text-balance">
            Bar, festa, evento ou só curiosidade — chama a gente no WhatsApp que a gente responde.
          </p>
          <WhatsAppButton background="verde-escuro">Chamar no WhatsApp</WhatsAppButton>
        </div>
      </div>
    </section>
  );
}

export default ContatoSection;
