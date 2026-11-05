import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { ACTIVE_PRODUCTS } from "@/lib/catalog";
import { stockRemaining } from "@/lib/store/stock";
import { PRELAUNCH, STORE } from "@/content/site";
import { LojaSection } from "@/components/sections/LojaSection";
import { FooterSection } from "@/components/sections/FooterSection";

export const metadata: Metadata = {
  title: "Loja",
  description: "Six pack e kit do Fernandito, fernet y cola em lata.",
};

// Loja (site completo): os produtos lado a lado; cada um tem a sua página
// (/comprar/<slug>). No pré-lançamento a compra fica dentro da home.
export default async function ComprarPage() {
  // Loja desligada (`STORE.enabled` em src/content/site.ts) → 404.
  if (!STORE.enabled) notFound();
  if (PRELAUNCH.enabled) redirect("/#comprar");
  await connection();
  // Os à venda primeiro; o que esgotou (teto do site) vai pro fim.
  const left = await Promise.all(
    ACTIVE_PRODUCTS.map((p) => stockRemaining(p.sku).catch(() => null)),
  );
  // Six pack primeiro (posição no catálogo); o que esgotou vai pro fim.
  const order = ACTIVE_PRODUCTS.map((p, i) => ({ sku: p.sku, out: left[i] === 0, pos: p.position }))
    .sort((a, b) => Number(a.out) - Number(b.out) || a.pos - b.pos)
    .map((p) => p.sku);
  return (
    <main>
      <LojaSection order={order} />
      <FooterSection />
    </main>
  );
}
