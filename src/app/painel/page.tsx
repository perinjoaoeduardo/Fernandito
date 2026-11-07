import type { Metadata } from "next";
import Link from "next/link";
import { after, connection } from "next/server";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BellRing,
  Boxes,
  CircleCheck,
  Clock,
  Download,
  FileText,
  Gift,
  Hand,
  LoaderCircle,
  LogOut,
  MapPin,
  PackageCheck,
  Printer,
  RefreshCw,
  ShoppingBag,
  Receipt,
  CupSoda,
  TriangleAlert,
  Truck,
  Undo2,
} from "lucide-react";
import { getManualSales, manualSalesStale, syncManualSales } from "@/lib/bling/manual";
import { listLeads } from "@/lib/leads";
import { painelAuthed } from "@/lib/painel";
import { ALL_SET } from "@/lib/store/checkout";
import {
  getFulfillments,
  maybeAdvanceFulfillments,
  type FulfillStage,
  type Fulfillment,
} from "@/lib/store/fulfillment";
import { kvGet, kvSet, kvSMembers } from "@/lib/store/kv";
import { getOrders, type StoredOrder } from "@/lib/store/orders";
import { blingStock } from "@/lib/bling/orders";
import { stockRemaining } from "@/lib/store/stock";
import { ESPECIAL_LOTES } from "@/lib/especial";
import { atualizar, marcarEntregue, marcarPostado, sair } from "./actions";
import { LoginForm } from "./LoginForm";
import { SearchBox } from "./SearchBox";
import { SubmitButton } from "./SubmitButton";
import { Producao } from "./Producao";
import {
  EXEMPLO,
  PRODUCAO_BACKUP_V1,
  PRODUCAO_KEY,
  importarComprasLNF,
  lerProducao,
} from "@/lib/producao";
import {
  Badge,
  CARD,
  Code,
  Empty,
  Frame,
  KpiStrip,
  LINK,
  PageHeader,
  SectionTitle,
  FilterGroups,
  SortHead,
  StockBar,
  Shell,
  TABLE_WRAP,
  TD,
  TH,
  Tile,
  btn,
  type Aba,
  type Tone,
} from "./ui";

// "Atualizar agora" confere a fila toda no Melhor Envio: dá tempo pra isso.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

// Estoque que o painel mostra. O kit é o que importa. Site público: teto
// `stockCap` (src/lib/catalog.ts, 159, já esgotado). Depois disso, só o link
// especial (src/lib/especial.ts), em lotes com contador próprio. Os números
// saem dos contadores, então não tem conta fixa pra trocar aqui.
const KIT_SKU = "FERN-KIT-PRE";
// Produtos na tela de estoque, na ordem que importa. Preço = o do Bling
// (06/11). `latas` = quantas latas vão em cada unidade (pra contar as latas
// que já saíram). Saldo vem do Bling; o six pack é calculado pelas latas.
const ESTOQUE = [
  {
    sku: "FERN-350-6",
    name: "Six pack",
    priceCents: 9499,
    latas: 6,
    unit: ["pack", "packs"],
    note: "37 liberados no site + 5 de reserva · em breve",
  },
  {
    sku: "FERN-350",
    name: "Lata 350ml",
    priceCents: 1599,
    latas: 1,
    unit: ["lata", "latas"],
    note: "Cada six pack usa 6 latas deste saldo",
  },
  {
    sku: "FERN-KIT-PRE",
    name: "Kit Fernandito Pré-Lançamento",
    priceCents: 8990,
    latas: 2,
    unit: ["kit", "kits"],
    note: "Os últimos saem só pelo link especial",
  },
  {
    sku: "FERN-PRESSKIT",
    name: "Press kit (brinde)",
    priceCents: 8990,
    latas: 0,
    unit: ["kit", "kits"],
    note: "Só bonificação",
  },
] as const;
const LATAS: Record<string, number> = Object.fromEntries(ESTOQUE.map((p) => [p.sku, p.latas]));

/**
 * Saldo do Bling com validade de 1 min no banco: o painel não precisa ir ao
 * Bling (duas chamadas lentas) a cada clique. "Atualizar agora" não limpa; em
 * no máximo 1 min o número se renova sozinho.
 */
async function cachedBlingStock(skus: string[]): Promise<Map<string, number> | null> {
  const key = "painel:estoque";
  try {
    const raw = await kvGet(key);
    if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, number>));
  } catch {
    // Sem cache: vai direto ao Bling.
  }
  const fresh = await blingStock(skus);
  if (fresh) await kvSet(key, JSON.stringify(Object.fromEntries(fresh)), 60).catch(() => {});
  return fresh;
}

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

