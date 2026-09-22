"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { scrollToTarget } from "@/lib/lenis";
import { SvgPlaceholder } from "@/components/ui/SvgPlaceholder";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { Link } from "@/components/ui/Link";

// "Onde encontrar" e "Contato" apontam para a mesma seção (CTASection) por
// enquanto — não há um bloco de contato dedicado nesta fundação.
const LINKS = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "Produto", href: "#produto" },
  { label: "Onde encontrar", href: "#onde-encontrar" },
];

export function FloatingNav() {
  const [visible, setVisible] = useState(false);
  const [shrunk, setShrunk] = useState(false);
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
        ticking = false;
      });
    };

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

  const pillAnimation = {
    scale: shrunk ? 0.95 : 1,
    backgroundColor: shrunk ? "rgba(230, 230, 203, 0.95)" : "rgba(230, 230, 203, 0.7)",
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
        {/* Pill 1 (desktop) — símbolo do cavalo, volta ao topo */}
        <motion.button
          type="button"
          animate={pillAnimation}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={() => scrollToTarget("#hero")}
          aria-label="Voltar ao topo"
          className="duration-base ease-out-standard focus-visible:outline-fernandito-verde-medio hidden h-11 w-11 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex"
        >
          <SvgPlaceholder
            label="CAVALO"
            className="text-fernandito-verde-escuro/70 h-7 w-7 rounded-full border text-[6px]"
          />
        </motion.button>

        {/* Pill 1 (mobile) — mesmo símbolo, vira gatilho do menu fullscreen */}
        <motion.button
          type="button"
          animate={pillAnimation}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          className="duration-base ease-out-standard focus-visible:outline-fernandito-verde-medio flex h-11 w-11 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:hidden"
        >
          <SvgPlaceholder
            label="CAVALO"
            className="text-fernandito-verde-escuro/70 h-7 w-7 rounded-full border text-[6px]"
          />
        </motion.button>

        {/* Pill 2 (desktop only) — links + CTA WhatsApp em destaque */}
        <motion.div
          animate={pillAnimation}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="hidden items-center gap-1 rounded-full py-2 pr-2 pl-4 backdrop-blur-md sm:flex"
        >
          {LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-label text-fernandito-verde-escuro rounded-full px-4 py-2 font-sans tracking-[0.08em] uppercase"
            >
              {link.label}
            </Link>
          ))}
          <WhatsAppButton background="verde-escuro" className="!text-label ml-1 !px-4 !py-2">
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
            className="bg-fernandito-verde-escuro fixed inset-0 z-40 flex flex-col items-center justify-center gap-10 sm:hidden"
          >
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
              className="text-fernandito-off-white duration-base ease-out-standard focus-visible:outline-fernandito-off-white absolute top-6 right-6 text-3xl leading-none transition-opacity hover:opacity-70 focus-visible:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              ×
            </button>

            <nav className="flex flex-col items-center gap-8">
              {LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-fernandito-off-white text-display-md !outline-fernandito-off-white font-serif"
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
