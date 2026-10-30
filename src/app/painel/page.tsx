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
import { stockRemaining } from "@/lib/store/stock";
import { atualizar, marcarEntregue, sair } from "./actions";
import { LoginForm } from "./LoginForm";
import { SubmitButton } from "./SubmitButton";
import {
  ActionCard,
  Badge,
  CARD,
  Empty,
  Figure,
  Fold,
  LINK,
  SectionHead,
  Shell,
  btn,
  type Tone,
} from "./ui";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

// Estoque que o painel mostra. O kit é o que importa. Total à venda =
// 54 vendidos no 1º lote + 108 contados no Bling no relançamento = 162. O site
// libera só 100 do lote novo (teto `stockCap` em src/lib/catalog.ts = 54 + 100),
// o resto é reserva. Mudou o lote? Troca aqui.
const KIT_SKU = "FERN-KIT-PRE";
const LOTE_KIT = 100; // liberado no site neste lote
const PRIMEIRO_LOTE = 54; // vendidos antes
const CONTAGEM_BLING = 108; // saldo no relançamento
const TOTAL_KITS = PRIMEIRO_LOTE + CONTAGEM_BLING;
// Os outros produtos aparecem só como número (contagem ainda a acertar).
const OTHER_STOCK = [
  { sku: "FERN-350", name: "Lata" },
  { sku: "FERN-350-6", name: "Pack 6" },
  { sku: "FERN-PRESSKIT", name: "Press kit" },
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

const PAGE_SIZE = 20;

const FILTERS = [
  ["ativos", "Ativos"],
  ["imprimir", "Imprimir"],
  ["entregar", "Entregar (em mãos)"],
  ["olho", "Precisam de olho"],
  ["estornados", "Estornados"],
  ["todos", "Todos"],
] as const;

export default async function PainelPage(props: PageProps<"/painel">) {
  await connection();

  if (!(await painelAuthed())) {
    return (
      <Shell>
        <main className="mx-auto max-w-sm px-6 pt-28">
          <div className={`${CARD} p-6`}>
            <h1 className="text-lg font-semibold tracking-tight">Painel Fernandito</h1>
            <p className="mt-1 text-sm text-zinc-500">Só pra equipe. Entra com a senha.</p>
            <LoginForm />
          </div>
        </main>
      </Shell>
    );
  }

  const sp = await props.searchParams;
  const raw = sp.ver;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(String(sp.p ?? "1"), 10) || 1);
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

  const byFilter =
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

  // Busca: nome, telefone, cidade, itens, nota, rastreio e código do pedido.
  const norm = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const needle = norm(q);
  const digits = q.replace(/\D/g, "");
  const rows = needle
    ? byFilter.filter(({ order: o, f }) => {
        const hay = norm(
          [
            o.id,
            o.customer.name,
            o.customer.phone,
            o.address.city,
            o.address.neighborhood,
            o.address.cep,
            o.items.map((i) => i.name).join(" "),
            f?.invoice.number,
            f?.label.tracking,
          ].join(" "),
        );
        return (
          hay.includes(needle) || (digits.length >= 4 && hay.replace(/\D/g, "").includes(digits))
        );
      })
    : byFilter;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const shown = rows.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const href = (o: { ver?: string; p?: number; q?: string }) => {
    const v = o.ver ?? ver;
    const qs = new URLSearchParams();
    if (v !== "ativos") qs.set("ver", v);
    const query = o.q ?? q;
    if (query) qs.set("q", query);
    if (o.p && o.p > 1) qs.set("p", String(o.p));
    const t = qs.toString();
    return t ? `/painel?${t}` : "/painel";
  };

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

  const [stockMap, alertsRaw, siteLeft] = await Promise.all([
    blingStock([KIT_SKU, ...OTHER_STOCK.map((p) => p.sku)]),
    kvSMembers("loja:alertas"),
    stockRemaining(KIT_SKU).catch(() => null),
  ]);
  // Kit: livres no site = o menor entre o teto do site e o saldo do Bling.
  const kitBling = stockMap?.get(KIT_SKU) ?? null;
  const kitFree =
    siteLeft === null ? kitBling : kitBling === null ? siteLeft : Math.min(siteLeft, kitBling);
  // Vendidos no total: o que saiu do saldo do Bling (+ 1º lote); sem Bling, pela contagem do site.
  const kitSold =
    kitBling !== null
      ? Math.min(TOTAL_KITS, Math.max(0, TOTAL_KITS - kitBling))
      : siteLeft === null
        ? null
        : PRIMEIRO_LOTE + Math.max(0, LOTE_KIT - siteLeft);
  const kitRest = kitSold === null ? null : TOTAL_KITS - kitSold;
  const kitReserve = kitBling !== null && kitFree !== null ? Math.max(0, kitBling - kitFree) : null;
  const kitPct = kitRest === null ? 0 : Math.min(100, Math.round((kitRest / TOTAL_KITS) * 100));
  const kitLow = kitRest !== null && kitRest <= 15;
  // Alerta só aparece enquanto o pedido ainda está ativo (estornado não conta).
  const refunded = new Set(all.filter((r) => r.order.refundedAt).map((r) => r.order.id));
  const alerts = alertsRaw
    .map((a) => JSON.parse(a) as { at: string; orderId: string; problem: string })
    .filter((a) => !refunded.has(a.orderId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  const counts: Record<string, number> = {
    ativos: active.length,
    imprimir: toPrint.length,
    entregar: toDeliver.length,
    olho: stuck.length,
    estornados: all.filter((r) => r.order.refundedAt).length,
    todos: every.length,
  };
  const waLink = (digits: string) =>
    `https://wa.me/55${digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`;
  const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

  return (
    <Shell>
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
            <p className="text-sm text-zinc-500">
              Pagamento, nota, etiqueta e rastreio num lugar só.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/painel/planilha" className={btn("secondary")}>
              Baixar planilha
            </a>
            <form action={sair}>
              <button className={btn("secondary")}>Sair</button>
            </form>
            <form action={atualizar}>
              <SubmitButton variant="primary" pending="Atualizando…">
                Atualizar agora
              </SubmitButton>
            </form>
          </div>
        </header>

        {alerts.length > 0 && (
          <section className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm shadow-sm">
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

        <section className="flex flex-col gap-3">
          <SectionHead title="Fazer agora" />
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <ActionCard
              label="Imprimir"
              value={toPrint.length}
              href="/painel?ver=imprimir"
              tone="blue"
            />
            <ActionCard
              label="Entregar"
              value={toDeliver.length}
              href="/painel?ver=entregar"
              tone="blue"
            />
            <ActionCard
              label="Precisam de olho"
              value={stuck.length}
              href="/painel?ver=olho"
              tone="red"
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHead
            title="Estoque do kit"
            hint={`Total pra vender: ${PRIMEIRO_LOTE} do 1º lote + ${CONTAGEM_BLING} contados = ${TOTAL_KITS}.`}
          />
          <div className={`${CARD} p-5`}>
            <div className="flex items-baseline justify-between gap-3">
              <p>
                <span
                  className={`text-3xl font-semibold tracking-tight ${kitLow ? "text-red-600" : ""}`}
                >
                  {kitRest ?? "—"}
                </span>{" "}
                <span className="text-sm text-zinc-500">restam de {TOTAL_KITS}</span>
              </p>
              <p className="text-sm text-zinc-500">
                {kitSold !== null ? `${kitSold} vendidos` : ""}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${kitLow ? "bg-red-500" : "bg-zinc-900"}`}
                style={{ width: `${kitPct}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              No site: {kitFree ?? "—"} livres (liberados {LOTE_KIT} neste lote)
              {kitReserve !== null ? ` · reserva fora do site: ${kitReserve}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {OTHER_STOCK.map((p) => `${p.name} ${stockMap?.get(p.sku) ?? "—"}`).join(" · ")}
            </p>
          </div>
        </section>

        <section>
          <div className={`${CARD} grid grid-cols-2 divide-x divide-zinc-100 sm:grid-cols-3`}>
            <Figure label="A caminho" value={inTransit.length} />
            <Figure label="Entregues" value={delivered.length} />
            <div className="col-span-2 border-t border-zinc-100 sm:col-span-1 sm:border-t-0">
              <Figure
                label="Faturado"
                value={brl(revenue + manualRevenue)}
                hint={`site ${brl(revenue)} · manual ${brl(manualRevenue)}`}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHead
            title="Pedidos"
            aside={`${rows.length} ${rows.length === 1 ? "pedido" : "pedidos"}${q ? " na busca" : ""}`}
          />
          <form action="/painel" className="flex gap-2">
            {ver !== "ativos" && <input type="hidden" name="ver" value={ver} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar nome, telefone, cidade, nota, rastreio ou código"
              aria-label="Buscar pedidos"
              className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            />
            <button className={btn("primary")}>Buscar</button>
            {q && (
              <Link href={href({ q: "" })} className={btn("secondary")}>
                Limpar
              </Link>
            )}
          </form>
          <nav
            aria-label="Filtrar pedidos"
            className="flex flex-wrap gap-1 self-start rounded-lg bg-zinc-100 p-1 text-sm"
          >
            {FILTERS.map(([key, label]) => (
              <Link
                key={key}
                href={href({ ver: key })}
                aria-current={ver === key ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-zinc-900 ${
                  ver === key
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {label} <span className="text-zinc-400">{counts[key]}</span>
              </Link>
            ))}
          </nav>

          {rows.length === 0 ? (
            <Empty>{q ? "Nenhum pedido bate com a busca." : "Nada por aqui."}</Empty>
          ) : (
            <ul className={`${CARD} divide-y divide-zinc-100 overflow-hidden`}>
              {shown.map(({ order: o, f, st }) => (
                <li
                  key={o.id}
                  className={`grid gap-4 px-5 py-4 md:grid-cols-[1fr_16rem] ${
                    o.refundedAt ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.customer.name}</p>
                    <p className="mt-0.5 text-sm text-zinc-700">
                      {o.items.map((i) => `${i.qty}x ${i.name}`).join(" + ")}
                    </p>
                    <p className="text-sm text-zinc-500">
                      <span className="font-medium text-zinc-900">{brl(o.totalCents)}</span> ·{" "}
                      {o.shipping.carrier} · {when(o.paidAt)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      {o.address.street}, {o.address.number}
                      {o.address.complement ? ` (${o.address.complement})` : ""} ·{" "}
                      {o.address.neighborhood} · {o.address.city}/{o.address.uf} · CEP{" "}
                      {o.address.cep}
                    </p>
                    <p className="text-sm">
                      <a className={LINK} href={waLink(o.customer.phone)} {...ext}>
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

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <Badge tone={st[1]}>{st[0]}</Badge>
                    {f?.error && <p className="text-xs text-red-600 md:text-right">{f.error}</p>}
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {f?.stage === "local" && (
                        <form action={marcarEntregue}>
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="back" value={href({})} />
                          <SubmitButton variant="primary" size="sm">
                            Marcar como entregue
                          </SubmitButton>
                        </form>
                      )}
                      {f?.label.printUrl && (
                        <a
                          className={btn(f.stage === "ready" ? "primary" : "secondary", "sm")}
                          href={f.label.printUrl}
                          {...ext}
                        >
                          Imprimir etiqueta
                        </a>
                      )}
                      {f?.invoice.danfeUrl && (
                        <a className={btn("secondary", "sm")} href={f.invoice.danfeUrl} {...ext}>
                          Nota {f.invoice.number ?? "(DANFE)"}
                        </a>
                      )}
                      {f?.label.trackingUrl && (
                        <a className={btn("secondary", "sm")} href={f.label.trackingUrl} {...ext}>
                          Rastrear
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 md:text-right">
                      {f?.label.tracking && <span className="mr-2">{f.label.tracking}</span>}
                      {!f?.invoice.danfeUrl && f?.invoice.number && (
                        <span className="mr-2">Nota {f.invoice.number}</span>
                      )}
                      <a
                        className="font-mono hover:text-zinc-700"
                        href={`/pedido/${o.id}/confirmado`}
                        {...ext}
                      >
                        {o.id}
                      </a>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
              {cur > 1 ? (
                <Link href={href({ p: cur - 1 })} className={btn("secondary")}>
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-zinc-500">
                Página {cur} de {pages}
              </span>
              {cur < pages ? (
                <Link href={href({ p: cur + 1 })} className={btn("secondary")}>
                  Próxima →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <Fold
            title="Avisar do próximo lote"
            summary={`${waitlist.length} ${waitlist.length === 1 ? "contato" : "contatos"} na lista de espera`}
          >
            {waitlist.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">Ninguém na lista ainda.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {waitlist.map((l) => {
                  const c = l.fields.contato ?? "";
                  const href = c.includes("@") ? `mailto:${c}` : waLink(c);
                  return (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                    >
                      <span className="font-medium">{l.fields.nome || "—"}</span>
                      <span className="flex items-center gap-4">
                        <a className={LINK} href={href} {...ext}>
                          {c}
                        </a>
                        <span className="text-zinc-400">{when(l.createdAt)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Fold>

          <Fold
            title="Fora do site"
            summary={`${manualSales.length} vendas · ${brl(manualRevenue)} · ${bonus.length} bonificações (${units(bonus)} itens) — lidas das notas do Bling`}
          >
            {manual?.error && (
              <p className="px-5 pt-3 text-xs text-red-600">
                Última conferência falhou: {manual.error}
              </p>
            )}
            {(manual?.sales.length ?? 0) === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">
                Nenhuma nota fora do site nos últimos 6 meses.
              </p>
            ) : (
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
                      {m.nfPara && (
                        <p className="truncate text-xs text-zinc-400">Nota em nome de {m.nfPara}</p>
                      )}
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
                        <a className={`${LINK} whitespace-nowrap`} href={m.danfeUrl} {...ext}>
                          NF {m.numero}
                        </a>
                      ) : (
                        <span className="whitespace-nowrap text-zinc-500">NF {m.numero}</span>
                      )}
                      <span className="font-medium tabular-nums">{brl(m.totalCents)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Fold>
        </section>
      </main>
    </Shell>
  );
}