type St = { label: string; tone: Tone; icon: LucideIcon };

// Estados fixos (cor + ícone + palavra, iguais em todo o painel): petrol =
// espera por ti; azul = o sistema trabalhando; âmbar = com a transportadora;
// verde = entregue; vermelho = problema.
const STAGE: Record<FulfillStage, St> = {
  invoice: { label: "Emitindo a nota", tone: "running", icon: LoaderCircle },
  label: { label: "Comprando a etiqueta", tone: "running", icon: LoaderCircle },
  ready: { label: "Imprimir e postar", tone: "action", icon: Printer },
  posted: { label: "A caminho", tone: "hold", icon: Truck },
  delivered: { label: "Entregue pelo correio", tone: "pass", icon: CircleCheck },
  local: { label: "Entregar em mãos", tone: "action", icon: Hand },
  "local-delivered": { label: "Entregue em mãos", tone: "pass", icon: CircleCheck },
};

// Situação do envio como o Melhor Envio responde (diagnóstico no painel).
const ME_STATUS: Record<string, string> = {
  pending: "no carrinho",
  released: "paga, sem etiqueta",
  generated: "etiqueta gerada, sem registro de postagem",
  posted: "postado",
  received: "recebido no ponto de coleta",
  collected: "coletado",
  delivered: "entregue",
  canceled: "cancelada",
  undelivered: "não entregue",
};

/** Entregue em mãos: a etiqueta (se houve) foi cancelada, então não mostra botão nem rastreio. */
const byHand = (f: Fulfillment) => f.stage === "local-delivered";

function status(o: StoredOrder, f: Fulfillment | null): St {
  if (o.refundedAt) return { label: "Estornado", tone: "muted", icon: Undo2 };
  if (o.status === "manual")
    return { label: "Pix manual: conferir", tone: "fail", icon: TriangleAlert };
  if (o.status !== "paid") return { label: "Aguardando Pix", tone: "muted", icon: Clock };
  if (f?.error) return { label: "Precisa de olho", tone: "fail", icon: TriangleAlert };
  if (f) return STAGE[f.stage];
  return {
    label: o.bling?.orderId ? "Na fila de envio" : "Entrando no Bling",
    tone: "running",
    icon: LoaderCircle,
  };
}

const PAGE_SIZE = 20;

// Na ordem do caminho do pedido. "Todos" é o padrão.
const FILTERS = [
  ["todos", "Todos"],
  ["imprimir", "Imprimir"],
  ["entregar", "Entregar"],
  ["caminho", "A caminho"],
  ["entregues-maos", "Entregues"],
  ["entregues-correio", "Entregues"],
  ["olho", "Precisam de olho"],
  ["estornados", "Estornados"],
] as const;

// Filtros agrupados pelo caminho do pedido.
const FILTER_LABEL = Object.fromEntries(FILTERS) as Record<(typeof FILTERS)[number][0], string>;
const FILTER_GROUPS = [
  { title: "Geral", keys: ["todos"] },
  { title: "Correio", keys: ["imprimir", "caminho", "entregues-correio"] },
  { title: "Em mãos", keys: ["entregar", "entregues-maos"] },
  { title: "Atenção", keys: ["olho", "estornados"] },
] as const;

const ABAS: Aba[] = ["pedidos", "estoque", "fora", "lista", "producao"];

/** "Bom dia, equipe / sexta-feira, 6 de novembro" (hora de Brasília). */
function greeting() {
  const now = new Date();
  const hour = Number(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }),
  );
  const hi = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const date = now.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <>
      <span className="text-lk-ink font-medium">{hi}, equipe</span>
      <span aria-hidden className="text-lk-border mx-2">
        /
      </span>
      {date}
    </>
  );
}

