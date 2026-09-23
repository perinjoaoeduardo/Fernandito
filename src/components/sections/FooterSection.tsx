"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "@/lib/gsap";
import { scrollToTarget } from "@/lib/lenis";
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
  const footerRef = useRef<HTMLElement>(null);
  const line1Ref = useRef<HTMLHeadingElement>(null);
  const line2Ref = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const footer = footerRef.current;
    const line1 = line1Ref.current;
    const line2 = line2Ref.current;
    const tagline = taglineRef.current;
    if (!footer || !line1 || !line2 || !tagline) return;

    const reduceMotion = prefersReducedMotion();

    // Split as duas linhas por palavra. SplitText é gratuito desde o gsap
    // 3.13 (sem Club GreenSock) — fallback abaixo só por segurança.
    const splitInstances: SplitText[] = [];
    let words: Element[] = [];
    try {
      const split1 = new SplitText(line1, { type: "words", aria: "none" });
      const split2 = new SplitText(line2, { type: "words", aria: "none" });
      splitInstances.push(split1, split2);
      words = [...split1.words, ...split2.words];
    } catch (err) {
      console.warn("[FooterSection] SplitText indisponível, usando fallback manual.", err);
      [line1, line2].forEach((line) => {
        const text = line.textContent ?? "";
        line.innerHTML = "";
        const tokens = text.split(" ");
        tokens.forEach((word, idx) => {
          const span = document.createElement("span");
          span.textContent = idx < tokens.length - 1 ? `${word} ` : word;
          span.style.display = "inline-block";
          line.appendChild(span);
          words.push(span);
        });
      });
    }

    if (reduceMotion) {
      gsap.set(words, { opacity: 1, y: 0 });
      gsap.set(tagline, { opacity: 1, y: 0 });
    } else {
      gsap.set(words, { opacity: 0, y: 40 });
      gsap.set(tagline, { opacity: 0, y: 20 });
    }

    let tl: gsap.core.Timeline | null = null;
    let trigger: ScrollTrigger | null = null;

    if (!reduceMotion) {
      tl = gsap.timeline({ paused: true });
      tl.to(words, { opacity: 1, y: 0, duration: 0.7, stagger: 0.04, ease: "power3.out" }).to(
        tagline,
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
        "-=0.3",
      );

      trigger = ScrollTrigger.create({
        trigger: footer,
        start: "top 80%",
        once: true,
        onEnter: () => tl?.play(),
      });
    }

    return () => {
      trigger?.kill();
      tl?.kill();
      splitInstances.forEach((split) => split.revert());
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      id="footer"
      className="bg-fernandito-verde-escuro text-fernandito-off-white relative w-full px-6 py-14 sm:px-10 sm:py-16 lg:px-16"
    >
      <div className="mx-auto grid w-full max-w-5xl gap-12 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-12">
        {/* Frase de fechamento + CTA */}
        <div>
          {/* Rampart é só caixa-alta: o contraste entre as linhas vem da
              cor (off-white → verde-claro), não de itálico/peso. */}
          <h2 className="font-rampart text-display-sm flex flex-col gap-1 leading-[1.05] tracking-[0.01em]">
            <span ref={line1Ref}>Pra quem não deixa passar,</span>
            <span ref={line2Ref} className="text-fernandito-verde-claro">
              vira história.
            </span>
          </h2>
          <p ref={taglineRef} className="text-body font-accent mt-5 tracking-[0.04em] opacity-80">
            Isso toma fernandito.
          </p>
          <div className="mt-8">
            <WhatsAppButton>Fale no WhatsApp</WhatsAppButton>
          </div>
        </div>

        {/* Navegação em colunas — estilo compacto (Company/Socials da Lassie) */}
        <div className="grid grid-cols-2 gap-10 sm:gap-14">
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
        </div>
      </div>

      {/* Base do footer — moeda no lugar de um mascote/flor genérico + botão
          de voltar ao topo, igual ao rodapé enxuto da Lassie (sem o grain e
          sem o texto gigante de fundo: aqui embaixo entra um placeholder de
          imagem futuramente, por isso o fundo fica sólido). */}
      <div className="relative mx-auto mt-12 flex w-full max-w-5xl flex-col items-center gap-6 border-t border-white/10 pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
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
