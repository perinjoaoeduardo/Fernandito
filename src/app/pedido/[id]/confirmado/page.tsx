import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { STORE } from "@/content/site";
import { getOrder, publicOrder } from "@/lib/store/orders";
import { OrderReceipt } from "@/components/checkout/OrderReceipt";
import { ClearCart } from "@/components/checkout/ClearCart";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  robots: { index: false, follow: false },
};

export default async function ConfirmadoPage(props: PageProps<"/pedido/[id]/confirmado">) {
  if (!STORE.enabled) notFound();
  await connection();
  const { id } = await props.params;
  const order = await getOrder(id);
  if (!order) notFound();
  // Ainda não pago → volta pra tela do Pix.
  if (order.status !== "paid") redirect(`/pedido/${order.id}`);

  return (
    <main className="bg-fernandito-off-white text-fernandito-verde-escuro min-h-screen [color-scheme:light]">
      <ClearCart />
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-8 px-6 pt-[calc(8rem+var(--announcement-h))] pb-24 sm:px-10">
        <div>
          <p className="font-accent text-label tracking-[0.16em] uppercase opacity-70">
            Pagamento recebido
          </p>
          <h1 className="font-rampart mt-3 text-[clamp(2.25rem,6vw,4rem)] leading-[1.05]">
            Pedido confirmado! Toma Fernandito.
          </h1>
          <p className="text-body-lg mt-4 max-w-xl font-sans">
            Valeu, {order.customer.name.split(/\s+/)[0]}! Teu pagamento chegou. Guarda o número do
            pedido (#{order.id}) — qualquer dúvida, é só chamar a gente no WhatsApp.
          </p>
        </div>
        <OrderReceipt order={publicOrder(order)} />
        <Button as="a" href="/" variant="secondary">
          Voltar pro site
        </Button>
      </div>
    </main>
  );
}