export default async function PainelPage(props: PageProps<"/painel">) {
  await connection();

  if (!(await painelAuthed())) {
    return (
      <Shell>
        <main className="bg-lk-paper flex min-h-full items-center justify-center px-6 py-16">
          <div className={`${CARD} w-full max-w-sm p-7 shadow-[0_1px_2px_rgb(24_34_46/0.04)]`}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/fernandito-selo.webp" alt="" className="size-10 rounded-full" />
              <div>
                <p className="font-lk-brand text-xl leading-none font-semibold tracking-[-0.03em]">
                  Fernandito
                </p>
                <p className="font-lk-mono text-lk-action-strong mt-1.5 text-[10px] leading-none font-medium tracking-[0.18em] uppercase">
                  Painel da loja
                </p>
              </div>
            </div>
            <p className="text-lk-muted mt-6 text-sm">Só pra equipe. Entra com a senha.</p>
            <LoginForm />
          </div>
        </main>
      </Shell>
    );
  }

  const sp = await props.searchParams;
  const aba: Aba = ABAS.includes(sp.aba as Aba) ? (sp.aba as Aba) : "pedidos";
  const raw = sp.ver;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(String(sp.p ?? "1"), 10) || 1);
  const ver = FILTERS.some(([k]) => k === raw) ? String(raw) : "todos";
  const ORDENS = ["cliente", "valor", "pago", "status"] as const;
  type Ordem = (typeof ORDENS)[number];
  const ordem: Ordem | null = ORDENS.includes(sp.ordem as Ordem) ? (sp.ordem as Ordem) : null;
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  // Confere rastreio/nota/etiqueta em segundo plano a cada abertura (no máx.
  // a cada 2 min): "A caminho" e "Entregue" atualizam sem apertar botão.
  after(() => maybeAdvanceFulfillments());

  const ids = await kvSMembers(ALL_SET);
  const orders = (await getOrders(ids))
    .filter((o): o is StoredOrder => Boolean(o) && (o!.status === "paid" || o!.status === "manual"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fulfillments = await getFulfillments(orders.map((o) => o.id));
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
  const deliveredByHand = active.filter((r) => r.f?.stage === "local-delivered");
  const deliveredByMail = active.filter((r) => r.f?.stage === "delivered");
  const delivered = [...deliveredByHand, ...deliveredByMail];
  const revenue = active
    .filter((r) => r.order.status === "paid")
    .reduce((sum, r) => sum + r.order.totalCents, 0);

  const byFilter =
    ver === "imprimir"
      ? toPrint
      : ver === "entregar"
        ? toDeliver
        : ver === "caminho"
          ? inTransit
          : ver === "entregues-maos"
            ? deliveredByHand
            : ver === "entregues-correio"
              ? deliveredByMail
              : ver === "olho"
                ? stuck
                : ver === "estornados"
                  ? all.filter((r) => r.order.refundedAt)
                  : every;

  // Busca: nome, telefone, cidade, itens, nota, rastreio e código do pedido.
  const norm = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const needle = norm(q);
  const digits = q.replace(/\D/g, "");
  const rows = [
    ...(needle
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
      : byFilter),
  ];
  // Ordenar pela coluna clicada (padrão: mais novo primeiro).
  const STATUS_RANK: Record<Tone, number> = {
    fail: 0,
    action: 1,
    running: 2,
    hold: 3,
    pass: 4,
    review: 5,
    muted: 6,
  };
  if (ordem) {
    const by = (r: (typeof rows)[number]) =>
      ordem === "cliente"
        ? norm(r.order.customer.name)
        : ordem === "valor"
          ? r.order.totalCents
          : ordem === "pago"
            ? (r.order.paidAt ?? r.order.createdAt)
            : STATUS_RANK[r.st.tone] * 100 + r.st.label.length;
    rows.sort((a, b) => {
      const x = by(a);
      const y = by(b);
      const c = typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y));
      return dir === "asc" ? c : -c;
    });
  }
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const shown = rows.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const href = (o: { ver?: string; p?: number; q?: string; ordem?: string; dir?: string }) => {
    const v = o.ver ?? ver;
    const qs = new URLSearchParams();
    if (v !== "todos") qs.set("ver", v);
    const query = o.q ?? q;
    if (query) qs.set("q", query);
    const ord = o.ordem ?? ordem;
    if (ord) {
      qs.set("ordem", ord);
      qs.set("dir", o.dir ?? dir);
    }
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
  // Aba Produção: cadastro salvo no banco (sem nada salvo → exemplos).
  const producao = await (async () => {
    if (aba !== "producao") return EXEMPLO;
    try {
      const raw = await kvGet(PRODUCAO_KEY);
      const dados = (raw && lerProducao(JSON.parse(raw))) || EXEMPLO;
      // Importações de dados (rodam uma vez só e ficam salvas no banco).
      const importado = importarComprasLNF(dados);
      if (!importado) return dados;
      // Falhar ao salvar não pode cair nos exemplos: mostra o importado mesmo assim.
      if (raw && !raw.includes('"versao":2')) await kvSet(PRODUCAO_BACKUP_V1, raw).catch(() => {});
      await kvSet(
        PRODUCAO_KEY,
        JSON.stringify({ ...importado, atualizadoEm: new Date().toISOString() }),
      ).catch(() => {});
      return importado;
    } catch {
      return EXEMPLO;
    }
  })();

  // Vendas: pedidos pagos do site + vendas manuais com nota autorizada.
  // Unidades por produto (site, manual e brindes) e as latas que já saíram.
  const sitePaid = active.filter((r) => r.order.status === "paid");
  const manualOk = manualSales.filter((m) => NFE_OK.includes(m.situacao));
  const unitsBy = (pairs: [string, number][]) => {
    const map = new Map<string, number>();
    for (const [sku, n] of pairs) map.set(sku, (map.get(sku) ?? 0) + n);
    return map;
  };
  const soldUnits = unitsBy([
    ...sitePaid.flatMap((r) => r.order.items.map((i) => [i.sku, i.qty] as [string, number])),
    ...manualOk.flatMap((m) => m.itens.map((i) => [i.codigo, i.quantidade] as [string, number])),
  ]);
  const giftUnits = unitsBy(
    bonus.flatMap((m) => m.itens.map((i) => [i.codigo, i.quantidade] as [string, number])),
  );
  const latasOf = (map: Map<string, number>) =>
    [...map].reduce((n, [sku, qty]) => n + (LATAS[sku] ?? 0) * qty, 0);
  const salesCount = sitePaid.length + manualOk.length;
  const totalRevenue = revenue + manualRevenue;
  const ticket = salesCount ? Math.round(totalRevenue / salesCount) : 0;
  const latasSold = latasOf(soldUnits);
  const latasGift = latasOf(giftUnits);

  const [stockMap, alertsRaw, siteLeft] = await Promise.all([
    cachedBlingStock(ESTOQUE.map((p) => p.sku)),
    kvSMembers("loja:alertas"),
    stockRemaining(KIT_SKU).catch(() => null),
  ]);
  // Link especial: livres no lote atual e quantos já saíram de todos os lotes.
  const especialLeft = await Promise.all(
    ESPECIAL_LOTES.map((l) => stockRemaining(l.sku).catch(() => null)),
  );
  const especialFree = especialLeft[especialLeft.length - 1] ?? 0;
  // Kit. A conta vem dos contadores do site (anda junto com a compra; o Bling
  // só baixa depois da nota):
  //   restam    = livres no site público + livres no link especial (limitado ao Bling)
  //   em Pix    = kits reservados em Pix aberto (ainda não pagos)
  //   vendidos  = (teto do site − livres) + saídos pelo link − em Pix
  const kitBling = stockMap?.get(KIT_SKU) ?? null;
  const kitFree = siteLeft;
  // Alerta só aparece enquanto o pedido ainda está ativo (estornado não conta).
  const refunded = new Set(all.filter((r) => r.order.refundedAt).map((r) => r.order.id));
  const alerts = alertsRaw
    .map((a) => JSON.parse(a) as { at: string; orderId: string; problem: string })
    .filter((a) => !refunded.has(a.orderId))
    // "Sem saldo no Melhor Envio" some sozinho quando a etiqueta já saiu.
    .filter((a) => {
      if (!/sem saldo no melhor envio/i.test(a.problem)) return true;
      const row = every.find((r) => r.order.id === a.orderId);
      return !(row?.f && !row.f.error && row.f.stage !== "invoice" && row.f.stage !== "label");
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  const counts: Record<string, number> = {
    imprimir: toPrint.length,
    entregar: toDeliver.length,
    caminho: inTransit.length,
    "entregues-maos": deliveredByHand.length,
    "entregues-correio": deliveredByMail.length,
    olho: stuck.length,
    estornados: all.filter((r) => r.order.refundedAt).length,
    todos: every.length,
  };
  const waLink = (digits: string) =>
    `https://wa.me/55${digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`;
  const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

  type Row = (typeof every)[number];
  const first = (list: Row[]) => list[list.length - 1]?.order.customer.name.split(/\s+/)[0];

  const actions = (
    <>
      <form action={atualizar}>
        <SubmitButton variant="primary" pending="Atualizando…">
          <RefreshCw aria-hidden />
          Atualizar agora
        </SubmitButton>
      </form>
      <a href="/painel/planilha" className={btn("secondary")}>
        <Download aria-hidden />
        Baixar planilha
      </a>
      <form action={sair}>
        <button className={btn("ghost")}>
          <LogOut aria-hidden />
          Sair
        </button>
      </form>
    </>
  );

  const alertBox = alerts.length > 0 && (
    <section
      aria-label="Alertas"
      className="border-lk-fail/25 bg-lk-fail-bg text-lk-fail rounded-xl border px-5 py-4 text-sm"
    >
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert aria-hidden className="size-4" />
        {alerts.length === 1 ? "1 alerta" : `${alerts.length} alertas`}
      </p>
      <ul className="text-lk-ink mt-2 space-y-1.5">
        {alerts.map((a) => (
          <li key={a.at + a.orderId} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lk-muted text-xs">{when(a.at)}</span>
            <Code>{a.orderId}</Code>
            <span>{a.problem}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  // ── Peças de uma linha de pedido (tabela no computador, cartão no celular) ──
  const cliente = ({ order: o }: Row) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-lk-ink truncate font-semibold">{o.customer.name}</p>
      <p className="text-lk-muted text-xs">
        {o.items.map((i) => `${i.qty}x ${i.name}`).join(" + ")} · {o.address.city}/{o.address.uf}
      </p>
      <p className="text-lk-ink3 text-xs">
        {o.address.street}, {o.address.number}
        {o.address.complement ? ` (${o.address.complement})` : ""} · {o.address.neighborhood} · CEP{" "}
        {o.address.cep} ·{" "}
        <a className={`${LINK} font-normal`} href={waLink(o.customer.phone)} {...ext}>
          {phone(o.customer.phone)}
        </a>
      </p>
      {o.note && (
        <p className="bg-lk-hold-bg text-lk-hold mt-1.5 rounded-md px-2.5 py-1.5 text-xs">
          <span className="font-medium">Recado:</span> {o.note}
        </p>
      )}
    </div>
  );

  const estado = ({ order: o, f, st }: Row) => (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <Badge tone={st.tone} icon={st.icon}>
        {st.label}
      </Badge>
      {f?.error && <p className="text-lk-fail text-xs">{f.error}</p>}
      {o.status === "paid" && !o.bling?.orderId && o.bling?.error && (
        <p className="text-lk-fail text-xs">Não entrou no Bling: {o.bling.error}</p>
      )}
      {o.simulated && <p className="text-lk-ink3 text-xs">Pedido de teste (Pix simulado)</p>}
      {f?.label.meId && (f.stage === "ready" || f.stage === "posted") && (
        <p className="text-lk-ink3 text-xs">
          Melhor Envio: {ME_STATUS[f.label.status ?? ""] ?? f.label.status ?? "—"}
          {f.label.postedAt ? ` · postado ${when(f.label.postedAt)}` : ""}
          {f.label.postedByHand ? ' · "Já postei" marcado' : ""}
          {` · conferido ${f.label.checkedAt ? when(f.label.checkedAt) : "ainda não"}`}
        </p>
      )}
      <p className="flex flex-wrap gap-x-3">
        {f?.label.tracking && !byHand(f) && <Code>{f.label.tracking}</Code>}
        <a href={`/pedido/${o.id}/confirmado`} {...ext} className="hover:underline">
          <Code>#{o.id}</Code>
        </a>
      </p>
    </div>
  );

  const acoes = ({ order: o, f }: Row) => (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      {f?.stage === "local" && (
        <form action={marcarEntregue}>
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="back" value={href({})} />
          <SubmitButton variant="primary" size="sm">
            <PackageCheck aria-hidden />
            Marcar entregue
          </SubmitButton>
        </form>
      )}
      {f?.label.printUrl && !byHand(f) && (
        <a
          className={btn(f.stage === "ready" ? "primary" : "secondary", "sm")}
          href={f.label.printUrl}
          {...ext}
        >
          <Printer aria-hidden />
          Etiqueta
        </a>
      )}
      {f?.stage === "ready" && (
        <form action={marcarPostado}>
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="back" value={href({})} />
          <SubmitButton variant="secondary" size="sm">
            <Truck aria-hidden />
            Já postei
          </SubmitButton>
        </form>
      )}
      {f?.invoice.danfeUrl && (
        <a className={btn("ghost", "sm")} href={f.invoice.danfeUrl} {...ext}>
          <FileText aria-hidden />
          Nota {f.invoice.number ?? ""}
        </a>
      )}
      {f?.label.trackingUrl && !byHand(f) && (
        <a className={btn("ghost", "sm")} href={f.label.trackingUrl} {...ext}>
          <MapPin aria-hidden />
          Rastrear
        </a>
      )}
    </div>
  );

  const pedidosView = (
    <>
      <PageHeader eyebrow={greeting()} title="Pedidos Fernandito" actions={actions} />
      {alertBox}
      <KpiStrip cols={4}>
        <Tile
          icon={Printer}
          label="Imprimir e postar"
          value={toPrint.length}
          note={toPrint.length ? `Mais antigo: ${first(toPrint)}` : "Tudo impresso"}
          href={href({ ver: ver === "imprimir" ? "todos" : "imprimir", p: 1 })}
          selected={ver === "imprimir"}
        />
        <Tile
          icon={Hand}
          label="Entregar em mãos"
          value={toDeliver.length}
          note={toDeliver.length ? `Mais antigo: ${first(toDeliver)}` : "Nada pra entregar"}
          href={href({ ver: ver === "entregar" ? "todos" : "entregar", p: 1 })}
          selected={ver === "entregar"}
        />
        <Tile
          icon={Truck}
          label="A caminho"
          value={inTransit.length}
          tone="hold"
          note={`${delivered.length} entregues até agora`}
          href={href({ ver: ver === "caminho" ? "todos" : "caminho", p: 1 })}
          selected={ver === "caminho"}
        />
        <Tile
          icon={TriangleAlert}
          label="Precisam de olho"
          value={stuck.length}
          tone="fail"
          note={stuck.length ? "Abre pra ver o motivo" : "Tudo certo"}
          href={href({ ver: ver === "olho" ? "todos" : "olho", p: 1 })}
          selected={ver === "olho"}
        />
        <Tile
          icon={Banknote}
          label="Faturado"
          value={brl(totalRevenue)}
          note={`site ${brl(revenue)} · manual ${brl(manualRevenue)}`}
        />
        <Tile
          icon={ShoppingBag}
          label="Vendas"
          value={salesCount}
          note={`${sitePaid.length} no site · ${manualOk.length} manuais`}
        />
        <Tile icon={Receipt} label="Ticket médio" value={brl(ticket)} note="Faturado ÷ vendas" />
        <Tile
          icon={CupSoda}
          label="Latas vendidas"
          value={latasSold}
          note={latasGift ? `+${latasGift} em brindes` : "Kit = 2 latas · six pack = 6"}
        />
      </KpiStrip>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Pedidos" count={rows.length} />
        <div className="flex flex-col gap-3">
          <SearchBox ver={ver} q={q} />
          <FilterGroups
            label="Filtrar pedidos"
            groups={FILTER_GROUPS.map((g) => ({
              title: g.title,
              items: g.keys.map((key) => ({
                key,
                label: FILTER_LABEL[key],
                count: counts[key],
                href: href({ ver: key, p: 1 }),
                active: ver === key,
              })),
            }))}
          />
        </div>

        {rows.length === 0 ? (
          <Empty>{q ? "Nenhum pedido bate com a busca." : "Nada por aqui."}</Empty>
        ) : (
          <>
            {/* Computador: tabela. */}
            <div className={`${TABLE_WRAP} hidden lg:block`}>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr>
                    {(
                      [
                        ["cliente", "Cliente", "w-[34%]", "left", "asc"],
                        ["valor", "Valor", "w-[10%]", "right", "desc"],
                        ["pago", "Pago", "w-[10%]", "left", "desc"],
                        ["status", "Status", "w-[24%]", "left", "asc"],
                      ] as const
                    ).map(([key, label, w, align, first]) => (
                      <SortHead
                        key={key}
                        label={label}
                        align={align}
                        className={w}
                        dir={ordem === key ? dir : undefined}
                        href={href({
                          ordem: key,
                          dir: ordem === key ? (dir === "asc" ? "desc" : "asc") : first,
                          p: 1,
                        })}
                      />
                    ))}
                    <th className={TH}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-lk-border divide-y">
                  {shown.map((r) => (
                    <tr
                      key={r.order.id}
                      className={`hover:bg-lk-paper/60 transition-colors duration-100 ${r.order.refundedAt ? "opacity-60" : ""}`}
                    >
                      <td className={TD}>{cliente(r)}</td>
                      <td className={`${TD} text-right`}>
                        <p className="font-medium">{brl(r.order.totalCents)}</p>
                        <p className="text-lk-muted text-xs">{r.order.shipping.carrier}</p>
                      </td>
                      <td className={`${TD} text-lk-muted`}>{when(r.order.paidAt)}</td>
                      <td className={TD}>{estado(r)}</td>
                      <td className={TD}>{acoes(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular e tablet: lista de cartões. */}
            <ul className={`${TABLE_WRAP} divide-lk-border divide-y lg:hidden`}>
              {shown.map((r) => (
                <li
                  key={r.order.id}
                  className={`flex flex-col gap-3 px-4 py-4 ${r.order.refundedAt ? "opacity-60" : ""}`}
                >
                  {cliente(r)}
                  <p className="text-lk-muted text-xs">
                    <span className="text-lk-ink font-medium">{brl(r.order.totalCents)}</span> ·{" "}
                    {r.order.shipping.carrier} · pago {when(r.order.paidAt)}
                  </p>
                  {estado(r)}
                  {acoes(r)}
                </li>
              ))}
            </ul>
          </>
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
            <span className="text-lk-muted">
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
    </>
  );

  const estoqueView = (
    <>
      <PageHeader eyebrow={greeting()} title="Estoque e vendas" actions={actions} />
      <KpiStrip cols={4}>
        <Tile
          icon={ShoppingBag}
          label="Vendas"
          value={salesCount}
          note={`${sitePaid.length} no site · ${manualOk.length} manuais`}
        />
        <Tile
          icon={Banknote}
          label="Faturado"
          value={brl(totalRevenue)}
          note={`site ${brl(revenue)} · manual ${brl(manualRevenue)}`}
        />
        <Tile icon={Receipt} label="Ticket médio" value={brl(ticket)} note="Faturado ÷ vendas" />
        <Tile
          icon={CupSoda}
          label="Latas vendidas"
          value={latasSold}
          note={latasGift ? `+${latasGift} em brindes` : "Kit = 2 latas · six pack = 6"}
        />
      </KpiStrip>

      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Produtos"
          count={ESTOQUE.length}
          aside={
            <span className="text-lk-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-lk-action size-2.5 rounded-full" /> Vendidos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-lk-review size-2.5 rounded-full" /> Brindes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#b9c4ca]" /> Em estoque
              </span>
            </span>
          }
        />
        <ul className={`${TABLE_WRAP} divide-lk-border divide-y`}>
          {ESTOQUE.map((p) => {
            const sold = soldUnits.get(p.sku) ?? 0;
            const gift = giftUnits.get(p.sku) ?? 0;
            const left = stockMap?.get(p.sku) ?? null;
            const word = (n: number) => (n === 1 ? p.unit[0] : p.unit[1]);
            return (
              <li
                key={p.sku}
                className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)_9rem] lg:items-center lg:gap-8"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-lk-muted mt-0.5 text-xs">
                    {brl(p.priceCents)} · <Code>{p.sku}</Code>
                  </p>
                  <p className="text-lk-ink3 mt-1 text-xs">
                    {p.sku === KIT_SKU
                      ? `Site esgotado · link especial: ${especialFree} ${especialFree === 1 ? "livre" : "livres"}`
                      : p.note}
                  </p>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <StockBar sold={sold} gift={gift} left={Math.max(0, left ?? 0)} />
                  <p className="text-lk-muted flex flex-wrap gap-x-4 text-xs tabular-nums">
                    <span>
                      <span className="text-lk-ink font-medium">{sold}</span> vendidos
                    </span>
                    {gift > 0 && (
                      <span>
                        <span className="text-lk-ink font-medium">{gift}</span> em brindes
                      </span>
                    )}
                    <span>
                      <span className="text-lk-ink font-medium">{left ?? "—"}</span> em estoque
                    </span>
                  </p>
                </div>
                <div className="lg:text-right">
                  <p
                    className={`text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${
                      left === 0 ? "text-lk-muted/45" : "text-lk-action-strong"
                    }`}
                  >
                    {left ?? "—"}
                  </p>
                  <p className="text-lk-muted mt-1 text-xs">
                    {left === null ? "Bling sem resposta" : `${word(left)} no Bling`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-lk-ink3 text-xs">
          Vendidos = pedidos pagos do site + vendas manuais com nota. Brindes = bonificações. O
          saldo é o do Bling (atualiza a cada minuto).
        </p>
      </section>
    </>
  );

  const foraView = (
    <>
      <PageHeader eyebrow="Lidas das notas do Bling" title="Vendas manuais" actions={actions} />
      <KpiStrip cols={3}>
        <Tile
          icon={ShoppingBag}
          label="Vendas manuais"
          value={manualSales.length}
          note={brl(manualRevenue)}
        />
        <Tile
          icon={Gift}
          label="Bonificações"
          value={bonus.length}
          tone="review"
          note={`${units(bonus)} itens`}
        />
        <Tile
          icon={Clock}
          label="Notas pendentes"
          value={(manual?.sales ?? []).filter((m) => !NFE_OK.includes(m.situacao)).length}
          tone="hold"
          note="Ainda sem autorização"
        />
      </KpiStrip>
      {manual?.error && (
        <p className="text-lk-fail text-xs">Última conferência falhou: {manual.error}</p>
      )}
      <section className="flex flex-col gap-4">
        <SectionTitle title="Notas" count={manual?.sales.length ?? 0} />
        {(manual?.sales.length ?? 0) === 0 ? (
          <Empty>Nenhuma nota fora do site nos últimos 6 meses.</Empty>
        ) : (
          <div className={`${TABLE_WRAP} overflow-x-auto`}>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className={`${TH} w-[30%]`}>Cliente</th>
                  <th className={TH}>Itens</th>
                  <th className={TH}>Tipo</th>
                  <th className={TH}>Nota</th>
                  <th className={`${TH} text-right`}>Valor</th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {manual!.sales.map((m) => (
                  <tr key={m.id} className="hover:bg-lk-paper/60">
                    <td className={TD}>
                      <p className="font-semibold">{m.cliente || "—"}</p>
                      <p className="text-lk-muted text-xs">
                        {m.cidade ? `${m.cidade}/${m.uf} · ` : ""}
                        {m.data ? when(m.data.replace(" ", "T") + "-03:00") : "—"}
                      </p>
                      {m.nfPara && (
                        <p className="text-lk-ink3 text-xs">Nota em nome de {m.nfPara}</p>
                      )}
                    </td>
                    <td className={`${TD} text-lk-muted`}>
                      {m.itens.map((i) => `${i.quantidade}x ${i.descricao}`).join(" + ")}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1.5">
                        {m.tipo === "bonificacao" ? (
                          <Badge tone="review" icon={Gift}>
                            Bonificação
                          </Badge>
                        ) : (
                          <Badge tone="pass" icon={ShoppingBag}>
                            Venda manual
                          </Badge>
                        )}
                        {!NFE_OK.includes(m.situacao) && (
                          <Badge tone="hold" icon={Clock}>
                            Nota pendente
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className={TD}>
                      {m.danfeUrl ? (
                        <a className={LINK} href={m.danfeUrl} {...ext}>
                          NF {m.numero}
                        </a>
                      ) : (
                        <span className="text-lk-muted">NF {m.numero}</span>
                      )}
                    </td>
                    <td className={`${TD} text-right font-medium`}>{brl(m.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );

  // Lista de espera: 25 por página, mais novo primeiro.
  const LIST_PAGE = 25;
  const listPages = Math.max(1, Math.ceil(waitlist.length / LIST_PAGE));
  const listCur = Math.min(listPages, Math.max(1, Number.parseInt(String(sp.lp ?? "1"), 10) || 1));
  const listShown = [...waitlist]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice((listCur - 1) * LIST_PAGE, listCur * LIST_PAGE);
  const listHref = (n: number) => (n > 1 ? `/painel?aba=lista&lp=${n}` : "/painel?aba=lista");

  const listaView = (
    <>
      <PageHeader
        eyebrow="Quem pediu aviso do próximo lote"
        title="Lista de espera"
        actions={actions}
      />
      <section className="flex flex-col gap-4">
        <SectionTitle title="Contatos" count={waitlist.length} />
        {waitlist.length === 0 ? (
          <Empty>Ninguém na lista ainda.</Empty>
        ) : (
          <div className={`${TABLE_WRAP} overflow-x-auto`}>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th className={TH}>Nome</th>
                  <th className={TH}>Contato</th>
                  <th className={TH}>Interesse</th>
                  <th className={`${TH} text-right`}>Quando</th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {listShown.map((l) => {
                  const c = l.fields.contato ?? "";
                  const link = c.includes("@") ? `mailto:${c}` : waLink(c);
                  return (
                    <tr key={l.id} className="hover:bg-lk-paper/60">
                      <td className={`${TD} font-semibold`}>{l.fields.nome || "—"}</td>
                      <td className={TD}>
                        <a className={LINK} href={link} {...ext}>
                          {c.includes("@") ? c : phone(c)}
                        </a>
                      </td>
                      <td className={`${TD} text-lk-muted`}>
                        {l.fields.produto ? <Code>{l.fields.produto}</Code> : "Próximo lote"}
                      </td>
                      <td className={`${TD} text-lk-muted text-right`}>{when(l.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {listPages > 1 && (
          <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
            {listCur > 1 ? (
              <Link href={listHref(listCur - 1)} className={btn("secondary")}>
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-lk-muted">
              {(listCur - 1) * LIST_PAGE + 1}–{Math.min(listCur * LIST_PAGE, waitlist.length)} de{" "}
              {waitlist.length} · página {listCur} de {listPages}
            </span>
            {listCur < listPages ? (
              <Link href={listHref(listCur + 1)} className={btn("secondary")}>
                Próxima →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );

  return (
    <Frame
      aba={aba}
      counts={{ pedidos: toPrint.length + toDeliver.length + stuck.length, lista: waitlist.length }}
    >
      {aba === "producao" ? (
        <>
          <PageHeader eyebrow="Lotes, fornecedores e custos" title="Produção" actions={actions} />
          <Producao
            initial={producao}
            precos={{
              lata: ESTOQUE.find((p) => p.sku === "FERN-350")!.priceCents,
              pack: ESTOQUE.find((p) => p.sku === "FERN-350-6")!.priceCents,
            }}
          />
        </>
      ) : aba === "estoque" ? (
        estoqueView
      ) : aba === "fora" ? (
        foraView
      ) : aba === "lista" ? (
        listaView
      ) : (
        pedidosView
      )}
    </Frame>
  );
}
