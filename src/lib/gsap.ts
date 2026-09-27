"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";

let registered = false;

// Nomes de ease compartilhados entre GSAP e Tailwind (ver DESIGN_SYSTEM.md
// "## Interação") — os mesmos cubic-bezier dos tokens `ease-out-standard`
// etc., pra que uma transição CSS e uma tween GSAP no mesmo componente
// pareçam a mesma curva.
export const EASE = {
  outStandard: "out-standard",
  outBack: "out-back",
  inOutSmooth: "in-out-smooth",
} as const;

// A mesma `out-standard` como array, pro framer-motion (FloatingNav).
export const EASE_BEZIER = {
  outStandard: [0.22, 1, 0.36, 1],
} as const;

// Segundos (GSAP). fast/base/slow espelham os tokens `duration-*` do
// Tailwind: base é todo hover e troca de estado; slow é o que tem peso
// físico (cartão levantando). `enter` é a entrada única de um bloco.
export const DURATION = {
  fast: 0.15,
  base: 0.3,
  slow: 0.5,
  enter: 0.7,
} as const;

// Tela de toque como ponteiro principal (celular, tablet). Avaliado no
// navegador (este módulo é client); no servidor fica false, mas lá nenhuma
// animação roda.
export const IS_TOUCH =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

// Atraso (s) com que uma animação presa à rolagem alcança a posição da
// rolagem. tight: texto e detalhes que têm que responder na hora
// (máquina de escrever, carimbo). base: blocos entrando. soft: objetos
// grandes com "peso" (galeria saindo, cartão do Manifesto).
// No toque o atraso é quase zero: a rolagem do dedo já tem inércia própria
// e um atraso por cima vira elástico (a animação seguia andando ~0,8s
// depois que o dedo e a inércia já tinham parado). No mouse o atraso é o
// que esconde os "degraus" da roda.
export const SCRUB = IS_TOUCH
  ? { tight: 0.1, base: 0.15, soft: 0.2 }
  : { tight: 0.4, base: 0.6, soft: 0.8 };

/**
 * Registers GSAP plugins exactly once on the client.
 * SplitText e CustomEase vêm grátis desde o gsap 3.13+ (sem Club GreenSock).
 */
export function registerGsapPlugins() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  // A barra de endereço do celular muda a altura da tela a cada rolagem;
  // recalcular tudo nisso dava pulos no meio do gesto.
  ScrollTrigger.config({ ignoreMobileResize: true });
  CustomEase.create(EASE.outStandard, "0.22, 1, 0.36, 1");
  CustomEase.create(EASE.outBack, "0.34, 1.56, 0.64, 1");
  CustomEase.create(EASE.inOutSmooth, "0.65, 0, 0.35, 1");
  registered = true;
}

// Registered eagerly at module evaluation (not inside a useEffect) so any
// component's own mount-time effect can rely on ScrollTrigger/SplitText
// being ready regardless of React's child-before-parent effect ordering.
registerGsapPlugins();

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function supportsHover() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover)").matches;
}

export { gsap, ScrollTrigger, SplitText };
