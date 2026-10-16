"use client";

import { useEffect } from "react";

/**
 * Comportamento das páginas legais (não desenha nada):
 * - link pra uma seção (índice ou #endereço) abre o acordeão dela;
 * - o índice marca a seção que está na tela;
 * - imprimir / salvar PDF abre tudo antes (e fecha de volta depois).
 */
export function LegalReader() {
  useEffect(() => {
    const items = [...document.querySelectorAll<HTMLDetailsElement>("details[data-legal-item]")];

    const openHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      const details = target?.closest("details");
      if (details && !details.open) {
        details.open = true;
        requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
      }
    };
    openHash();
    window.addEventListener("hashchange", openHash);

    const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target.id);
        if (!visible.length) return;
        for (const link of links) {
          const on = link.dataset.tocLink === visible[0];
          link.toggleAttribute("data-active", on);
          if (on) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        }
      },
      { rootMargin: "-15% 0px -55% 0px" },
    );
    items.forEach((item) => observer.observe(item));

    let closed: HTMLDetailsElement[] = [];
    const beforePrint = () => {
      closed = items.filter((item) => !item.open);
      closed.forEach((item) => (item.open = true));
    };
    const afterPrint = () => closed.forEach((item) => (item.open = false));
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);

    return () => {
      window.removeEventListener("hashchange", openHash);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      observer.disconnect();
    };
  }, []);
  return null;
}
