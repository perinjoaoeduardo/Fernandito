"use client";

import { clsx } from "clsx";
import type { InputHTMLAttributes, Ref } from "react";

/** Campo de formulário do checkout: rótulo, input e erro embaixo. */
export function Field({
  label,
  error,
  hint,
  aside,
  className,
  id,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /** Recado curto à direita do rótulo (ex.: "Só pra nota fiscal"). */
  aside?: string;
  id: string;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <div className={clsx("flex flex-col gap-1.5 font-sans", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label font-bold tracking-[0.08em] uppercase">
          {label}
        </label>
        {aside && <span className="text-label opacity-55">{aside}</span>}
      </div>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : hint ? `${id}-dica` : undefined}
        className={clsx(
          "text-body duration-base ease-out-standard w-full rounded-xl border bg-white/70 px-4 py-3.5 shadow-[inset_0_1px_2px_rgba(36,48,34,0.06)] transition-[background-color,border-color,box-shadow] outline-none placeholder:opacity-40 focus:bg-white focus:shadow-[0_0_0_4px_rgba(64,81,57,0.18)] [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#f8f8f1] [&:-webkit-autofill]:[-webkit-text-fill-color:#243022] [&:-webkit-autofill]:[transition:background-color_9999s_ease-out]",
          error
            ? "border-red-700/70 focus:border-red-700"
            : "border-fernandito-verde-escuro/25 focus:border-fernandito-verde-medio",
        )}
        {...input}
      />
      {error ? (
        <p id={`${id}-erro`} className="text-label text-red-800">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-dica`} className="text-label opacity-60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default Field;
