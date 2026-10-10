"use client";

import { clsx } from "clsx";
import type { InputHTMLAttributes, Ref } from "react";

/** Campo de formulário do checkout: rótulo, input e erro embaixo. */
export function Field({
  label,
  error,
  hint,
  className,
  id,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  id: string;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <div className={clsx("flex flex-col gap-1.5 font-sans", className)}>
      <label htmlFor={id} className="text-label tracking-[0.08em] uppercase opacity-80">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : hint ? `${id}-dica` : undefined}
        className={clsx(
          "text-body duration-base ease-out-standard w-full rounded-lg border bg-white/50 px-4 py-3 transition-colors outline-none placeholder:opacity-40 focus:bg-white/80",
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
