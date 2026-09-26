"use client";

import { useEffect, useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  DURATION,
  EASE,
  SCRUB,
  prefersReducedMotion,
  supportsHover,
} from "@/lib/gsap";
import { onIntroComplete } from "@/lib/introSignal";
import { scrollToTarget } from "@/lib/lenis";
import { Logo } from "@/components/ui/Logo";
import { RotatingWord } from "@/components/ui/RotatingWord";
import { HERO } from "@/content/site";

// Quanto o cartão encolhe/arredonda ao rolar (ver efeito "shrink-to-card"
// abaixo) — sutil o bastante pra não parecer um zoom brusco.
const SHRINK_SCALE = 0.9;
const SHRINK_RADIUS = 40; // px
// Na saída o bloco do logo (da altura do cartão) desce um pouco mais que
// metade do que o cartão sobe: assim o logo fica no meio da parte do
// cartão que ainda está na tela (a metade exata deixaria ele ~35px acima,
// porque a frase embaixo puxa o centro do bloco pra baixo do logo).
const EXIT_LAG = 55;

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const box = boxRef.current;
    const exit = exitRef.current;
    const logo = logoRef.current;
    const tagline = taglineRef.current;
    const indicator = indicatorRef.current;
    if (!section || !box || !exit || !logo || !tagline || !indicator) return;

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

    // "Shrink-to-card": a section é mais alta que a viewport (motion-safe:h-[160vh])
    // e o cartão (`box`) fica `sticky top-0` — enquanto o resto da altura extra
    // rola por baixo dele, a gente anima scale + border-radius do cartão
    // (revela o fundo da própria section nas bordas, como uma moldura — ver
    // comentário no `className` da section abaixo). O logo e a frase FICAM
    // no cartão, encolhendo junto: antes eles sumiam no
    // primeiro terço e sobrava quase uma tela de cartão verde vazio.
    // Ao fim do range, o sticky solta sozinho e a OQueESection continua o
    // scroll normalmente — sem precisar de pin/unpin manual via ScrollTrigger.
    let shrinkTrigger: ScrollTrigger | null = null;
    let exitTween: gsap.core.Tween | null = null;
    if (!reduceMotion) {
      shrinkTrigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: SCRUB.base,
        onUpdate: (self) => {
          const progress = self.progress;
          const boxProgress = Math.min(1, progress / 0.7);
          const indicatorProgress = Math.min(1, progress / 0.15);

          gsap.set(box, {
            scale: 1 - boxProgress * (1 - SHRINK_SCALE),
            borderRadius: boxProgress * SHRINK_RADIUS,
          });
          gsap.set(indicator, { opacity: 1 - indicatorProgress });
        },
      });

      // Saída: quando o sticky solta e o cartão sobe com a página, o logo
      // sobe mais devagar que ele (parallax) e fica centrado na faixa do
      // cartão que ainda aparece — é a última coisa a deixar a tela, nunca
      // sobra cartão vazio.
      exitTween = gsap.fromTo(
        exit,
        { yPercent: 0 },
        {
          yPercent: EXIT_LAG,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "bottom bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    }

    return () => {
      unsubscribeIntro?.();
      entranceTimeline?.kill();
      removeMouseMove?.();
      shrinkTrigger?.kill();
      exitTween?.scrollTrigger?.kill();
      exitTween?.kill();
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      // O fundo aqui é o que aparece na "moldura" revelada pelo efeito
      // shrink-to-card (ver `shrinkTrigger` acima) — tem que ser sempre a
      // mesma cor de fundo da PRÓXIMA seção (hoje, `OQueESection`,
      // off-white). Se a cor da próxima seção mudar no futuro, atualizar
      // aqui também — não há sincronia automática entre as duas.
      className="bg-fernandito-off-white relative h-screen motion-safe:h-[160vh]"
    >
      <div
        ref={boxRef}
        className="bg-fernandito-verde-escuro sticky top-0 flex h-screen w-full flex-col items-center justify-center overflow-hidden [will-change:transform,border-radius]"
      >
        <div
          ref={exitRef}
          className="absolute inset-0 flex items-center justify-center [will-change:transform]"
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
        </div>

        <button
          ref={indicatorRef}
          type="button"
          onClick={() => scrollToTarget("#o-que-e")}
          aria-label="Rolar até a próxima seção"
          className="text-fernandito-off-white/70 duration-base ease-out-standard focus-visible:outline-fernandito-off-white text-body hover:text-fernandito-off-white focus-visible:text-fernandito-off-white absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-1 bg-transparent font-sans transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
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
    </section>
  );
}

export default HeroSection;
