import NextLink from "next/link";
import type { ReactNode } from "react";

/**
 * Cabeçalho das páginas internas (Manifesto, Eventos, Revenda, Contato):
 * "← Início", rótulo, título grande e uma linha de apoio. Fundo verde-medio
 * (cor principal); o espaço de cima abre lugar pro menu flutuante.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children?: ReactNode;
}) {
  return (
    <header className="bg-fernandito-verde-medio text-fernandito-off-white w-full px-6 pt-[calc(8.5rem+var(--announcement-h))] pb-14 sm:px-10 md:pb-20 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <NextLink
          href="/"
          className="text-label duration-base ease-out-standard inline-flex items-center gap-2 font-sans tracking-[0.1em] uppercase opacity-70 transition-opacity hover:opacity-100"
        >
          <span aria-hidden="true">←</span> Início
        </NextLink>
        <p className="font-accent text-label text-fernandito-off-white/70 mt-8 tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-rampart mt-3 max-w-4xl text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.98] text-balance">
          {title}
        </h1>
        <p className="text-body-lg mt-5 max-w-2xl font-sans opacity-85">{intro}</p>
        {children}
      </div>
    </header>
  );
}

export default PageHeader;
