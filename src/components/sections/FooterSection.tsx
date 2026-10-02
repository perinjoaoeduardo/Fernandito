"use client";

import { teleportToTop } from "@/lib/lenis";
import { Parallax } from "@/components/ui/Parallax";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { Link } from "@/components/ui/Link";
import { InstagramIcon } from "@/components/ui/icons";
import { FOOTER, LINKS, NAV, PRELAUNCH } from "@/content/site";

// Ritmo da frase de fechamento, que se escreve sozinha quando o rodapé
// aparece (não acompanha a rolagem): devagar, como máquina de escrever.
const FOOTER_CPS = 13;

// Mesmos "andares" da FloatingNav + o bloco de contato (ContatoSection).
const NAV_LINKS = [...NAV.links, NAV.contactLink];

// Footer é fundo escuro (verde-escuro) — outline de foco precisa contrastar
// com isso, não com o verde-medio padrão do Link (pensado pra fundos claros).
const FOOTER_LINK_CLASSES =
  "text-fernandito-off-white/85 text-body font-sans !outline-fernandito-off-white";

function TopoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4 translate-y-[0.5px]"
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

export function FooterSection() {
  return (
    <footer
      id="footer"
      className="bg-fernandito-verde-escuro text-fernandito-off-white relative w-full px-6 py-14 sm:px-10 sm:py-16 lg:px-16"
    >
      {/* Largura total (só o padding da página). A partir de lg, "Pra quem
          não deixa passar," cabe numa linha: a frase mede ~17em na Rampart,
          então o tamanho é (100vw − 36rem de padding+links) / 17, com teto
          de 2.75rem. */}
      {/* No pré-lançamento só sobra a coluna "Social": ela fica logo ao lado
          da frase, em vez de lá no canto direito da tela. */}
      <div
        className={`grid w-full gap-12 md:items-start ${
          PRELAUNCH.enabled
            ? "md:grid-cols-[auto_auto] md:justify-start md:gap-[12vw] lg:gap-[20vw]"
            : "md:grid-cols-[minmax(0,34rem)_auto] md:justify-between md:gap-16 lg:grid-cols-[minmax(0,1fr)_auto]"
        }`}
      >
        {/* Frase de fechamento + CTA — escrita à máquina como o resto do
            site. Rampart é só caixa-alta: o contraste entre as linhas vem
            da cor (off-white → verde-claro), não de itálico/peso. */}
        {/* Só a frase principal se escreve, sozinha, quando o rodapé entra
            (não presa à rolagem); o resto já está lá. Parallax só no
            computador: no celular, com a Social e a faixa na tela ao mesmo
            tempo, era movimento demais. */}
        <Parallax speed={24} touch={false}>
          <TypewriterText
            text={FOOTER.line1}
            caret={false}
            triggerSelector="#footer"
            mode="play"
            start="top 75%"
            charsPerSecond={FOOTER_CPS}
            className="font-rampart text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.1] tracking-[0.01em] lg:text-[min(2.75rem,calc((100vw-36rem)/17))] lg:whitespace-nowrap"
          />
          <TypewriterText
            as="p"
            text={FOOTER.line2}
            triggerSelector="#footer"
            mode="play"
            start="top 75%"
            charsPerSecond={FOOTER_CPS}
            // Começa quando a primeira linha termina (+ uma pausa curta).
            delay={FOOTER.line1.length / FOOTER_CPS + 0.3}
            className="font-rampart text-fernandito-verde-claro mt-1 text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.1] tracking-[0.01em] lg:text-[min(2.75rem,calc((100vw-36rem)/17))]"
          />
          <p className="text-body-lg font-accent mt-5 tracking-[0.04em] opacity-80">
            {FOOTER.tagline}
          </p>
          <div className="mt-8">
            <WhatsAppButton>{NAV.whatsappLabel}</WhatsAppButton>
          </div>
        </Parallax>

        {/* Navegação em colunas — estilo compacto (Company/Socials da Lassie) */}
        <Parallax
          speed={-16}
          touch={false}
          className={`grid gap-10 sm:gap-16 ${PRELAUNCH.enabled ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {/* No pré-lançamento as seções não existem: some o "Navegar". */}
          {!PRELAUNCH.enabled && (
            <div>
              <h3 className="text-label mb-4 font-sans tracking-[0.08em] uppercase opacity-80">
                {FOOTER.navTitle}
              </h3>
              <ul className="flex flex-col gap-3">
                {NAV_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} variant="underline-grow" className={FOOTER_LINK_CLASSES}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-label mb-4 font-sans tracking-[0.08em] uppercase opacity-80">
              {FOOTER.socialTitle}
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link
                  href={LINKS.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="underline-grow"
                  className={FOOTER_LINK_CLASSES}
                >
                  <span className="inline-flex items-center gap-2">
                    <InstagramIcon className="h-4 w-4" />
                    Instagram
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </Parallax>
      </div>

      {/* Base do footer — moeda no lugar de um mascote/flor genérico + botão
          de voltar ao topo, igual ao rodapé enxuto da Lassie (sem o grain e
          sem o texto gigante de fundo: aqui embaixo entra um placeholder de
          imagem futuramente, por isso o fundo fica sólido). */}
      <div className="relative mt-12 flex w-full flex-col items-center gap-6 border-t border-white/10 pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
          <img
            src="/logo/fernandito-moeda.webp"
            alt=""
            aria-hidden="true"
            width={256}
            height={258}
            loading="lazy"
            decoding="async"
            className="h-10 w-10 shrink-0 opacity-90"
          />
          <div className="font-sans text-[13px] opacity-70">
            <p>{FOOTER.copyright}</p>
            <p>{FOOTER.madeIn}</p>
          </div>
        </div>

        {/* Voltar ao topo: pílula com rótulo escrito + seta (só a seta num
            círculo fino passava despercebida — não parecia clicável). No
            hover o fundo acende e a seta dá um passinho pra cima. */}
        <button
          type="button"
          onClick={teleportToTop}
          className="group border-fernandito-off-white/40 text-fernandito-off-white duration-base ease-out-standard hover:bg-fernandito-off-white hover:text-fernandito-verde-escuro focus-visible:outline-fernandito-off-white focus-visible:bg-fernandito-off-white focus-visible:text-fernandito-verde-escuro inline-flex h-11 shrink-0 items-center gap-2 rounded-full border pr-4 pl-5 font-sans text-[13px] tracking-[0.12em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {/* A fonte reserva espaço de descendente embaixo: as maiúsculas
              ficavam ~1,4px acima do centro da pílula. */}
          <span className="translate-y-[0.11em]">{FOOTER.backToTop}</span>
          <span className="duration-base ease-out-standard transition-transform group-hover:-translate-y-0.5">
            <TopoIcon />
          </span>
        </button>
      </div>
    </footer>
  );
}

export default FooterSection;
