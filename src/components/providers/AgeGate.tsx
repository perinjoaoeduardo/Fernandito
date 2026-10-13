"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { markAgeConfirmed } from "@/lib/introSignal";
import { prefersReducedMotion } from "@/lib/gsap";

const AGE_KEY = "fernandito:age:v1";

// Páginas que precisam abrir sem o portão (textos legais).
const OPEN_PATHS = ["/termos", "/privacidade", "/legal"];

/** Atraso (s) de cada linha do cartão ao entrar, em cascata. */
const itemDelay = (i: number) => ({ animationDelay: `${0.45 + i * 0.09}s` });

/**
 * Portão de idade da primeira visita. Quem confirma não vê de novo
 * (localStorage). O `<script>` do layout decide antes de pintar se o portão
 * aparece (`html[data-age="ask"]`), sem piscar pra quem já confirmou. Na
 * home ele aparece quando a cortina do cavalo COMEÇA a subir
 * (`data-intro="reveal"`): fica por baixo da cortina (z 95 < 100) e o
 * cartão sobe junto com ela. "Sim": o cartão sobe e some, e a Hero entra.
 * "Não": o texto troca por um recado e o site continua fechado (é o
 * propósito do portão). Não é a prova de idade da compra — essa é a caixa
 * marcada no fim do checkout.
 */
export function AgeGate() {
  const pathname = usePathname();
  const [state, setState] = useState<"ask" | "denied" | "leaving">("ask");
  const yesRef = useRef<HTMLButtonElement>(null);

  if (OPEN_PATHS.some((path) => pathname.startsWith(path))) return null;

  const confirm = () => {
    try {
      localStorage.setItem(AGE_KEY, new Date().toISOString());
    } catch {
      // Sem armazenamento (aba anônima etc.): vale só até recarregar.
    }
    window.dispatchEvent(new Event("fernandito:age-ok"));
    const reduce = prefersReducedMotion();
    setState("leaving");
    // A Hero começa a entrar enquanto o cartão ainda está subindo.
    window.setTimeout(markAgeConfirmed, reduce ? 0 : 250);
    window.setTimeout(
      () => {
        document.documentElement.dataset.age = "ok";
      },
      reduce ? 0 : 750,
    );
  };

  const denied = state === "denied";

  return (
    <div
      id="age-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      data-state={state}
      className="fixed inset-0 z-[95] items-center justify-center p-5"
    >
      <div
        aria-hidden="true"
        className="gate-backdrop bg-fernandito-verde-escuro/60 absolute inset-0 backdrop-blur-xl"
      />

      <div className="gate-card bg-fernandito-off-white text-fernandito-verde-escuro relative w-full max-w-[26rem] rounded-[2rem] px-7 pt-[5.5rem] pb-9 text-center shadow-[0_40px_90px_rgba(0,0,0,0.5)] sm:px-10">
        {/* Moldura tracejada de rótulo, por dentro do cartão. */}
        <span
          aria-hidden="true"
          className="border-fernandito-verde-escuro/20 pointer-events-none absolute inset-2.5 rounded-[1.6rem] border border-dashed"
        />

        {/* Selo de carimbo no topo, vazando pra fora do cartão. */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2">
          <div className="gate-seal">
            {/* eslint-disable-next-line @next/next/no-img-element -- raster pequeno de tamanho fixo */}
            <img
              src="/logo/fernandito-selo.webp"
              alt=""
              width={480}
              height={490}
              decoding="async"
              className="h-auto w-32 rotate-[-6deg] drop-shadow-[0_14px_24px_rgba(20,28,18,0.35)]"
            />
          </div>
        </div>

        {/* A key troca o conteúdo (pergunta ↔ recado) e refaz a cascata. */}
        <div key={denied ? "denied" : "ask"} className="relative">
          <p
            className="gate-item font-accent text-fernandito-verde-medio text-label tracking-[0.22em] uppercase"
            style={itemDelay(0)}
          >
            {denied ? "Sem problema" : "Antes de entrar"}
          </p>
          <h2
            id="age-gate-title"
            className="gate-item font-rampart mt-3 text-[clamp(1.9rem,6vw,2.25rem)] leading-[1.05] text-balance"
            style={itemDelay(1)}
          >
            {denied ? "Então, até daqui a pouco." : "Tu tem 18 anos ou mais?"}
          </h2>
          <p
            className="gate-item text-body mx-auto mt-4 max-w-[19rem] opacity-80"
            style={itemDelay(2)}
          >
            {denied
              ? "O Fernandito é só pra maiores de idade. Volta quando chegar a tua hora."
              : "O Fernandito é fernet y cola em lata: bebida alcoólica, feita pra maiores de idade."}
          </p>

          <div className="gate-item mt-7 flex flex-col items-center gap-1" style={itemDelay(3)}>
            {denied ? (
              <button
                type="button"
                onClick={() => setState("ask")}
                className="text-label border-fernandito-verde-escuro/25 duration-base ease-out-standard hover:border-fernandito-verde-escuro/60 h-11 rounded-full border px-6 tracking-[0.12em] uppercase transition-colors"
              >
                ← Voltar
              </button>
            ) : (
              <>
                <button
                  ref={yesRef}
                  type="button"
                  onClick={confirm}
                  className="bg-fernandito-verde-escuro text-fernandito-off-white duration-base ease-out-standard hover:bg-fernandito-verde-medio focus-visible:outline-fernandito-verde-medio flex h-12 w-full items-center justify-center rounded-full font-sans text-[0.9rem] font-bold tracking-[0.04em] transition-[background-color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
                >
                  Sim, tenho 18 ou mais
                </button>
                <button
                  type="button"
                  onClick={() => setState("denied")}
                  className="text-label duration-base ease-out-standard h-11 px-5 tracking-[0.12em] uppercase opacity-60 transition-opacity hover:opacity-100"
                >
                  Não tenho
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgeGate;
