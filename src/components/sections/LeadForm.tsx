"use client";

import { useState, type FormEvent } from "react";
import type { LeadForm as LeadFormConfig } from "@/content/site";
import { ArrowRightIcon } from "@/components/ui/icons";
import { whatsappHref } from "@/components/ui/WhatsAppButton";

/** "2026-12-12" → "12/12/2026" (o resto passa direto). */
function pretty(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/**
 * Formulário curtíssimo dos motivos Evento e Revenda do Contato (campos em
 * `LEAD_FORMS`). Ao enviar: guarda o lead (/api/leads, sendBeacon — não
 * espera) e abre o WhatsApp com a mensagem já escrita, no mesmo clique (senão
 * o navegador bloqueia a janela nova). Cartão bege sobre o verde.
 */
export function LeadForm({ form }: { form: LeadFormConfig }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(form.fields.map((f) => [f.name, f.options ? f.options[0] : ""])),
  );
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (form.fields.some((f) => !values[f.name]?.trim())) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const fields = Object.fromEntries(
      form.fields.map((f) => [f.name, pretty(values[f.name].trim())]),
    );
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
    setSent(true);
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={`lead-${form.key}-titulo`}
      className="bg-fernandito-off-white text-fernandito-verde-escuro rounded-3xl p-6 font-sans shadow-[0_30px_70px_rgba(20,28,18,0.35)] sm:p-8"
    >
      <h2 id={`lead-${form.key}-titulo`} className="font-rampart text-[1.9rem] leading-[1.02]">
        {form.formTitle}
      </h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {form.fields.map((field) => {
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
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                >
                  {field.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  {...common}
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
        <p className="text-label mt-4 text-red-800" aria-live="polite">
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
      <p className="text-label mt-3 text-center opacity-60" aria-live="polite">
        {sent
          ? "Abrimos o WhatsApp. É só enviar a mensagem."
          : "Abre o WhatsApp com a mensagem pronta. É só enviar."}
      </p>
    </form>
  );
}

export default LeadForm;
