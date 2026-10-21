import type { Metadata } from "next";
import { connection } from "next/server";
import { ACTIVE_PRODUCTS } from "@/lib/catalog";
import { painelAuthed } from "@/lib/painel";
import { ALL_SET } from "@/lib/store/checkout";
import { getFulfillment, type FulfillStage, type Fulfillment } from "@/lib/store/fulfillment";
import { kvSMembers } from "@/lib/store/kv";
import { getOrder, type StoredOrder } from "@/lib/store/orders";
import { stockRemaining } from "@/lib/store/stock";
import { atualizar, sair } from "./actions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

type Tone = "gray" | "amber" | "green" | "red" | "blue";
const TONES: Record<Tone, string> = {
  gray: "bg-neutral-100 text-neutral-600",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-800",
};

const STAGE: Record<FulfillStage, [string, Tone]> = {
  invoice: ["Emitindo a nota", "amber"],
  label: ["Comprando a etiqueta", "amber"],
  ready: ["Etiqueta pronta: imprimir e postar", "blue"],
  posted: ["Postado", "green"],
  delivered: ["Entregue", "green"],
  local: ["Entrega própria (POA)", "blue"],
  "local-delivered": ["Entregue (POA)", "green"],
};

function status(o: StoredOrder, f: Fulfillment | null): [string, Tone] {
  if (o.refundedAt) return ["Estornado", "gray"];
  if (o.status === "manual") return ["Pix manual: conferir comprovante", "red"];
  if (o.status !== "paid") return ["Aguardando Pix", "gray"];
  if (f?.error) return ["Parado: precisa de olho", "red"];
  if (f) return STAGE[f.stage];
  return [o.bling?.orderId ? "Na fila de envio" : "Entrando no Bling", "amber"];
}

function Card({ label, value, tone = "gray" }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${TONES[tone]}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="painel fixed inset-0 z-[500] overflow-y-auto bg-white font-sans text-neutral-900 [color-scheme:light]">
      {children}
    </div>
  );
}

export default async function PainelPage() {
  await connection();

  if (!(await painelAuthed())) {
    return (
      <Shell>
        <main className="mx-auto max-w-sm px-6 pt-28">
          <h1 className="text-2xl font-semibold">Painel Fernandito</h1>
          <p className="mt-1 text-sm text-neutral-500">Só pra equipe.</p>
          <LoginForm />
        </main>
      </Shell>
    );
  }

  const ids = await kvSMembers(ALL_SET);
  const orders = (await Promise.all(ids.map(getOrder)))
    .filter((o): o is StoredOrder => Boolean(o) && (o!.status === "paid" || o!.status === "manual"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fulfillments = await Promise.all(orders.map((o) => getFulfillment(o.id)));
  const rows = orders.map((order, i) => ({ order, f: fulfillments[i], st: status(order, fulfillments[i]) }));
  const active = rows.filter((r) => !r.order.refundedAt);

  const toPrint = active.filter((r) => r.f?.stage === "ready");
  const stuck = active.filter((r) => r.f?.error || r.order.status === "manual");
  const inTransit = active.filter((r) => r.f?.stage === "posted");
  const delivered = active.filter((r) => r.f?.stage === "delivered" || r.f?.stage === "local-delivered");
  const revenue = active
    .filter((r) => r.order.status === "paid")
    .reduce((sum, r) => sum + r.order.totalCents, 0);

  const [stock, alertsRaw] = await Promise.all([
    Promise.all(
      ACTIVE_PRODUCTS.filter((p) => p.stockCap).map(async (p) => ({
        name: p.name,
        left: await stockRemaining(p.sku),
        cap: p.stockCap,
      })),
    ),
    kvSMembers("loja:alertas"),
  ]);
  const alerts = alertsRaw
    .map((a) => JSON.parse(a) as { at: string; orderId: string; problem: string })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <form action={atualizar}>
              <button className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white">
                Atualizar agora
              </button>
            </form>
            <a
              href="/painel/planilha"
              className="rounded-lg border border-neutral-300 px-4 py-2 font-medium"
            >
              Baixar planilha
            </a>
            <form action={sair}>
              <button className="rounded-lg border border-neutral-300 px-4 py-2 text-neutral-500">
                Sair
              </button>
            </form>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card label="Imprimir hoje" value={toPrint.length} tone={toPrint.length ? "blue" : "gray"} />
          <Card label="Precisam de olho" value={stuck.length} tone={stuck.length ? "red" : "gray"} />
          <Card label="A caminho" value={inTransit.length} />
          <Card label="Entregues" value={delivered.length} />
          <Card label="Faturado" value={brl(revenue)} tone="green" />
        </section>

        <section className="mt-6 flex flex-wrap gap-x-8 gap-y-1 text-sm text-neutral-600">
          {stock.map((s) => (
            <p key={s.name}>
              <b className="text-neutral-900">{s.name}:</b> {s.left} de {s.cap} livres
            </p>
          ))}
        </section>

        {alerts.length > 0 && (
          <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
            <h2 className="font-semibold text-red-800">Alertas recentes</h2>
            <ul className="mt-2 space-y-1 text-red-900">
              {alerts.map((a) => (
                <li key={a.at + a.orderId}>
                  <span className="text-red-700">{when(a.at)}</span> · <code>{a.orderId}</code> ·{" "}
                  {a.problem}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
              Nenhum pedido pago ainda.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
              {rows.map(({ order: o, f, st }) => (
                <li key={o.id} className={`p-4 ${o.refundedAt ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {o.customer.name}{" "}
                        <span className="font-normal text-neutral-500">
                          · {o.address.city}/{o.address.uf}
                        </span>
                      </p>
                      <p className="text-sm text-neutral-500">
                        {o.items.map((i) => `${i.qty}x ${i.name}`).join(" + ")} · {brl(o.totalCents)} ·{" "}
                        {o.shipping.carrier} · pago {when(o.paidAt)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${TONES[st[1]]}`}>
                      {st[0]}
                    </span>
                  </div>
                  {f?.error && <p className="mt-2 text-sm text-red-700">{f.error}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                    <span className="text-neutral-500">
                      Nota:{" "}
                      {f?.invoice.danfeUrl ? (
                        <a className="text-blue-700 underline" href={f.invoice.danfeUrl} target="_blank" rel="noopener noreferrer">
                          {f.invoice.number ?? "ver DANFE"}
                        </a>
                      ) : (
                        <b className="font-normal text-neutral-900">{f?.invoice.number ?? "—"}</b>
                      )}
                    </span>
                    <span className="text-neutral-500">
                      Etiqueta:{" "}
                      {f?.label.printUrl ? (
                        <a className="font-medium text-blue-700 underline" href={f.label.printUrl} target="_blank" rel="noopener noreferrer">
                          imprimir
                        </a>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-neutral-500">
                      Rastreio:{" "}
                      {f?.label.tracking ? (
                        f.label.trackingUrl ? (
                          <a className="text-blue-700 underline" href={f.label.trackingUrl} target="_blank" rel="noopener noreferrer">
                            {f.label.tracking}
                          </a>
                        ) : (
                          <b className="font-normal text-neutral-900">{f.label.tracking}</b>
                        )
                      ) : (
                        "—"
                      )}
                    </span>
                    <a className="text-neutral-400 underline" href={`/pedido/${o.id}/confirmado`} target="_blank" rel="noopener noreferrer">
                      {o.id}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </Shell>
  );
}
