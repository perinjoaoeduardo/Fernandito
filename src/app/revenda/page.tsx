import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGES, PORTAS, PRELAUNCH } from "@/content/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadForm } from "@/components/sections/LeadForm";
import { NextStep } from "@/components/sections/NextStep";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Revenda",
  description: "Fernandito no teu bar, restaurante, mercado ou empório.",
};

// Porta "No teu negócio": por que vender + formulário curto → lead + WhatsApp.
export default function RevendaPage() {
  if (PRELAUNCH.enabled) notFound();
  const page = PAGES.revenda;
  const form = PORTAS.forms.find((f) => f.key === "negocio")!;
  return (
    <main>
      <PageHeader eyebrow={page.eyebrow} title={page.title} intro={page.intro} />
      <section className="bg-fernandito-verde-medio text-fernandito-off-white w-full px-6 pb-20 sm:px-10 md:pb-28 lg:px-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <ul className="border-fernandito-off-white/15 border-t font-sans">
            {page.reasons.map((reason) => (
              <li key={reason.title} className="border-fernandito-off-white/15 border-b py-5">
                <p className="text-body-lg font-bold">{reason.title}</p>
                <p className="text-body mt-1 opacity-75">{reason.text}</p>
              </li>
            ))}
          </ul>
          <LeadForm form={form} />
        </div>
      </section>
      <NextStep />
      <FooterSection />
    </main>
  );
}
