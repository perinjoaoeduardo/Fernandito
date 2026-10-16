"use client";

import type { ReactNode } from "react";
import { PageCurtain } from "@/components/providers/PageCurtain";

/**
 * Transição entre telas: o template remonta a cada navegação e, junto com a
 * página nova, monta a cortina (`PageCurtain`) — a mesma da abertura, que
 * sobe e revela a página. Nada aqui envolve o conteúdo num elemento animado
 * (um transform num ancestral viraria o "pai" dos elementos `fixed`).
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      <PageCurtain />
      {children}
    </>
  );
}
