import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { STORE } from "@/content/site";
import { CAN_SIMULATE_PAYMENT } from "@/lib/mercadopago";
import { refreshOrder } from "@/lib/store/checkout";
import { getOrder, publicOrder } from "@/lib/store/orders";
import { PixPayment } from "@/components/checkout/PixPayment";

export const metadata: Metadata = {
  title: "Pagamento Pix",
  robots: { index: false, follow: false },
};

// Tela do Pix: QR, copia e cola, contador e polling até pagar/expirar.
export default async function PedidoPage(props: PageProps<"/pedido/[id]">) {
  if (!STORE.enabled) notFound();
  await connection();
  const { id } = await props.params;
  const stored = await getOrder(id);
  if (!stored) notFound();
  const order = await refreshOrder(stored);
  if (order.status === "paid") redirect(`/pedido/${order.id}/confirmado`);

  return (
    <main className="bg-fernandito-verde-medio text-fernandito-off-white min-h-screen [color-scheme:light]">
      <div className="mx-auto max-w-6xl px-6 pt-[calc(8rem+var(--announcement-h))] pb-24 sm:px-10">
        <PixPayment
          order={publicOrder(order)}
          simulated={order.simulated}
          canSimulate={CAN_SIMULATE_PAYMENT}
        />
      </div>
    </main>
  );
}
