import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRELAUNCH } from "@/content/site";
import { ContatoTela } from "@/components/sections/ContatoTela";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fala com o Fernandito: dúvidas, pedidos, eventos, revenda e parcerias.",
};

// Uma tela só pra falar com a gente (escolhe o motivo, responde 2–3
// perguntas, a mensagem vai pronta pro WhatsApp). As perguntas frequentes
// (PerguntasSection) saíram da página; o componente fica pra voltar se quiser.
export default function ContatoPage() {
  if (PRELAUNCH.enabled) notFound();
  return (
    <main>
      <ContatoTela />
      <FooterSection />
    </main>
  );
}
