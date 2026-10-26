import type { Metadata } from "next";
import Link from "next/link";
import { after, connection } from "next/server";
import { getManualSales, manualSalesStale, syncManualSales } from "@/lib/bling/manual";
import { listLeads } from "@/lib/leads";
import { painelAuthed } from "@/lib/painel";
import { ALL_SET } from "@/lib/store/checkout";
import { getFulfillment, type FulfillStage, type Fulfillment } from "@/lib/store/fulfillment";
import { kvSMembers } from "@/lib/store/kv";
import { getOrder, type StoredOrder } from "@/lib/store/orders";
import { blingStock } from "@/lib/bling/orders";
import { atualizar, marcarEntregue, sair } from "./actions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

// Estoque que o painel mostra: os 4 produtos do Bling (saldo virtual).
// `cap` = tamanho do lote de referência (a barra mostra quanto sobra dele).
// Mudou o lote? Troca aqui.
const PRODUCTS_STOCK = [
  { sku: "FERN-KIT-PRE", name: "Kit pré-lançamento", cap: 150 },
  { sku: "FERN-350", name: "Lata 350ml", cap: 1000 },
  { sku: "FERN-350-6", name: "Pack 6 latas", cap: 166 },
  { sku: "FERN-PRESSKIT", name: "Press kit (brinde)", cap: 50 },
] as const;

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const phone = (digits: string) => {
  const d = digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length === 10
      ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : digits;
};
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

// Visual no estilo shadcn/ui (zinc, bordas finas, badges com ponto). Fonte do
// sistema de propósito: o painel é ferramenta interna, não a marca.
type Tone = "zinc" | "amber" | "green" | "red" | "blue";
const BADGE: Record<Tone, string> = {
  zinc: "border-zinc-200 bg-zinc-100 text-zinc-600",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-red-200 bg-red-50 text-red-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
};
const DOT: Record<Tone, string> = {
  zinc: "bg-zinc-400",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  blue: "bg-sky-500",
};

const STAGE: Record<FulfillStage, [string, Tone]> = {
  invoice: ["Emitindo a nota", "amber"],
  label: ["Comprando a etiqueta", "amber"],
  ready: ["Imprimir e postar", "blue"],
  posted: ["Postado", "green"],
  delivered: ["Entregue", "green"],
  local: ["Entregar em mãos", "blue"],
  "local-delivered": ["Entregue (em mãos)", "green"],
};

function status(o: StoredOrder, f: Fulfillment | null): [string, Tone] {
  if (o.refundedAt) return ["Estornado", "zinc"];
  if (o.status === "manual") return ["Pix manual: conferir", "red"];
  if (o.status !== "paid") return ["Aguardando Pix", "zinc"];
  if (f?.error) return ["Precisa de olho", "red"];
  if (f) return STAGE[f.stage];
  return [o.bling?.orderId ? "Na fila de envio" : "Entrando no Bling", "amber"];
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        {label}
        {tone && <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} />}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-lenis-prevent
      className="painel fixed inset-0 z-[500] overflow-y-auto bg-zinc-50 font-[system-ui,-apple-system,'Segoe_UI',Roboto,sans-serif] text-zinc-900 antialiased [color-scheme:light]"
    >
      {children}
    </div>
  );
}

const FILTERS = [
  ["ativos", "Ativos"],
  ["imprimir", "Imprimir"],
  ["entregar", "Entregar (em mãos)"],
  ["olho", "Precisam de olho"],
  ["estornados", "Estornados"],
  ["todos", "Todos"],
] as const;

const LINK =
  "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900";
const BTN =
  "inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-zinc-100";

