"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

let registered = false;

/**
 * Registers GSAP plugins exactly once on the client.
 * SplitText ships free with gsap 3.13+ (no Club GreenSock membership needed).
 */
export function registerGsapPlugins() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, SplitText);
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
