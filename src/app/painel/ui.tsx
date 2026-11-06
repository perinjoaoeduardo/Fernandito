import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Boxes, FileText, Inbox, BellRing, Factory } from "lucide-react";

// Peças do painel, no visual do Lakeshore Funding (docs/design-rules.md e
// docs/rules/* daquele repositório). Regras que valem aqui:
// 1) uma ação principal por tela/linha (botão petrol); o resto é contorno ou discreto;
// 2) estado = cor + ícone + palavra, sempre os mesmos (ver `Tone`);
// 3) estrutura com espaço e bordas finas, sem pilha de cartões nem sombra forte;
// 4) Public Sans pra tudo; IBM Plex Mono só pra códigos (pedido, rastreio);
// 5) alvos de 32 px+, foco visível em petrol.

export type Tone = "action" | "running" | "hold" | "pass" | "fail" | "review" | "muted";

const TONE: Record<Tone, string> = {
  action: "bg-lk-action-subtle text-lk-action-strong",
  running: "bg-lk-running-bg text-lk-running",
  hold: "bg-lk-hold-bg text-lk-hold",
  pass: "bg-lk-pass-bg text-lk-pass",
  fail: "bg-lk-fail-bg text-lk-fail",
  review: "bg-lk-review-bg text-lk-review",
  muted: "bg-lk-soft text-lk-muted",
};
const TEXT: Record<Tone, string> = {
  action: "text-lk-action-strong",
  running: "text-lk-running",
  hold: "text-lk-hold",
  pass: "text-lk-pass",
  fail: "text-lk-fail",
  review: "text-lk-review",
  muted: "text-lk-muted",
};

export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-lk-action focus-visible:ring-offset-2";

/** Etiqueta de estado: pílula com ícone e palavra. */
export function Badge({
  tone,
  icon: Icon,
  children,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

export type BtnVariant = "primary" | "secondary" | "ghost";

/** Botão: `primary` (petrol, a ação principal), `secondary` (contorno), `ghost` (discreto). */
export function btn(variant: BtnVariant = "secondary", size: "md" | "sm" = "md") {
  const h = size === "md" ? "h-9 px-4 text-sm" : "h-8 px-3 text-[13px]";
  const look =
    variant === "primary"
      ? "bg-lk-action text-white hover:bg-lk-action-hover"
      : variant === "ghost"
        ? "text-lk-muted hover:bg-lk-soft hover:text-lk-ink"
        : "border border-lk-border bg-white text-lk-ink hover:bg-lk-paper";
  return `inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 ${h} ${look} ${FOCUS}`;
}

export const LINK =
  "font-medium text-lk-action-strong underline decoration-lk-action-border underline-offset-4 hover:decoration-lk-action-strong";

export const CARD = "rounded-xl border border-lk-border bg-white";

/** Fundo do painel: cobre o site, fonte e cores do painel. */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-lenis-prevent
      className="painel font-lk bg-lk-page text-lk-ink fixed inset-0 z-[500] overflow-y-auto text-sm [font-variant-numeric:tabular-nums] antialiased [color-scheme:light]"
    >
      {children}
    </div>
  );
}

// ── Menu lateral (docs/rules/sidebar.md do Lakeshore) ─────────────────────

export type Aba = "pedidos" | "estoque" | "fora" | "lista" | "producao";

const NAV: { aba: Aba; label: string; icon: LucideIcon }[] = [
  { aba: "pedidos", label: "Pedidos", icon: Inbox },
  { aba: "estoque", label: "Estoque e vendas", icon: Boxes },
  { aba: "fora", label: "Vendas manuais", icon: FileText },
  { aba: "lista", label: "Lista de espera", icon: BellRing },
  { aba: "producao", label: "Produção", icon: Factory },
];

const abaHref = (aba: Aba) => (aba === "pedidos" ? "/painel" : `/painel?aba=${aba}`);

function Brand() {
  return (
    <Link
      href="/painel"
      aria-label="Fernandito, painel da loja, início"
      className={`flex min-w-0 items-center gap-2.5 rounded-xl ${FOCUS} focus-visible:ring-offset-lk-side`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/fernandito-selo.webp" alt="" className="size-8 shrink-0 rounded-full" />
      <span className="flex flex-col gap-1.5">
        <span className="font-lk-brand text-lk-side-fg text-[18px] leading-none font-semibold tracking-[-0.03em]">
          Fernandito
        </span>
        <span className="font-lk-mono text-lk-lagoon text-[10px] leading-none font-medium tracking-[0.18em] uppercase">
          Painel da loja
        </span>
      </span>
    </Link>
  );
}

/** Contagem discreta ao lado do item (só quando > 0): número lagoon num quadrado lagoon 12%. */
function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="bg-lk-lagoon/[0.12] text-lk-lagoon ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums">
      {n}
    </span>
  );
}

