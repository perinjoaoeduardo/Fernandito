"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import NextLink from "next/link";
import { useState, type FormEvent } from "react";
import { PAGES, type ContatoReason } from "@/content/site";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { WHATSAPP_DISPLAY, whatsappOpenHref } from "@/components/ui/WhatsAppButton";

// Cores da tela por motivo (mesmos valores dos tokens do Tailwind — o
// framer-motion precisa da cor de verdade pra fazer a transição).
const THEMES = {
  "verde-medio": { bg: "#405139", fg: "#E6E6CB", dark: true },
  "verde-escuro": { bg: "#243022", fg: "#E6E6CB", dark: true },
  "verde-claro": { bg: "#6C7D4F", fg: "#E6E6CB", dark: true },
  "off-white": { bg: "#E6E6CB", fg: "#243022", dark: false },
} as const;

// A mesma curva da cortina das trocas de tela.
const SMOOTH = [0.65, 0, 0.35, 1] as const;

type Values = Record<string, string>;

/** Mensagem com as respostas (o que falta some). */
function compose(reason: ContatoReason, values: Values) {
  return reason.message.replace(/\{(\w+)\}/g, (_, name: string) => values[name]?.trim() || "…");
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12 2a10 10 0 0 0-8.65 15L2 22l5.13-1.34A10 10 0 1 0 12 2zm0 18.16a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3.04.8.81-2.97-.2-.31A8.16 8.16 0 1 1 12 20.16z" />
    </svg>
  );
}

/**
 * Página Contato: "Contato", os 3 motivos e o botão do WhatsApp. "Falar com a
 * gente" vai direto; evento e revenda pedem o mínimo (2–3 campos) pra
 * mensagem chegar com contexto. Trocar o motivo muda a cor da tela e a foto.
 * No celular o botão fica preso embaixo; no computador vai com a mensagem por
 * cima da foto. Ao mandar: guarda o lead (sendBeacon) e abre o WhatsApp no
 * mesmo clique (app no celular, WhatsApp Web no computador). Se não abrir,
 * dá pra copiar a mensagem. Textos em `PAGES.contato`.
 */
