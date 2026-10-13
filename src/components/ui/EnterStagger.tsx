"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";

/**
 * Entrada em cascata dos filhos marcados com `data-enter` (sobem e
 * aparecem, `DURATION.enter` + `EASE.outStandard`). Sem animação sob
 * prefers-reduced-motion.
 */
export function EnterStagger({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const items = gsap.utils.toArray<HTMLElement>("[data-enter]", root);
    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: DURATION.enter,
        ease: EASE.outStandard,
        stagger: 0.1,
        delay: 0.1,
        clearProps: "opacity,transform",
      },
    );
    return () => {
      tween.kill();
      gsap.set(items, { clearProps: "opacity,transform" });
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export default EnterStagger;
