"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, EASE, prefersReducedMotion, supportsHover } from "@/lib/gsap";

// A bolinha fica sempre off-white — o hover só dá um aumento sutil (~8%),
// só pra indicar "isso é clicável" sem virar o protagonista da interação.
// Quem carrega a identidade visual de fato são os próprios componentes
// (Button, Link, ElevatedCard — ver DESIGN_SYSTEM.md "## Interação").
// `[data-cursor-hover]` é o opt-in pra elementos não-semânticos (divs com
// reação de hover forte mas sem ação de clique, tipo o ElevatedCard) que
// ainda assim devem contar como "hover" pro cursor.
const HOVER_SELECTOR =
  "a, button, [role='button'], input, textarea, select, label, [data-cursor-hover]";
const HOVER_SCALE = 1.08;

export function CustomCursor() {
  const [active, setActive] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // One-time synchronous check on mount (not a state sync loop) — both
    // checks are client-only (matchMedia), so they can't move to the
    // initial useState value without risking an SSR/hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(!prefersReducedMotion() && supportsHover());
  }, []);

  useEffect(() => {
    if (!active) return;
    const dot = dotRef.current;
    if (!dot) return;

    document.documentElement.classList.add("cursor-none-mode");

    const moveX = gsap.quickTo(dot, "x", { duration: 0.18, ease: "power2" });
    const moveY = gsap.quickTo(dot, "y", { duration: 0.18, ease: "power2" });

    const handleMouseMove = (event: MouseEvent) => {
      moveX(event.clientX);
      moveY(event.clientY);
    };

    const handlePointerOver = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest(HOVER_SELECTOR)) {
        gsap.to(dot, { scale: HOVER_SCALE, duration: 0.3, ease: EASE.outStandard });
      }
    };
    const handlePointerOut = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest(HOVER_SELECTOR)) {
        gsap.to(dot, { scale: 1, duration: 0.3, ease: EASE.outStandard });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);

    return () => {
      document.documentElement.classList.remove("cursor-none-mode");
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      className="bg-fernandito-off-white pointer-events-none fixed top-0 left-0 z-[200] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-difference [will-change:transform]"
    />
  );
}

export default CustomCursor;
