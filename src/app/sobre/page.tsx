import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGES, PRELAUNCH } from "@/content/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { OQueESection } from "@/components/sections/OQueESection";
import { FichaTecnicaSection } from "@/components/sections/FichaTecnicaSection";
import { NextStep } from "@/components/sections/NextStep";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Sobre",
  description: "O que tem na lata, de onde vem e quem está por trás do Fernandito.",
};

// Sobre: o produto em detalhe (O que é + faixa da ficha técnica). Quem faz
// (a história e os sócios) entra aqui quando o texto estiver pronto.
export default function SobrePage() {
  if (PRELAUNCH.enabled) notFound();
  const page = PAGES.sobre;
  return (
    <main>
      <PageHeader eyebrow={page.eyebrow} title={page.title} intro={page.intro} />
      <OQueESection />
      <FichaTecnicaSection />
      <NextStep />
      <FooterSection />
    </main>
  );
}
