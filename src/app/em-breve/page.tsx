import type { Metadata } from "next";
import Image from "next/image";
import { Logo } from "@/components/ui/Logo";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { InstagramIcon } from "@/components/ui/icons";
import { FOOTER, LINKS, PRELAUNCH } from "@/content/site";

export const metadata: Metadata = {
  title: "Em breve",
  description: PRELAUNCH.text,
};

// Página de quem ainda não tem convite (ver `ACESSO` e src/proxy.ts): a
// mesma mensagem do pré-lançamento, sem loja nem menu.
export default function EmBrevePage() {
  return (
    <main className="bg-fernandito-verde-escuro text-fernandito-off-white relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <Image
        src="/images/hero-rotulo.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div aria-hidden="true" className="bg-fernandito-verde-escuro absolute inset-0 opacity-80" />
      <div className="relative flex w-full max-w-xl flex-col items-center">
        <h1 className="sr-only">Fernandito</h1>
        <Logo aria-hidden className="max-w-[300px] sm:max-w-[420px]" />
        <p className="font-rampart mt-10 text-[clamp(1.6rem,4vw,2.4rem)] leading-[1.1] uppercase">
          {PRELAUNCH.title}
        </p>
        <p className="mt-4 font-sans text-[1rem] opacity-80">{PRELAUNCH.text}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <WhatsAppButton background="verde-escuro">{PRELAUNCH.cta}</WhatsAppButton>
          <a
            href={LINKS.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-fernandito-off-white/40 text-body hover:bg-fernandito-off-white/10 inline-flex items-center gap-2 rounded-full border px-6 py-3 font-sans transition-colors"
          >
            <InstagramIcon className="h-4 w-4" />
            {LINKS.instagramHandle}
          </a>
        </div>
      </div>
      <p className="relative mt-16 max-w-md font-sans text-[12px] leading-relaxed opacity-60">
        {FOOTER.alcoholNotice}
        <br />
        {FOOTER.company}
      </p>
    </main>
  );
}
