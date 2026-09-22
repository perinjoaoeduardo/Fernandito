"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";

let registered = false;

// Nomes de ease compartilhados entre GSAP e Tailwind (ver DESIGN_SYSTEM.md
// "## Interação") — os mesmos cubic-bezier dos tokens `ease-out-standard`
// etc., pra que uma transição CSS e uma tween GSAP no mesmo componente
// pareçam a mesma curva.
export const EASE = {
  outStandard: "out-standard",
  outBack: "out-back",
  inOutSmooth: "in-out-smooth",
} as const;

// Segundos (GSAP), espelhando os tokens `duration-*` em ms do Tailwind.
export const DURATION = {
  fast: 0.15,
  base: 0.3,
  slow: 0.5,
} as const;

/**
 * Registers GSAP plugins exactly once on the client.
 * SplitText e CustomEase vêm grátis desde o gsap 3.13+ (sem Club GreenSock).
 */
export function registerGsapPlugins() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create(EASE.outStandard, "0.22, 1, 0.36, 1");
  CustomEase.create(EASE.outBack, "0.34, 1.56, 0.64, 1");
  CustomEase.create(EASE.inOutSmooth, "0.65, 0, 0.35, 1");
  registered = true;
}

// Registered eagerly at module evaluation (not inside a useEffect) so any
// component's own mount-time effect can rely on ScrollTrigger/SplitText
// being ready regardless of React's child-before-parent effect ordering.
registerGsapPlugins();

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function supportsHover() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover)").matches;
}

export { gsap, ScrollTrigger, SplitText };
