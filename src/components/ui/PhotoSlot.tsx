import { clsx } from "clsx";
import Image from "next/image";
import type { ContentImage } from "@/content/site";

type PhotoSlotProps = {
  image: ContentImage;
  /** Tamanho que a foto ocupa na tela, pro navegador baixar a versão certa
   * (ver `sizes` do next/image). */
  sizes: string;
  /** Classes do placeholder (normalmente a cor de fundo). */
  placeholderClassName?: string;
  className?: string;
};

/**
 * Preenche o elemento pai (que precisa ser `relative` ou `absolute`) com a
 * foto de `src/content/site.ts`, recortada pra cobrir. Sem `src`, mostra o
 * placeholder com o nome da foto.
 */
export function PhotoSlot({ image, sizes, placeholderClassName, className }: PhotoSlotProps) {
  if (image.src) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        className={clsx("object-cover", className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={image.alt}
      className={clsx(
        "absolute inset-0 flex items-center justify-center",
        placeholderClassName,
        className,
      )}
    >
      <span className="text-label text-fernandito-off-white px-3 text-center font-sans tracking-[0.12em] uppercase opacity-80">
        {image.placeholder}
      </span>
    </div>
  );
}

export default PhotoSlot;
