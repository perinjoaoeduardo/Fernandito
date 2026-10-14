"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ProductImage } from "@/lib/catalog";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { prefersReducedMotion } from "@/lib/gsap";

/** Tempo de cada foto no passa-sozinho. */
const AUTOPLAY_MS = 5000;

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

/**
 * Galeria do produto: foto grande + miniaturas clicáveis embaixo (somem se
 * só houver uma foto). As fotos passam sozinhas a cada 5 s (sem marcador
 * de tempo, só trocam) e têm setas de anterior/próxima que
 * aparecem ao passar o mouse (no toque ficam sempre visíveis). O passa-
 * sozinho pausa com o mouse em cima, fora da tela, com a aba escondida e sob
 * prefers-reduced-motion; clicar numa seta ou miniatura recomeça a contagem.
 * `seal` fica por cima, no canto da foto (pode vazar pra fora dela).
 * Ganchos de animação: `data-gallery-image` e `data-gallery-thumb` — a
 * entrada mora na ComprarSection.
 */
export function ProductGallery({ images, seal }: { images: ProductImage[]; seal?: ReactNode }) {
  const [active, setActive] = useState(0);
  // Muda a cada troca manual: recomeça os 5 s.
  const [cycle, setCycle] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [canAutoplay, setCanAutoplay] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const many = images.length > 1;
  const current = images[active] ?? images[0];

  const go = useCallback(
    (index: number) => {
      setActive((index + images.length) % images.length);
      setCycle((c) => c + 1);
    },
    [images.length],
  );

  // Só passa sozinho com a galeria na tela e sem reduced motion.
  useEffect(() => {
    // Checagem só do navegador (matchMedia) — não dá pra ir pro useState
    // inicial sem quebrar a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanAutoplay(!prefersReducedMotion());
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const playing = many && canAutoplay && inView && !hovered;

  // Passa sozinho, sem marcador de tempo. Pausar e voltar recomeça os 5 s.
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => go(active + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [playing, active, cycle, go]);

  return (
    <div>
      <div className="relative">
        <div
          ref={frameRef}
          data-gallery-image
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="group bg-fernandito-verde-medio relative aspect-[4/5] overflow-hidden lg:aspect-auto lg:h-[clamp(22rem,calc(100svh-17rem),42rem)] rounded-[1.75rem] shadow-[0_30px_70px_rgba(36,48,34,0.28)]"
        >
          {/* A foto troca com um fade curto (a key remonta o PhotoSlot). */}
          <div key={active} className="absolute inset-0 animate-[fadeIn_0.7s_ease-out_both]">
            <PhotoSlot
              image={current}
              sizes="(max-width: 767px) 90vw, 45vw"
              placeholderClassName="bg-fernandito-verde-medio"
            />
          </div>

          {many && (
            <>
              {(["left", "right"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => go(active + (dir === "left" ? -1 : 1))}
                  aria-label={dir === "left" ? "Foto anterior" : "Próxima foto"}
                  className={clsx(
                    "bg-fernandito-off-white/85 text-fernandito-verde-escuro duration-base ease-out-standard hover:bg-fernandito-off-white focus-visible:outline-fernandito-off-white absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full shadow-[0_8px_20px_rgba(20,28,18,0.3)] backdrop-blur-sm transition-[opacity,transform,background-color] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95",
                    dir === "left" ? "left-3 sm:left-4" : "right-3 sm:right-4",
                    // Mouse: aparecem ao passar por cima, deslizando de leve
                    // pra dentro. Toque: sempre visíveis.
                    "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100",
                    dir === "left"
                      ? "pointer-fine:-translate-x-2 pointer-fine:group-hover:translate-x-0"
                      : "pointer-fine:translate-x-2 pointer-fine:group-hover:translate-x-0",
                  )}
                >
                  <Chevron dir={dir} />
                </button>
              ))}
            </>
          )}
        </div>
        {seal}
      </div>

      {many && (
        <ul className="mt-4 flex gap-3" aria-label="Fotos do produto">
          {images.map((image, i) => (
            <li key={i} data-gallery-thumb className="w-[4.5rem] sm:w-20">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Ver foto ${i + 1}: ${image.placeholder}`}
                aria-pressed={i === active}
                className={clsx(
                  "bg-fernandito-verde-medio duration-base ease-out-standard focus-visible:outline-fernandito-verde-medio relative block aspect-square w-full overflow-hidden rounded-xl transition-[opacity,transform,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2",
                  i === active
                    ? "ring-fernandito-verde-escuro ring-offset-fernandito-off-white ring-2 ring-offset-2"
                    : "opacity-55 hover:-translate-y-0.5 hover:opacity-100",
                )}
              >
                <PhotoSlot
                  image={image}
                  sizes="80px"
                  placeholderClassName="bg-fernandito-verde-medio"
                  className="[&_span]:hidden"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductGallery;
