"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

// Número comercial ainda não definido — ver README ("Ativar o botão do
// WhatsApp") para como preencher em produção (Vercel > Environment Variables).
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
const WHATSAPP_MESSAGE = "Oi! Quero comprar Fernandito 🐎";

type WhatsAppButtonProps = {
  children: ReactNode;
  className?: string;
};

export function WhatsAppButton({ children, className }: WhatsAppButtonProps) {
  if (!WHATSAPP_NUMBER) {
    return (
      <Button
        as="button"
        type="button"
        variant="whatsapp"
        disabled
        title="Em breve"
        aria-disabled="true"
        className={`cursor-not-allowed opacity-60 hover:opacity-60 ${className ?? ""}`}
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
      className={className}
    >
      {children}
    </Button>
  );
}

export default WhatsAppButton;
