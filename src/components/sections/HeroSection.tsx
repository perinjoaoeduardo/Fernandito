"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion, supportsHover } from "@/lib/gsap";
import { onIntroComplete } from "@/lib/introSignal";
import { scrollToTarget } from "@/lib/lenis";
import { Logo } from "@/components/ui/Logo";
import { RotatingWord } from "@/components/ui/RotatingWord";

// Quanto o cartão encolhe/arredonda ao rolar (ver efeito "shrink-to-card"
// abaixo) — sutil o bastante pra não parecer um zoom brusco.
const SHRINK_SCALE = 0.9;
const SHRINK_RADIUS = 40; // px

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const box = boxRef.current;
    const content = contentRef.current;
    const logo = logoRef.current;
    const tagline = taglineRef.current;
    const indicator = indicatorRef.current;
    if (!section || !box || !content || !logo || !tagline || !indicator) return;

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
            .to(logo, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }, 0.2)
            .to(tagline, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.8)
            .to(indicator, { opacity: 1, duration: 0.4, ease: "power1.out" }, 1.4)
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
    // comentário no `className` da section abaixo) e desvanece o conteúdo de
    // texto, que já não faz sentido dentro de um cartão pequeno.
    // Ao fim do range, o sticky solta sozinho e a ManifestoSection continua o
    // scroll normalmente — sem precisar de pin/unpin manual via ScrollTrigger.
    let shrinkTrigger: ScrollTrigger | null = null;
    if (!reduceMotion) {
      shrinkTrigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        onUpdate: (self) => {
          const progress = self.progress;
          const boxProgress = Math.min(1, progress / 0.7);
          const contentProgress = Math.min(1, progress / 0.35);
          const indicatorProgress = Math.min(1, progress / 0.15);

          gsap.set(box, {
            scale: 1 - boxProgress * (1 - SHRINK_SCALE),
            borderRadius: boxProgress * SHRINK_RADIUS,
          });
          gsap.set(content, {
            opacity: 1 - contentProgress,
            y: -contentProgress * 40,
          });
          gsap.set(indicator, { opacity: 1 - indicatorProgress });
        },
      });
    }

    return () => {
      unsubscribeIntro?.();
      entranceTimeline?.kill();
      removeMouseMove?.();
      shrinkTrigger?.kill();
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      // O fundo aqui é o que aparece na "moldura" revelada pelo efeito
      // shrink-to-card (ver `shrinkTrigger` acima) — tem que ser sempre a
      // mesma cor de fundo da PRÓXIMA seção (hoje, `ManifestoSection`,
      // off-white). Se a cor da próxima seção mudar no futuro, atualizar
      // aqui também — não há sincronia automática entre as duas.
      className="bg-fernandito-off-white relative h-screen motion-safe:h-[160vh]"
    >
      <div
        ref={boxRef}
        className="bg-fernandito-verde-escuro sticky top-0 flex h-screen w-full flex-col items-center justify-center overflow-hidden [will-change:transform,border-radius]"
      >
        <div ref={contentRef} className="flex flex-col items-center px-6 text-center">
          {/* O texto do h1 vive num `sr-only` de verdade (não só no `alt` da
              imagem): garante um h1 com texto rastreável no HTML do servidor,
              independente do raster do logo carregar ou não. A imagem vira
              decorativa (`alt=""`) pra não duplicar o anúncio no leitor. */}
          <h1 ref={logoRef} className="flex justify-center">
            <span className="sr-only">Fernandito — fernet com cola, direto da lata</span>
            <Logo alt="" aria-hidden />
          </h1>
          <div
            ref={taglineRef}
            className="text-fernandito-off-white font-rampart-sans mt-8 flex flex-col items-center gap-1"
          >
            <p className="text-body-lg">Fernet y cola em lata.</p>
            <div className="text-body text-fernandito-off-white/70">
              <RotatingWord />
            </div>
          </div>
        </div>

        <button
          ref={indicatorRef}
          type="button"
          onClick={() => scrollToTarget("#manifesto")}
          aria-label="Rolar até a seção Manifesto"
          className="text-fernandito-off-white/70 duration-base ease-out-standard focus-visible:outline-fernandito-off-white text-body hover:text-fernandito-off-white focus-visible:text-fernandito-off-white absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-1 bg-transparent font-sans transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          scroll
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
