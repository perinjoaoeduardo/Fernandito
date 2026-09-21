"use client";

import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/**
 * Creates a Lenis instance and syncs it to the GSAP ticker, so ScrollTrigger
 * and the smooth scroll share a single rAF clock. Returns a cleanup fn.
 */
export function initLenis() {
  const lenis = new Lenis({
    autoRaf: false,
  });

  lenis.on("scroll", ScrollTrigger.update);

  const tick = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(tick);
    lenis.destroy();
  };
}
