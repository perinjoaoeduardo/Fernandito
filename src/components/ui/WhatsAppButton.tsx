"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

// Número comercial ainda não definido — ver README ("Ativar o botão do
// WhatsApp") para como preencher em produção (Vercel > Environment Variables).
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
const WHATSAPP_MESSAGE = "Oi! Quero comprar Fernandito 🐎";

type WhatsAppButtonProps = {
  children: ReactNode;
  className?: string;
  /** Fundo sólido do botão — "verde-medio" (padrão, CTA de seção) ou
   * "verde-escuro" (usado no FloatingNav, que já tem fundo off-white). */
  background?: "verde-medio" | "verde-escuro";
};

export function WhatsAppButton({
  children,
  className,
  background = "verde-medio",
}: WhatsAppButtonProps) {
  // `!` força a sobrescrita do bg-fernandito-verde-medio da variante
  // "whatsapp" do Button, já que a ordem das classes no JSX não garante
  // qual delas "vence" no CSS gerado pelo Tailwind.
  const bgOverride = background === "verde-escuro" ? "!bg-fernandito-verde-escuro" : undefined;

  if (!WHATSAPP_NUMBER) {
    // `aria-disabled` em vez do atributo `disabled` nativo: alguns
    // navegadores (Firefox, principalmente) simplesmente não disparam
    // eventos de mouse/hover em elementos com `disabled` nativo — o que
    // quebrava tanto o tooltip "Em breve" quanto o CustomCursor global
    // nesse botão. `aria-disabled` mantém o botão focável/hoverável (correto
    // pra acessibilidade — dá pra descobrir por que a ação está indisponível)
    // e o clique é barrado via `onClick` com `preventDefault`.
    return (
      <Button
        as="button"
        type="button"
        variant="whatsapp"
        onClick={(event) => event.preventDefault()}
        title="Em breve"
        aria-disabled="true"
        className={clsx(bgOverride, "cursor-not-allowed opacity-60 hover:opacity-60", className)}
      >
        {children}
      </Button>
    );
  }

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <Button
      as="a"
      href={href}
      variant="whatsapp"
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(bgOverride, className)}
    >
      {children}
    </Button>
  );
}

export default WhatsAppButton;
