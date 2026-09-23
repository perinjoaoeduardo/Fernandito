import { clsx } from "clsx";
import Image from "next/image";

type LogoProps = {
  className?: string;
  /** Vazio quando quem usa já fornece o texto acessível por fora (ver o h1
   * da Hero) — aí a imagem entra como decorativa. */
  alt?: string;
  "aria-hidden"?: boolean;
};

// Dimensões reais do arquivo — passadas pro next/image reservar a caixa
// certa antes de carregar (sem isso o layout pula: CLS).
const INTRINSIC_WIDTH = 1400;
const INTRINSIC_HEIGHT = 263;

/**
 * Lockup completo da marca. Serve o WebP 2x (`fernandito-logo-text.webp`,
 * ~59KB) em vez do SVG original (~2.3MB antes do svgo, 739KB depois): o
 * vetor é uma ilustração com milhares de paths e era o elemento de LCP da
 * Hero. O `.svg` continua em `/public/logo` como arquivo-fonte da marca —
 * pra regerar o raster, ver DESIGN_SYSTEM.md ("Assets de logo").
 *
 * `priority` porque é justamente o LCP: o Next injeta um `<link rel=preload>`
 * e tira o lazy-loading padrão.
 */
export function Logo({ className, alt = "Fernandito", "aria-hidden": ariaHidden }: LogoProps) {
  return (
    <Image
      src="/logo/fernandito-logo-text.webp"
      alt={alt}
      aria-hidden={ariaHidden}
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      priority
      sizes="(min-width: 1024px) 805px, (min-width: 640px) 690px, 432px"
      className={clsx("h-auto w-full max-w-[432px] sm:max-w-[690px] lg:max-w-[805px]", className)}
    />
  );
}

export default Logo;
