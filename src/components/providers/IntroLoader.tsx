"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { markIntroComplete } from "@/lib/introSignal";

// Cortina de abertura: cavalinho por ~2s, depois sobe e revela o site —
// estilo intro de landing page. Roda uma vez por carregamento (não tem
// sessionStorage: é uma landing de página única, então "toda vez que
// carrega" É o comportamento esperado).
//
// Usa o mesmo GIF do Hero (transparência real de verdade, palette-based)
// em vez do antigo cavalinho-intro.mp4: MP4 não tem canal alpha, então o
// fundo preto sólido do vídeo dependia de mix-blend-mode:screen pra sumir
// — só que isso clareia qualquer pixel escuro contra o fundo, não só o
// preto puro, e lavava o contraste da crina/cauda (escura mas não preta).
// cavalinho-intro.gif é gerado a partir de public/cavalinho.gif com os
// frames 25% mais lentos (80ms -> 100ms, equivalente ao antigo
// playbackRate 0.8 do vídeo) sem alterar o GIF original usado no Hero.
const VISIBLE_DURATION = 2;
const REVEAL_DURATION = 0.9 / 0.8;

export function IntroLoader() {
  const [visible, setVisible] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      markIntroComplete();
      // One-time synchronous bail-out on mount (not a state sync loop) — the
      // matchMedia check can only run client-side, so it can't move to the
      // initial useState value without risking an SSR/hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }

    const overlay = overlayRef.current;
    if (!overlay) return;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const tl = gsap.timeline({
      delay: VISIBLE_DURATION,
      onComplete: () => {
        document.documentElement.style.overflow = previousOverflow;
        markIntroComplete();
        setVisible(false);
      },
    });

    tl.to(overlay, {
      yPercent: -100,
      duration: REVEAL_DURATION,
      ease: "power3.inOut",
    });

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      tl.kill();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="bg-fernandito-verde-medio fixed inset-0 z-[100] flex items-center justify-center [will-change:transform]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- GIF animado, next/image tiraria a animação */}
      <img
        src="/cavalinho-intro.gif"
        alt=""
        width={640}
        height={366}
        fetchPriority="high"
        decoding="async"
        className="h-[160px] w-[240px] object-contain sm:h-[220px] sm:w-[320px]"
      />
    </div>
  );
}

export default IntroLoader;
