"use client";

import { scrollToTarget } from "@/lib/lenis";
import { Parallax } from "@/components/ui/Parallax";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { Link } from "@/components/ui/Link";
import { InstagramIcon } from "@/components/ui/icons";

// Mesmos "andares" da FloatingNav + o bloco de contato (ContatoSection).
const NAV_LINKS = [
  { label: "O que é", href: "#o-que-e" },
  { label: "Galeria", href: "#galeria" },
  { label: "Manifesto", href: "#manifesto" },
  { label: "Contato", href: "#contato" },
];

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
      className="h-5 w-5"
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
      {/* Largura total (só o padding da página), com a coluna de texto
          limitada pra não espremer Navegar/Social. */}
      <div className="grid w-full gap-12 md:grid-cols-[minmax(0,34rem)_auto] md:items-start md:justify-between md:gap-16">
        {/* Frase de fechamento + CTA — escrita à máquina como o resto do
            site. Rampart é só caixa-alta: o contraste entre as linhas vem
            da cor (off-white → verde-claro), não de itálico/peso. */}
        <Parallax speed={24}>
          <TypewriterText
            text="Pra quem não deixa passar,"
            caret={false}
            start="top 98%"
            end="top 75%"
            className="font-rampart text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.1] tracking-[0.01em]"
          />
          <TypewriterText
            as="p"
            text="vira história."
            start="top 98%"
            end="top 80%"
            className="font-rampart text-fernandito-verde-claro mt-1 text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.1] tracking-[0.01em]"
          />
          <TypewriterText
            as="p"
            text="Isso toma fernandito."
            caret={false}
            start="top 98%"
            end="top 85%"
            className="text-body-lg font-accent mt-5 tracking-[0.04em] opacity-80"
          />
          <div className="mt-8">
            <WhatsAppButton>Fale no WhatsApp</WhatsAppButton>
          </div>
        </Parallax>

        {/* Navegação em colunas — estilo compacto (Company/Socials da Lassie) */}
        <Parallax speed={-16} className="grid grid-cols-2 gap-10 sm:gap-16">
          <div>
            <h3 className="text-label mb-4 font-sans tracking-[0.08em] uppercase opacity-80">
              Navegar
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

          <div>
            <h3 className="text-label mb-4 font-sans tracking-[0.08em] uppercase opacity-80">
              Social
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link
                  href="https://www.instagram.com/toma.fernandito/"
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
            <p>© 2026 Fernandito. Todos os direitos reservados.</p>
            <p>Feito com brio. Porto Alegre, RS.</p>
          </div>
        </div>

        {/* Botão circular — mesmo peso visual dos outros ícones redondos do
            site (cavalo do FloatingNav, moeda acima): antes era só um link
            de texto discreto, fácil de perder ao lado do bloco de
            copyright. */}
        <button
          type="button"
          onClick={() => scrollToTarget("#hero")}
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
          className="border-fernandito-off-white/25 text-fernandito-off-white/80 duration-base ease-out-standard hover:border-fernandito-off-white/50 hover:text-fernandito-off-white hover:bg-fernandito-off-white/5 focus-visible:outline-fernandito-off-white flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all hover:scale-105 focus-visible:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <TopoIcon />
        </button>
      </div>
    </footer>
  );
}

export default FooterSection;
