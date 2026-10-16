"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import NextLink from "next/link";
import { useState, type FormEvent } from "react";
import { PAGES, type ContatoReason } from "@/content/site";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { ArrowRightIcon } from "@/components/ui/icons";
import { whatsappHref } from "@/components/ui/WhatsAppButton";

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

/** Mensagem montada com as respostas; o que falta vira "___". */
function compose(reason: ContatoReason, values: Values, blank = "___") {
  return reason.message
    .replace(/\{(\w+)\}/g, (_, name: string) => {
      const field = reason.fields.find((f) => f.name === name);
      const value = values[name]?.trim();
      return value || (field?.optional ? "" : blank);
    })
    .replace(/ {2,}/g, " ")
    .replace(/ \./g, ".");
}

/**
 * Página Contato numa tela só: "Quero o Fernandito ___" + os três caminhos
 * (pra mim, evento, negócio). Ao escolher, a tela inteira troca de cor, a
 * foto sobe por cima da anterior (como a cortina das trocas de página) e a
 * palavra do título desliza. Só nome e o que a pessoa quer — o mínimo de
 * contexto —, e a mensagem do WhatsApp se monta ao vivo
 * (no computador, por cima da foto). Ao mandar: guarda o lead (sendBeacon,
 * não espera) e abre o WhatsApp no mesmo clique — senão o navegador bloqueia.
 * Textos em `PAGES.contato`.
 */
