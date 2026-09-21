"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";

// "Onde encontrar" e "Contato" apontam para a mesma seção (CTASection) por
// enquanto — não há um bloco de contato dedicado nesta fundação.
const LINKS = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "Produto", href: "#produto" },
  { label: "Onde encontrar", href: "#onde-encontrar" },
  { label: "Contato", href: "#onde-encontrar" },
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

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-4 left-1/2 z-50 -translate-x-1/2 sm:top-6"
      aria-label="Navegação principal"
    >
      <motion.div
        animate={{
          scale: shrunk ? 0.95 : 1,
          backgroundColor: shrunk ? "rgba(36, 48, 34, 0.9)" : "rgba(36, 48, 34, 0.6)",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="rounded-full px-2 py-2 backdrop-blur-md sm:px-3"
      >
        {/* Desktop links */}
        <ul className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="text-label text-fernandito-off-white block rounded-full px-4 py-2 font-sans tracking-[0.08em] uppercase transition-opacity hover:opacity-70"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-full sm:hidden"
        >
          <span
            className={clsx(
              "bg-fernandito-off-white h-[1.5px] w-4 transition-transform duration-200",
              menuOpen && "translate-y-[3.5px] rotate-45",
            )}
          />
          <span
            className={clsx(
              "bg-fernandito-off-white h-[1.5px] w-4 transition-transform duration-200",
              menuOpen && "-translate-y-[3.5px] -rotate-45",
            )}
          />
        </button>
      </motion.div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-1/2 mt-2 w-max -translate-x-1/2 rounded-lg bg-[rgba(36,48,34,0.95)] p-2 backdrop-blur-md sm:hidden"
          >
            <ul className="flex flex-col items-stretch gap-1">
              {LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="text-label text-fernandito-off-white block rounded-md px-4 py-2 text-center font-sans tracking-[0.08em] uppercase transition-opacity hover:opacity-70"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
