"use client";

import NextLink from "next/link";
import { PORTAS, STORE } from "@/content/site";
import { scrollToTarget } from "@/lib/lenis";
import { ArrowRightIcon } from "@/components/ui/icons";

const CARD =
  "group duration-base ease-out-standard focus-visible:outline-fernandito-off-white flex h-full w-full flex-col rounded-3xl p-6 text-left transition-[transform,box-shadow] hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-7";

/**
 * "As três portas" (home, depois do kit): cada visitante escolhe o seu
 * caminho. Casa (cartão bege, o principal) volta pro kit; evento e negócio
 * levam pras páginas /eventos e /revenda (um lugar só pra cada intenção).
 * Fundo verde-medio (a cor principal).
 */
export function PortasSection() {
  return (
    <section
      id="portas"
      aria-labelledby="portas-titulo"
      className="bg-fernandito-verde-medio text-fernandito-off-white w-full px-6 py-20 sm:px-10 md:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <p className="font-accent text-label text-fernandito-off-white/70 tracking-[0.18em] uppercase">
          {PORTAS.eyebrow}
        </p>
        <h2
          id="portas-titulo"
          className="font-rampart mt-3 text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1]"
        >
          {PORTAS.title}
        </h2>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {STORE.enabled && (
            <li>
              <button
                type="button"
                onClick={() => scrollToTarget("#comprar")}
                className={`${CARD} bg-fernandito-off-white text-fernandito-verde-escuro shadow-[0_18px_40px_rgba(20,28,18,0.3)]`}
              >
                <Door title={PORTAS.casa.title} text={PORTAS.casa.text} cta={PORTAS.casa.cta} />
              </button>
            </li>
          )}
          {PORTAS.forms.map((form) => (
            <li key={form.key}>
              <NextLink
                href={form.href}
                className={`${CARD} bg-fernandito-verde-escuro/35 ring-fernandito-off-white/15 hover:ring-fernandito-verde-claro ring-1`}
              >
                <Door title={form.title} text={form.text} cta={form.cta} />
              </NextLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Door({ title, text, cta }: { title: string; text: string; cta: string }) {
  return (
    <>
      <span className="font-rampart text-[1.55rem] leading-[1.05]">{title}</span>
      <span className="text-body mt-3 flex-1 font-sans opacity-80">{text}</span>
      <span className="mt-6 inline-flex items-center gap-2 font-sans text-[0.9rem] font-bold">
        {cta}
        <span className="duration-base ease-out-standard transition-transform group-hover:translate-x-1">
          <ArrowRightIcon />
        </span>
      </span>
    </>
  );
}

export default PortasSection;
