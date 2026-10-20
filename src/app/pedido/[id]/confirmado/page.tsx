import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { after, connection } from "next/server";
import { LINKS, STORE } from "@/content/site";
import { getOrder, publicOrder } from "@/lib/store/orders";
import { OrderReceipt } from "@/components/checkout/OrderReceipt";
import { ClearCart } from "@/components/checkout/ClearCart";
import { Button } from "@/components/ui/Button";
import { EnterStagger } from "@/components/ui/EnterStagger";
import { OrderTimeline } from "@/components/checkout/OrderTimeline";
import { AutoRefresh } from "@/components/checkout/AutoRefresh";
import { advanceFulfillment, getFulfillment, isStale } from "@/lib/store/fulfillment";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  robots: { index: false, follow: false },
};

// Link do WhatsApp montado aqui (página do servidor): o WHATSAPP_HREF do
// botão mora num módulo de cliente.
const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || LINKS.whatsappNumber;
// Já vai com o número do pedido: quem atende acha ele no painel na hora.
const whatsappFor = (id: string) =>
  WA_NUMBER
    ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Oi! Sobre o meu pedido #${id}: `)}`
    : null;

export default async function ConfirmadoPage(props: PageProps<"/pedido/[id]/confirmado">) {
  if (!STORE.enabled) notFound();
  await connection();
  const { id } = await props.params;
  const order = await getOrder(id);
  if (!order) notFound();
  // Ainda não pago → volta pra tela do Pix.
  if (order.status !== "paid") redirect(`/pedido/${order.id}`);
  const fulfillment = await getFulfillment(order.id);
  const finished = ["delivered", "local-delivered"].includes(fulfillment?.stage ?? "");
  // Página aberta = dá um empurrão no envio (no máximo a cada 2 min).
  if (!finished && isStale(fulfillment))
    after(() => advanceFulfillment(order.id).then(() => undefined));

  return (
    <main className="bg-fernandito-verde-medio text-fernandito-off-white min-h-screen [color-scheme:light]">
      <ClearCart />
      {!finished && <AutoRefresh seconds={30} />}
      <EnterStagger className="mx-auto flex max-w-2xl flex-col items-start gap-8 px-6 pt-[calc(8rem+var(--announcement-h))] pb-24 sm:px-10">
        <div data-enter>
          <p className="font-accent text-label tracking-[0.16em] uppercase opacity-70">
            Pagamento recebido
          </p>
          <h1 className="font-rampart mt-3 text-[clamp(2rem,5vw,3.25rem)] leading-[1.05]">
            Pedido confirmado!
          </h1>
          <p className="text-body-lg mt-4 max-w-xl font-sans">
            Valeu, {order.customer.name.split(/\s+/)[0]}! O pagamento chegou e o teu kit já está na
            fila de envio.
          </p>
        </div>
        <div data-enter className="w-full">
          <OrderTimeline
            paidAt={order.paidAt}
            shippingId={order.shipping.id}
            fulfillment={fulfillment}
          />
          <p className="text-label mt-3 tracking-[0.04em] opacity-70">
            Guarda este link: é aqui que tu acompanha o pedido. Atualiza sozinho.
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
          {whatsappFor(order.id) && (
            <a
              href={whatsappFor(order.id)!}
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
