import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STORE } from "@/content/site";
import { getLegalDoc } from "@/lib/legal";
import { LegalPage } from "@/components/legal/LegalPage";

// Texto em content/legal/termos.md (Markdown + frontmatter).
export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDoc("termos");
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: "/termos" },
  };
}

export default async function Page() {
  // Some junto com a loja (`STORE.enabled`).
  if (!STORE.enabled) notFound();
  return <LegalPage slug="termos" doc={await getLegalDoc("termos")} />;
}