export function ContatoTela() {
  const page = PAGES.contato;
  const reduce = useReducedMotion();
  const [activeKey, setActiveKey] = useState(page.reasons[0].key);
  const [values, setValues] = useState<Record<string, Values>>({});
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);

  const reason = page.reasons.find((r) => r.key === activeKey) ?? page.reasons[0];
  const theme = THEMES[reason.theme];
  const current = values[reason.key] ?? {};
  const isMissing = (name: string) =>
    !reason.fields.find((f) => f.name === name)?.optional && !current[name]?.trim();

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
    if (reason.fields.some((f) => isMissing(f.name))) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const fields = Object.fromEntries(
      reason.fields.map((f) => [f.name, current[f.name]?.trim() ?? ""]),
    );
    try {
      navigator.sendBeacon(
        "/api/leads",
        new Blob([JSON.stringify({ form: reason.key, fields })], { type: "application/json" }),
      );
    } catch {
      // sem beacon: segue pro WhatsApp mesmo assim
    }
    const href = whatsappHref(compose(reason, current, ""));
    if (href) window.open(href, "_blank", "noopener");
    setSent(true);
  };

  const t = (duration: number) => (reduce ? { duration: 0 } : { duration, ease: SMOOTH });

  // Cartão da mensagem + botão. Mora por cima da foto no computador e
  // depois das perguntas no celular (renderizado nos dois lugares; um fica
  // escondido em cada tamanho).
  const messageCard = (className: string) => (
    <div
      className={clsx(
        "rounded-3xl p-5 font-sans shadow-[0_30px_70px_rgba(20,28,18,0.35)] transition-colors duration-700 sm:p-6",
        theme.dark
          ? "bg-fernandito-off-white text-fernandito-verde-escuro"
          : "bg-fernandito-verde-escuro text-fernandito-off-white",
        className,
      )}
    >
      <p className="text-label tracking-[0.12em] uppercase opacity-60">{page.preview}</p>
      <p
        aria-live="polite"
        className="font-accent mt-2 text-[0.95rem] leading-relaxed whitespace-pre-line"
      >
        {compose(reason, current)}
      </p>
      <button
        type="submit"
        form="contato-form"
        className={clsx(
          "duration-base ease-out-standard mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.95rem] font-bold transition-[background-color,transform] active:scale-[0.98]",
          theme.dark
            ? "bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio"
            : "bg-fernandito-off-white text-fernandito-verde-escuro hover:bg-fernandito-verde-claro hover:text-fernandito-off-white",
        )}
      >
        {page.submit}
        <ArrowRightIcon />
      </button>
      <p className="text-label mt-3 text-center opacity-60" aria-live="polite">
        {missing ? page.missing : sent ? page.sent : page.hint}
      </p>
    </div>
  );

  return (
    <motion.section
      aria-label="Fala com a gente"
      initial={false}
      animate={{ backgroundColor: theme.bg, color: theme.fg }}
      transition={t(0.7)}
      className="w-full px-6 pt-[calc(7.5rem+var(--announcement-h))] pb-14 sm:px-10 lg:min-h-svh lg:px-16 lg:pb-10"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:grid-rows-[auto_1fr]">
        {/* Título + motivos */}
        <div>
          <NextLink
            href="/"
            className="text-label duration-base ease-out-standard inline-flex items-center gap-2 font-sans tracking-[0.1em] uppercase opacity-70 transition-opacity hover:opacity-100"
          >
            <span aria-hidden="true">←</span> Início
          </NextLink>
          <h1 className="font-rampart mt-5 text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[0.98] lg:text-[min(3.6vw,3.25rem)]">
            <span className="block lg:whitespace-nowrap">{page.lead}</span>
            {/* A palavra final desliza: a nova sobe de baixo, a velha sai
                por cima, cortadas pela máscara da linha. */}
            <span className="relative -mt-[0.18em] block overflow-hidden pt-[0.18em] pb-[0.08em]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={reason.key}
                  className="block"
                  initial={{ y: "105%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-105%" }}
                  transition={t(0.6)}
                >
                  {reason.word}
                </motion.span>
              </AnimatePresence>
            </span>
          </h1>

          <div
            role="radiogroup"
            aria-label="Motivo do contato"
            className="mt-7 flex flex-wrap gap-2 lg:mt-6"
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
                    "relative h-11 rounded-full px-5 font-sans text-[0.9rem] font-bold ring-1 transition-colors duration-500",
                    on ? "ring-transparent" : "opacity-85 ring-current/30 hover:opacity-100",
                    on &&
                      (theme.dark ? "text-fernandito-verde-escuro" : "text-fernandito-off-white"),
                  )}
                >
                  {/* O destaque desliza de um motivo pro outro. */}
                  {on && (
                    <motion.span
                      layoutId="contato-motivo"
                      transition={
                        reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }
                      }
                      className={clsx(
                        "absolute inset-0 rounded-full transition-colors duration-700",
                        theme.dark ? "bg-fernandito-off-white" : "bg-fernandito-verde-escuro",
                      )}
                    />
                  )}
                  <span className="relative">{r.chip}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Foto: a nova sobe por cima da anterior. No celular é uma faixa
            entre os motivos e as perguntas; no computador, a coluna inteira
            da direita, com a mensagem por cima. */}
        <div className="relative lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="relative aspect-[2/1] overflow-hidden rounded-3xl sm:aspect-[16/10] lg:sticky lg:top-[calc(7.5rem+var(--announcement-h))] lg:aspect-auto lg:h-[calc(100svh-10rem-var(--announcement-h))] lg:min-h-[34rem]">
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
                  sizes="(max-width: 1023px) 100vw, 45vw"
                  placeholderClassName="bg-fernandito-verde-escuro"
                />
              </motion.div>
            </AnimatePresence>
            <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
            <div className="absolute inset-x-5 bottom-5 hidden lg:block">{messageCard("")}</div>
          </div>
        </div>

        {/* Nome e objetivo: entram em cascata a cada troca de caminho. */}
        <form id="contato-form" onSubmit={submit} noValidate className="lg:col-start-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={reason.key}
              initial="hide"
              animate="show"
              exit="out"
              variants={{
                show: { transition: { staggerChildren: reduce ? 0 : 0.06 } },
                out: { opacity: 0, y: -10, transition: t(0.2) },
              }}
              className="flex flex-col gap-6 lg:gap-5"
            >
              {reason.fields.map((field) => {
                const id = `contato-${reason.key}-${field.name}`;
                const flagged = missing && isMissing(field.name);
                return (
                  <motion.div
                    key={field.name}
                    variants={{ hide: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                    transition={t(0.5)}
                  >
                    <p
                      id={`${id}-label`}
                      className={clsx(
                        "text-label font-sans tracking-[0.12em] uppercase",
                        flagged
                          ? "underline decoration-2 underline-offset-4 opacity-100"
                          : "opacity-70",
                      )}
                    >
                      {field.label}
                      {field.optional && <span className="opacity-70"> · se tiver</span>}
                    </p>
                    {field.options ? (
                      <div
                        role="radiogroup"
                        aria-labelledby={`${id}-label`}
                        className="mt-2.5 flex flex-wrap gap-2"
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
                                "duration-base ease-out-standard h-10 rounded-full px-4 font-sans text-[0.85rem] font-bold transition-[background-color,color,box-shadow,transform] active:scale-[0.96]",
                                on
                                  ? theme.dark
                                    ? "bg-fernandito-off-white text-fernandito-verde-escuro"
                                    : "bg-fernandito-verde-escuro text-fernandito-off-white"
                                  : "ring-1 ring-current/30 hover:ring-current/70",
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
                        aria-labelledby={`${id}-label`}
                        value={current[field.name] ?? ""}
                        placeholder={field.placeholder}
                        maxLength={100}
                        onChange={(e) => set(field.name, e.target.value)}
                        className="text-body-lg mt-1.5 w-full max-w-md border-b-2 border-current/30 bg-transparent py-2 font-sans transition-colors outline-none placeholder:opacity-45 focus:border-current"
                      />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
          {messageCard("mt-8 lg:hidden")}
        </form>
      </div>
    </motion.section>
  );
}

export default ContatoTela;
