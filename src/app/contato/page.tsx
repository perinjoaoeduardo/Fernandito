import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRELAUNCH } from "@/content/site";
import { ContatoTela } from "@/components/sections/ContatoTela";
import { PerguntasSection } from "@/components/sections/PerguntasSection";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fala com o Fernandito: dúvidas, pedidos, eventos, revenda e parcerias.",
};

// Uma tela só pra falar com a gente (escolhe o motivo, responde 2–3
// perguntas, a mensagem vai pronta pro WhatsApp) e, embaixo, as perguntas
// frequentes.
export default function ContatoPage() {
  if (PRELAUNCH.enabled) notFound();
  return (
    <main>
      <ContatoTela />
      <PerguntasSection />
      <FooterSection />
    </main>
  );
}
