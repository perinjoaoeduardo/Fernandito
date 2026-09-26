"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { backgroundAt } from "@/lib/background";
import { DURATION, EASE_BEZIER } from "@/lib/gsap";
import { scrollToTarget } from "@/lib/lenis";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { Link } from "@/components/ui/Link";
import { NAV } from "@/content/site";

// Site de página única: a nav é navegação por âncora pros "andares" da
// página. O contato não entra como link na pill — o botão de WhatsApp ao
// lado já é esse atalho (no menu mobile ele aparece).
const LINKS = NAV.links;

// Ponto de amostragem fixo (canto esquerdo, fora da pill que fica centrada)
// — assim a amostra sempre pega o fundo da SEÇÃO por trás do nav, nunca o
// próprio nav (ver `backgroundAt`).
const PROBE_X = 12;
const PROBE_Y = 40;

// Abaixo disso (px) a nav nunca se recolhe — na Hero ela é parte da capa.
const TUCK_AFTER = 160;

export function FloatingNav() {
  const [visible, setVisible] = useState(false);
  // `scrolled`: saiu do topo (pill mais opaca). `tucked`: recolhida pra cima
  // porque a pessoa está descendo — volta assim que ela sobe um pouco.
  const [scrolled, setScrolled] = useState(false);
  const [tucked, setTucked] = useState(false);
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

        setScrolled(currentY > 80);
        if (currentY < TUCK_AFTER) {
          setTucked(false);
          lastScrollY.current = currentY;
        } else if (Math.abs(delta) > 6) {
          setTucked(delta > 0);
          lastScrollY.current = currentY;
        }

        const sampled = backgroundAt(PROBE_X, PROBE_Y);
        if (sampled) setOverLight(sampled.light);

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
  // claro/off-white. Fora do topo ela fica mais opaca, pra ler por cima
  // de qualquer conteúdo.
  const pillAnimation = {
    backgroundColor: overLight
      ? scrolled
        ? "rgba(36, 48, 34, 0.95)"
        : "rgba(36, 48, 34, 0.7)"
      : scrolled
        ? "rgba(230, 230, 203, 0.95)"
        : "rgba(230, 230, 203, 0.7)",
  };
  const pillTransition = { duration: DURATION.base, ease: EASE_BEZIER.outStandard };

  // Com o menu do celular aberto a nav nunca se recolhe (o "Fechar" mora nela).
  const hidden = tucked && !menuOpen;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={!visible ? {} : hidden ? { opacity: 0, y: "-160%" } : { opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow, ease: EASE_BEZIER.outStandard }}
        // Foco de teclado entrando na nav traz ela de volta.
        onFocus={() => setTucked(false)}
        className={clsx(
          "fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 sm:top-6",
          hidden && "pointer-events-none",
        )}
        aria-label="Navegação principal"
      >
        {/* Pill 1 — símbolo do cavalo, volta ao topo (todos os tamanhos) */}
        <motion.button
          type="button"
          animate={pillAnimation}
          transition={pillTransition}
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
          transition={pillTransition}
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
          transition={pillTransition}
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
            {NAV.whatsappLabel}
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
            transition={{ duration: DURATION.base, ease: EASE_BEZIER.outStandard }}
            id="menu-mobile"
            className="bg-fernandito-verde-escuro fixed inset-0 z-40 flex flex-col items-center justify-center gap-10 md:hidden"
          >
            {/* Fechar é o próprio pill "Menu" (vira "Fechar", fica por cima
                do overlay) + Esc — sem um × separado competindo com ele. */}
            {/* Títulos grandes na Rampart (fonte de título do site). */}
            <nav aria-label="Menu" className="flex flex-col items-center gap-7">
              {[...LINKS, NAV.contactLink].map((link) => (
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
            <WhatsAppButton>{NAV.whatsappLabel}</WhatsAppButton>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingNav;
