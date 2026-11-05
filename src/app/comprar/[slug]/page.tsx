import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PRELAUNCH, STORE } from "@/content/site";
import { ACTIVE_PRODUCTS, getProductBySlug } from "@/lib/catalog";
import { ComprarSection } from "@/components/sections/ComprarSection";
import { FooterSection } from "@/components/sections/FooterSection";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ACTIVE_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProductBySlug((await params).slug);
  return product ? { title: product.name, description: product.description } : {};
}

// Página de um produto: galeria, o que vem, preço e "Adicionar ao carrinho".
export default async function ProdutoPage({ params }: Props) {
  if (!STORE.enabled) notFound();
  if (PRELAUNCH.enabled) redirect("/#comprar");
  const product = getProductBySlug((await params).slug);
  if (!product) notFound();
  return (
    <main>
      <ComprarSection
        headingLevel="h1"
        standalone
        product={product}
        back={{ href: "/comprar", label: "Loja" }}
      />
      <FooterSection />
    </main>
  );
}
