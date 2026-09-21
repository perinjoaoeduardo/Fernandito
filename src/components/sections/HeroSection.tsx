"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion, supportsHover } from "@/lib/gsap";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const horseRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const content = contentRef.current;
    const horse = horseRef.current;
    const title = titleRef.current;
    const tagline = taglineRef.current;
    const indicator = indicatorRef.current;
    if (!section || !content || !horse || !title || !tagline || !indicator) return;

    const reduceMotion = prefersReducedMotion();

    // Split "Fernandito" per character. SplitText ships free since gsap 3.13
    // (no Club GreenSock needed) — fallback below only guards against a
    // future/older gsap build that doesn't include it.
    let splitInstance: SplitText | null = null;
    let charTargets: Element[] = [];
    try {
      splitInstance = new SplitText(title, { type: "chars" });
      charTargets = splitInstance.chars;
    } catch (err) {
      console.warn("[HeroSection] SplitText indisponível, usando fallback manual.", err);
      const text = title.textContent ?? "";
      title.innerHTML = "";
      charTargets = text.split("").map((char) => {
        const span = document.createElement("span");
        span.textContent = char === " " ? "\u00A0" : char;
        span.style.display = "inline-block";
        title.appendChild(span);
        return span;
      });
    }

    let removeMouseMove: (() => void) | null = null;

    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set([horse, tagline, indicator], { opacity: 1, y: 0, scale: 1 });
        gsap.set(charTargets, { opacity: 1, y: 0 });
      } else {
        gsap.set(horse, { opacity: 0, scale: 0.8 });
        gsap.set(charTargets, { opacity: 0, y: 40 });
        gsap.set(tagline, { opacity: 0, y: 40 });
        gsap.set(indicator, { opacity: 0 });

        gsap
          .timeline()
          .to(horse, { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }, 0.2)
          .to(
            charTargets,
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.03, ease: "power4.out" },
            0.6,
          )
          .to(tagline, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 1.4)
          .to(indicator, { opacity: 0.6, duration: 0.4, ease: "power1.out" }, 2.0)
          .to(
            indicator,
            { y: 8, duration: 0.9, ease: "power1.inOut", yoyo: true, repeat: -1 },
            2.0,
          );
      }

      // Mouse parallax — desktop only (hover-capable pointers).
      if (!reduceMotion && supportsHover()) {
        const horseX = gsap.quickTo(horse, "x", { duration: 0.6, ease: "power2.out" });
        const horseY = gsap.quickTo(horse, "y", { duration: 0.6, ease: "power2.out" });
        const titleX = gsap.quickTo(title, "x", { duration: 0.6, ease: "power2.out" });
        const titleY = gsap.quickTo(title, "y", { duration: 0.6, ease: "power2.out" });

        const handleMouseMove = (event: MouseEvent) => {
          const rect = section.getBoundingClientRect();
          const relX = (event.clientX - rect.left) / rect.width - 0.5;
          const relY = (event.clientY - rect.top) / rect.height - 0.5;

          // Cavalinho: inverted, deeper plane. Nome: same direction, subtler.
          horseX(relX * -15);
          horseY(relY * -10);
          titleX(relX * 8);
          titleY(relY * 4);
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
      removeMouseMove?.();
      scrollTrigger?.kill();
      ctx.revert();
      splitInstance?.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="bg-fernandito-verde-escuro relative flex h-screen flex-col items-center justify-center overflow-hidden"
    >
      <div ref={contentRef} className="flex flex-col items-center px-6 text-center">
        <div ref={horseRef} className="mb-6 h-[120px] w-[120px] sm:h-[180px] sm:w-[180px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF, next/image would strip the animation */}
          <img
            src="/cavalinho.gif"
            alt="Cavalinho Fernandito"
            className="h-full w-full object-contain"
          />
        </div>
        <h1
          ref={titleRef}
          className="text-display-xl text-fernandito-off-white font-serif leading-[0.9]"
        >
          Fernandito
        </h1>
        <p ref={taglineRef} className="text-display-md text-fernandito-verde-claro mt-4 font-sans">
          Fernet com cola. Direto da lata.
        </p>
      </div>

      <div
        ref={indicatorRef}
        className="text-label text-fernandito-off-white absolute bottom-8 left-1/2 -translate-x-1/2 font-sans tracking-[0.08em] uppercase"
      >
        scroll ↓
      </div>
    </section>
  );
}

export default HeroSection;
