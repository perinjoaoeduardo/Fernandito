import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STORE } from "@/content/site";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { CAN_SIMULATE_PAYMENT } from "@/lib/mercadopago";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  // Loja desligada (`STORE.enabled` em src/content/site.ts) → 404.
  if (!STORE.enabled) notFound();
  return (
    <main className="bg-fernandito-verde-medio text-fernandito-off-white min-h-svh [color-scheme:light]">
      <div className="mx-auto max-w-6xl px-5 pt-[calc(7.5rem+var(--announcement-h))] pb-24 sm:px-10">
        <CheckoutClient canSimulate={CAN_SIMULATE_PAYMENT} />
      </div>
    </main>
  );
}
