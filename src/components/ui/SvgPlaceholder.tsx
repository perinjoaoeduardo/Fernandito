import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

type SvgPlaceholderProps = {
  label: string;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">;

/**
 * Placeholder visual genérico pros SVGs de marca que ainda não chegaram
 * (logo completo, símbolo do cavalo, etc.) — borda tracejada + label,
 * dimensionado via `className` por quem usa. Trocar pelo SVG real
 * (inline ou `<img>`) assim que o arquivo existir em `/public/logo/`.
 */
export function SvgPlaceholder({ label, className, ...rest }: SvgPlaceholderProps) {
  return (
    <div
      className={clsx(
        "border-fernandito-off-white/50 text-fernandito-off-white/70 flex shrink-0 items-center justify-center border-2 border-dashed text-center leading-tight",
        className,
      )}
      {...rest}
    >
      {label}
    </div>
  );
}

export default SvgPlaceholder;
