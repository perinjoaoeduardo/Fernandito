"use client";

import { clsx } from "clsx";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";

/** Seletor de quantidade − n +, usado na página de compra e no carrinho. */
export function QtyStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  tone = "light",
  size = "md",
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** Nome acessível, ex.: "Quantidade do Kit Fernandito". */
  label: string;
  /** "light" = sobre fundo claro; "dark" = sobre fundo escuro. */
  tone?: "light" | "dark";
  size?: "sm" | "md";
}) {
  const button = clsx(
    "duration-base ease-out-standard flex items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    size === "sm" ? "h-8 w-8" : "h-10 w-10",
    tone === "light"
      ? "hover:bg-fernandito-verde-escuro/10 focus-visible:outline-fernandito-verde-medio"
      : "hover:bg-fernandito-off-white/10 focus-visible:outline-fernandito-off-white",
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border p-1 font-sans",
        tone === "light" ? "border-fernandito-verde-escuro/25" : "border-fernandito-off-white/25",
      )}
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Diminuir quantidade"
      >
        <MinusIcon />
      </button>
      <output
        aria-live="polite"
        className={clsx(
          "text-center tabular-nums",
          size === "sm" ? "text-body w-6" : "text-body-lg w-8",
        )}
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Aumentar quantidade"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

export default QtyStepper;
