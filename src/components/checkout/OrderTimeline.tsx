import { clsx } from "clsx";
import { LOCAL_DELIVERY } from "@/lib/shipping";
import type { Fulfillment } from "@/lib/store/fulfillment";

/**
 * Linha do tempo do pedido (página /pedido/[id]/confirmado). Lê o estado do
 * envio automático (`fulfill:<id>`): pago → nota → etiqueta com rastreio →
 * postado → entregue. Em Porto Alegre: pago → nota → saiu pra entrega →
 * entregue. Tudo do servidor; a página se atualiza sozinha (AutoRefresh).
 */
export function OrderTimeline({
  paidAt,
  shippingId,
  fulfillment: f,
}: {
  paidAt: string | null;
  shippingId: string;
  fulfillment: Fulfillment | null;
}) {
  const local = shippingId === LOCAL_DELIVERY.id;
  const stage = f?.stage ?? "invoice";
  const invoiceDone = Boolean(f?.invoice.key);
  const reached = (s: string[]) => s.includes(stage);
  const date = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;

  const steps = local
    ? [
        { title: "Pagamento confirmado", done: true, note: date(paidAt) },
        {
          title: "Nota fiscal emitida",
          done: invoiceDone,
          note: f?.invoice.number ? `Nota nº ${f.invoice.number} — vai pro teu e-mail` : null,
        },
        {
          title: "Saiu pra entrega",
          done: reached(["local", "local-delivered"]),
          note: "Entrega própria em Porto Alegre",
        },
        { title: "Entregue", done: reached(["local-delivered"]), note: null },
      ]
    : [
        { title: "Pagamento confirmado", done: true, note: date(paidAt) },
        {
          title: "Nota fiscal emitida",
          done: invoiceDone,
          note: f?.invoice.number ? `Nota nº ${f.invoice.number} — vai pro teu e-mail` : null,
        },
        {
          title: "Etiqueta pronta",
          done: reached(["ready", "posted", "delivered"]),
          note: f?.label.tracking ? `Rastreio ${f.label.tracking}` : null,
          link: f?.label.trackingUrl ?? null,
        },
        { title: "Postado na transportadora", done: reached(["posted", "delivered"]), note: null },
        { title: "Entregue", done: reached(["delivered"]), note: null },
      ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <section
      aria-label="Andamento do pedido"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full rounded-3xl p-7 font-sans shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
    >
      <h2 className="font-rampart text-[1.5rem] leading-none">Onde tá o teu pedido</h2>
      <ol className="mt-6 flex flex-col">
        {steps.map((step, i) => {
          const isCurrent = i === current;
          return (
            <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    "absolute top-7 left-[13px] h-[calc(100%-1.5rem)] w-[2px]",
                    step.done ? "bg-fernandito-verde-medio" : "bg-fernandito-verde-escuro/15",
                  )}
                />
              )}
              <span
                aria-hidden="true"
                className={clsx(
                  "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-bold",
                  step.done
                    ? "bg-fernandito-verde-medio text-fernandito-off-white"
                    : isCurrent
                      ? "ring-fernandito-verde-medio bg-fernandito-off-white ring-2"
                      : "ring-fernandito-verde-escuro/20 ring-2",
                )}
              >
                {step.done ? (
                  "✓"
                ) : isCurrent ? (
                  <span className="bg-fernandito-verde-medio h-2 w-2 animate-pulse rounded-full" />
                ) : null}
              </span>
              <div className={clsx("pt-0.5", !step.done && !isCurrent && "opacity-45")}>
                <p className="font-bold">
                  {step.title}
                  <span className="sr-only">
                    {step.done ? " (feito)" : isCurrent ? " (agora)" : ""}
                  </span>
                </p>
                {step.note && <p className="text-body mt-0.5 opacity-75">{step.note}</p>}
                {"link" in step && step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-label mt-1 inline-block tracking-[0.06em] uppercase underline underline-offset-4"
                  >
                    Acompanhar a entrega
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
