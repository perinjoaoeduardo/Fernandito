"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "@/lib/gsap";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { SvgPlaceholder } from "@/components/ui/SvgPlaceholder";
import { Link } from "@/components/ui/Link";

const NAV_LINKS = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "Produto", href: "#produto" },
  { label: "Onde encontrar", href: "#onde-encontrar" },
];

const LEGAL_LINES = [
  "Contém glúten",
  "Venda proibida para menores de 18 anos",
  "Registro MAPA RS 002594-1.000127",
];

// Footer é fundo escuro (verde-escuro) — outline de foco precisa contrastar
// com isso, não com o verde-medio padrão do Link (pensado pra fundos claros).
const FOOTER_LINK_CLASSES =
  "text-fernandito-off-white/85 text-body font-sans !outline-fernandito-off-white";

export function FooterSection() {
  const footerRef = useRef<HTMLElement>(null);
  const cornerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const line1Ref = useRef<HTMLHeadingElement>(null);
  const line2Ref = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const footer = footerRef.current;
    const line1 = line1Ref.current;
    const line2 = line2Ref.current;
    const tagline = taglineRef.current;
    const corners = cornerRefs.current.filter((el): el is HTMLSpanElement => Boolean(el));
    if (!footer || !line1 || !line2 || !tagline) return;

    const reduceMotion = prefersReducedMotion();

    // Split as duas linhas por palavra. SplitText é gratuito desde o gsap
    // 3.13 (sem Club GreenSock) — fallback abaixo só por segurança.
    const splitInstances: SplitText[] = [];
    let words: Element[] = [];
    try {
      const split1 = new SplitText(line1, { type: "words" });
      const split2 = new SplitText(line2, { type: "words" });
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
          span.textContent = idx < tokens.length - 1 ? `${word}\u00A0` : word;
          span.style.display = "inline-block";
          line.appendChild(span);
          words.push(span);
        });
      });
    }

    if (reduceMotion) {
      gsap.set(corners, { opacity: 0.6, x: 0, y: 0 });
      gsap.set(words, { opacity: 1, y: 0 });
      gsap.set(tagline, { opacity: 1, y: 0 });
    } else {
      // Cada canto entra pela direção do seu próprio lado.
      corners.forEach((corner) => {
        const axis = corner.dataset.axis === "x" ? "x" : "y";
        const from = Number(corner.dataset.from ?? -20);
        gsap.set(corner, { opacity: 0, [axis]: from });
      });
      gsap.set(words, { opacity: 0, y: 40 });
      gsap.set(tagline, { opacity: 0, y: 20 });
    }

    let tl: gsap.core.Timeline | null = null;
    let trigger: ScrollTrigger | null = null;

    if (!reduceMotion) {
      tl = gsap.timeline({ paused: true });

      corners.forEach((corner, i) => {
        const axis = corner.dataset.axis === "x" ? "x" : "y";
        tl!.to(corner, { opacity: 0.6, [axis]: 0, duration: 0.6, ease: "power2.out" }, i * 0.1);
      });

      tl.to(words, { opacity: 1, y: 0, duration: 0.7, stagger: 0.04, ease: "power3.out" }, 0.15).to(
        tagline,
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
        "-=0.2",
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
      className="bg-fernandito-verde-escuro text-fernandito-off-white relative flex min-h-[90vh] flex-col overflow-hidden px-6 py-16 sm:px-10 lg:min-h-[90vh] lg:px-16"
    >
      {/* Grain sutil de fundo — puro CSS/SVG, sem canvas. */}
      <div className="footer-grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay" />

      {/* Camada 1 — labels soltos nos cantos, ruído tipográfico editorial */}
      <span
        ref={(el) => {
          cornerRefs.current[0] = el;
        }}
        data-axis="y"
        data-from="-20"
        aria-hidden="true"
        className="text-label absolute top-6 left-6 hidden font-sans tracking-[0.15em] uppercase opacity-60 sm:top-10 sm:left-10 sm:block"
      >
        Feito no Rio Grande do Sul
      </span>
      <span
        ref={(el) => {
          cornerRefs.current[1] = el;
        }}
        data-axis="y"
        data-from="-20"
        aria-hidden="true"
        className="text-label absolute top-6 right-6 hidden font-sans tracking-[0.15em] uppercase opacity-60 sm:top-10 sm:right-10 sm:block"
      >
        Indústria brasileira
      </span>
      <span
        ref={(el) => {
          cornerRefs.current[2] = el;
        }}
        data-axis="x"
        data-from="-20"
        aria-hidden="true"
        className="text-label absolute top-1/2 left-4 hidden -translate-y-1/2 -rotate-90 font-sans tracking-[0.15em] uppercase opacity-60 sm:block"
      >
        Fernet y cola
      </span>
      <span
        ref={(el) => {
          cornerRefs.current[3] = el;
        }}
        data-axis="x"
        data-from="20"
        aria-hidden="true"
        className="text-label absolute top-1/2 right-4 hidden -translate-y-1/2 rotate-90 font-sans tracking-[0.15em] uppercase opacity-60 sm:block"
      >
        350ml — 8%
      </span>

      {/* Camada 2 — frase de fechamento */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-16 text-left">
        <h2 className="flex flex-col">
          <span ref={line1Ref} className="text-display-xl font-serif leading-[0.95] font-bold">
            Pra quem não deixa passar,
          </span>
          <span ref={line2Ref} className="text-display-xl font-serif leading-[0.95] italic">
            vira história.
          </span>
        </h2>
        <p ref={taglineRef} className="text-display-md text-fernandito-verde-claro mt-10 font-sans">
          Isso toma fernandito.
        </p>

        {/* Camada 4 — CTA WhatsApp */}
        <div className="mt-12">
          <WhatsAppButton className="w-full sm:w-auto">Fale no WhatsApp</WhatsAppButton>
        </div>
      </div>

      {/* Camada 3 — navegação em colunas */}
      <div className="relative mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 border-t border-white/10 py-12 sm:grid-cols-3">
        <div>
          <h3 className="text-label mb-4 font-sans tracking-[0.08em] uppercase opacity-50">
            Navegar
          </h3>
          <ul className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} variant="underline-swap" className={FOOTER_LINK_CLASSES}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-label mb-4 font-sans tracking-[0.08em] uppercase opacity-50">
            Social
          </h3>
          <ul className="flex flex-col gap-3">
            <li>
              <Link
                href="https://www.instagram.com/toma.fernandito/"
                target="_blank"
                rel="noopener noreferrer"
                variant="underline-swap"
                className={FOOTER_LINK_CLASSES}
              >
                Instagram
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-label mb-4 font-sans tracking-[0.08em] uppercase opacity-50">
            Legal
          </h3>
          <ul className="flex flex-col gap-3">
            {LEGAL_LINES.map((line) => (
              <li key={line} className="text-body text-fernandito-off-white/85 font-sans">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Camada 5 — base do footer */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-4 border-t border-white/10 pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <SvgPlaceholder
          label="CAVALO"
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-full text-[6px] opacity-70"
        />
        <div className="font-sans text-[13px] opacity-70 sm:text-sm">
          <p>© 2026 Fernandito. Todos os direitos reservados.</p>
          <p>Feito com brio. Porto Alegre, RS.</p>
        </div>
      </div>
    </footer>
  );
}

export default FooterSection;
