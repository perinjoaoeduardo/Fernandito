import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGES, PRELAUNCH } from "@/content/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContatoHub } from "@/components/sections/ContatoHub";
import { PerguntasSection } from "@/components/sections/PerguntasSection";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fala com o Fernandito: dúvidas, pedidos, eventos, revenda e parcerias.",
};

// Um lugar só pra falar com a gente: motivos (cada um com a sua mensagem no
// WhatsApp) e, embaixo, as perguntas frequentes.
export default function ContatoPage() {
  if (PRELAUNCH.enabled) notFound();
  const page = PAGES.contato;
  return (
    <main>
      <PageHeader eyebrow={page.eyebrow} title={page.title} intro={page.intro} />
      <ContatoHub />
      <PerguntasSection />
      <FooterSection />
    </main>
  );
}
