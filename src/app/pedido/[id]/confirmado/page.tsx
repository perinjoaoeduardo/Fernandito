import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { LINKS, STORE } from "@/content/site";
import { getOrder, publicOrder } from "@/lib/store/orders";
import { OrderReceipt } from "@/components/checkout/OrderReceipt";
import { ClearCart } from "@/components/checkout/ClearCart";
import { Button } from "@/components/ui/Button";
import { EnterStagger } from "@/components/ui/EnterStagger";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  robots: { index: false, follow: false },
};

// Link do WhatsApp montado aqui (página do servidor): o WHATSAPP_HREF do
// botão mora num módulo de cliente.
const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || LINKS.whatsappNumber;
const WHATSAPP_HREF = WA_NUMBER
  ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(LINKS.whatsappMessage)}`
  : null;

export default async function ConfirmadoPage(props: PageProps<"/pedido/[id]/confirmado">) {
  if (!STORE.enabled) notFound();
  await connection();
  const { id } = await props.params;
  const order = await getOrder(id);
  if (!order) notFound();
  // Ainda não pago → volta pra tela do Pix.
  if (order.status !== "paid") redirect(`/pedido/${order.id}`);

  return (
    <main className="bg-fernandito-verde-escuro text-fernandito-off-white min-h-screen [color-scheme:light]">
      <ClearCart />
      <EnterStagger className="mx-auto flex max-w-2xl flex-col items-start gap-8 px-6 pt-[calc(8rem+var(--announcement-h))] pb-24 sm:px-10">
        <div data-enter>
          <span
            aria-hidden="true"
            className="bg-fernandito-off-white text-fernandito-verde-escuro mb-6 flex h-16 w-16 animate-[ageIn_0.7s_cubic-bezier(0.34,1.56,0.64,1)_0.3s_both] items-center justify-center rounded-full text-3xl shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
          >
            ✓
          </span>
          <p className="font-accent text-label tracking-[0.16em] uppercase opacity-70">
            Pagamento recebido
          </p>
          <h1 className="font-rampart mt-3 text-[clamp(2rem,5vw,3.25rem)] leading-[1.05]">
            Pedido confirmado! Toma Fernandito.
          </h1>
          <p className="text-body-lg mt-4 max-w-xl font-sans">
            Valeu, {order.customer.name.split(/\s+/)[0]}! O pagamento chegou e o teu kit já está na
            fila de envio.
          </p>
        </div>
        <div data-enter className="w-full">
          <OrderReceipt order={publicOrder(order)} />
        </div>
        <div data-enter className="flex flex-wrap items-center">
          <Button
            as="a"
            href="/"
            variant="primary"
            className="!bg-fernandito-off-white !text-fernandito-verde-escuro hover:!bg-fernandito-verde-medio hover:!text-fernandito-off-white"
          >
            Voltar pro site
          </Button>
          {WHATSAPP_HREF && (
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="text-label ml-5 tracking-[0.08em] uppercase underline underline-offset-4 opacity-75 hover:opacity-100"
            >
              Dúvidas? WhatsApp
            </a>
          )}
        </div>
      </EnterStagger>
    </main>
  );
}
