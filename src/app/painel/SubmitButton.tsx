"use client";

import { useFormStatus } from "react-dom";
import { btn } from "./ui";

/** Botão de formulário com retorno ao toque: desabilita e troca o texto enquanto envia. */
export function SubmitButton({
  children,
  pending: pendingText = "Salvando…",
  variant = "secondary",
  size = "md",
}: {
  children: React.ReactNode;
  pending?: string;
  variant?: "primary" | "secondary";
  size?: "md" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      aria-busy={pending}
      className={`${btn(variant, size)} disabled:opacity-60`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
