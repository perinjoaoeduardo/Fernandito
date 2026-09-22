import { clsx } from "clsx";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type LinkVariant = "underline-grow" | "underline-swap";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: LinkVariant;
  children: ReactNode;
  className?: string;
};

// `underline-grow`: sem sublinha em repouso; cresce da esquerda pra direita
// no hover/focus (origin-left) e retrai da direita pra esquerda ao sair
// (origin-right) — o clássico truque de trocar `transform-origin` entre os
// dois estados, sem precisar de JS pra rastrear hover.
const UNDERLINE_GROW =
  "relative w-fit after:absolute after:-bottom-0.5 after:left-0 after:h-[1.5px] after:w-full after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-base after:ease-out-standard hover:after:origin-left hover:after:scale-x-100 focus-visible:after:origin-left focus-visible:after:scale-x-100";

// `underline-swap`: sublinha permanente (fina) + uma segunda, mais grossa e
// colorida, "sobe" por baixo dela no hover — efeito de dupla sublinha,
// tratamento mais editorial (footer, cartão).
const UNDERLINE_SWAP =
  "relative w-fit opacity-100 transition-opacity duration-base ease-out-standard after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:bg-current before:absolute before:-bottom-2 before:left-0 before:h-0.5 before:w-full before:origin-bottom before:scale-y-0 before:bg-fernandito-verde-medio before:transition-transform before:duration-base before:ease-out-standard hover:opacity-85 hover:before:scale-y-100 focus-visible:opacity-85 focus-visible:before:scale-y-100";

const VARIANT_CLASSES: Record<LinkVariant, string> = {
  "underline-grow": UNDERLINE_GROW,
  "underline-swap": UNDERLINE_SWAP,
};

/**
 * Link textual com sublinha animada. `<a>` já é detectado pelo CustomCursor
 * (ver DESIGN_SYSTEM.md "## Interação") sem precisar de atributo extra.
 */
export function Link({ variant = "underline-grow", children, className, ...props }: LinkProps) {
  return (
    <a
      className={clsx(
        "focus-visible:outline-fernandito-verde-medio focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export default Link;
