import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGES, PORTAS, PRELAUNCH } from "@/content/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadForm } from "@/components/sections/LeadForm";
import { NextStep } from "@/components/sections/NextStep";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Eventos",
  description: "Fernandito na tua festa, formatura, casamento ou evento da empresa.",
};

// Porta "No teu evento": como funciona (3 passos) + formulário curto que
// vira lead e abre o WhatsApp com a mensagem pronta.
export default function EventosPage() {
  if (PRELAUNCH.enabled) notFound();
  const page = PAGES.eventos;
  const form = PORTAS.forms.find((f) => f.key === "evento")!;
  return (
    <main>
      <PageHeader eyebrow={page.eyebrow} title={page.title} intro={page.intro} />
      <section className="bg-fernandito-verde-medio text-fernandito-off-white w-full px-6 pb-20 sm:px-10 md:pb-28 lg:px-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <ol className="grid gap-6 font-sans">
            {page.steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4">
                <span className="font-rampart text-fernandito-verde-claro text-[2.4rem] leading-none brightness-150">
                  {i + 1}
                </span>
                <div>
                  <p className="text-body-lg font-bold">{step.title}</p>
                  <p className="text-body mt-1 opacity-75">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <LeadForm form={form} />
        </div>
      </section>
      <NextStep />
      <FooterSection />
    </main>
  );
}