export default async function PainelPage(props: PageProps<"/painel">) {
  await connection();

  if (!(await painelAuthed())) {
    return (
      <Shell>
        <main className="mx-auto max-w-sm px-6 pt-28">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold tracking-tight">Painel Fernandito</h1>
            <p className="mt-1 text-sm text-zinc-500">Só pra equipe. Entra com a senha.</p>
            <LoginForm />
          </div>
        </main>
      </Shell>
    );
  }

  const raw = (await props.searchParams).ver;
  const ver = FILTERS.some(([k]) => k === raw) ? String(raw) : "ativos";

  const ids = await kvSMembers(ALL_SET);
  const orders = (await Promise.all(ids.map(getOrder)))
    .filter((o): o is StoredOrder => Boolean(o) && (o!.status === "paid" || o!.status === "manual"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fulfillments = await Promise.all(orders.map((o) => getFulfillment(o.id)));
  const every = orders.map((order, i) => ({
    order,
    f: fulfillments[i],
    st: status(order, fulfillments[i]),
  }));
  // Pedidos simulados (Pix de mentira dos testes do preview) ficam fora das
  // contas e da lista; só aparecem em "Todos".
  const all = every.filter((r) => !r.order.simulated);
  const active = all.filter((r) => !r.order.refundedAt);

  const toPrint = active.filter((r) => r.f?.stage === "ready");
  const toDeliver = active.filter((r) => r.f?.stage === "local");
  const stuck = active.filter((r) => r.f?.error || r.order.status === "manual");
  const inTransit = active.filter((r) => r.f?.stage === "posted");
  const delivered = active.filter(
    (r) => r.f?.stage === "delivered" || r.f?.stage === "local-delivered",
  );
  const revenue = active
    .filter((r) => r.order.status === "paid")
    .reduce((sum, r) => sum + r.order.totalCents, 0);

  const rows =
    ver === "imprimir"
      ? toPrint
      : ver === "entregar"
        ? toDeliver
        : ver === "olho"
          ? stuck
          : ver === "estornados"
            ? all.filter((r) => r.order.refundedAt)
            : ver === "todos"
              ? every
              : active;

  // Vendas fora do site (Bling): sem nada guardado ainda → busca agora; velho →
  // mostra o que tem e atualiza depois da resposta.
  let manual = await getManualSales();
  if (!manual) manual = await syncManualSales();
  else if (manualSalesStale(manual)) after(() => syncManualSales().then(() => undefined));
  const NFE_OK = [5, 6, 7];
  const manualSales = (manual?.sales ?? []).filter((m) => m.tipo === "venda");
  const bonus = (manual?.sales ?? []).filter((m) => m.tipo === "bonificacao");
  const manualRevenue = manualSales
    .filter((m) => NFE_OK.includes(m.situacao))
    .reduce((sum, m) => sum + m.totalCents, 0);
  const units = (list: typeof bonus) =>
    list.reduce((sum, m) => sum + m.itens.reduce((n, i) => n + i.quantidade, 0), 0);

  const waitlist = (await listLeads().catch(() => [])).filter((l) => l.form === "aviso");

  const [stockMap, alertsRaw] = await Promise.all([
    blingStock(PRODUCTS_STOCK.map((p) => p.sku)),
    kvSMembers("loja:alertas"),
  ]);
  // Alerta só aparece enquanto o pedido ainda está ativo (estornado não conta).
  const stock = PRODUCTS_STOCK.map((p) => ({ ...p, left: stockMap?.get(p.sku) ?? null }));
  const refunded = new Set(all.filter((r) => r.order.refundedAt).map((r) => r.order.id));
  const alerts = alertsRaw
    .map((a) => JSON.parse(a) as { at: string; orderId: string; problem: string })
    .filter((a) => !refunded.has(a.orderId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
            <p className="text-sm text-zinc-500">
              Pagamento, nota, etiqueta e rastreio num lugar só.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={atualizar}>
              <button className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
                Atualizar agora
              </button>
            </form>
            <a href="/painel/planilha" className={BTN}>
              Baixar planilha
            </a>
            <form action={sair}>
              <button className={`${BTN} text-zinc-500`}>Sair</button>
            </form>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Stat
            label="Imprimir hoje"
            value={toPrint.length}
            tone={toPrint.length ? "blue" : undefined}
          />
          <Stat
            label="Entregar (em mãos)"
            value={toDeliver.length}
            tone={toDeliver.length ? "blue" : undefined}
          />
          <Stat
            label="Precisam de olho"
            value={stuck.length}
            tone={stuck.length ? "red" : undefined}
          />
          <Stat label="A caminho" value={inTransit.length} />
          <Stat label="Entregues" value={delivered.length} />
          <Stat
            label="Faturado"
            value={brl(revenue + manualRevenue)}
            hint={`site ${brl(revenue)} · manual ${brl(manualRevenue)}`}
          />
        </section>

        <section className="mt-3 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          {stock.map((p) => {
            const pct = p.left === null ? 0 : Math.min(100, Math.round((p.left / p.cap) * 100));
            return (
              <div key={p.sku}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-zinc-500">
                    {p.left ?? "—"} de {p.cap}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full ${pct <= 15 ? "bg-red-500" : "bg-zinc-900"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {alerts.length > 0 && (
          <section className="mt-3 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm shadow-sm">
            <h2 className="font-semibold text-red-800">Alertas</h2>
            <ul className="mt-2 space-y-1.5 text-red-900">
              {alerts.map((a) => (
                <li key={a.at + a.orderId}>
                  <span className="text-red-700/80">{when(a.at)}</span>
                  <span className="mx-1.5 rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs">
                    {a.orderId}
                  </span>
                  {a.problem}
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="mt-8 inline-flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
          {FILTERS.map(([key, label]) => (
            <Link
              key={key}
              href={key === "ativos" ? "/painel" : `/painel?ver=${key}`}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                ver === key
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <section className="mt-3">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
              Nada por aqui.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.6fr_1fr_1.2fr_1.2fr] gap-4 border-b border-zinc-200 bg-zinc-50/70 px-5 py-2.5 text-xs font-medium text-zinc-500 md:grid">
                <span>Cliente</span>
                <span>Status</span>
                <span>Nota e etiqueta</span>
                <span>Rastreio</span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {rows.map(({ order: o, f, st }) => (
                  <li
                    key={o.id}
                    className={`grid gap-3 px-5 py-4 md:grid-cols-[1.6fr_1fr_1.2fr_1.2fr] md:items-start md:gap-4 ${
                      o.refundedAt ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{o.customer.name}</p>
                      <p className="text-sm text-zinc-500">
                        {o.address.city}/{o.address.uf} ·{" "}
                        {o.items.map((i) => `${i.qty}x ${i.name}`).join(" + ")}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {brl(o.totalCents)} · {o.shipping.carrier} · {when(o.paidAt)}
                      </p>
                      <p className="mt-1.5 text-sm text-zinc-700">
                        {o.address.street}, {o.address.number}
                        {o.address.complement ? ` (${o.address.complement})` : ""} ·{" "}
                        {o.address.neighborhood} · CEP {o.address.cep}
                      </p>
                      <p className="text-sm text-zinc-500">
                        <a
                          className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900"
                          href={`https://wa.me/55${o.customer.phone.replace(/\D/g, "").replace(/^55/, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {phone(o.customer.phone)}
                        </a>
                      </p>
                      {o.note && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <p className="text-xs font-medium text-amber-700">Recado do cliente</p>
                          <p className="mt-0.5 whitespace-pre-line">{o.note}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge tone={st[1]}>{st[0]}</Badge>
                      {f?.error && <p className="text-xs text-red-600">{f.error}</p>}
                      {f?.stage === "local" && (
                        <form action={marcarEntregue}>
                          <input type="hidden" name="id" value={o.id} />
                          <button className="inline-flex h-8 items-center rounded-md bg-zinc-900 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
                            Marcar como entregue
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="text-zinc-500">
                        Nota:{" "}
                        {f?.invoice.danfeUrl ? (
                          <a
                            className={LINK}
                            href={f.invoice.danfeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {f.invoice.number ?? "ver DANFE"}
                          </a>
                        ) : (
                          <span className="text-zinc-900">{f?.invoice.number ?? "—"}</span>
                        )}
                      </p>
                      <p className="text-zinc-500">
                        Etiqueta:{" "}
                        {f?.label.printUrl ? (
                          <a
                            className={LINK}
                            href={f.label.printUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            imprimir
                          </a>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>
                        {f?.label.tracking ? (
                          f.label.trackingUrl ? (
                            <a
                              className={LINK}
                              href={f.label.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {f.label.tracking}
                            </a>
                          ) : (
                            f.label.tracking
                          )
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </p>
                      <a
                        className="font-mono text-xs text-zinc-400 hover:text-zinc-700"
                        href={`/pedido/${o.id}/confirmado`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {o.id}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Avisar do próximo lote</h2>
              <p className="text-sm text-zinc-500">
                Quem pediu pra ser avisado quando o kit voltar (aparece quando esgota).
              </p>
            </div>
            <p className="text-sm text-zinc-500">{waitlist.length} contatos</p>
          </div>
          {waitlist.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              Ninguém na lista ainda.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <ul className="divide-y divide-zinc-100">
                {waitlist.map((l) => {
                  const c = l.fields.contato ?? "";
                  const phone = c.replace(/\D/g, "");
                  const href = c.includes("@")
                    ? `mailto:${c}`
                    : `https://wa.me/55${phone.replace(/^55(?=\d{10,11}$)/, "")}`;
                  return (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                    >
                      <span className="font-medium">{l.fields.nome || "—"}</span>
                      <span className="flex items-center gap-4">
                        <a className={LINK} href={href} target="_blank" rel="noopener noreferrer">
                          {c}
                        </a>
                        <span className="text-zinc-400">{when(l.createdAt)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Fora do site</h2>
              <p className="text-sm text-zinc-500">
                Vendas manuais e bonificações, lidas das notas fiscais do Bling.
              </p>
            </div>
            <p className="text-sm text-zinc-500">
              {manualSales.length} vendas · {brl(manualRevenue)} · {bonus.length} bonificações (
              {units(bonus)} itens)
            </p>
          </div>
          {manual?.error && (
            <p className="mt-2 text-xs text-red-600">Última conferência falhou: {manual.error}</p>
          )}
          {(manual?.sales.length ?? 0) === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              Nenhuma nota fora do site nos últimos 6 meses.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <ul className="divide-y divide-zinc-100">
                {manual!.sales.map((m) => (
                  <li
                    key={m.id}
                    className="grid gap-2 px-5 py-3.5 text-sm md:grid-cols-[1.4fr_1.6fr_1fr_0.8fr] md:items-center md:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.cliente || "—"}</p>
                      <p className="text-zinc-500">
                        {m.cidade ? `${m.cidade}/${m.uf} · ` : ""}
                        {m.data ? when(m.data.replace(" ", "T") + "-03:00") : "—"}
                      </p>
                    </div>
                    <p className="text-zinc-600">
                      {m.itens.map((i) => `${i.quantidade}x ${i.descricao}`).join(" + ")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={m.tipo === "bonificacao" ? "amber" : "green"}>
                        {m.tipo === "bonificacao" ? "Bonificação" : "Venda manual"}
                      </Badge>
                      {!NFE_OK.includes(m.situacao) && <Badge tone="zinc">Nota pendente</Badge>}
                    </div>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      {m.danfeUrl ? (
                        <a
                          className={LINK}
                          href={m.danfeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          NF {m.numero}
                        </a>
                      ) : (
                        <span className="text-zinc-500">NF {m.numero}</span>
                      )}
                      <span className="font-medium tabular-nums">{brl(m.totalCents)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}
