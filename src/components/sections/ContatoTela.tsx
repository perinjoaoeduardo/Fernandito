"use client";

import { clsx } from "clsx";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import NextLink from "next/link";
import { useState, type FormEvent, type PointerEvent } from "react";
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
 * Página Contato: "Contato", uma frase, os 3 motivos e o botão do WhatsApp.
 * "Conversar" vai direto; evento e revenda pedem o mínimo (2–3 campos) pra
 * mensagem chegar com contexto. Trocar o motivo muda a cor da tela e a foto.
 * Evento e revenda abrem um cartão com as perguntas e o botão dentro.
 * Computador: tela dividida, o bloco no centro da metade esquerda e a foto na
 * direita. Celular: a foto embaixo do botão. A mensagem pronta não aparece na tela. Ao mandar: guarda o lead (sendBeacon) e abre o WhatsApp no
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
  const hasFields = reason.fields.length > 0;

  // Depois de mandar: confirmação + plano B se o WhatsApp não abriu.
  const after = sent && (
    <p aria-live="polite" className="text-label mt-3 font-sans tracking-[0.04em]">
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

  // O único elemento cheio da tela (bege). Seletor, cartão e campos ficam
  // translúcidos, no tom do fundo, pra não competir com ele.
  const button = (
    <button
      type="submit"
      className={clsx(
        "duration-base ease-out-standard flex h-13 w-full items-center justify-center gap-2.5 rounded-full px-8 font-sans text-[1rem] font-bold transition-[background-color,transform] active:scale-[0.98]",
        "bg-fernandito-off-white text-fernandito-verde-escuro hover:bg-white",
      )}
    >
      <WhatsAppIcon className="h-5 w-5" />
      {page.submit}
    </button>
  );

  return (
    <motion.section
      aria-label={page.title}
      initial={false}
      animate={{ backgroundColor: theme.bg, color: theme.fg }}
      transition={t(0.7)}
      className="w-full lg:grid lg:min-h-svh lg:grid-cols-2"
    >
      {/* Metade do texto: o bloco fica no centro (nos dois sentidos) e
          desliza quando cresce ou encolhe com a troca de motivo. */}
      <div className="flex w-full justify-center px-6 pt-[calc(7.5rem+var(--announcement-h))] pb-10 sm:px-10 lg:items-center lg:px-12 lg:pt-[calc(6.5rem+var(--announcement-h))] lg:pb-12">
        <motion.div
          layout={reduce ? false : "position"}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
          className="flex w-full max-w-[26rem] flex-col"
        >
          <NextLink
            href="/"
            className="text-label duration-base ease-out-standard inline-flex items-center gap-2 self-start font-sans tracking-[0.1em] uppercase opacity-70 transition-opacity hover:opacity-100"
          >
            <span aria-hidden="true">←</span> Início
          </NextLink>
          <h1 className="font-rampart mt-5 text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.95]">
            {page.title}
          </h1>
          <p className="mt-3 font-sans text-[0.95rem] opacity-75">{page.lead}</p>

          {/* Motivos: trilho discreto, o destaque desliza de um pro outro. */}
          <div
            role="radiogroup"
            aria-label="Motivo do contato"
            className="mt-7 flex gap-1 self-start rounded-full bg-black/15 p-1"
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
                    "relative h-9 rounded-full px-4 font-sans text-[0.875rem] font-bold whitespace-nowrap transition-opacity duration-300 lg:h-10 lg:px-5",
                    on ? "opacity-100" : "opacity-60 hover:opacity-100",
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId="contato-motivo"
                      transition={
                        reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }
                      }
                      className="absolute inset-0 rounded-full bg-white/15 ring-1 ring-white/25"
                    />
                  )}
                  <span className="relative">{r.chip}</span>
                </button>
              );
            })}
          </div>

          {/* "Conversar": só o botão. Evento e revenda: um cartão com as
              perguntas e o botão dentro. */}
          <form onSubmit={submit} noValidate className="mt-7">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={reason.key}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={t(0.35)}
                className={clsx(
                  hasFields && "rounded-3xl bg-black/12 p-5 ring-1 ring-white/10 sm:p-6",
                )}
              >
                {hasFields && (
                  <div className="mb-6 flex flex-col gap-5">
                    {reason.fields.map((field) => {
                      const id = `contato-${reason.key}-${field.name}`;
                      const flagged = missing && !current[field.name]?.trim();
                      return (
                        <div key={field.name}>
                          <label
                            htmlFor={field.options ? undefined : id}
                            id={`${id}-label`}
                            className="block font-sans text-[0.9rem] font-bold"
                          >
                            {field.label}
                            {flagged && <span className="font-normal opacity-70"> · falta</span>}
                          </label>
                          {field.options ? (
                            <div
                              id={id}
                              tabIndex={-1}
                              role="radiogroup"
                              aria-labelledby={`${id}-label`}
                              className="mt-2 flex flex-wrap gap-2 outline-none"
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
                                      "duration-base ease-out-standard h-10 rounded-full px-4 font-sans text-[0.875rem] font-bold ring-1 transition-[background-color,box-shadow,transform] active:scale-[0.96]",
                                      on
                                        ? "bg-white/20 ring-white/40"
                                        : clsx(
                                            "opacity-80 hover:opacity-100 hover:ring-white/40",
                                            flagged ? "ring-white/70" : "ring-white/15",
                                          ),
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
                                "mt-2 h-12 w-full rounded-xl bg-white/8 px-4 font-sans text-[1rem] ring-1 transition-[background-color,box-shadow] outline-none placeholder:text-current/40 focus:bg-white/12 focus:ring-white/50",
                                flagged ? "ring-white/70" : "ring-white/15",
                              )}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {button}
                {after}
              </motion.div>
            </AnimatePresence>
          </form>
        </motion.div>
      </div>

      {/* Foto: no computador, a metade direita inteira (presa enquanto rola);
          no celular, de ponta a ponta embaixo do botão. */}
      <div className="relative h-[46svh] min-h-[18rem] lg:h-auto">
        <div className="lg:sticky lg:top-0 lg:h-svh">
          <ContatoFoto reason={reason} reduce={!!reduce} />
        </div>
      </div>
    </motion.section>
  );
}

/**
 * Foto do motivo, sem moldura. Troca subindo por cima da anterior (cortina);
 * com mouse: zoom no hover e um parallax leve seguindo o ponteiro.
 */
function ContatoFoto({ reason, reduce }: { reason: ContatoReason; reduce: boolean }) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 120, damping: 20, mass: 0.6 });
  const y = useSpring(py, { stiffness: 120, damping: 20, mass: 0.6 });
  const t = (duration: number) => (reduce ? { duration: 0 } : { duration, ease: SMOOTH });

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (reduce || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    px.set(((event.clientX - box.left) / box.width - 0.5) * -24);
    py.set(((event.clientY - box.top) / box.height - 0.5) * -24);
  };
  const leave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <div
      onPointerMove={move}
      onPointerLeave={leave}
      className="group absolute inset-0 overflow-hidden lg:relative lg:h-full"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={reason.key}
          className="absolute inset-0"
          initial={{ clipPath: "inset(100% 0% 0% 0%)", scale: 1.15 }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)", scale: 1 }}
          exit={{ scale: 1.06, transition: t(0.9) }}
          transition={t(0.9)}
        >
          <div className="duration-slow ease-out-standard absolute inset-0 transition-transform [@media(hover:hover)]:group-hover:scale-[1.06]">
            <motion.div style={{ x, y }} className="absolute -inset-4">
              <PhotoSlot
                image={reason.photo}
                sizes="(min-width: 1024px) 50vw, 100vw"
                placeholderClassName="bg-fernandito-verde-escuro"
              />
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
    </div>
  );
}

export default ContatoTela;
