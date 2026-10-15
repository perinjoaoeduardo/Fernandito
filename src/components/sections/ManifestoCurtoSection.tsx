import NextLink from "next/link";
import { MANIFESTO_CURTO } from "@/content/site";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * Manifesto em 3 frases (home): quem tem pressa já saiu pelas portas; quem
 * segue rolando quer conhecer a marca. A frase do meio em destaque
 * (Rampart). Fundo verde-escuro, link pro manifesto inteiro (/manifesto).
 */
export function ManifestoCurtoSection() {
  const [first, middle, last] = MANIFESTO_CURTO.lines;
  return (
    <section
      id="manifesto-curto"
      aria-label="Manifesto"
      className="bg-fernandito-verde-escuro text-fernandito-off-white w-full px-6 py-24 sm:px-10 md:py-32 lg:px-16"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-6">
        <p className="font-accent text-body-lg opacity-80">{first}</p>
        <p className="font-rampart text-[clamp(2.4rem,6vw,4.5rem)] leading-[1]">{middle}</p>
        <p className="font-accent text-body-lg opacity-80">{last}</p>
        <NextLink
          href="/manifesto"
          className="group border-fernandito-off-white/40 hover:bg-fernandito-off-white hover:text-fernandito-verde-escuro duration-base ease-out-standard mt-4 inline-flex h-12 items-center gap-2 rounded-full border px-6 font-sans text-[0.95rem] font-bold transition-colors"
        >
          {MANIFESTO_CURTO.cta}
          <span className="duration-base ease-out-standard transition-transform group-hover:translate-x-1">
            <ArrowRightIcon />
          </span>
        </NextLink>
      </div>
    </section>
  );
}

export default ManifestoCurtoSection;
