"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { markIntroComplete } from "@/lib/introSignal";

// Cortina de abertura: vídeo do cavalinho por ~2s, depois sobe e revela o
// site — estilo intro de landing page. Roda uma vez por carregamento (não
// tem sessionStorage: é uma landing de página única, então "toda vez que
// carrega" É o comportamento esperado).
const VISIBLE_DURATION = 2;
// -20% de velocidade = dura 1/0.8 = 1.25x mais (0.9s base -> 1.125s).
const REVEAL_DURATION = 0.9 / 0.8;
const VIDEO_PLAYBACK_RATE = 0.8;

export function IntroLoader() {
  const [visible, setVisible] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

    if (videoRef.current) videoRef.current.playbackRate = VIDEO_PLAYBACK_RATE;

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
      <video
        ref={videoRef}
        src="/cavalinho-intro.mp4"
        autoPlay
        muted
        loop
        playsInline
        // O vídeo tem fundo preto sólido (não transparente). "screen" faz
        // preto virar invisível contra o fundo da cortina — só o cavalo claro
        // fica visível, sem a caixa retangular do vídeo aparecendo.
        className="h-[160px] w-[240px] object-contain mix-blend-screen sm:h-[220px] sm:w-[320px]"
      />
    </div>
  );
}

export default IntroLoader;
