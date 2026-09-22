"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis";

/**
 * Barra fina fixa no topo, largura 0-100% conforme o progresso de scroll da
 * página inteira. Puramente um adorno de motion — sob prefers-reduced-motion
 * ela nem monta (não é conteúdo, não precisa de estado estático nenhum).
 */
export function ScrollProgress() {
  const [active, setActive] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // One-time synchronous check on mount (not a state sync loop) — the
    // matchMedia check can only run client-side, so it can't move to the
    // initial useState value without risking an SSR/hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(!prefersReducedMotion());
  }, []);

  useEffect(() => {
    if (!active) return;
    const bar = barRef.current;
    if (!bar) return;

    let rafId: number;

    const update = () => {
      const lenis = getLenis();
      let progress: number;

      if (lenis) {
        progress = lenis.progress;
      } else {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress = max > 0 ? window.scrollY / max : 0;
      }

      bar.style.width = `${Math.min(1, Math.max(0, progress)) * 100}%`;
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="bg-fernandito-verde-medio pointer-events-none fixed top-0 left-0 z-[60] h-[2px] mix-blend-difference [will-change:width]"
      style={{ width: "0%" }}
      ref={barRef}
    />
  );
}

export default ScrollProgress;
