import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PRELAUNCH, STORE } from "@/content/site";
import { ComprarSection } from "@/components/sections/ComprarSection";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Comprar",
  description: "Kit Fernandito de pré-lançamento: 2 latas, copo e adesivos.",
};

// Página do kit (site completo): a compra mora aqui; a home tem a chamada.
// No pré-lançamento a compra fica dentro da home (#comprar).
export default function ComprarPage() {
  // Loja desligada (`STORE.enabled` em src/content/site.ts) → 404.
  if (!STORE.enabled) notFound();
  if (PRELAUNCH.enabled) redirect("/#comprar");
  return (
    <main>
      <ComprarSection headingLevel="h1" standalone />
      <FooterSection />
    </main>
  );
}
