"use client";

import { Trash2, X } from "lucide-react";
import { btn } from "./ui";

// Peças comuns das telas de Produção (Producao.tsx e Lotes.tsx).

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (n: number, max = 1) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: max });
export const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
/** "0,95" / "1.234,50" / "12" → centavos. */
export const toCents = (v: string) => {
  const n = Number(
    v
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, ""),
  );
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
export const fromCents = (c: number) => (c / 100).toFixed(2).replace(".", ",");
/** "2026-12-08" → "ter., 08/12". */
export const dia = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

export const INPUT =
  "border-lk-input focus:border-lk-action focus:ring-lk-action/15 h-10 rounded-lg border bg-white px-3 outline-none focus:ring-4";
export const LABEL = "flex flex-col gap-1.5 text-sm";
export const HINT = "text-lk-ink3 text-xs";

export const novoId = (p: string) =>
  `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** Painel lateral (gaveta) com rodapé de Excluir / Cancelar / Salvar. */
export function Drawer({
  title,
  isNew,
  ok,
  onCancel,
  onSave,
  onDelete,
  children,
}: {
  title: string;
  isNew: boolean;
  ok: boolean;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[600] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onCancel}
        className="absolute inset-0 bg-black/30"
      />
      <div className="border-lk-border relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l bg-white shadow-2xl">
        <div className="border-lk-border flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className={btn("ghost", "sm")}
            aria-label="Fechar"
          >
            <X aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-5 px-6 py-5">{children}</div>
        <div className="border-lk-border mt-auto flex items-center justify-between gap-2 border-t px-6 py-4">
          {!isNew ? (
            <button
              type="button"
              className={`${btn("ghost", "sm")} text-lk-fail`}
              onClick={onDelete}
            >
              <Trash2 aria-hidden />
              Excluir
            </button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <button type="button" className={btn("secondary")} onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className={btn("primary")} disabled={!ok} onClick={onSave}>
              Salvar
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Campo numérico com rótulo e dica. */
export function NumField({
  label,
  value,
  onChange,
  hint,
  step = "any",
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  step?: number | "any";
  max?: number;
}) {
  return (
    <label className={LABEL}>
      <span className="font-medium">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        step={step}
        className={`${INPUT} text-right tabular-nums`}
        value={value}
        onChange={(e) => {
          const n = Math.max(0, Number(e.target.value) || 0);
          onChange(max === undefined ? n : Math.min(max, n));
        }}
      />
      {hint && <span className={HINT}>{hint}</span>}
    </label>
  );
}

/** Campo pequeno dentro de tabela (data, número). */
export const MINI =
  "border-lk-input focus:border-lk-action focus:ring-lk-action/15 h-8 rounded-md border bg-white px-2 text-[13px] tabular-nums outline-none focus:ring-2";
