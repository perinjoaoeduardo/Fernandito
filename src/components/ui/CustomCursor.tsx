"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion, supportsHover } from "@/lib/gsap";
import { backgroundAt } from "@/lib/background";

// A bolinha é sólida (sem mix-blend-mode — isso deixava o fundo "vazar"
// através dela) e troca de cor conforme o fundo por baixo: off-white sobre
// fundo escuro, verde-escuro sobre fundo claro (branco some no bege). Um
// anel fino da cor oposta mantém ela visível em cima de fotos, que o
// amostrador não enxerga. O hover só dá um aumento sutil (~8%), só
// pra indicar "isso é clicável" sem virar o protagonista da interação.
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

    // Amostra o fundo sob o cursor no máximo uma vez por quadro — tanto
    // quando o mouse anda quanto quando a página rola por baixo dele parado.
    let pointerX = -1;
    let pointerY = -1;
    let sampling = false;
    const sample = () => {
      sampling = false;
      if (pointerX < 0) return;
      const bg = backgroundAt(pointerX, pointerY);
      if (bg) dot.dataset.tone = bg.light ? "dark" : "light";
    };
    const requestSample = () => {
      if (sampling) return;
      sampling = true;
      requestAnimationFrame(sample);
    };

    const handleMouseMove = (event: MouseEvent) => {
      moveX(event.clientX);
      moveY(event.clientY);
      pointerX = event.clientX;
      pointerY = event.clientY;
      requestSample();
    };

    const handlePointerOver = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest(HOVER_SELECTOR)) {
        gsap.to(dot, { scale: HOVER_SCALE, duration: DURATION.base, ease: EASE.outStandard });
      }
    };
    const handlePointerOut = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest(HOVER_SELECTOR)) {
        gsap.to(dot, { scale: 1, duration: DURATION.base, ease: EASE.outStandard });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", requestSample, { passive: true });
    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);

    return () => {
      document.documentElement.classList.remove("cursor-none-mode");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", requestSample);
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      data-tone="light"
      className="bg-fernandito-off-white data-[tone=dark]:bg-fernandito-verde-escuro duration-base ease-out-standard pointer-events-none fixed top-0 left-0 z-[200] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_1.5px_rgba(36,48,34,0.35)] transition-[background-color,box-shadow] [will-change:transform] data-[tone=dark]:shadow-[0_0_0_1.5px_rgba(230,230,203,0.6)]"
    />
  );
}

export default CustomCursor;
