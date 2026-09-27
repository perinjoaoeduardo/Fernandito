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
 * "Voltar ao topo" sem atravessar a página: a página rola um pouco rumo ao
 * destino enquanto uma cortina verde-medio sobe e cobre a tela; por trás
 * dela, pula pra perto do destino; a cortina segue subindo e a página
 * termina de rolar os últimos metros até ele. Rolar suave o caminho todo
 * passava por todas as seções (galeria, manifesto...). Sob reduced motion,
 * pulo seco.
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
  const settle = () => {
    // Animações presas à rolagem chegam no lugar na hora, sem "correr"
    // atrás da posição nova depois que a cortina abre. (Nem todo gatilho
    // tem uma tween de scrub com `progress`.)
    ScrollTrigger.update();
    ScrollTrigger.getAll().forEach((trigger) => {
      const tween = trigger.getTween?.() as gsap.core.Tween | undefined;
      if (tween && typeof tween.progress === "function") tween.progress(1);
    });
  };

  const goal = destination();
  if (prefersReducedMotion() || !lenis || Math.abs(window.scrollY - goal) < 8) {
    if (lenis) lenis.scrollTo(goal, { immediate: true, force: true });
    else window.scrollTo(0, goal);
    settle();
    return;
  }

  // A página também anda um pouco no sentido da viagem, dos dois lados da
  // cortina: sai rolando uns 18% de tela e chega rolando os últimos 18%.
  // Sente que foi pra lá, sem mostrar tudo passando no caminho.
  const nudge = window.innerHeight * 0.18;
  const dir = goal < window.scrollY ? -1 : 1;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const clamp = (y: number) => Math.min(maxScroll, Math.max(0, y));

  teleporting = true;
  const curtain = document.createElement("div");
  curtain.setAttribute("aria-hidden", "true");
  curtain.style.cssText =
    "position:fixed;inset:0;z-index:90;background:#405139;pointer-events:none;will-change:transform";
  document.body.appendChild(curtain);

  lenis.scrollTo(clamp(window.scrollY + dir * nudge), { duration: 0.45, force: true });
  gsap
    .timeline({
      onComplete: () => {
        curtain.remove();
        teleporting = false;
      },
    })
    .fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.35, ease: "power2.in" })
    .add(() => {
      const end = destination();
      lenis.scrollTo(clamp(end - dir * nudge), { immediate: true, force: true });
      settle();
      lenis.scrollTo(end, { duration: 0.6, force: true, easing: (t) => 1 - Math.pow(1 - t, 3) });
    })
    .to(curtain, { yPercent: -100, duration: 0.55, ease: "power3.out" }, "+=0.08");
}
