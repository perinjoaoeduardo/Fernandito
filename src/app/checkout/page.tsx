import type { Metadata } from "next";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <main className="bg-fernandito-off-white text-fernandito-verde-escuro min-h-screen [color-scheme:light]">
      <div className="mx-auto max-w-6xl px-6 pt-[calc(8rem+var(--announcement-h))] pb-24 sm:px-10">
        <CheckoutClient />
      </div>
    </main>
  );
}
