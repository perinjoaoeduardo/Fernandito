"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { curtainNavigate } from "@/lib/page-transition";
import { useStock } from "@/components/cart/useStock";
import { motion, AnimatePresence } from "framer-motion";
import { backgroundAt } from "@/lib/background";
import { DURATION, EASE_BEZIER, IS_TOUCH } from "@/lib/gsap";
import { teleportToTop } from "@/lib/lenis";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { Link } from "@/components/ui/Link";
import { CartIcon, InstagramIcon } from "@/components/ui/icons";
import { useCart } from "@/components/cart/CartProvider";
import { useGoToShop } from "@/components/cart/useGoToShop";
import { LINKS as SITE_LINKS, NAV, PRELAUNCH, STORE } from "@/content/site";

// Menu das PÁGINAS (Manifesto · Eventos · Revenda · Contato — máx. 4, regra
// da navegação). O cavalo (início) mora fora da barra, no canto. No
// pré-lançamento as páginas não existem: o menu fica só com o essencial.
const LINKS = PRELAUNCH.enabled ? [] : NAV.links;
const MENU_LINKS = LINKS;

// Ponto de amostragem fixo (canto esquerdo, fora da pill que fica centrada)
// — assim a amostra sempre pega o fundo da SEÇÃO por trás do nav, nunca o
// próprio nav (ver `backgroundAt`).
// Com a faixa "Estamos chegando" no topo, a amostra desce junto com a nav.
const PROBE_X = 12;
const PROBE_Y = 40;
const probeY = () =>
  PROBE_Y +
  (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--announcement-h")) ||
    0);

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
  const cart = useCart();
  const goToShop = useGoToShop();
  const { soldOut } = useStock();
  // No checkout e nas telas do pedido a pessoa já está comprando: sem CTA.
  const pathname = usePathname();
  const inPurchase = pathname.startsWith("/checkout") || pathname.startsWith("/pedido");

  const router = useRouter();
  const handleHorseClick = () => {
    // Fora da home o cavalo é o "voltar pro início".
    if (window.location.pathname !== "/") {
      curtainNavigate(() => router.push("/"));
      return;
    }
    teleportToTop();
  };

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

        const sampled = backgroundAt(PROBE_X, probeY());
        if (sampled) setOverLight(sampled.light);

        ticking = false;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Trocou de página: o menu do celular fecha (garantia além do clique no link).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reage à troca de rota
    setMenuOpen(false);
  }, [pathname]);

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
  // No toque a pill não tem desfoque (backdrop-blur por cima das fotos da
  // Hero se mexendo pesava no celular), então no topo ela fica mais opaca
  // pra continuar legível.
  const restAlpha = IS_TOUCH ? 0.94 : 0.88;
  const pillAnimation = {
    backgroundColor: overLight
      ? scrolled
        ? "rgba(36, 48, 34, 0.95)"
        : `rgba(36, 48, 34, ${restAlpha})`
      : scrolled
        ? "rgba(230, 230, 203, 0.95)"
        : `rgba(230, 230, 203, ${restAlpha})`,
  };
  const pillTransition = { duration: DURATION.base, ease: EASE_BEZIER.outStandard };

  // Com o menu do celular aberto a nav nunca se recolhe (o "Fechar" mora nela).
  const hidden = tucked && !menuOpen;

  // Cores da barra: sobre fundo claro ela é verde-escura (conteúdo claro);
  // sobre fundo escuro, off-white (conteúdo verde-escuro). O CTA sempre
  // contrasta com a barra: claro na barra escura, escuro na barra clara.
  const ink = overLight ? "text-fernandito-off-white" : "text-fernandito-verde-escuro";
  const iconButton = clsx(
    "duration-base ease-out-standard focus-visible:outline-fernandito-verde-medio relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    ink,
    overLight ? "hover:bg-fernandito-off-white/[0.07]" : "hover:bg-fernandito-verde-escuro/[0.06]",
  );

  // Página "em breve" (sem convite): sem menu nem loja.
  if (pathname === "/em-breve") return null;

  return (
    <>
      {/* Cavalo + barra lado a lado, centralizados: o cavalo é uma peça
          própria (fora da barra), encostado nela. */}
      <div
        className={clsx(
          "fixed top-[calc(1rem+var(--announcement-h))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 sm:top-[calc(1.5rem+var(--announcement-h))]",
          hidden && "pointer-events-none",
        )}
      >
        {/* Cavalo — sempre volta pro início (na home, pro topo). Sobe e desce
          junto com a barra. */}
        <motion.button
          type="button"
          onClick={handleHorseClick}
          aria-label={pathname === "/" ? "Voltar ao topo" : "Voltar pro início"}
          initial={{ opacity: 0, y: -16 }}
          animate={!visible ? {} : hidden ? { opacity: 0, y: "-160%" } : { opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE_BEZIER.outStandard }}
          className="focus-visible:outline-fernandito-verde-medio flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-[0_12px_32px_rgba(20,28,18,0.32)] transition-[scale] duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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

        {/* Barra única (computador e celular): cavalo · CTA · Instagram ·
          carrinho (· menu no celular), tudo num container só — antes eram
          peças soltas. */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={
            !visible
              ? {}
              : hidden
                ? { opacity: 0, y: "-160%", ...pillAnimation }
                : { opacity: 1, y: 0, ...pillAnimation }
          }
          transition={{
            duration: DURATION.slow,
            ease: EASE_BEZIER.outStandard,
            backgroundColor: pillTransition,
          }}
          // Foco de teclado entrando na nav traz ela de volta.
          onFocus={() => setTucked(false)}
          className={clsx(
            // `--announcement-h`: altura da faixa "Estamos chegando" (0 sem ela).
            "flex items-center gap-1 rounded-full p-1.5 shadow-[0_12px_32px_rgba(20,28,18,0.28)] ring-1 pointer-fine:backdrop-blur-md",
            overLight ? "ring-fernandito-off-white/10" : "ring-fernandito-verde-escuro/10",
            hidden && "pointer-events-none",
          )}
          aria-label="Navegação principal"
        >
          {/* Páginas (site completo, md+). */}
          {LINKS.length > 0 && (
            // Mesma altura (h-11) e o mesmo fundo de hover do carrinho: todas
            // as peças da barra são pílulas iguais, a 6px da borda. Hover é
            // mais leve que a página atual (que ainda ganha negrito).
            <div className="hidden items-center gap-1 md:flex">
              {LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  variant="none"
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={clsx(
                    "text-label duration-base ease-out-standard flex h-11 items-center rounded-full px-4 font-sans tracking-[0.08em] whitespace-nowrap uppercase transition-colors",
                    ink,
                    overLight
                      ? "hover:bg-fernandito-off-white/[0.07]"
                      : "hover:bg-fernandito-verde-escuro/[0.06]",
                    pathname === link.href &&
                      (overLight
                        ? "bg-fernandito-off-white/12 font-bold"
                        : "bg-fernandito-verde-escuro/10 font-bold"),
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* CTA: compra (loja ligada) ou WhatsApp (loja desligada, md+). */}
          {inPurchase ? null : STORE.enabled ? (
            <button
              type="button"
              onClick={goToShop}
              className={clsx(
                "duration-base ease-out-standard focus-visible:outline-fernandito-verde-medio flex h-11 items-center rounded-full px-5 font-sans text-[0.8125rem] font-bold tracking-[0.06em] whitespace-nowrap uppercase transition-[background-color,color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]",
                overLight
                  ? "bg-fernandito-off-white text-fernandito-verde-escuro hover:bg-fernandito-verde-claro hover:text-fernandito-off-white"
                  : "bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio",
              )}
            >
              {soldOut ? STORE.notifyNavCta : STORE.navCta}
            </button>
          ) : (
            <WhatsAppButton
              background={overLight ? "verde-medio" : "verde-escuro"}
              className="!text-label ml-1 hidden !px-4 !py-2 whitespace-nowrap md:inline-flex"
            >
              {NAV.whatsappLabel}
            </WhatsAppButton>
          )}

          <span
            aria-hidden="true"
            data-cart-ui
            className={clsx(
              "mx-1.5 h-6 w-px",
              overLight ? "bg-fernandito-off-white/20" : "bg-fernandito-verde-escuro/20",
            )}
          />

          {/* Carrinho, com contador. */}
          {STORE.enabled && (
            <button
              type="button"
              data-cart-ui
              onClick={cart.open}
              aria-label={
                cart.count
                  ? `Abrir carrinho (${cart.count} ${cart.count === 1 ? "item" : "itens"})`
                  : "Abrir carrinho"
              }
              className={iconButton}
            >
              <CartIcon className="h-[20px] w-[20px]" />
              {cart.count > 0 && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    "bg-fernandito-verde-claro text-fernandito-off-white absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-sans text-[10px] leading-none font-bold ring-2",
                    overLight ? "ring-fernandito-verde-escuro" : "ring-fernandito-off-white",
                  )}
                >
                  {cart.count}
                </span>
              )}
            </button>
          )}

          {/* Menu (celular): ícone que vira × com o overlay aberto. */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            className={clsx(iconButton, "md:hidden")}
          >
            {/* 3 traços de 2px em posições inteiras (0, 6 e 12px): com 1,5px
                e meio-pixel de posição, cada traço borrava diferente. */}
            <span aria-hidden="true" className="relative block h-[14px] w-5">
              <span
                className={clsx(
                  "duration-base ease-out-standard absolute top-0 left-0 h-[2px] w-full rounded-full bg-current transition-transform",
                  menuOpen && "translate-y-[6px] rotate-45",
                )}
              />
              <span
                className={clsx(
                  "duration-base ease-out-standard absolute top-[6px] left-0 h-[2px] w-full rounded-full bg-current transition-opacity",
                  menuOpen && "opacity-0",
                )}
              />
              <span
                className={clsx(
                  "duration-base ease-out-standard absolute top-[12px] left-0 h-[2px] w-full rounded-full bg-current transition-transform",
                  menuOpen && "-translate-y-[6px] -rotate-45",
                )}
              />
            </span>
          </button>
        </motion.div>
      </div>

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
            {MENU_LINKS.length > 0 && (
              <nav aria-label="Menu" className="flex flex-col items-center gap-7">
                {MENU_LINKS.map((link) => (
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
            )}

            {/* Fundo padrão (verde-medio) aqui — o overlay já é verde-escuro,
                então o CTA "verde-escuro" do pill ficaria invisível contra ele. */}
            <div className="flex flex-col items-center gap-4">
              {/* A compra já está na barra ("Comprar") e a conversa no link
                  "Contato" (a tela do contato leva pro WhatsApp); aqui fica
                  só o Instagram, contornado. */}
              <a
                href={SITE_LINKS.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${SITE_LINKS.instagramHandle} — seguir no Instagram, abre em nova aba`}
                className="border-fernandito-off-white/40 text-fernandito-off-white text-body active:bg-fernandito-off-white/10 focus-visible:outline-fernandito-off-white inline-flex w-64 items-center justify-center gap-2 rounded-full border px-6 py-3 font-sans transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <InstagramIcon />
                {SITE_LINKS.instagramHandle}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingNav;
