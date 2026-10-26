"use client";

import { createContext, useContext, type ReactNode } from "react";
import { PRELAUNCH, STORE } from "@/content/site";

/**
 * Qual versão do site esta visita está vendo (ver `ACESSO` em
 * src/content/site.ts e src/proxy.ts):
 * - `publico`: quem chega sem o link de convite vê o site de pré-lançamento
 *   de antes (Hero, "o Fernandito está chegando" e rodapé, sem loja);
 * - senão, o site que `PRELAUNCH` e `STORE` configuram (completo, com loja).
 */
const ModoContext = createContext(false);

export function ModoProvider({ publico, children }: { publico: boolean; children: ReactNode }) {
  return <ModoContext.Provider value={publico}>{children}</ModoContext.Provider>;
}

export function useModo() {
  const publico = useContext(ModoContext);
  return {
    publico,
    prelaunch: publico ? true : PRELAUNCH.enabled,
    store: publico ? false : STORE.enabled,
  };
}
