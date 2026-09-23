"use client";

import { useEffect } from "react";
import { onIntroComplete } from "@/lib/introSignal";

/** Primeira cor de fundo não-transparente subindo a árvore a partir do
 * elemento naquele ponto da tela (mesma lógica do FloatingNav). */
function sampleBackground(x: number, y: number): string | null {
  let node: Element | null = document.elementFromPoint(x, y);
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(bg)) return bg;
    node = node.parentElement;
  }
  return null;
}

/**
 * O Safari do iPhone pinta a área das barras (a de cima e a flutuante de
 * baixo, com o endereço) com a cor "tema" da página — que era fixa em
 * verde-escuro (`theme-color` + fundo do body). Com uma seção bege na tela,
 * sobrava uma faixa escura embaixo. Aqui a cor acompanha o que está na
 * borda da tela: `theme-color` = cor na borda de cima, fundo do `<html>`
 * (o que o Safari usa pra área de baixo e pro overscroll) = cor na borda
 * de baixo.
 */
export function ThemeColorSync() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const root = document.documentElement;
    let lastTop = "";
    let lastBottom = "";
    let ticking = false;

    const update = () => {
      ticking = false;
      // x=12: fora da pill centralizada do nav; y=6 passa por baixo da barra
      // de progresso (2px) e acima do nav (top-4).
      const top = sampleBackground(12, 6);
      const bottom = sampleBackground(12, window.innerHeight - 2);
      if (top && top !== lastTop) {
        lastTop = top;
        meta?.setAttribute("content", top);
      }
      if (bottom && bottom !== lastBottom) {
        lastBottom = bottom;
        root.style.backgroundColor = bottom;
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    // A cortina de abertura (verde-medio) cobre a tela no carregamento —
    // amostra de novo quando ela sai, sem esperar a primeira rolagem.
    const unsubscribeIntro = onIntroComplete(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      unsubscribeIntro();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      root.style.backgroundColor = "";
    };
  }, []);

  return null;
}

export default ThemeColorSync;
