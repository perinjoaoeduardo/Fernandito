"use client";

import { useEffect, useRef, useState } from "react";
import { getLenis } from "@/lib/lenis";
import { NOTIFY_EVENT } from "@/lib/notify";
import { NOTIFY } from "@/content/site";

const itemDelay = (i: number) => ({ animationDelay: `${0.35 + i * 0.08}s` });
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v: string) => v.replace(/\D/g, "").length >= 10;

/**
 * "Me avisa do próximo lote": mesmo cartão do portão de idade (selo
 * carimbado, moldura tracejada, cascata), aberto pelos botões de compra
 * quando o kit esgota. O contato vira um lead "aviso" e aparece no painel.
 */
export function NotifyModal() {
  const [state, setState] = useState<"closed" | "open" | "leaving" | "done">("closed");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const open = () => {
      setError(null);
      setState("open");
    };
    window.addEventListener(NOTIFY_EVENT, open);
    return () => window.removeEventListener(NOTIFY_EVENT, open);
  }, []);

  const visible = state !== "closed";
  useEffect(() => {
    if (!visible) return;
    const lenis = getLenis();
    lenis?.stop();
    const t = window.setTimeout(() => firstRef.current?.focus(), 400);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible]);

  function close() {
    setState("leaving");
    window.setTimeout(() => setState("closed"), 650);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const c = contact.trim();
    if (!name.trim()) return setError("Coloca teu nome.");
    if (!isEmail(c) && !isPhone(c)) return setError("Coloca um WhatsApp com DDD ou um e-mail.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: "aviso",
          fields: { nome: name.trim(), contato: c },
        }),
      });
      if (!res.ok) throw new Error();
      setState("done");
    } catch {
      setError("Não deu pra salvar agora. Tenta de novo em instantes.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  const done = state === "done";
  const field =
    "text-body duration-base ease-out-standard border-fernandito-verde-escuro/25 focus:border-fernandito-verde-medio h-12 w-full rounded-xl border bg-white/70 px-4 font-sans outline-none placeholder:opacity-40 focus:bg-white focus:shadow-[0_0_0_4px_rgba(64,81,57,0.18)]";

  return (
    <div
      id="notify-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notify-title"
      data-state={state}
      className="fixed inset-0 z-[96] flex items-center justify-center p-5"
    >
      <button
        type="button"
        aria-label={NOTIFY.close}
        onClick={close}
        className="gate-backdrop bg-fernandito-verde-escuro/60 absolute inset-0 cursor-default backdrop-blur-xl"
      />
      <div className="gate-card bg-fernandito-off-white text-fernandito-verde-escuro relative w-full max-w-[26rem] rounded-[2rem] px-7 pt-[5.5rem] pb-8 text-center shadow-[0_40px_90px_rgba(0,0,0,0.5)] sm:px-10">
        <span
          aria-hidden="true"
          className="border-fernandito-verde-escuro/20 pointer-events-none absolute inset-2.5 rounded-[1.6rem] border border-dashed"
        />
        <div className="absolute -top-16 left-1/2 -translate-x-1/2">
          <div className="gate-seal">
            {/* eslint-disable-next-line @next/next/no-img-element -- raster pequeno de tamanho fixo */}
            <img
              src="/logo/fernandito-selo.webp"
              alt=""
              width={640}
              height={653}
              decoding="async"
              className="h-auto w-32 rotate-[-6deg] drop-shadow-[0_14px_24px_rgba(20,28,18,0.35)]"
            />
          </div>
        </div>

        <div key={done ? "done" : "ask"} className="relative">
          <p
            className="gate-item font-accent text-fernandito-verde-medio text-label tracking-[0.22em] uppercase"
            style={itemDelay(0)}
          >
            {done ? "Anotado" : NOTIFY.kicker}
          </p>
          <h2
            id="notify-title"
            className="gate-item font-rampart mt-3 text-[clamp(1.9rem,6vw,2.25rem)] leading-[1.05] text-balance"
            style={itemDelay(1)}
          >
            {done ? NOTIFY.doneTitle : NOTIFY.title}
          </h2>
          <p
            className="gate-item text-body mx-auto mt-4 max-w-[19rem] opacity-80"
            style={itemDelay(2)}
          >
            {done ? NOTIFY.doneText : NOTIFY.text}
          </p>

          {done ? (
            <div className="gate-item mt-7" style={itemDelay(3)}>
              <button
                type="button"
                onClick={close}
                className="bg-fernandito-verde-escuro text-fernandito-off-white duration-base ease-out-standard hover:bg-fernandito-verde-medio flex h-12 w-full items-center justify-center rounded-full font-sans text-[0.9rem] font-bold tracking-[0.04em] transition-colors active:scale-[0.98]"
              >
                {NOTIFY.close}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-3 text-left">
              <input
                ref={firstRef}
                className={`gate-item ${field}`}
                style={itemDelay(3)}
                placeholder={NOTIFY.name}
                aria-label={NOTIFY.name}
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className={`gate-item ${field}`}
                style={itemDelay(4)}
                placeholder={NOTIFY.contact}
                aria-label={NOTIFY.contact}
                autoComplete="tel"
                inputMode="email"
                maxLength={100}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
              {error && (
                <p role="alert" className="text-label text-red-800">
                  {error}
                </p>
              )}
              <div className="gate-item mt-2 flex flex-col items-center gap-1" style={itemDelay(5)}>
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-fernandito-verde-escuro text-fernandito-off-white duration-base ease-out-standard hover:bg-fernandito-verde-medio flex h-12 w-full items-center justify-center rounded-full font-sans text-[0.9rem] font-bold tracking-[0.04em] transition-colors active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? "Salvando…" : NOTIFY.submit}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="text-label duration-base ease-out-standard h-11 px-5 tracking-[0.12em] uppercase opacity-60 transition-opacity hover:opacity-100"
                >
                  {NOTIFY.skip}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotifyModal;
