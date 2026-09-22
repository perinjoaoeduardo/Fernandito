import { clsx } from "clsx";
import NextLink from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type LinkVariant = "underline-grow" | "underline-swap";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: LinkVariant;
  children: ReactNode;
  className?: string;
};

// A sublinha mora num <span> interno que abraça só o texto (não o `<a>`
// inteiro) — se o link tiver padding (ex: dentro de uma pill do
// FloatingNav, pra dar área de clique maior), a sublinha continua colada
// no texto em vez de flutuar lá embaixo, na borda da caixa com padding.
// Por isso hover/focus usam `group-hover`/`group-focus-visible`: o estado
// é lido no `<a>` (que cobre toda a área clicável), mas quem desenha é o
// span de dentro.

// `underline-grow`: sem sublinha em repouso; cresce da esquerda pra direita
// no hover/focus (origin-left) e retrai da direita pra esquerda ao sair
// (origin-right) — o clássico truque de trocar `transform-origin` entre os
// dois estados, sem precisar de JS pra rastrear hover.
const UNDERLINE_GROW =
  "relative after:absolute after:-bottom-0.5 after:left-0 after:h-[1.5px] after:w-full after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-base after:ease-out-standard group-hover:after:origin-left group-hover:after:scale-x-100 group-focus-visible:after:origin-left group-focus-visible:after:scale-x-100";

// `underline-swap`: sublinha permanente (fina) + uma segunda, mais grossa e
// colorida, "sobe" por baixo dela no hover — efeito de dupla sublinha,
// tratamento mais editorial (footer, cartão).
const UNDERLINE_SWAP =
  "relative opacity-100 transition-opacity duration-base ease-out-standard after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:bg-current before:absolute before:-bottom-2 before:left-0 before:h-0.5 before:w-full before:origin-bottom before:scale-y-0 before:bg-fernandito-verde-medio before:transition-transform before:duration-base before:ease-out-standard group-hover:opacity-85 group-hover:before:scale-y-100 group-focus-visible:opacity-85 group-focus-visible:before:scale-y-100";

const VARIANT_CLASSES: Record<LinkVariant, string> = {
  "underline-grow": UNDERLINE_GROW,
  "underline-swap": UNDERLINE_SWAP,
};

/**
 * Link textual com sublinha animada. `<a>` já é detectado pelo CustomCursor
 * (ver DESIGN_SYSTEM.md "## Interação") sem precisar de atributo extra.
 *
 * Rotas internas (`href` começando com "/", sem `target="_blank"`) usam
 * `next/link` por baixo — navegação client-side, sem recarregar a página
 * (o que faria a IntroLoader tocar de novo). Âncoras (#hero), externos e
 * `target="_blank"` continuam como `<a>` simples.
 */
export function Link({
  variant = "underline-grow",
  children,
  className,
  href,
  target,
  ...props
}: LinkProps) {
  const classes = clsx(
    "group focus-visible:outline-fernandito-verde-medio focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    className,
  );
  const content = (
    <span className={clsx("inline-block w-fit", VARIANT_CLASSES[variant])}>{children}</span>
  );

  if (href && href.startsWith("/") && target !== "_blank") {
    return (
      <NextLink href={href} className={classes} {...props}>
        {content}
      </NextLink>
    );
  }

  return (
    <a href={href} target={target} className={classes} {...props}>
      {content}
    </a>
  );
}

export default Link;
