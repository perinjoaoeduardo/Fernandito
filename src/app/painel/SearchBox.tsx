"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { btn } from "./ui";

/** Busca que atualiza a lista enquanto digita (sem clicar em "Buscar"). */
export function SearchBox({ ver, q }: { ver: string; q: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [pending, start] = useTransition();
  const last = useRef(q);

  const go = (text: string) => {
    const term = text.trim();
    if (term === last.current) return;
    last.current = term;
    const qs = new URLSearchParams();
    if (ver !== "ativos") qs.set("ver", ver);
    if (term) qs.set("q", term);
    const url = qs.toString() ? `/painel?${qs}` : "/painel";
    start(() => router.replace(url, { scroll: false }));
  };

  // Espera a pessoa parar de digitar (350 ms) antes de buscar.
  useEffect(() => {
    const t = window.setTimeout(() => go(value), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="flex gap-2"
    >
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar nome, telefone, cidade, nota, rastreio ou código"
          aria-label="Buscar pedidos"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 pr-24 text-sm shadow-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
        />
        {pending && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-400">
            Buscando…
          </span>
        )}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            go("");
          }}
          className={btn("secondary")}
        >
          Limpar
        </button>
      )}
    </form>
  );
}
