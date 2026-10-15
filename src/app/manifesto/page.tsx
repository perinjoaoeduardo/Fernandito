import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGES, PRELAUNCH } from "@/content/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { OQueESection } from "@/components/sections/OQueESection";
import { GaleriaSection } from "@/components/sections/GaleriaSection";
import { CartaSection } from "@/components/sections/CartaSection";
import { FichaTecnicaSection } from "@/components/sections/FichaTecnicaSection";
import { NextStep } from "@/components/sections/NextStep";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Manifesto",
  description: "O que tem na lata, de onde vem e no que a gente acredita.",
};

// A marca inteira: o que é, as fotos, a carta e a faixa da ficha técnica.
export default function ManifestoPage() {
  if (PRELAUNCH.enabled) notFound();
  const page = PAGES.manifesto;
  return (
    <main>
      <PageHeader eyebrow={page.eyebrow} title={page.title} intro={page.intro} />
      <OQueESection />
      <GaleriaSection />
      <CartaSection />
      <FichaTecnicaSection />
      <NextStep />
      <FooterSection />
    </main>
  );
}
