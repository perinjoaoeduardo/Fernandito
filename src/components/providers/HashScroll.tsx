"use client";

import { useEffect } from "react";
import { getLenis } from "@/lib/lenis";
import { onIntroComplete } from "@/lib/introSignal";
import { ScrollTrigger } from "@/lib/gsap";

/**
 * Chegando na home com âncora (ex.: "/#comprar", vindo do checkout, do
 * carrinho ou de um link antigo de /comprar): espera a cortina do cavalo e
 * o portão de idade, deixa as seções presas à rolagem se medirem e pula
 * direto pra seção — sem atravessar a página.
 */
export function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let cancelled = false;
    // Se a pessoa mexer na rolagem, para de "corrigir" a posição.
    let userMoved = false;
    const stop = () => {
      userMoved = true;
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);

    const jump = () => {
      if (cancelled || userMoved) return;
      const element = document.getElementById(id);
      if (!element) return;
      if (Math.abs(element.getBoundingClientRect().top) < 4) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo(0, top);
      ScrollTrigger.update();
    };
    const timers: number[] = [];
    const off = onIntroComplete(() => {
      // As seções presas à rolagem (Hero etc.) terminam de se medir alguns
      // quadros depois de montar e empurram o conteúdo: pula, confere de
      // novo e corrige se ainda não estiver no lugar.
      ScrollTrigger.refresh();
      jump();
      for (const ms of [150, 400, 900, 1600]) timers.push(window.setTimeout(jump, ms));
    });
    return () => {
      cancelled = true;
      off();
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, []);
  return null;
}

export default HashScroll;
