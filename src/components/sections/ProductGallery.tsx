"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import type { ProductImage } from "@/lib/catalog";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

/**
 * Galeria do produto: foto grande + miniaturas clicáveis embaixo (somem se
 * só houver uma foto). `seal` fica por cima, no canto da foto (pode vazar
 * pra fora dela). Ganchos de animação: `data-gallery-image` (a foto) e
 * `data-gallery-thumb` (as miniaturas) — a entrada mora na ComprarSection.
 */
export function ProductGallery({ images, seal }: { images: ProductImage[]; seal?: ReactNode }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div>
      <div className="relative">
        <div
          data-gallery-image
          className="bg-fernandito-verde-medio relative aspect-[4/5] overflow-hidden rounded-[1.75rem] shadow-[0_30px_70px_rgba(36,48,34,0.28)]"
        >
          {/* A foto troca com um fade curto (a key remonta o PhotoSlot). */}
          <div key={active} className="absolute inset-0 animate-[fadeIn_0.45s_ease-out_both]">
            <PhotoSlot
              image={current}
              sizes="(max-width: 767px) 90vw, 45vw"
              placeholderClassName="bg-fernandito-verde-medio"
            />
          </div>
        </div>
        {seal}
      </div>

      {images.length > 1 && (
        <ul className="mt-4 flex gap-3" aria-label="Fotos do produto">
          {images.map((image, i) => (
            <li key={i} data-gallery-thumb className="w-[4.5rem] sm:w-20">
              <button
                type="button"
                onClick={() => setActive(i)}
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
