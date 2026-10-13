"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Transição entre páginas: a página nova entra com um fade curto e sobe
 * alguns pixels (a mesma curva do resto do site). O template remonta a
 * cada navegação. A home fica de fora: ela tem a cortina de abertura e as
 * seções presas à rolagem, que não podem ter ancestral animado.
 */
export default function Template({ children }: { children: ReactNode }) {
  const isHome = usePathname() === "/";
  if (isHome) return <>{children}</>;
  return <div className="animate-[pageIn_0.55s_cubic-bezier(0.22,1,0.36,1)_both]">{children}</div>;
}
