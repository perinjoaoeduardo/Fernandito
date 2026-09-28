"use client";

import { useEffect, useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  DURATION,
  EASE,
  IS_TOUCH,
  prefersReducedMotion,
  supportsHover,
} from "@/lib/gsap";
import { onIntroComplete } from "@/lib/introSignal";
import { scrollToTarget } from "@/lib/lenis";
import { Logo } from "@/components/ui/Logo";
import { RotatingWord } from "@/components/ui/RotatingWord";
import { HERO } from "@/content/site";

// Quanto o cartão encolhe/arredonda ao rolar (a "moldura") — sutil o
// bastante pra não parecer um zoom brusco.
const SHRINK_SCALE = 0.9;
const SHRINK_RADIUS = 40; // px
// No computador o cartão fecha inteiro PARADO (trecho preso curto, meia
// tela) e só depois sobe; fecha um pouco mais que no celular.
const DESKTOP_SHRINK_SCALE = 0.86;
// Parallax BEM sutil do logo e da frase dentro do cartão: sobem só isso (px)
// enquanto o cartão fecha na moldura. Menos no toque.
const CONTENT_DRIFT = IS_TOUCH ? 22 : 36;

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const indicatorFadeRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const box = boxRef.current;
    const content = contentRef.current;
    const logo = logoRef.current;
    const tagline = taglineRef.current;
    const indicator = indicatorRef.current;
    const indicatorFade = indicatorFadeRef.current;
    if (!section || !box || !content || !logo || !tagline || !indicator || !indicatorFade) return;

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

    // Moldura: o cartão encolhe e arredonda com a rolagem, revelando o fundo
    // bege da section em volta. O logo e a frase são parte do cartão;
    // o único movimento próprio é um parallax bem sutil (CONTENT_DRIFT).
    // (Já tentamos: sumir cedo — sobrava cartão vazio; andar mais devagar
    // que o cartão na saída — parecia descer junto; subir no ritmo da
    // rolagem — disparava pra cima no primeiro gesto.)
    //
    // O cartão é `sticky`: fica preso enquanto fecha e só depois sobe.
    // Celular (toque): 140vh/160vh, termina aos 70% e segura — aprovado
    // assim. Computador (mouse): trecho preso curto (150vh = meia tela de
    // rolagem) e o fechamento ocupa ele inteiro, terminando exatamente
    // quando o cartão solta — primeiro fecha, depois desce, um de cada
    // vez e sem pausa entre os dois. (Já foi: preso 60vh com o fechamento
    // seguindo depois de soltar — travava no meio; e sem trecho preso,
    // fechando enquanto subia — os dois ao mesmo tempo.)
    let shrinkTrigger: ScrollTrigger | null = null;
    let desktopTl: gsap.core.Timeline | null = null;
    if (!reduceMotion && IS_TOUCH) {
      shrinkTrigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const boxProgress = Math.min(1, self.progress / 0.7);
          const scale = 1 - boxProgress * (1 - SHRINK_SCALE);
          gsap.set(box, { scale, borderRadius: boxProgress * SHRINK_RADIUS });
          gsap.set(content, { y: -self.progress * CONTENT_DRIFT });
          // No wrapper, não no botão: a entrada anima a opacidade do botão.
          gsap.set(indicatorFade, { autoAlpha: 1 - Math.min(1, self.progress / 0.15) });
        },
      });
    } else if (!reduceMotion) {
      desktopTl = gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: true },
        })
        .fromTo(
          box,
          { scale: 1, borderRadius: 0 },
          { scale: DESKTOP_SHRINK_SCALE, borderRadius: SHRINK_RADIUS, duration: 1 },
          0,
        )
        .fromTo(content, { y: 0 }, { y: -CONTENT_DRIFT, duration: 1 }, 0)
        .fromTo(indicatorFade, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, 0);
    }

    return () => {
      shrinkTrigger?.kill();
      desktopTl?.scrollTrigger?.kill();
      desktopTl?.kill();
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
      // O fundo aqui é a "moldura" revelada quando o cartão encolhe — tem
      // que ser a cor da PRÓXIMA seção (OQueESection, off-white). A section
      // é mais alta que a tela pro cartão ficar preso enquanto fecha. Toque
      // (pointer-coarse, o mesmo critério do IS_TOUCH): 140vh no celular,
      // 160vh do md pra cima. Mouse (pointer-fine): 150vh.
      className="bg-fernandito-off-white relative h-screen motion-safe:pointer-coarse:h-[140vh] md:motion-safe:pointer-coarse:h-[160vh] motion-safe:pointer-fine:h-[150vh]"
    >
      <div
        ref={boxRef}
        className="bg-fernandito-verde-escuro sticky top-0 flex h-screen w-full flex-col items-center justify-center overflow-hidden [will-change:transform,border-radius]"
      >
        <div
          ref={contentRef}
          className="flex flex-col items-center px-6 text-center [will-change:transform]"
        >
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
