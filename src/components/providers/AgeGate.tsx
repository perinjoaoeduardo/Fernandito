"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { markAgeConfirmed } from "@/lib/introSignal";

const AGE_KEY = "fernandito:age:v1";

// Páginas que precisam abrir sem o portão (textos legais).
const OPEN_PATHS = ["/termos", "/privacidade", "/legal"];

/**
 * Portão de idade da primeira visita: "Você tem 18 anos ou mais?". Quem
 * confirma não vê de novo (localStorage). O `<script>` do layout decide
 * antes de pintar se o portão aparece (`html[data-age="ask"]`, ver
 * globals.css; na home só depois da animação do cavalo, `data-intro`), então não pisca pra quem já confirmou. Não é a prova de
 * idade da compra: essa é a caixa marcada no fim do checkout.
 */
export function AgeGate() {
  const pathname = usePathname();
  const [denied, setDenied] = useState(false);

  if (OPEN_PATHS.some((path) => pathname.startsWith(path))) return null;

  const confirm = () => {
    try {
      localStorage.setItem(AGE_KEY, new Date().toISOString());
    } catch {
      // Sem armazenamento (aba anônima etc.): vale só até recarregar.
    }
    document.documentElement.dataset.age = "ok";
    window.dispatchEvent(new Event("fernandito:age-ok"));
    markAgeConfirmed();
  };

  return (
    <div
      id="age-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="bg-fernandito-verde-escuro/55 fixed inset-0 z-[190] items-center justify-center p-5 backdrop-blur-xl"
    >
      <div className="bg-fernandito-off-white text-fernandito-verde-escuro w-full max-w-md animate-[ageIn_0.6s_cubic-bezier(0.22,1,0.36,1)_both] rounded-3xl p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- raster estático de tamanho fixo */}
        <img
          src="/logo/fernandito-horse.webp"
          alt=""
          width={64}
          height={64}
          className="mx-auto h-16 w-16 rounded-full"
        />
        {denied ? (
          <>
            <h2 id="age-gate-title" className="font-rampart mt-6 text-[1.9rem] leading-tight">
              Volte quando completar 18.
            </h2>
            <p className="text-body mt-3 font-sans opacity-80">
              O Fernandito é uma bebida alcoólica, só para maiores de 18 anos.
            </p>
            <Button variant="secondary" className="mt-7 w-full" onClick={() => setDenied(false)}>
              Voltar
            </Button>
          </>
        ) : (
          <>
            <h2 id="age-gate-title" className="font-rampart mt-6 text-[1.9rem] leading-tight">
              Você tem 18 anos ou mais?
            </h2>
            <p className="text-body mt-3 font-sans opacity-80">
              O Fernandito é uma bebida alcoólica. Beba com moderação.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" className="flex-1" onClick={confirm}>
                Sim, tenho
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setDenied(true)}>
                Não
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AgeGate;
