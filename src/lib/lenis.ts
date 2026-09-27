"use client";

import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

let lenisInstance: Lenis | null = null;

/**
 * Creates a Lenis instance and syncs it to the GSAP ticker, so ScrollTrigger
 * and the smooth scroll share a single rAF clock. Returns a cleanup fn.
 */
export function initLenis() {
  const lenis = new Lenis({
    autoRaf: false,
  });
  lenisInstance = lenis;

  lenis.on("scroll", ScrollTrigger.update);

  const tick = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(tick);
    lenis.destroy();
    lenisInstance = null;
  };
}

/** Instância ativa do Lenis, se o smooth scroll estiver rodando (null sob
 * prefers-reduced-motion, quando o SmoothScrollProvider nunca a cria). */
export function getLenis() {
  return lenisInstance;
}

/** Scroll suave (via Lenis quando disponível) até um seletor/elemento. */
export function scrollToTarget(target: string) {
  const lenis = getLenis();
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.2 });
    return;
  }
  document.querySelector(target)?.scrollIntoView();
}

let teleporting = false;

/**
 * "Voltar ao topo" sem atravessar a página: uma cortina verde-medio sobe
 * e cobre a tela, a página pula pro topo por trás dela e a cortina continua
 * subindo, revelando a Hero. Rolar suave até o topo passava por todas as
 * seções (galeria, manifesto...) no caminho. Sob reduced motion, pulo seco.
 */
export function teleportToTop() {
  teleportTo(0);
}

/** Mesmo teletransporte, pra uma âncora (links do menu e do rodapé). */
export function teleportTo(target: string | 0) {
  if (teleporting) return;
  const lenis = getLenis();
  const element = target === 0 ? null : document.querySelector<HTMLElement>(target);
  if (target !== 0 && !element) return;
  const destination = () => (element ? element.getBoundingClientRect().top + window.scrollY : 0);
  const jump = () => {
    const y = destination();
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
    ScrollTrigger.update();
    // Animações presas à rolagem chegam no lugar na hora, sem "correr"
    // atrás da posição nova depois que a cortina abre.
    // (Nem todo gatilho tem uma tween de scrub com `progress`.)
    ScrollTrigger.getAll().forEach((trigger) => {
      const tween = trigger.getTween?.() as gsap.core.Tween | undefined;
      if (tween && typeof tween.progress === "function") tween.progress(1);
    });
  };

  if (prefersReducedMotion() || Math.abs(window.scrollY - destination()) < 8) {
    jump();
    return;
  }

  teleporting = true;
  const curtain = document.createElement("div");
  curtain.setAttribute("aria-hidden", "true");
  curtain.style.cssText =
    "position:fixed;inset:0;z-index:90;background:#405139;pointer-events:none;will-change:transform";
  document.body.appendChild(curtain);

  gsap
    .timeline({
      onComplete: () => {
        curtain.remove();
        teleporting = false;
      },
    })
    .fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.35, ease: "power2.in" })
    .add(jump)
    .to(curtain, { yPercent: -100, duration: 0.55, ease: "power3.out" }, "+=0.08");
}
