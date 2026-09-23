"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

type ParallaxProps = {
  /** px de deslocamento em cada ponta. Positivo = sobe mais rápido que a
   * rolagem (camada "da frente"); negativo = mais devagar ("de trás"). */
  speed?: number;
  className?: string;
  children: ReactNode;
};

/**
 * Camada de parallax genérica: translada em `y` de +speed a −speed enquanto
 * o elemento atravessa a tela (scrub). Fica num wrapper próprio — não usar
 * em volta de algo que já anima `transform` no mesmo nó.
 */
export function Parallax({ speed = 40, className, children }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    // Em tela estreita os blocos ficam empilhados e mais perto uns dos
    // outros — a amplitude cheia do desktop os faria se encostar.
    const amp = window.innerWidth < 768 ? speed * 0.5 : speed;
    const tween = gsap.fromTo(
      el,
      { y: amp },
      {
        y: -amp,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [speed]);

  return (
    <div ref={ref} className={clsx("[will-change:transform]", className)}>
      {children}
    </div>
  );
}

export default Parallax;
