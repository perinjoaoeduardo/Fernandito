"use client";

import NextLink from "next/link";
import { useEffect, useState } from "react";
import { onIntroComplete } from "@/lib/introSignal";
import { CookieIcon } from "@/components/ui/icons";

const COOKIE_KEY = "fernandito:cookies:v1";

/** Espera depois da primeira interação (rolar, tocar, clicar, tecla). */
const DELAY_MS = 5000;
const INTERACTIONS = ["wheel", "touchstart", "pointerdown", "keydown", "scroll"] as const;

/**
 * Aviso de cookies: cartão pequeno flutuante, embaixo à esquerda, com ícone
 * de cookie e "Política de cookies". Só aparece 5 s depois da PRIMEIRA
 * interação da pessoa com o site (rolar, tocar, clicar) — e nunca antes do
 * portão de idade e da animação do cavalo (home). Entra subindo, com o
 * cookie dando uma balançada. Hoje o site só usa o essencial (carrinho e a
 * confirmação de idade, no próprio navegador) e estatística sem cookies —
 * por isso só tem "Entendi". Se um dia entrar ferramenta com cookies de
 * análise/anúncios, aqui vira "Aceitar / Só o essencial".
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let answered = false;
    try {
      answered = Boolean(localStorage.getItem(COOKIE_KEY));
    } catch {
      // sem armazenamento: mostra sempre
    }
    if (answered) return;
    let ageOk = document.documentElement.dataset.age === "ok";
    let introOk = false;
    let armed = false;
    let timer: number | undefined;
    const onInteract = () => {
      stopListening();
      timer = window.setTimeout(() => setVisible(true), DELAY_MS);
    };
    const stopListening = () =>
      INTERACTIONS.forEach((e) => window.removeEventListener(e, onInteract));
    // Só começa a ouvir depois do portão de idade E do intro: interações
    // dentro do portão não contam.
    const check = () => {
      if (!ageOk || !introOk || armed) return;
      armed = true;
      INTERACTIONS.forEach((e) => window.addEventListener(e, onInteract, { passive: true }));
    };
    const onAge = () => {
      ageOk = true;
      check();
    };
    const offIntro = onIntroComplete(() => {
      introOk = true;
      check();
    });
    if (ageOk) check();
    else window.addEventListener("fernandito:age-ok", onAge, { once: true });
    return () => {
      offIntro();
      stopListening();
      window.removeEventListener("fernandito:age-ok", onAge);
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(COOKIE_KEY, new Date().toISOString());
    } catch {
      // ok
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Política de cookies"
      className="cookie-in bg-fernandito-verde-escuro/95 text-fernandito-off-white ring-fernandito-off-white/10 fixed right-4 bottom-4 left-4 z-[70] flex items-center gap-3.5 rounded-2xl py-3 pr-3 pl-3.5 font-sans shadow-[0_18px_44px_rgba(0,0,0,0.38)] ring-1 backdrop-blur-md sm:right-auto sm:max-w-[26rem]"
    >
      <span className="cookie-icon bg-fernandito-off-white/10 text-fernandito-off-white flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <CookieIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] leading-tight font-bold">Política de cookies</p>
        <p className="mt-0.5 text-[0.75rem] leading-snug opacity-75">
          Só o essencial, sem rastreamento.{" "}
          <NextLink href="/privacidade" className="underline underline-offset-2 hover:opacity-100">
            Saiba mais
          </NextLink>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="bg-fernandito-off-white text-fernandito-verde-escuro duration-base ease-out-standard hover:bg-fernandito-verde-claro hover:text-fernandito-off-white focus-visible:outline-fernandito-off-white shrink-0 rounded-full px-4 py-2 text-[0.75rem] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]"
      >
        Entendi
      </button>
    </div>
  );
}

export default CookieBanner;
