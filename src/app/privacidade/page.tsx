import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STORE } from "@/content/site";
import { getLegalDoc } from "@/lib/legal";
import { LegalPage } from "@/components/legal/LegalPage";

// Texto em content/legal/privacidade.md (Markdown + frontmatter).
export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDoc("privacidade");
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: "/privacidade" },
  };
}

export default async function Page() {
  // Some junto com a loja (`STORE.enabled`).
  if (!STORE.enabled) notFound();
  return <LegalPage slug="privacidade" doc={await getLegalDoc("privacidade")} />;
}
