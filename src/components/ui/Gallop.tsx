"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

// Largura do cavalinho na tela e quanto tempo ele leva pra atravessar.
const HORSE_WIDTH = "min(42vw, 320px)";
const CROSS_SECONDS = 2.4;

/**
 * O segredo: o cavalinho da abertura atravessa a tela galopando, uma vez.
 * Quem dispara é o FloatingNav (três toques rápidos no cavalo do menu).
 * Usa o mesmo GIF da intro, que o navegador já tem em cache.
 */
export function Gallop({ onDone }: { onDone: () => void }) {
  const horseRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const horse = horseRef.current;
    if (!horse) return;
    const tween = gsap.fromTo(
      horse,
      // Invisível até o primeiro quadro da tween (o efeito roda depois da
      // pintura), já posicionado fora da tela à esquerda.
      { x: () => -horse.offsetWidth, opacity: 1 },
      { x: () => window.innerWidth, duration: CROSS_SECONDS, ease: "none", onComplete: onDone },
    );
    return () => {
      tween.kill();
    };
  }, [onDone]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- GIF animado já em cache pela intro; next/image não anima nem ajuda aqui
    <img
      ref={horseRef}
      src="/cavalinho-intro.gif"
      alt=""
      aria-hidden="true"
      width={640}
      height={366}
      style={{ width: HORSE_WIDTH }}
      className="pointer-events-none fixed bottom-[8vh] left-0 z-[45] h-auto opacity-0 [will-change:transform]"
    />
  );
}

export default Gallop;