function NavItem({
  item,
  active,
  count,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  count: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={abaHref(item.aba)}
      aria-current={active ? "page" : undefined}
      className={`focus-visible:ring-lk-side-fg/60 flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] whitespace-nowrap transition-colors duration-100 focus-visible:ring-2 focus-visible:outline-none ${
        active
          ? "bg-lk-side-selected text-lk-side-fg font-semibold shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] ring-1 ring-white/[0.06]"
          : "text-lk-side-muted hover:bg-lk-side-hover hover:text-lk-side-fg"
      }`}
    >
      <Icon
        aria-hidden
        className={`size-[18px] shrink-0 ${active ? "text-lk-lagoon" : "opacity-80"}`}
      />
      <span>{item.label}</span>
      <Count n={count} />
    </Link>
  );
}

/**
 * Moldura de toda tela logada: menu lateral petrol flutuante (≥ 1024 px) ou
 * barra no topo (celular), e a página ao lado.
 */
export function Frame({
  aba,
  counts,
  children,
}: {
  aba: Aba;
  counts: Partial<Record<Aba, number>>;
  children: React.ReactNode;
}) {
  return (
    <Shell>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-white focus:px-3 focus:py-2"
      >
        Pular pro conteúdo
      </a>
      <div className="lg:flex lg:min-h-full">
        {/* Celular/tablet: barra petrol no topo com o menu rolando de lado. */}
        <header className="bg-lk-side px-4 pt-4 pb-3 lg:hidden">
          <Brand />
          <nav aria-label="Menu" className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 pb-1">
            {NAV.map((item) => (
              <NavItem
                key={item.aba}
                item={item}
                active={aba === item.aba}
                count={counts[item.aba] ?? 0}
              />
            ))}
          </nav>
        </header>

        {/* Computador: painel flutuante, 19rem, 1.5rem da borda da janela. */}
        <aside className="hidden lg:block lg:w-[calc(19rem+3rem)] lg:shrink-0 lg:p-6">
          <div className="bg-lk-side sticky top-6 flex h-[calc(100svh-3rem)] flex-col rounded-2xl px-3 pt-5 pb-3">
            <div className="pl-2">
              <Brand />
            </div>
            <p className="font-lk-mono text-lk-side-muted mt-8 mb-1 px-3 text-[10.5px] font-medium tracking-[0.14em] uppercase">
              Loja
            </p>
            <nav aria-label="Menu" className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavItem
                  key={item.aba}
                  item={item}
                  active={aba === item.aba}
                  count={counts[item.aba] ?? 0}
                />
              ))}
            </nav>
            <div className="mt-auto flex items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.04] p-2">
              <span className="bg-lk-sand text-lk-petrol flex size-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-semibold">
                FE
              </span>
              <span className="min-w-0">
                <span className="text-lk-side-fg block truncate text-sm font-semibold">
                  Equipe Fernandito
                </span>
                <span className="text-lk-side-muted block truncate text-xs">fernandito.com.br</span>
              </span>
            </div>
          </div>
        </aside>

        <main id="conteudo" className="min-w-0 flex-1">
          <div className="mx-auto flex max-w-[1560px] flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-10 xl:px-10">
            {children}
          </div>
        </main>
      </div>
    </Shell>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

/** Topo de toda tela: linha de 14 px (saudação/data), título de 32 px e as ações à direita. */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <p className="text-lk-muted text-sm">{eyebrow}</p>}
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.01em] sm:text-[32px] sm:leading-10">
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Título de seção com a contagem ao lado: "Pedidos · 11". */
export function SectionTitle({
  title,
  count,
  aside,
}: {
  title: string;
  count?: number;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="text-xl leading-7 font-semibold">
        {title}
        {count !== undefined && <span className="text-lk-muted font-normal"> · {count}</span>}
      </h2>
      {aside}
    </div>
  );
}

// ── KPIs (docs/rules/queue-header.md do Lakeshore) ─────────────────────────

