"use client";

import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * Troca de tela com a mesma cortina do "voltar pro topo": um painel
 * verde-medio sobe de baixo e cobre a tela, a página troca por baixo dele e
 * a página nova monta a `PageCurtain`, que continua subindo e revela.
 * `go` é quem navega de fato (router.push, replace…).
 */
const COVER_ID = "page-cover";

export function curtainNavigate(go: () => void) {
  if (prefersReducedMotion() || document.getElementById(COVER_ID)) {
    go();
    return;
  }
  const cover = document.createElement("div");
  cover.id = COVER_ID;
  cover.setAttribute("aria-hidden", "true");
  cover.style.cssText =
    "position:fixed;inset:0;z-index:100;background:#405139;pointer-events:none;will-change:transform";
  document.body.appendChild(cover);
  gsap.fromTo(
    cover,
    { yPercent: 100 },
    { yPercent: 0, duration: 0.38, ease: "power2.in", onComplete: go },
  );
  // Se a página nova não montar (erro, mesma rota), não deixa a tela coberta.
  window.setTimeout(() => removePageCover(), 3000);
}

/** A cortina da página nova já está cobrindo: tira a de "ida". */
export function removePageCover() {
  document.getElementById(COVER_ID)?.remove();
}
