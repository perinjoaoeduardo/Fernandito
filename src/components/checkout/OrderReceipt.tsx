import { formatBRL } from "@/lib/money";
import { formatDays } from "@/lib/shipping";
import { splitName } from "@/lib/catalog";
import type { PublicOrder } from "@/lib/store/orders";
import { Price } from "@/components/ui/Price";

/** Resumo do pedido salvo (tela do Pix e de confirmação). Sem CPF/e-mail. */
export function OrderReceipt({ order }: { order: PublicOrder }) {
  const { address } = order;
  return (
    <section
      aria-label="Resumo do pedido"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full rounded-3xl p-7 font-sans shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-rampart translate-y-[0.06em] text-[1.5rem] leading-none">Teu pedido</h2>
        <span className="bg-fernandito-verde-escuro/[0.07] text-label rounded-full px-3 py-1 tracking-[0.06em] uppercase">
          #{order.id}
        </span>
      </div>

      <ul className="mt-6 flex flex-col gap-4">
        {order.items.map((item) => {
          const { main, sub } = splitName(item.name);
          return (
            <li key={item.sku} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-rampart text-[1.1rem] leading-tight">{main}</p>
                <p className="text-label mt-1 tracking-[0.06em] uppercase opacity-60">
                  {sub ? `${sub} · ` : ""}× {item.qty}
                </p>
              </div>
              <span className="whitespace-nowrap tabular-nums">
                {formatBRL(item.unitPriceCents * item.qty)}
              </span>
            </li>
          );
        })}
        <li className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p>Frete</p>
            <p className="text-label mt-1 tracking-[0.06em] uppercase opacity-60">
              {order.shipping.service} · {formatDays(order.shipping.days)}
            </p>
          </div>
          <span className="whitespace-nowrap tabular-nums">
            {formatBRL(order.shipping.priceCents)}
          </span>
        </li>
      </ul>

      <div className="border-fernandito-verde-escuro/12 mt-5 flex items-end justify-between border-t pt-4">
        <span className="text-label tracking-[0.1em] uppercase">Total</span>
        <span className="font-rampart text-[2rem] leading-none tabular-nums">
          <Price cents={order.totalCents} />
        </span>
      </div>

      <div className="bg-fernandito-verde-escuro/[0.05] mt-6 rounded-2xl px-4 py-3.5">
        <p className="text-label tracking-[0.1em] uppercase opacity-60">
          Entrega para {order.firstName}
        </p>
        <p className="text-body mt-1.5 leading-snug">
          {address.street}, {address.number}
          {address.complement ? ` (${address.complement})` : ""}
          <br />
          {address.neighborhood}, {address.city}/{address.uf}
        </p>
      </div>
    </section>
  );
}
