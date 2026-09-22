"use client";

import { clsx } from "clsx";
import NextLink from "next/link";
import { usePathname } from "next/navigation";

// Lista de documentos legais — hoje só tem um (as informações regulatórias
// que já existiam no rodapé). Quando "Política de Privacidade" e "Termos
// de Uso" tiverem conteúdo real (não fabricado por IA), adicionar aqui —
// a estrutura de sidebar já está pronta pra crescer.
const LEGAL_DOCS = [{ slug: "avisos", label: "Avisos e registro" }];

export function LegalSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentos legais" className="shrink-0 sm:w-56">
      <NextLink
        href="/"
        className="text-label duration-base ease-out-standard mb-8 inline-flex items-center gap-1 font-sans tracking-[0.08em] uppercase opacity-60 transition-opacity hover:opacity-100"
      >
        ← Voltar ao site
      </NextLink>
      <ul className="flex flex-col gap-2">
        {LEGAL_DOCS.map((doc) => {
          const href = `/legal/${doc.slug}`;
          const active = pathname === href;
          return (
            <li key={doc.slug}>
              <NextLink
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "text-body duration-base ease-out-standard block rounded-full border px-4 py-2 font-sans transition-colors",
                  active
                    ? "border-fernandito-verde-escuro bg-fernandito-verde-escuro text-fernandito-off-white"
                    : "text-fernandito-verde-escuro/70 hover:border-fernandito-verde-escuro/30 border-transparent",
                )}
              >
                {doc.label}
              </NextLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default LegalSidebar;
