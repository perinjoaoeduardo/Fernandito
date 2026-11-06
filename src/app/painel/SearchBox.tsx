"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { FOCUS } from "./ui";

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
    if (ver !== "todos") qs.set("ver", ver);
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
      className="w-full xl:max-w-md"
    >
      <div className="relative min-w-0">
        <Search
          aria-hidden
          className="text-lk-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar nome, cidade, nota ou rastreio"
          aria-label="Buscar pedidos"
          autoComplete="off"
          className="bg-lk-soft/70 text-lk-ink placeholder:text-lk-muted focus:border-lk-action focus:ring-lk-action/15 h-10 w-full rounded-lg border border-transparent pr-24 pl-10 text-sm outline-none focus:bg-white focus:ring-4 [&::-webkit-search-cancel-button]:hidden"
        />
        {pending && (
          <span className="text-lk-ink3 pointer-events-none absolute top-1/2 right-10 -translate-y-1/2 text-xs">
            Buscando…
          </span>
        )}
        {value && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setValue("");
              go("");
            }}
            className={`text-lk-muted hover:bg-lk-soft hover:text-lk-ink absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md ${FOCUS} focus-visible:ring-offset-0`}
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
}
