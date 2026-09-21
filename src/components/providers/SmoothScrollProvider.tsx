"use client";

import { useEffect, type ReactNode } from "react";
import { registerGsapPlugins, prefersReducedMotion } from "@/lib/gsap";
import { initLenis } from "@/lib/lenis";

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerGsapPlugins();

    if (prefersReducedMotion()) return;

    const cleanup = initLenis();
    return cleanup;
  }, []);

  return <>{children}</>;
}