/** A fileira de números: um cartão só, células divididas por uma linha. */
export function KpiStrip({ cols, children }: { cols: 3 | 4; children: React.ReactNode }) {
  return (
    <div
      className={`border-lk-border bg-lk-border grid gap-px overflow-hidden rounded-xl border shadow-[0_1px_2px_rgb(24_34_46/0.04)] ${
        cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Um número: ícone + rótulo, o número (28 px, petrol), uma linha de contexto.
 * Com `href` a célula toda filtra a lista; zero apaga e desliga o clique.
 */
export function Tile({
  icon: Icon,
  label,
  value,
  note,
  href,
  selected = false,
  tone = "action",
  edge,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  href?: string;
  selected?: boolean;
  tone?: Tone;
  /** Barrinha no pé (ex.: estoque). 0–100. */
  edge?: number;
}) {
  const empty = value === 0;
  const body = (
    <>
      <span
        className={`flex h-6 items-center gap-2 text-[13px] font-medium ${empty ? "text-lk-muted opacity-70" : TEXT[tone]}`}
      >
        <Icon aria-hidden className="size-4" />
        {label}
      </span>
      <span
        className={`text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${
          empty ? "text-lk-muted/45" : TEXT[tone]
        }`}
      >
        {value}
      </span>
      <span className="text-lk-muted min-h-5 truncate text-xs">{note}</span>
      {edge !== undefined && (
        <span className="bg-lk-soft absolute inset-x-0 bottom-0 h-1">
          <span className="bg-lk-action block h-full" style={{ width: `${edge}%` }} />
        </span>
      )}
    </>
  );
  const base = `relative flex min-w-0 flex-col gap-2 bg-white px-5 pt-4 pb-4 transition-colors duration-100`;
  if (href && !empty)
    return (
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        className={`${base} ${FOCUS} focus-visible:ring-offset-0 focus-visible:ring-inset ${
          selected
            ? "!bg-[#f1f4f5] shadow-[inset_0_2px_0_var(--color-lk-ink)]"
            : "hover:!bg-[#f8f9fa]"
        }`}
      >
        {body}
      </Link>
    );
  return <div className={base}>{body}</div>;
}

// ── Lista ──────────────────────────────────────────────────────────────────

/** Abas segmentadas (o "Today · This week" do Lakeshore). */
export function Segmented({
  label,
  items,
}: {
  label: string;
  items: { key: string; label: string; count?: number; href: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="bg-lk-soft inline-flex gap-0.5 rounded-lg p-1">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            aria-current={it.active ? "page" : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] whitespace-nowrap transition-colors duration-100 ${FOCUS} focus-visible:ring-offset-0 ${
              it.active
                ? "text-lk-ink bg-white font-medium shadow-[0_1px_2px_rgb(24_34_46/0.08)]"
                : "text-lk-muted hover:text-lk-ink"
            }`}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={`tabular-nums ${it.active ? "text-lk-muted" : "text-lk-ink3"}`}>
                {it.count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Cabeçalho de tabela: 40 px, fundo suave, rótulo 12 px. */
export const TH =
  "h-10 bg-lk-soft px-4 text-left text-xs font-medium text-lk-muted first:pl-5 last:pr-5";
export const TD = "px-4 py-3 align-top first:pl-5 last:pr-5";
export const TABLE_WRAP = "overflow-hidden rounded-xl border border-lk-border bg-white";

/** Lista vazia: cartão tracejado com uma linha. */
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-lk-input text-lk-muted rounded-xl border border-dashed bg-white p-10 text-center text-sm">
      {children}
    </p>
  );
}

/** Código (pedido, rastreio, nota): IBM Plex Mono 13 px. */
export function Code({ children }: { children: React.ReactNode }) {
  return <span className="font-lk-mono text-lk-muted text-[12.5px]">{children}</span>;
}

// ── Filtros agrupados ──────────────────────────────────────────────────────

type FilterItem = { key: string; label: string; count?: number; href: string; active: boolean };

/**
 * Filtros em grupos (Correio · Em mãos · Atenção): cada grupo é um bloco de
 * abas segmentadas com o nome em cima, todos lado a lado num cartão só.
 */
export function FilterGroups({
  label,
  groups,
}: {
  label: string;
  groups: { title: string; items: FilterItem[] }[];
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="border-lk-border inline-flex items-end gap-x-5 gap-y-3 rounded-xl border bg-white p-3 max-sm:flex-wrap">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-1.5">
            <span className="text-lk-ink3 px-1 text-[11px] font-medium">{g.title}</span>
            <div className="bg-lk-soft inline-flex gap-0.5 rounded-lg p-1">
              {g.items.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  aria-current={it.active ? "page" : undefined}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] whitespace-nowrap transition-colors duration-100 ${FOCUS} focus-visible:ring-offset-0 ${
                    it.active
                      ? "text-lk-ink bg-white font-medium shadow-[0_1px_2px_rgb(24_34_46/0.08)]"
                      : "text-lk-muted hover:text-lk-ink"
                  }`}
                >
                  {it.label}
                  {it.count !== undefined && (
                    <span
                      className={`tabular-nums ${it.active ? "text-lk-muted" : "text-lk-ink3"}`}
                    >
                      {it.count}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

/** Cabeçalho que ordena: clique alterna ↓ ↑; o ativo mostra a seta. */
export function SortHead({
  label,
  href,
  dir,
  align = "left",
  className = "",
}: {
  label: string;
  href: string;
  /** Direção atual se esta coluna é a ordenada. */
  dir?: "asc" | "desc";
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`${TH} ${align === "right" ? "text-right" : ""} ${className}`}
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
    >
      <Link
        href={href}
        className={`group hover:text-lk-ink inline-flex items-center gap-1 rounded-sm ${FOCUS} focus-visible:ring-offset-0 ${
          dir ? "text-lk-ink" : ""
        }`}
      >
        {label}
        <span aria-hidden className={dir ? "" : "opacity-0 group-hover:opacity-50"}>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      </Link>
    </th>
  );
}

/** Barra empilhada de estoque: vendidos · brindes · restam. */
export function StockBar({ sold, gift, left }: { sold: number; gift: number; left: number }) {
  const total = sold + gift + left;
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : "0%");
  return (
    <div className="bg-lk-soft flex h-2.5 w-full overflow-hidden rounded-full" aria-hidden>
      <span className="bg-lk-action block h-full" style={{ width: pct(sold) }} />
      <span className="bg-lk-review block h-full" style={{ width: pct(gift) }} />
      <span className="block h-full bg-[#b9c4ca]" style={{ width: pct(left) }} />
    </div>
  );
}
