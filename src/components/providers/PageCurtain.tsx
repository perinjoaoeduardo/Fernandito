"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/gsap";
import { removePageCover } from "@/lib/page-transition";

// Marca que a 1ª página já carregou: dali pra frente, cada página nova
// (o template remonta a cada navegação) entra com a cortina.
declare global {
  interface Window {
    __fernanditoNavigated?: boolean;
  }
}

/**
 * Transição entre telas (regra do site): a mesma cortina do "voltar pro
 * topo" — só o painel verde-medio, sem o cavalinho. Ela sobe de baixo antes
 * de trocar (`curtainNavigate`) e aqui, na página nova, continua subindo e
 * revela ("joga pra cima e tu cai na tela"). Não roda
 * no 1º carregamento (lá a cortina de abertura já faz isso) nem sob
 * prefers-reduced-motion. É um irmão `fixed` do conteúdo (sem transform em
 * ancestral nenhum, então as barras fixas e as seções presas não quebram).
 */
export function PageCurtain() {
  // No servidor e na hidratação da 1ª página: false (bate com o HTML).
  const [show, setShow] = useState(
    () => typeof window !== "undefined" && Boolean(window.__fernanditoNavigated),
  );

  useEffect(() => {
    window.__fernanditoNavigated = true;
    // A cortina de "ida" (da página anterior) sai: esta já está cobrindo.
    removePageCover();
    if (show && prefersReducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- checagem só do navegador
      setShow(false);
    }
  }, [show]);

  if (!show) return null;
  return (
    <div
      aria-hidden="true"
      onAnimationEnd={() => setShow(false)}
      className="page-curtain bg-fernandito-verde-medio fixed inset-0 z-[100]"
    />
  );
}

export default PageCurtain;
