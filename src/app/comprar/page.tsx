import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STORE } from "@/content/site";
import { ComprarSection } from "@/components/sections/ComprarSection";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Comprar o Kit Pré-Lançamento",
  description:
    "Compre o Kit Fernandito Pré-Lançamento: 2 latas de fernet com cola 350ml, copo e adesivos. Edição limitada, pagamento por Pix. Venda proibida para menores de 18 anos.",
  alternates: { canonical: "/comprar" },
};

export default function ComprarPage() {
  // Loja desligada (`STORE.enabled` em src/content/site.ts) → 404.
  if (!STORE.enabled) notFound();
  return (
    <main className="pt-[calc(4rem+var(--announcement-h))]">
      <ComprarSection headingLevel="h1" />
      <FooterSection />
    </main>
  );
}
