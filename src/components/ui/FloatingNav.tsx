"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { scrollToTarget } from "@/lib/lenis";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { Link } from "@/components/ui/Link";

// Site de página única: a nav é navegação por âncora pros "andares" da
// página. O contato não entra como link na pill — o botão de WhatsApp ao
// lado já é esse atalho (no menu mobile ele aparece).
const LINKS = [
  { label: "O que é", href: "#o-que-e" },
  { label: "Galeria", href: "#galeria" },
  { label: "Manifesto", href: "#manifesto" },
];

// Ponto de amostragem fixo (canto esquerdo, fora da pill que fica centrada)
// — assim `elementFromPoint` sempre pega o fundo da SEÇÃO por trás do nav,
// nunca o próprio nav. Funciona pra qualquer seção presente ou futura, sem
// precisar marcar cada uma manualmente com um data-attribute: a gente lê a
// cor de fundo computada de verdade e decide clara/escura pela luminância.
const PROBE_X = 12;
const PROBE_Y = 40;
const LIGHT_LUMINANCE_THRESHOLD = 150;

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Sobe a árvore a partir do ponto amostrado até achar um background-color
 * não-transparente — a maioria dos wrappers internos não define bg próprio. */
function sampleIsOverLight(): boolean | null {
  const el = document.elementFromPoint(PROBE_X, PROBE_Y);
  let node: Element | null = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const [, r, g, b] = match;
      const alpha = bg.match(/[\d.]+\)$/)?.[0];
      // Ignora transparente total (rgba(0,0,0,0)) — continua subindo.
      if (!(alpha === "0)" && r === "0" && g === "0" && b === "0")) {
        return luminance(Number(r), Number(g), Number(b)) > LIGHT_LUMINANCE_THRESHOLD;
      }
    }
    node = node.parentElement;
  }
  return null;
}

export function FloatingNav() {
  const [visible, setVisible] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  const [overLight, setOverLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        if (Math.abs(delta) > 4) {
          setShrunk(delta > 0 && currentY > 80);
          lastScrollY.current = currentY;
        }

        const isLight = sampleIsOverLight();
        if (isLight !== null) setOverLight(isLight);

        ticking = false;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fecha o overlay mobile com Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // Cor do fundo por trás do nav decide o tom da pill — clara (off-white,
  // padrão) sobre fundo escuro/verde, escura (verde-escuro) sobre fundo
  // claro/off-white, sempre com a mesma transição suave do "shrunk".
  const pillAnimation = {
    scale: shrunk ? 0.95 : 1,
    backgroundColor: overLight
      ? shrunk
        ? "rgba(36, 48, 34, 0.95)"
        : "rgba(36, 48, 34, 0.7)"
      : shrunk
        ? "rgba(230, 230, 203, 0.95)"
        : "rgba(230, 230, 203, 0.7)",
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 sm:top-6"
        aria-label="Navegação principal"
      >
        {/* Pill 1 — símbolo do cavalo, volta ao topo (todos os tamanhos) */}
        <motion.button
          type="button"
          animate={pillAnimation}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={() => scrollToTarget("#hero")}
          aria-label="Voltar ao topo"
          className="duration-base ease-out-standard focus-visible:outline-fernandito-verde-medio flex h-11 w-11 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- raster estático de tamanho fixo, next/image não traz benefício */}
          <img
            src="/logo/fernandito-horse.webp"
            alt=""
            width={128}
            height={129}
            decoding="async"
            className="h-full w-full rounded-full"
          />
        </motion.button>

        {/* Pill 2 (mobile/tablet) — botão "Menu" explícito: antes o próprio
            cavalo abria o menu, e ninguém adivinhava isso. */}
        <motion.button
          type="button"
          animate={pillAnimation}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="menu-mobile"
          className={clsx(
            "text-label duration-base ease-out-standard focus-visible:outline-fernandito-verde-medio flex h-11 items-center gap-2 rounded-full px-5 font-sans tracking-[0.12em] whitespace-nowrap uppercase backdrop-blur-md transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:hidden",
            overLight ? "text-fernandito-off-white" : "text-fernandito-verde-escuro",
          )}
        >
          <span aria-hidden="true" className="flex w-4 flex-col gap-[3px]">
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
            <span className="h-px w-2/3 bg-current" />
          </span>
          {menuOpen ? "Fechar" : "Menu"}
        </motion.button>

        {/* Pill 2 (md+) — links + CTA WhatsApp em destaque. Só a partir de
            768px: abaixo disso não cabe sem quebrar os links em várias
            linhas (era o "O / QUE / É" empilhado no tablet). */}
        <motion.div
          animate={pillAnimation}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="hidden items-center gap-1 rounded-full py-1.5 pr-1.5 pl-3 backdrop-blur-md md:flex lg:py-2 lg:pr-2 lg:pl-4"
        >
          {LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={clsx(
                "text-label duration-base ease-out-standard rounded-full px-3 py-2 font-sans tracking-[0.08em] whitespace-nowrap uppercase transition-colors lg:px-4",
                overLight ? "text-fernandito-off-white" : "text-fernandito-verde-escuro",
              )}
            >
              {link.label}
            </Link>
          ))}
          {/* Sempre verde-escuro aqui, mesmo quando a pill inverte (fica
              clara sobre fundo claro) — a borda sutil do WhatsAppButton
              garante que ele continue legível como forma própria. */}
          <WhatsAppButton
            background="verde-escuro"
            className="!text-label ml-1 !px-4 !py-2 whitespace-nowrap"
          >
            Fale no WhatsApp
          </WhatsAppButton>
        </motion.div>
      </motion.div>

      {/* Overlay fullscreen (mobile) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            id="menu-mobile"
            className="bg-fernandito-verde-escuro fixed inset-0 z-40 flex flex-col items-center justify-center gap-10 md:hidden"
          >
            {/* Fechar é o próprio pill "Menu" (vira "Fechar", fica por cima
                do overlay) + Esc — sem um × separado competindo com ele. */}
            {/* Títulos grandes na Rampart (fonte de título do site). */}
            <nav aria-label="Menu" className="flex flex-col items-center gap-7">
              {[...LINKS, { label: "Contato", href: "#contato" }].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-fernandito-off-white text-display-md !outline-fernandito-off-white font-rampart tracking-[0.02em] whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Fundo padrão (verde-medio) aqui — o overlay já é verde-escuro,
                então o CTA "verde-escuro" do pill ficaria invisível contra ele. */}
            <WhatsAppButton>Fale no WhatsApp</WhatsAppButton>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingNav;
