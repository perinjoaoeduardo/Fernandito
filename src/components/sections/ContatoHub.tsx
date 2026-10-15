"use client";

import NextLink from "next/link";
import { PAGES } from "@/content/site";
import { ArrowRightIcon } from "@/components/ui/icons";
import { whatsappHref } from "@/components/ui/WhatsAppButton";

/**
 * Página Contato: um cartão por motivo. Cada um abre o WhatsApp com a
 * mensagem do motivo (nenhum WhatsApp genérico) — ou, pra evento e revenda,
 * leva pra página própria, onde o formulário curto já qualifica o pedido.
 */
export function ContatoHub() {
  return (
    <section
      aria-label="Motivos de contato"
      className="bg-fernandito-verde-medio text-fernandito-off-white w-full px-6 pb-20 sm:px-10 md:pb-28 lg:px-16"
    >
      <ul className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PAGES.contato.reasons.map((reason) => {
          const external = reason.message ? whatsappHref(reason.message) : null;
          const body = (
            <>
              <span className="font-rampart text-[1.45rem] leading-[1.05]">{reason.title}</span>
              <span className="text-body mt-2 flex-1 font-sans opacity-75">{reason.text}</span>
              <span className="mt-5 inline-flex items-center gap-2 font-sans text-[0.85rem] font-bold">
                {reason.href ? "Ver página" : "Chamar no WhatsApp"}
                <span className="duration-base ease-out-standard transition-transform group-hover:translate-x-1">
                  <ArrowRightIcon />
                </span>
              </span>
            </>
          );
          const card =
            "group bg-fernandito-verde-escuro/35 ring-fernandito-off-white/15 hover:ring-fernandito-verde-claro duration-base ease-out-standard flex h-full flex-col rounded-3xl p-6 ring-1 transition-[transform,box-shadow] hover:-translate-y-1";
          return (
            <li key={reason.title}>
              {reason.href ? (
                <NextLink href={reason.href} className={card}>
                  {body}
                </NextLink>
              ) : (
                <a
                  href={external ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={card}
                >
                  {body}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ContatoHub;
