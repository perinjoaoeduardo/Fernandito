"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { PORTAS, STORE, type LeadForm } from "@/content/site";
import { DURATION, EASE_BEZIER } from "@/lib/gsap";
import { getLenis, scrollToTarget } from "@/lib/lenis";
import { ArrowRightIcon, CloseIcon } from "@/components/ui/icons";
import { whatsappHref } from "@/components/ui/WhatsAppButton";

/** "2026-12-12" → "12/12/2026" (o resto passa direto). */
function pretty(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/**
 * "As três portas": logo depois da Hero, cada visitante escolhe o seu
 * caminho. Casa (cartão bege, o principal) leva pro kit. Evento e negócio
 * abrem um formulário curtíssimo; ao enviar, o lead é guardado no site
 * (/api/leads, via sendBeacon) e o WhatsApp abre com a mensagem já escrita
 * — quem atende já sabe o que a pessoa quer. Fundo verde-medio (a cor
 * principal), cartões com hover que sobe de leve.
 */
export function PortasSection() {
  const [open, setOpen] = useState<LeadForm | null>(null);
  const shop = STORE.enabled;

  return (
    <section
      id="portas"
      aria-labelledby="portas-titulo"
      className="bg-fernandito-verde-medio text-fernandito-off-white w-full px-6 py-20 sm:px-10 md:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <p className="font-accent text-label text-fernandito-off-white/70 tracking-[0.18em] uppercase">
          {PORTAS.eyebrow}
        </p>
        <h2
          id="portas-titulo"
          className="font-rampart mt-3 text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1]"
        >
          {PORTAS.title}
        </h2>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {shop && (
            <li>
              <button
                type="button"
                onClick={() => scrollToTarget("#comprar")}
                className="group bg-fernandito-off-white text-fernandito-verde-escuro duration-base ease-out-standard focus-visible:outline-fernandito-off-white flex h-full w-full flex-col rounded-3xl p-6 text-left shadow-[0_18px_40px_rgba(20,28,18,0.3)] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-7"
              >
                <Door title={PORTAS.casa.title} text={PORTAS.casa.text} cta={PORTAS.casa.cta} />
              </button>
            </li>
          )}
          {PORTAS.forms.map((form) => (
            <li key={form.key}>
              <button
                type="button"
                onClick={() => setOpen(form)}
                className="group bg-fernandito-verde-escuro/35 ring-fernandito-off-white/15 hover:ring-fernandito-verde-claro duration-base ease-out-standard focus-visible:outline-fernandito-off-white flex h-full w-full flex-col rounded-3xl p-6 text-left ring-1 transition-[transform,box-shadow] hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-7"
              >
                <Door title={form.title} text={form.text} cta={form.cta} muted />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <LeadDialog form={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function Door({
  title,
  text,
  cta,
  muted,
}: {
  title: string;
  text: string;
  cta: string;
  muted?: boolean;
}) {
  return (
    <>
      <span className="font-rampart text-[1.55rem] leading-[1.05]">{title}</span>
      <span className={`text-body mt-3 flex-1 font-sans ${muted ? "opacity-75" : "opacity-80"}`}>
        {text}
      </span>
      <span className="mt-6 inline-flex items-center gap-2 font-sans text-[0.9rem] font-bold">
        {cta}
        <span className="duration-base ease-out-standard transition-transform group-hover:translate-x-1">
          <ArrowRightIcon />
        </span>
      </span>
    </>
  );
}

/** Janela do formulário (evento/negócio): poucos campos → lead + WhatsApp. */
function LeadDialog({ form, onClose }: { form: LeadForm | null; onClose: () => void }) {
  const firstRef = useRef<HTMLElement | null>(null);

  const transition = { duration: DURATION.slow, ease: EASE_BEZIER.outStandard };

  // Abriu: trava a rolagem, foco no 1º campo, Esc fecha.
  useEffect(() => {
    if (!form) return;
    const lenis = getLenis();
    lenis?.stop();
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => firstRef.current?.focus());
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [form, onClose]);

  return (
    <AnimatePresence>
      {form && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.div
            aria-hidden="true"
            className="bg-fernandito-verde-escuro/55 absolute inset-0 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={onClose}
          />
          <LeadPanel key={form.key} form={form} onClose={onClose} firstRef={firstRef} />
        </div>
      )}
    </AnimatePresence>
  );
}

/** Conteúdo da janela: estado do formulário nasce aqui (key = porta). */
function LeadPanel({
  form,
  onClose,
  firstRef,
}: {
  form: LeadForm;
  onClose: () => void;
  firstRef: RefObject<HTMLElement | null>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(form.fields.map((f) => [f.name, f.options ? f.options[0] : ""])),
  );
  const [missing, setMissing] = useState(false);
  const reduce = useReducedMotion();
  const transition = { duration: DURATION.slow, ease: EASE_BEZIER.outStandard };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (form.fields.some((f) => !values[f.name]?.trim())) {
      setMissing(true);
      return;
    }
    const fields = Object.fromEntries(
      form.fields.map((f) => [f.name, pretty(values[f.name].trim())]),
    );
    // Guarda o lead (não espera a resposta) e abre o WhatsApp na hora — no
    // mesmo clique, senão o navegador bloqueia a janela nova.
    try {
      navigator.sendBeacon(
        "/api/leads",
        new Blob([JSON.stringify({ form: form.key, fields })], { type: "application/json" }),
      );
    } catch {
      // sem beacon: segue pro WhatsApp mesmo assim
    }
    const message = form.message.replace(/\{(\w+)\}/g, (_, name: string) => fields[name] ?? "");
    const href = whatsappHref(message);
    if (href) window.open(href, "_blank", "noopener");
    onClose();
  };

  return (
    <motion.form
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-titulo"
      data-lenis-prevent
      onSubmit={submit}
      noValidate
      className="bg-fernandito-off-white text-fernandito-verde-escuro relative max-h-[calc(100svh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl p-6 font-sans shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-8"
      initial={reduce ? false : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: 40 }}
      transition={transition}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label text-fernandito-verde-medio tracking-[0.16em] uppercase">
            {form.title}
          </p>
          <h3 id="lead-titulo" className="font-rampart mt-2 text-[1.9rem] leading-[1.02]">
            {form.formTitle}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="hover:bg-fernandito-verde-escuro/10 duration-base ease-out-standard -mt-1 -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {form.fields.map((field, i) => {
          const id = `lead-${form.key}-${field.name}`;
          const common = {
            id,
            value: values[field.name] ?? "",
            className:
              "text-body border-fernandito-verde-escuro/20 focus:border-fernandito-verde-claro duration-base ease-out-standard w-full rounded-xl border-2 bg-white/60 px-4 py-3 outline-none transition-colors",
          };
          return (
            <div key={field.name} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-label tracking-[0.08em] uppercase opacity-80">
                {field.label}
              </label>
              {field.options ? (
                <select
                  {...common}
                  ref={i === 0 ? (el) => void (firstRef.current = el) : undefined}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                >
                  {field.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  {...common}
                  ref={i === 0 ? (el) => void (firstRef.current = el) : undefined}
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>

      {missing && (
        <p role="alert" className="text-label mt-4 text-red-800">
          Preenche tudo pra gente já te responder certo.
        </p>
      )}

      <button
        type="submit"
        className="bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio duration-base ease-out-standard mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.95rem] font-bold transition-[background-color,transform] active:scale-[0.98]"
      >
        {form.submit}
        <ArrowRightIcon />
      </button>
      <p className="text-label mt-3 text-center opacity-60">
        Abre o WhatsApp com a mensagem pronta. É só enviar.
      </p>
    </motion.form>
  );
}

export default PortasSection;
