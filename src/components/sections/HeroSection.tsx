"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion, supportsHover } from "@/lib/gsap";
import { onIntroComplete } from "@/lib/introSignal";
import { scrollToTarget } from "@/lib/lenis";
import { Logo } from "@/components/ui/Logo";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const content = contentRef.current;
    const logo = logoRef.current;
    const tagline = taglineRef.current;
    const indicator = indicatorRef.current;
    if (!section || !content || !logo || !tagline || !indicator) return;

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
              { y: -8 },
              { y: 8, duration: 1.2, ease: "power1.inOut", yoyo: true, repeat: -1 },
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

    // Exit parallax (1.2x scroll speed) + fade over the last 30vh of the
    // section's own scroll range.
    let scrollTrigger: ScrollTrigger | null = null;
    if (!reduceMotion) {
      scrollTrigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => {
          const progress = self.progress;
          const translateY = -progress * window.innerHeight * 0.2;
          const fadeStart = 0.7;
          const opacity =
            progress <= fadeStart ? 1 : Math.max(0, 1 - (progress - fadeStart) / (1 - fadeStart));
          gsap.set(content, { y: translateY, opacity });
        },
      });
    }

    return () => {
      unsubscribeIntro?.();
      entranceTimeline?.kill();
      removeMouseMove?.();
      scrollTrigger?.kill();
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="bg-fernandito-verde-medio relative flex h-screen flex-col items-center justify-center overflow-hidden"
    >
      <div ref={contentRef} className="flex flex-col items-center px-6 text-center">
        <h1 ref={logoRef} aria-label="Fernandito" className="flex justify-center">
          <Logo />
        </h1>
        <p ref={taglineRef} className="text-body-lg text-fernandito-verde-claro mt-6 font-sans">
          Fernet com cola. Direto da lata.
        </p>
      </div>

      <button
        ref={indicatorRef}
        type="button"
        onClick={() => scrollToTarget("#manifesto")}
        aria-label="Rolar até a seção Manifesto"
        className="border-fernandito-off-white duration-base ease-out-standard focus-visible:outline-fernandito-off-white absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-transparent transition-transform [will-change:transform] hover:scale-110 focus-visible:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <svg
          ref={chevronRef}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-fernandito-off-white h-5 w-5"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </section>
  );
}

export default HeroSection;
