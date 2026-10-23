"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { curtainNavigate } from "@/lib/page-transition";

/**
 * Todo link interno que troca de página passa pela cortina (`curtainNavigate`).
 * Escuta o clique no documento, na fase de captura, antes do Next.js: links
 * pra outra aba, download, com Ctrl/Cmd, só de âncora (#) ou pra mesma página
 * seguem o caminho normal.
 */
export function PageTransitions() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      if (url.pathname.startsWith("/api/")) return;
      // Só cancela a navegação padrão (o Next não navega se o clique já foi
      // cancelado). NÃO para a propagação: o `onClick` do próprio link (ex.:
      // fechar o menu do celular) precisa rodar.
      event.preventDefault();
      curtainNavigate(() => router.push(url.pathname + url.search + url.hash));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);
  return null;
}

export default PageTransitions;