export function ContatoTela() {
  const page = PAGES.contato;
  const reduce = useReducedMotion();
  const [activeKey, setActiveKey] = useState(page.reasons[0].key);
  const [values, setValues] = useState<Record<string, Values>>({});
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const reason = page.reasons.find((r) => r.key === activeKey) ?? page.reasons[0];
  const theme = THEMES[reason.theme];
  const current = values[reason.key] ?? {};
  const empty = reason.fields.filter((f) => !current[f.name]?.trim());
  const message = compose(reason, current);

  const choose = (key: ContatoReason["key"]) => {
    setActiveKey(key);
    setMissing(false);
    setSent(false);
  };
  const set = (name: string, value: string) => {
    setValues({ ...values, [reason.key]: { ...current, [name]: value } });
    setSent(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (empty.length) {
      setMissing(true);
      document.getElementById(`contato-${reason.key}-${empty[0].name}`)?.focus();
      return;
    }
    setMissing(false);
    const fields = Object.fromEntries(reason.fields.map((f) => [f.name, current[f.name].trim()]));
    try {
      navigator.sendBeacon(
        "/api/leads",
        new Blob([JSON.stringify({ form: reason.key, fields })], { type: "application/json" }),
      );
    } catch {
      // sem beacon: segue pro WhatsApp mesmo assim
    }
    const href = whatsappOpenHref(message);
    if (href) window.open(href, "_blank", "noopener");
    setSent(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // sem permissão: a mensagem está visível pra copiar à mão
    }
  };

  const t = (duration: number) => (reduce ? { duration: 0 } : { duration, ease: SMOOTH });
  const onDark = theme.dark;
  const chipOn = onDark
    ? "bg-fernandito-off-white text-fernandito-verde-escuro"
    : "bg-fernandito-verde-escuro text-fernandito-off-white";

  const button = (
    <button
      type="submit"
      form="contato-form"
      className={clsx(
        "duration-base ease-out-standard flex h-14 w-full items-center justify-center gap-2.5 rounded-full font-sans text-[1rem] font-bold shadow-[0_14px_34px_rgba(20,28,18,0.3)] transition-[background-color,transform] active:scale-[0.98]",
        onDark
          ? "bg-fernandito-off-white text-fernandito-verde-escuro hover:bg-white"
          : "bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio",
      )}
    >
      <WhatsAppIcon className="h-5 w-5" />
      {page.submit}
    </button>
  );

  // Depois de mandar: confirmação + plano B se o WhatsApp não abriu.
  const after = sent && (
    <p aria-live="polite" className="text-label mt-3 text-center font-sans tracking-[0.04em]">
      {page.sent} {page.fallback}{" "}
      <button
        type="button"
        onClick={() => void copy()}
        className="font-bold underline underline-offset-4"
      >
        {copied ? page.copied : page.copy}
      </button>
      {WHATSAPP_DISPLAY && <> · {WHATSAPP_DISPLAY}</>}
    </p>
  );

  return (
    <motion.section
      aria-label={page.title}
      initial={false}
      animate={{ backgroundColor: theme.bg, color: theme.fg }}
      transition={t(0.7)}
      className="w-full px-6 pt-[calc(7.5rem+var(--announcement-h))] pb-10 sm:px-10 lg:min-h-svh lg:px-16 lg:pb-12"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col">
          <NextLink
            href="/"
            className="text-label duration-base ease-out-standard inline-flex items-center gap-2 self-start font-sans tracking-[0.1em] uppercase opacity-70 transition-opacity hover:opacity-100"
          >
            <span aria-hidden="true">←</span> Início
          </NextLink>
          <h1 className="font-rampart mt-5 text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.95]">
            {page.title}
          </h1>

          {/* Motivos: o destaque desliza de um pro outro. */}
          <div
            role="radiogroup"
            aria-label="Motivo do contato"
            className="mt-7 flex flex-wrap gap-2"
          >
            {page.reasons.map((r) => {
              const on = r.key === reason.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose(r.key)}
                  className={clsx(
                    "relative h-12 rounded-full px-5 font-sans text-[0.95rem] font-bold ring-1 transition-colors duration-500",
                    on ? "ring-transparent" : "opacity-85 ring-current/30 hover:opacity-100",
                    on && (onDark ? "text-fernandito-verde-escuro" : "text-fernandito-off-white"),
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId="contato-motivo"
                      transition={
                        reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }
                      }
                      className={clsx(
                        "absolute inset-0 rounded-full transition-colors duration-700",
                        onDark ? "bg-fernandito-off-white" : "bg-fernandito-verde-escuro",
                      )}
                    />
                  )}
                  <span className="relative">{r.chip}</span>
                </button>
              );
            })}
          </div>

          {/* Campos do motivo (nenhum no "Falar com a gente"). */}
          <form id="contato-form" onSubmit={submit} noValidate className="mt-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={reason.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={t(0.35)}
                className="flex flex-col gap-6"
              >
                {reason.fields.map((field) => {
                  const id = `contato-${reason.key}-${field.name}`;
                  const flagged = missing && !current[field.name]?.trim();
                  return (
                    <div key={field.name}>
                      <label
                        htmlFor={field.options ? undefined : id}
                        id={`${id}-label`}
                        className={clsx(
                          "text-label block font-sans tracking-[0.12em] uppercase",
                          flagged ? "font-bold opacity-100" : "opacity-70",
                        )}
                      >
                        {field.label}
                        {flagged && " · falta"}
                      </label>
                      {field.options ? (
                        <div
                          id={id}
                          tabIndex={-1}
                          role="radiogroup"
                          aria-labelledby={`${id}-label`}
                          className="mt-2.5 flex flex-wrap gap-2 outline-none"
                        >
                          {field.options.map((option) => {
                            const on = current[field.name] === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => set(field.name, option)}
                                className={clsx(
                                  "duration-base ease-out-standard h-11 rounded-full px-4 font-sans text-[0.9rem] font-bold transition-[background-color,color,box-shadow,transform] active:scale-[0.96]",
                                  on ? chipOn : "ring-1 ring-current/30 hover:ring-current/70",
                                )}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          id={id}
                          value={current[field.name] ?? ""}
                          placeholder={field.placeholder}
                          maxLength={100}
                          autoComplete={field.name === "nome" ? "name" : "off"}
                          enterKeyHint="next"
                          onChange={(e) => set(field.name, e.target.value)}
                          className={clsx(
                            "text-body-lg mt-1.5 w-full max-w-md border-b-2 bg-transparent py-2 font-sans transition-colors outline-none placeholder:opacity-40 focus:border-current",
                            flagged ? "border-current" : "border-current/30",
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {/* Celular: botão preso embaixo da tela enquanto a pessoa está no
                contato (sticky: some quando ela rola pras perguntas). */}
            <div className="sticky bottom-0 z-40 -mx-2 mt-10 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
              {button}
              {after}
            </div>
          </form>
        </div>

        {/* Foto (troca subindo por cima da anterior) + mensagem e botão
            (computador). No celular, uma faixa entre os motivos e os campos
            ocupa espaço demais: fica só no computador. */}
        <div className="relative hidden lg:block">
          <div className="sticky top-[calc(7.5rem+var(--announcement-h))] h-[calc(100svh-10rem-var(--announcement-h))] min-h-[32rem] overflow-hidden rounded-3xl">
            <AnimatePresence initial={false}>
              <motion.div
                key={reason.key}
                className="absolute inset-0"
                initial={{ clipPath: "inset(100% 0% 0% 0%)", scale: 1.15 }}
                animate={{ clipPath: "inset(0% 0% 0% 0%)", scale: 1 }}
                exit={{ scale: 1.06, transition: t(0.9) }}
                transition={t(0.9)}
              >
                <PhotoSlot
                  image={reason.photo}
                  sizes="45vw"
                  placeholderClassName="bg-fernandito-verde-escuro"
                />
              </motion.div>
            </AnimatePresence>
            <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
            <div className="absolute inset-x-5 bottom-5">
              <div
                className={clsx(
                  "rounded-3xl p-5 font-sans shadow-[0_30px_70px_rgba(20,28,18,0.35)] transition-colors duration-700",
                  onDark
                    ? "bg-fernandito-off-white text-fernandito-verde-escuro"
                    : "bg-fernandito-verde-escuro text-fernandito-off-white",
                )}
              >
                <p
                  aria-live="polite"
                  className="font-accent text-[0.95rem] leading-relaxed whitespace-pre-line"
                >
                  {message}
                </p>
                <div className="mt-4">
                  <button
                    type="submit"
                    form="contato-form"
                    className={clsx(
                      "duration-base ease-out-standard flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-[0.95rem] font-bold transition-[background-color,transform] active:scale-[0.98]",
                      onDark
                        ? "bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio"
                        : "bg-fernandito-off-white text-fernandito-verde-escuro hover:bg-white",
                    )}
                  >
                    <WhatsAppIcon className="h-5 w-5" />
                    {page.submit}
                  </button>
                  {after}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export default ContatoTela;
