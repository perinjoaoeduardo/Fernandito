"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import type { ProductImage } from "@/lib/catalog";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

/**
 * Galeria do produto: foto grande + miniaturas clicáveis embaixo (some se
 * só houver uma foto). `children` entra por cima da foto grande (selo).
 */
export function ProductGallery({
  images,
  children,
}: {
  images: ProductImage[];
  children?: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div>
      <div className="relative">
        <div className="bg-fernandito-verde-medio relative aspect-[4/5] overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(36,48,34,0.25)]">
          <PhotoSlot
            key={active}
            image={current}
            sizes="(max-width: 767px) 90vw, 45vw"
            placeholderClassName="bg-fernandito-verde-medio"
          />
        </div>
        {children}
      </div>

      {images.length > 1 && (
        <ul className="mt-4 grid grid-cols-4 gap-3" aria-label="Fotos do produto">
          {images.map((image, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Ver foto ${i + 1}: ${image.placeholder}`}
                aria-pressed={i === active}
                className={clsx(
                  "bg-fernandito-verde-medio duration-base ease-out-standard focus-visible:outline-fernandito-verde-medio relative block aspect-square w-full overflow-hidden rounded-xl transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2",
                  i === active
                    ? "ring-fernandito-verde-escuro ring-offset-fernandito-off-white ring-2 ring-offset-2"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <PhotoSlot
                  image={image}
                  sizes="12vw"
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
