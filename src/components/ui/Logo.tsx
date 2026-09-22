import { clsx } from "clsx";
import { SvgPlaceholder } from "@/components/ui/SvgPlaceholder";

type LogoProps = {
  className?: string;
};

/**
 * Lockup completo da marca. Placeholder até `/public/logo/fernandito-logo-full.svg`
 * chegar — trocar o conteúdo abaixo por esse SVG (inline, se for animar
 * partes dele depois) mantendo a proporção ~4:1.
 */
export function Logo({ className }: LogoProps) {
  return (
    <SvgPlaceholder
      label="LOGO SVG AQUI — aguardando arquivo"
      className={clsx(
        "text-label aspect-[4/1] w-full max-w-[280px] rounded-lg px-4 font-sans tracking-[0.06em] uppercase sm:max-w-md",
        className,
      )}
    />
  );
}

export default Logo;
