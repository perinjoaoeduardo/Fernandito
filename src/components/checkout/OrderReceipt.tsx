import { formatBRL } from "@/lib/money";
import { formatDays } from "@/lib/shipping";
import type { PublicOrder } from "@/lib/store/orders";
import { Price } from "@/components/ui/Price";

/** Resumo do pedido salvo (tela do Pix e de confirmação). Sem CPF/e-mail. */
export function OrderReceipt({ order }: { order: PublicOrder }) {
  const { address } = order;
  return (
    <section
      aria-label="Resumo do pedido"
      className="border-fernandito-verde-escuro/15 w-full rounded-2xl border bg-white/40 p-6 font-sans"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-rampart text-[1.5rem] leading-none">Resumo do pedido</h2>
        <span className="text-label tracking-[0.08em] uppercase opacity-60">#{order.id}</span>
      </div>
      <ul className="mt-5 flex flex-col gap-2">
        {order.items.map((item) => (
          <li key={item.sku} className="flex justify-between gap-4">
            <span>
              {item.name} <span className="opacity-60">× {item.qty}</span>
            </span>
            <span className="tabular-nums">{formatBRL(item.unitPriceCents * item.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4">
          <span>
            Frete — {order.shipping.service}{" "}
            <span className="opacity-60">({formatDays(order.shipping.days)})</span>
          </span>
          <span className="tabular-nums">{formatBRL(order.shipping.priceCents)}</span>
        </li>
      </ul>
      <div className="border-fernandito-verde-escuro/15 mt-4 flex items-baseline justify-between border-t pt-4">
        <span className="font-bold">Total</span>
        <span className="font-rampart text-[1.75rem] leading-none tabular-nums">
          <Price cents={order.totalCents} />
        </span>
      </div>
      <p className="text-body mt-5 opacity-75">
        Entrega para {order.firstName} — {address.street}, {address.number}
        {address.complement ? ` (${address.complement})` : ""}, {address.neighborhood},{" "}
        {address.city}/{address.uf}
      </p>
    </section>
  );
}
