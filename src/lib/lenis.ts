"use client";

import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

let lenisInstance: Lenis | null = null;

/**
 * Creates a Lenis instance and syncs it to the GSAP ticker, so ScrollTrigger
 * and the smooth scroll share a single rAF clock. Returns a cleanup fn.
 */
export function initLenis() {
  const lenis = new Lenis({
    autoRaf: false,
  });
  lenisInstance = lenis;

  lenis.on("scroll", ScrollTrigger.update);

  const tick = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(tick);
    lenis.destroy();
    lenisInstance = null;
  };
}

/** Instância ativa do Lenis, se o smooth scroll estiver rodando (null sob
 * prefers-reduced-motion, quando o SmoothScrollProvider nunca a cria). */
export function getLenis() {
  return lenisInstance;
}

/** Scroll suave (via Lenis quando disponível) até um seletor/elemento. */
export function scrollToTarget(target: string) {
  const lenis = getLenis();
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.2 });
    return;
  }
  document.querySelector(target)?.scrollIntoView();
}
