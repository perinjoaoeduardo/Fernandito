"use client";

import { PAGES, STORE } from "@/content/site";
import { useGoToShop } from "@/components/cart/useGoToShop";
import NextLink from "next/link";

/**
 * "Próximo passo" no fim das páginas internas (regra da navegação: toda
 * página termina com uma saída clara) — comprar o kit ou ir pro Contato.
 * Faixa bege (contraste) antes do rodapé verde.
 */
export function NextStep() {
  const goToShop = useGoToShop();
  return (
    <section
      aria-label="Próximo passo"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-16 sm:px-10 md:py-20 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <p className="font-rampart text-[clamp(2.2rem,4vw,3.2rem)] leading-[1]">
            {PAGES.next.title}
          </p>
          <p className="text-body-lg mt-2 font-sans opacity-75">{PAGES.next.text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {STORE.enabled && (
            <button
              type="button"
              onClick={goToShop}
              className="bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio duration-base ease-out-standard flex h-12 items-center rounded-full px-6 font-sans text-[0.95rem] font-bold transition-colors"
            >
              {PAGES.next.buy}
            </button>
          )}
          <NextLink
            href="/contato"
            className="border-fernandito-verde-escuro/40 hover:bg-fernandito-verde-escuro hover:text-fernandito-off-white duration-base ease-out-standard flex h-12 items-center rounded-full border px-6 font-sans text-[0.95rem] font-bold transition-colors"
          >
            {PAGES.next.talk}
          </NextLink>
        </div>
      </div>
    </section>
  );
}

export default NextStep;
