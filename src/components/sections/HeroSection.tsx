"use client";

import { useEffect, useRef } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion, supportsHover } from "@/lib/gsap";
import { onIntroComplete } from "@/lib/introSignal";
import { scrollToTarget } from "@/lib/lenis";
import { Logo } from "@/components/ui/Logo";
import { RotatingWord } from "@/components/ui/RotatingWord";
import { HERO } from "@/content/site";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const indicatorFadeRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const box = boxRef.current;
    const logo = logoRef.current;
    const tagline = taglineRef.current;
    const indicator = indicatorRef.current;
    const indicatorFade = indicatorFadeRef.current;
    if (!section || !box || !logo || !tagline || !indicator || !indicatorFade) return;

    const reduceMotion = prefersReducedMotion();

    if (reduceMotion) {
      gsap.set([logo, tagline, indicator], { opacity: 1, y: 0, scale: 1 });
    } else {
      gsap.set(logo, { opacity: 0, scale: 0.85 });
      gsap.set(tagline, { opacity: 0, y: 40 });
      gsap.set(indicator, { opacity: 0 });
    }

    // A entrada só começa a rodar quando o IntroLoader terminar — senão ela
    // acontece inteira escondida atrás da cortina do loader. Se o loader foi
    // pulado (reduced motion), onIntroComplete já dispara na hora.
    let entranceTimeline: gsap.core.Timeline | null = null;
    const unsubscribeIntro = reduceMotion
      ? null
      : onIntroComplete(() => {
          entranceTimeline = gsap
            .timeline()
            .to(
              logo,
              { opacity: 1, scale: 1, duration: DURATION.enter, ease: EASE.outStandard },
              0.2,
            )
            .to(
              tagline,
              { opacity: 1, y: 0, duration: DURATION.enter, ease: EASE.outStandard },
              0.8,
            )
            .to(indicator, { opacity: 1, duration: DURATION.slow, ease: EASE.outStandard }, 1.4)
            .fromTo(
              chevronRef.current,
              { y: -2 },
              { y: 2, duration: 1.2, ease: "power1.inOut", yoyo: true, repeat: -1 },
              1.4,
            );
        });

    let removeMouseMove: (() => void) | null = null;

    const ctx = gsap.context(() => {
      // Mouse parallax — desktop only (hover-capable pointers).
      if (!reduceMotion && supportsHover()) {
        const logoX = gsap.quickTo(logo, "x", { duration: 0.6, ease: "power2.out" });
        const logoY = gsap.quickTo(logo, "y", { duration: 0.6, ease: "power2.out" });

        const handleMouseMove = (event: MouseEvent) => {
          const rect = section.getBoundingClientRect();
          const relX = (event.clientX - rect.left) / rect.width - 0.5;
          const relY = (event.clientY - rect.top) / rect.height - 0.5;

          logoX(relX * 8);
          logoY(relY * 4);
        };

        section.addEventListener("mousemove", handleMouseMove);
        removeMouseMove = () => section.removeEventListener("mousemove", handleMouseMove);
      }
    }, section);

    return () => {
      unsubscribeIntro?.();
      entranceTimeline?.kill();
      removeMouseMove?.();
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      // Tela cheia comum, que sai com a rolagem como qualquer seção. Já foi
      // um cartão preso (sticky) que encolhia enquanto a página rolava por
      // baixo; saiu porque parecia que a Hero seguia a rolagem.
      className="bg-fernandito-verde-escuro relative h-screen"
    >
      <div
        ref={boxRef}
        className="flex h-full w-full flex-col items-center justify-center overflow-hidden"
      >
        <div className="flex flex-col items-center px-6 text-center">
          {/* O texto do h1 vive num `sr-only` de verdade (não só no `alt` da
              imagem): garante um h1 com texto rastreável no HTML do servidor,
              independente do raster do logo carregar ou não. A imagem vira
              decorativa (`alt=""`) pra não duplicar o anúncio no leitor. */}
          <h1 ref={logoRef} className="flex justify-center">
            <span className="sr-only">{HERO.srTitle}</span>
            <Logo alt="" aria-hidden />
          </h1>
          <div
            ref={taglineRef}
            className="text-fernandito-off-white font-rampart-sans mt-3 flex flex-col items-center gap-1"
          >
            <p className="text-body-lg">{HERO.tagline}</p>
            <div className="text-body text-fernandito-off-white/70">
              <RotatingWord />
            </div>
          </div>
        </div>

        <div
          ref={indicatorFadeRef}
          className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2"
        >
          <button
            ref={indicatorRef}
            type="button"
            onClick={() => scrollToTarget("#o-que-e")}
            aria-label="Rolar até a próxima seção"
            className="text-fernandito-off-white/70 duration-base ease-out-standard focus-visible:outline-fernandito-off-white text-body hover:text-fernandito-off-white focus-visible:text-fernandito-off-white flex items-center gap-1 bg-transparent font-sans transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {HERO.scrollHint}
            <svg
              ref={chevronRef}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
