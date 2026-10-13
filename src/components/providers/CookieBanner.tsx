"use client";

import NextLink from "next/link";
import { useEffect, useState } from "react";
import { onIntroComplete } from "@/lib/introSignal";

const COOKIE_KEY = "fernandito:cookies:v1";

/**
 * Aviso de cookies: flutuante, embaixo à esquerda, só depois de o visitante
 * confirmar a idade. Hoje o site só usa o essencial (carrinho e a
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
    // Só depois do portão de idade E da animação do cavalo (home).
    let ageOk = document.documentElement.dataset.age === "ok";
    let introOk = false;
    let timer: number | undefined;
    const check = () => {
      if (ageOk && introOk) timer = window.setTimeout(() => setVisible(true), 800);
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
      aria-label="Aviso de cookies"
      className="bg-fernandito-verde-escuro/90 text-fernandito-off-white fixed bottom-4 left-4 z-[70] flex max-w-sm animate-[ageIn_0.6s_cubic-bezier(0.22,1,0.36,1)_both] flex-col gap-3 rounded-3xl p-5 font-sans shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-6"
    >
      <p className="text-body">
        Usamos só o essencial (carrinho e sua confirmação de idade) e estatística sem cookies.{" "}
        <NextLink href="/privacidade" className="underline underline-offset-4">
          Saiba mais
        </NextLink>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="bg-fernandito-off-white text-fernandito-verde-escuro duration-base ease-out-standard hover:bg-fernandito-verde-medio hover:text-fernandito-off-white focus-visible:outline-fernandito-off-white self-start rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Entendi
      </button>
    </div>
  );
}

export default CookieBanner;
