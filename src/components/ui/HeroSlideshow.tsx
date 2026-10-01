"use client";

import { clsx } from "clsx";
import Image from "next/image";
import { useEffect, useState } from "react";
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

  // Só começa a contar quando a intro sai da frente — senão a 1ª foto
  // passava escondida atrás da cortina.
  useEffect(() => {
    if (photos.length < 2 || prefersReducedMotion()) return;
    let id: number | undefined;
    const unsubscribe = onIntroComplete(() => {
      id = window.setInterval(
        () => setActive((current) => (current + 1) % photos.length),
        INTERVAL_MS,
      );
    });
    return () => {
      unsubscribe();
      window.clearInterval(id);
    };
  }, [photos.length]);

  if (photos.length === 0) return null;

  return (
    <div aria-hidden="true" className="absolute inset-0">
      {photos.map((photo, i) =>
        photo.src ? (
          <div
            key={photo.src}
            className={clsx(
              "absolute inset-0 ease-out [will-change:opacity,transform]",
              i === active ? "scale-100 opacity-100" : "scale-[1.06] opacity-0",
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
      {/* Véu: mantém o cartão "verde-escuro" e o logo legível. */}
      <div className="bg-fernandito-verde-escuro/55 absolute inset-0" />
    </div>
  );
}

export default HeroSlideshow;
