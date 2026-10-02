"use client";

import { clsx } from "clsx";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/gsap";
import { onIntroComplete } from "@/lib/introSignal";
import { HERO } from "@/content/site";
import { PHOTO_QUALITY } from "@/components/ui/PhotoSlot";

// Tempo de cada foto na tela, a troca (fade) e o zoom lento ("Ken Burns")
// que a foto ativa faz enquanto está na tela — de 1.06 até 1.
const INTERVAL_MS = 5500;
const FADE_MS = 1400;
const ZOOM_MS = 7000;

/**
 * Fundo do cartão da Hero: as fotos de `HERO.photos` trocando sozinhas com
 * fade cruzado, por baixo de um véu verde-escuro (o logo e a frase
 * continuam legíveis em qualquer foto). Com reduced motion fica só a 1ª.
 * Decorativo: `aria-hidden` e `alt=""` — o conteúdo da Hero é o h1.
 */
export function HeroSlideshow() {
  const photos = HERO.photos;
  const [active, setActive] = useState(0);
  // A que está saindo (ainda no fade). As outras ficam `invisible`: fora da
  // composição, sem custo de GPU — no celular as 4 fotos de tela cheia
  // empilhadas e prontas pra animar pesavam.
  const [previous, setPrevious] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Só começa a contar quando a intro sai da frente — senão a 1ª foto
  // passava escondida atrás da cortina.
  useEffect(() => {
    if (photos.length < 2 || prefersReducedMotion()) return;
    let id: number | undefined;
    // Só troca com a Hero na tela: rolando o resto da página, a troca (e o
    // zoom de 7s) parava de gastar quadro à toa.
    let inView = true;
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    });
    if (rootRef.current) observer.observe(rootRef.current);
    const unsubscribe = onIntroComplete(() => {
      id = window.setInterval(() => {
        if (!inView || document.hidden) return;
        setActive((current) => {
          setPrevious(current);
          return (current + 1) % photos.length;
        });
      }, INTERVAL_MS);
    });
    return () => {
      unsubscribe();
      observer.disconnect();
      window.clearInterval(id);
    };
  }, [photos.length]);

  if (photos.length === 0) return null;

  return (
    <div ref={rootRef} aria-hidden="true" className="absolute inset-0">
      {photos.map((photo, i) =>
        photo.src ? (
          <div
            key={photo.src}
            className={clsx(
              "absolute inset-0 ease-out",
              i === active
                ? "scale-100 opacity-100 [will-change:opacity,transform]"
                : "scale-[1.06] opacity-0",
              i !== active && i !== previous && "invisible",
            )}
            style={{
              transitionProperty: "opacity, transform",
              transitionDuration: `${FADE_MS}ms, ${ZOOM_MS}ms`,
            }}
          >
            <Image
              src={photo.src}
              alt=""
              fill
              sizes="100vw"
              quality={PHOTO_QUALITY}
              priority={i === 0}
              className="object-cover"
            />
          </div>
        ) : null,
      )}
      {/* Véu: mantém o cartão "verde-escuro" e o logo legível (80%: a 55% o
          rótulo claro da foto brigava com o logo). Com a rolagem ele clareia
          até 50% enquanto o cartão fecha na moldura — a HeroSection anima a
          opacidade dele pelo `data-hero-veil`. */}
      <div
        data-hero-veil
        className="bg-fernandito-verde-escuro absolute inset-0 opacity-80 [will-change:opacity]"
      />
    </div>
  );
}

export default HeroSlideshow;
