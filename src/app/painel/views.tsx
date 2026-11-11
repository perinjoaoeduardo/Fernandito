import Link from "next/link";
import {
  Banknote,
  BellRing,
  Boxes,
  ChartLine,
  Coins,
  CupSoda,
  Gift,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Users,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Code,
  Empty,
  KpiStrip,
  LINK,
  PageHeader,
  Segmented,
  SectionTitle,
  TABLE_WRAP,
  TD,
  TH,
  Tile,
  type Tone,
} from "./ui";

// Telas do painel feitas no servidor: Vendas, Clientes, os lotes à venda
// (Estoque de produtos) e Resultados. Recebem os dados já prontos da
// page.tsx; aqui é só conta simples e desenho.

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number, max = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: max });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
/** "2026-11-07" → "07/11/2026". */
const diaBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesBR = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

// ── Vendas (site + manuais + bonificações), tudo num formato só ─────────────

export type Canal = "site" | "manual" | "bonificacao";

export type Venda = {
  id: string;
  /** Dia da venda (AAAA-MM-DD, Brasília). */
  data: string;
  canal: Canal;
  cliente: string;
  /** Telefone (dígitos) ou e-mail; vazio nas manuais. */
  contato: string;
  cidade: string;
  uf: string;
  itens: { sku: string; nome: string; qtd: number; valorCents: number }[];
  /** Total cobrado (no site, com o frete). */
  totalCents: number;
  freteCents: number;
  /** Nota manual ainda sem autorização (não entra no faturado). */
  pendente: boolean;
  /** Aceitou receber novidades (só no site). */
  marketing: boolean;
  ref: string;
  link: string | null;
};

export const PERIODOS = [
  ["mes", "Este mês"],
  ["anterior", "Mês passado"],
  ["30", "30 dias"],
  ["tudo", "Tudo"],
] as const;
export type Periodo = (typeof PERIODOS)[number][0];

/** O intervalo [de, ate] (AAAA-MM-DD) do período, no dia de hoje. */
export function intervalo(p: Periodo, hoje: string): [string, string] {
  const [y, m] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))];
  const mes = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}`;
  if (p === "mes") return [`${mes(y, m)}-01`, hoje];
  if (p === "anterior") {
    const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
    return [`${mes(py, pm)}-01`, `${mes(py, pm)}-31`];
  }
  if (p === "30") {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 29);
    return [d.toISOString().slice(0, 10), hoje];
  }
  return ["0000-00-00", "9999-12-31"];
}

const noPeriodo = (data: string, [de, ate]: [string, string]) => data >= de && data <= ate;

/** Latas por produto (kit = 2, six pack = 6, lata = 1). */
export type LatasPorSku = Record<string, number>;

const latasDa = (v: Venda, latas: LatasPorSku) =>
  v.itens.reduce((n, i) => n + (latas[i.sku] ?? 0) * i.qtd, 0);

/** Receita de produtos (sem o frete) de uma venda. */
const receitaProdutos = (v: Venda) => v.totalCents - v.freteCents;

function PeriodoNav({ aba, periodo }: { aba: string; periodo: Periodo }) {
  return (
    <Segmented
      label="Período"
      items={PERIODOS.map(([k, label]) => ({
        key: k,
        label,
        href: `/painel?aba=${aba}${k === "tudo" ? "" : `&periodo=${k}`}`,
        active: periodo === k,
      }))}
    />
  );
}

const CANAL: Record<Canal, { label: string; tone: Tone }> = {
  site: { label: "Site", tone: "action" },
  manual: { label: "Venda manual", tone: "pass" },
  bonificacao: { label: "Bonificação", tone: "review" },
};

export function VendasView({
  vendas,
  periodo,
  hoje,
  latas,
  actions,
  pendentesNotas,
  erroNotas,
  semTopo = false,
}: {
  vendas: Venda[];
  periodo: Periodo;
  hoje: string;
  latas: LatasPorSku;
  actions: React.ReactNode;
  pendentesNotas: number;
  erroNotas: string | null;
  /** Embutida na aba Vendas (depois da tabela de pedidos): sem título nem os 4 números. */
  semTopo?: boolean;
}) {
  const iv = intervalo(periodo, hoje);
  const doPeriodo = vendas.filter((v) => noPeriodo(v.data, iv));
  const pagas = doPeriodo.filter((v) => v.canal !== "bonificacao" && !v.pendente);
  const site = pagas.filter((v) => v.canal === "site");
  const manual = pagas.filter((v) => v.canal === "manual");
  const brindes = doPeriodo.filter((v) => v.canal === "bonificacao");
  const soma = (vs: Venda[]) => vs.reduce((n, v) => n + v.totalCents, 0);
  const faturado = soma(pagas);
  const ticket = pagas.length ? Math.round(faturado / pagas.length) : 0;
  const latasVendidas = pagas.reduce((n, v) => n + latasDa(v, latas), 0);
  const latasBrinde = brindes.reduce((n, v) => n + latasDa(v, latas), 0);
  const freteCobrado = site.reduce((n, v) => n + v.freteCents, 0);

  // Por produto: quantidade em cada canal e a receita (sem frete).
  const produtos = new Map<
    string,
    { nome: string; site: number; manual: number; brinde: number; receita: number }
  >();
  for (const v of doPeriodo.filter((x) => !x.pendente))
    for (const i of v.itens) {
      const p = produtos.get(i.sku) ?? { nome: i.nome, site: 0, manual: 0, brinde: 0, receita: 0 };
      if (v.canal === "site") p.site += i.qtd;
      else if (v.canal === "manual") p.manual += i.qtd;
      else p.brinde += i.qtd;
      if (v.canal !== "bonificacao") p.receita += i.valorCents;
      produtos.set(i.sku, p);
    }
  // Por mês (sempre tudo, pra ver a tendência).
  const meses = new Map<string, { vendas: number; faturado: number; latas: number }>();
  for (const v of vendas.filter((x) => x.canal !== "bonificacao" && !x.pendente)) {
    const m = v.data.slice(0, 7);
    const r = meses.get(m) ?? { vendas: 0, faturado: 0, latas: 0 };
    r.vendas++;
    r.faturado += v.totalCents;
    r.latas += latasDa(v, latas);
    meses.set(m, r);
  }
  const lista = [...doPeriodo].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <>
      {!semTopo && (
        <PageHeader
          eyebrow="Site, vendas manuais e bonificações"
          title="Vendas"
          actions={actions}
        />
      )}
      <PeriodoNav aba="pedidos" periodo={periodo} />
      {!semTopo && (
        <KpiStrip cols={4}>
          <Tile
            icon={Banknote}
            label="Faturado"
            value={brl(faturado)}
            note={`site ${brl(soma(site))} · manual ${brl(soma(manual))}`}
          />
          <Tile
            icon={ShoppingBag}
            label="Vendas"
            value={pagas.length}
            note={`${site.length} no site · ${manual.length} manuais`}
          />
          <Tile
            icon={Receipt}
            label="Ticket médio"
            value={brl(ticket)}
            note={freteCobrado ? `frete cobrado no site ${brl(freteCobrado)}` : "Faturado ÷ vendas"}
          />
          <Tile
            icon={CupSoda}
            label="Latas vendidas"
            value={num(latasVendidas)}
            note={latasBrinde ? `+${num(latasBrinde)} em brindes` : "Kit = 2 latas · six pack = 6"}
          />
        </KpiStrip>
      )}
      {(pendentesNotas > 0 || erroNotas) && (
        <p className="text-lk-muted text-xs">
          {pendentesNotas > 0 &&
            `${pendentesNotas} ${pendentesNotas === 1 ? "nota manual ainda sem autorização" : "notas manuais ainda sem autorização"} (fora do faturado). `}
          {erroNotas && (
            <span className="text-lk-fail">
              {/429|limite de requisi/i.test(erroNotas)
                ? "O Bling pediu calma (muitas consultas de uma vez): a leitura das notas fica pra daqui a pouco, sozinha."
                : `Última leitura das notas falhou: ${erroNotas}`}
            </span>
          )}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <SectionTitle title="Por produto" count={produtos.size} />
        {produtos.size === 0 ? (
          <Empty>Nenhuma venda no período.</Empty>
        ) : (
          <div className={`${TABLE_WRAP} overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className={TH}>Produto</th>
                  <th className={`${TH} text-right`}>Site</th>
                  <th className={`${TH} text-right`}>Manual</th>
                  <th className={`${TH} text-right`}>Brindes</th>
                  <th className={`${TH} text-right`}>Receita (sem frete)</th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {[...produtos]
                  .sort((a, b) => b[1].receita - a[1].receita)
                  .map(([sku, p]) => (
                    <tr key={sku}>
                      <td className={TD}>
                        <p className="font-semibold">{p.nome}</p>
                        <Code>{sku}</Code>
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{num(p.site)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{num(p.manual)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{num(p.brinde)}</td>
                      <td className={`${TD} text-right font-medium tabular-nums`}>
                        {brl(p.receita)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {meses.size > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="Por mês" count={meses.size} />
          <div className={`${TABLE_WRAP} overflow-x-auto`}>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr>
                  <th className={TH}>Mês</th>
                  <th className={`${TH} text-right`}>Vendas</th>
                  <th className={`${TH} text-right`}>Latas</th>
                  <th className={`${TH} text-right`}>Faturado</th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {[...meses]
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([m, r]) => (
                    <tr key={m}>
                      <td className={`${TD} font-medium`}>{mesBR(m)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{num(r.vendas)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{num(r.latas)}</td>
                      <td className={`${TD} text-right font-medium tabular-nums`}>
                        {brl(r.faturado)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!semTopo && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="Todas as vendas do período" count={lista.length} />
          {lista.length === 0 ? (
            <Empty>Nenhuma venda no período.</Empty>
          ) : (
            <div className={`${TABLE_WRAP} overflow-x-auto`}>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr>
                    <th className={TH}>Data</th>
                    <th className={`${TH} w-[28%]`}>Cliente</th>
                    <th className={TH}>Itens</th>
                    <th className={TH}>Canal</th>
                    <th className={`${TH} text-right`}>Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-lk-border divide-y">
                  {lista.map((v) => {
                    const c = CANAL[v.canal];
                    return (
                      <tr key={v.id} className="hover:bg-lk-paper/60">
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>{diaBR(v.data)}</td>
                        <td className={TD}>
                          <p className="font-semibold">{v.cliente || "—"}</p>
                          <p className="text-lk-muted text-xs">
                            {v.cidade ? `${v.cidade}/${v.uf}` : ""}
                          </p>
                        </td>
                        <td className={`${TD} text-lk-muted`}>
                          {v.itens.map((i) => `${num(i.qtd)}x ${i.nome}`).join(" + ")}
                        </td>
                        <td className={TD}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={c.tone}>{c.label}</Badge>
                            {v.pendente && <Badge tone="hold">Nota pendente</Badge>}
                          </div>
                          <p className="mt-1 text-xs">
                            {v.link ? (
                              <a className={LINK} href={v.link} {...ext}>
                                {v.ref}
                              </a>
                            ) : (
                              <span className="text-lk-muted">{v.ref}</span>
                            )}
                          </p>
                        </td>
                        <td className={`${TD} text-right font-medium tabular-nums`}>
                          {brl(v.totalCents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-lk-ink3 text-xs">
            Faturado = pedidos pagos do site (com o frete cobrado) + vendas manuais com nota
            autorizada. Bonificações não entram no faturado. Receita por produto é sem o frete.
          </p>
        </section>
      )}
    </>
  );
}

// ── Clientes (compradores + lista de espera) ────────────────────────────────

const chave = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

const telefone = (digits: string) => {
  const d = digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length === 10
      ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : digits;
};
const linkContato = (c: string) =>
  c.includes("@")
    ? `mailto:${c}`
    : `https://wa.me/55${c.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`;

export type Espera = {
  id: string;
  nome: string;
  contato: string;
  produto: string;
  quando: string;
};

export function ClientesView({
  vendas,
  espera,
  pagina,
  actions,
  latas,
}: {
  vendas: Venda[];
  espera: Espera[];
  pagina: number;
  actions: React.ReactNode;
  latas: LatasPorSku;
}) {
  // Compradores: junta por nome (site e manual), sem bonificação.
  type Comprador = {
    nome: string;
    contato: string;
    cidade: string;
    compras: number;
    total: number;
    latas: number;
    ultima: string;
    primeira: string;
    canais: Set<Canal>;
    marketing: boolean;
  };
  const porNome = new Map<string, Comprador>();
  for (const v of vendas.filter((x) => x.canal !== "bonificacao" && !x.pendente && x.cliente)) {
    const k = chave(v.cliente);
    const c = porNome.get(k) ?? {
      nome: v.cliente,
      contato: "",
      cidade: "",
      compras: 0,
      total: 0,
      latas: 0,
      ultima: v.data,
      primeira: v.data,
      canais: new Set<Canal>(),
      marketing: false,
    };
    c.compras++;
    c.total += v.totalCents;
    c.latas += latasDa(v, latas);
    if (v.data > c.ultima) c.ultima = v.data;
    if (v.data < c.primeira) c.primeira = v.data;
    c.contato ||= v.contato;
    c.cidade ||= v.cidade ? `${v.cidade}/${v.uf}` : "";
    c.canais.add(v.canal);
    c.marketing ||= v.marketing;
    porNome.set(k, c);
  }
  const compradores = [...porNome.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
  const recompra = compradores.filter((c) => c.compras > 1).length;
  const optIn = compradores.filter((c) => c.marketing).length;
  // Quem está na lista de espera e ainda não comprou.
  const jaCompraram = new Set(compradores.map((c) => chave(c.nome)));
  const esperaNova = espera.filter((l) => !jaCompraram.has(chave(l.nome))).length;

  const POR_PAGINA = 25;
  const paginas = Math.max(1, Math.ceil(espera.length / POR_PAGINA));
  const cur = Math.min(paginas, Math.max(1, pagina));
  const esperaPagina = [...espera]
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice((cur - 1) * POR_PAGINA, cur * POR_PAGINA);
  const href = (n: number) => (n > 1 ? `/painel?aba=clientes&lp=${n}` : "/painel?aba=clientes");

  return (
    <>
      <PageHeader eyebrow="Quem comprou e quem está esperando" title="Clientes" actions={actions} />
      <KpiStrip cols={4}>
        <Tile
          icon={Users}
          label="Compradores"
          value={compradores.length}
          note="site + vendas manuais"
        />
        <Tile
          icon={Repeat}
          label="Compraram de novo"
          value={recompra}
          note={
            compradores.length
              ? `${pct((recompra / compradores.length) * 100)} dos compradores`
              : "—"
          }
        />
        <Tile
          icon={BellRing}
          label="Aceitam novidades"
          value={optIn}
          note="marcaram no checkout do site"
        />
        <Tile
          icon={Gift}
          label="Lista de espera"
          value={espera.length}
          note={`${esperaNova} ainda não ${esperaNova === 1 ? "comprou" : "compraram"}`}
        />
      </KpiStrip>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Compradores" count={compradores.length} />
        {compradores.length === 0 ? (
          <Empty>Nenhuma compra ainda.</Empty>
        ) : (
          <div className={`${TABLE_WRAP} overflow-x-auto`}>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr>
                  <th className={TH}>Cliente</th>
                  <th className={TH}>Contato</th>
                  <th className={`${TH} text-right`}>Compras</th>
                  <th className={`${TH} text-right`}>Latas</th>
                  <th className={`${TH} text-right`}>Total</th>
                  <th className={`${TH} text-right`}>Última</th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {compradores.map((c) => (
                  <tr key={chave(c.nome)} className="hover:bg-lk-paper/60">
                    <td className={TD}>
                      <p className="font-semibold">{c.nome}</p>
                      <p className="text-lk-muted text-xs">
                        {c.cidade}
                        {c.canais.has("manual") && c.canais.has("site")
                          ? " · site e manual"
                          : c.canais.has("manual")
                            ? " · venda manual"
                            : ""}
                        {c.marketing ? " · aceita novidades" : ""}
                      </p>
                    </td>
                    <td className={TD}>
                      {c.contato ? (
                        <a className={`${LINK} font-normal`} href={linkContato(c.contato)} {...ext}>
                          {c.contato.includes("@") ? c.contato : telefone(c.contato)}
                        </a>
                      ) : (
                        <span className="text-lk-muted">—</span>
                      )}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {c.compras > 1 ? <Badge tone="pass">{c.compras}</Badge> : num(c.compras)}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{num(c.latas)}</td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{brl(c.total)}</td>
                    <td className={`${TD} text-lk-muted text-right whitespace-nowrap tabular-nums`}>
                      {diaBR(c.ultima)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-lk-ink3 text-xs">
          Juntado pelo nome (site e vendas manuais). Contato e &quot;aceita novidades&quot; vêm dos
          pedidos do site; as vendas manuais não trazem contato.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Lista de espera" count={espera.length} />
        {espera.length === 0 ? (
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
                {esperaPagina.map((l) => (
                  <tr key={l.id} className="hover:bg-lk-paper/60">
                    <td className={TD}>
                      <p className="font-semibold">{l.nome || "—"}</p>
                      {jaCompraram.has(chave(l.nome)) && (
                        <p className="text-lk-pass text-xs">já comprou</p>
                      )}
                    </td>
                    <td className={TD}>
                      {l.contato ? (
                        <a className={LINK} href={linkContato(l.contato)} {...ext}>
                          {l.contato.includes("@") ? l.contato : telefone(l.contato)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${TD} text-lk-muted`}>
                      {l.produto ? <Code>{l.produto}</Code> : "Próximo lote"}
                    </td>
                    <td className={`${TD} text-lk-muted text-right whitespace-nowrap`}>
                      {new Date(l.quando).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paginas > 1 && (
          <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
            {cur > 1 ? (
              <Link href={href(cur - 1)} className={LINK}>
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-lk-muted">
              Página {cur} de {paginas}
            </span>
            {cur < paginas ? (
              <Link href={href(cur + 1)} className={LINK}>
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
}

// ── Estoque de produtos: lotes à venda (primeiro que vence sai primeiro) ────

export type LoteProduto = {
  codigo: string;
  latasBoas: number;
  envaseEm: string | null;
  validade: string | null;
  /** Custo real por lata (centavos), se tiver. */
  lataCents: number | null;
};

export function LotesAVenda({
  lotes,
  latasEmEstoque,
  hoje,
}: {
  lotes: LoteProduto[];
  /** Latas no Bling (todas, as dos packs também); null = Bling sem resposta. */
  latasEmEstoque: number | null;
  hoje: string;
}) {
  // As latas que restam são dos lotes mais novos: as mais velhas saíram primeiro.
  const ordem = [...lotes].sort(
    (a, b) =>
      (b.validade ?? b.envaseEm ?? "").localeCompare(a.validade ?? a.envaseEm ?? "") ||
      b.codigo.localeCompare(a.codigo, undefined, { numeric: true }),
  );
  // Quanto sobra pra cada lote depois dos mais novos que ele.
  const total = latasEmEstoque ?? 0;
  const antes = ordem.map((_, k) => ordem.slice(0, k).reduce((n, x) => n + x.latasBoas, 0));
  const linhas = ordem.map((l, k) => {
    const restam = Math.min(l.latasBoas, Math.max(0, total - antes[k]));
    const dias = l.validade
      ? Math.round(
          (new Date(`${l.validade}T12:00:00Z`).getTime() -
            new Date(`${hoje}T12:00:00Z`).getTime()) /
            86_400_000,
        )
      : null;
    return { l, restam, dias };
  });
  const valor = linhas.reduce((n, x) => n + x.restam * (x.l.lataCents ?? 0), 0);
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle
        title="Lotes à venda"
        count={linhas.filter((x) => x.restam > 0).length}
        aside={
          valor > 0 ? (
            <span className="text-lk-muted text-sm">
              Valor em estoque (custo):{" "}
              <span className="text-lk-ink font-semibold">{brl(valor)}</span>
            </span>
          ) : undefined
        }
      />
      {linhas.length === 0 ? (
        <Empty>Nenhum lote concluído ainda.</Empty>
      ) : (
        <div className={`${TABLE_WRAP} overflow-x-auto`}>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th className={TH}>Lote</th>
                <th className={`${TH} text-right`}>Produzidas</th>
                <th className={`${TH} text-right`}>Restam (estimado)</th>
                <th className={TH}>Envase</th>
                <th className={TH}>Validade</th>
                <th className={`${TH} text-right`}>Custo/lata</th>
              </tr>
            </thead>
            <tbody className="divide-lk-border divide-y">
              {linhas.map(({ l, restam, dias }) => (
                <tr key={l.codigo} className={restam ? "" : "opacity-60"}>
                  <td className={`${TD} font-lk-mono font-medium`}>{l.codigo}</td>
                  <td className={`${TD} text-right tabular-nums`}>{num(l.latasBoas)}</td>
                  <td className={`${TD} text-right font-medium tabular-nums`}>
                    {latasEmEstoque === null ? "—" : restam ? num(restam) : "esgotado"}
                  </td>
                  <td className={`${TD} tabular-nums`}>{l.envaseEm ? diaBR(l.envaseEm) : "—"}</td>
                  <td className={TD}>
                    {l.validade ? (
                      <>
                        <span className="tabular-nums">{diaBR(l.validade)}</span>
                        {restam > 0 && dias !== null && (
                          <span className="ml-2">
                            <Badge tone={dias < 0 ? "fail" : dias <= 60 ? "hold" : "muted"}>
                              {dias < 0 ? "vencido" : `${num(dias)} dias`}
                            </Badge>
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-lk-muted">sem data (preencha em Produção)</span>
                    )}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {l.lataCents ? brl(l.lataCents) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-lk-ink3 text-xs">
        Restam = as latas no Bling distribuídas dos lotes mais novos pros mais velhos (o mais velho
        sai primeiro). É estimativa: o Bling não separa por lote. Vender primeiro o que vence antes.
      </p>
    </section>
  );
}

// ── Resultados ──────────────────────────────────────────────────────────────

export type Compra = { data: string; totalCents: number };

export function ResultadosView({
  vendas,
  compras,
  periodo,
  hoje,
  latas,
  custoLata,
  custoLataBase,
  embalagemPackCents,
  valorInsumos,
  latasEmEstoque,
  margens,
  actions,
}: {
  vendas: Venda[];
  compras: Compra[];
  periodo: Periodo;
  hoje: string;
  latas: LatasPorSku;
  /** Custo de produção por lata (centavos). */
  custoLata: number | null;
  custoLataBase: string;
  /** Embalagem de cada six pack (caixa). */
  embalagemPackCents: number;
  valorInsumos: number;
  latasEmEstoque: number | null;
  margens: { nome: string; preco: number; custo: number | null }[];
  actions: React.ReactNode;
}) {
  const iv = intervalo(periodo, hoje);
  const pagas = vendas.filter((v) => v.canal !== "bonificacao" && !v.pendente);
  const custoVenda = (v: Venda) =>
    custoLata === null
      ? 0
      : latasDa(v, latas) * custoLata +
        v.itens.reduce((n, i) => n + (latas[i.sku] === 6 ? i.qtd * embalagemPackCents : 0), 0);
  const resumo = (vs: Venda[], cs: Compra[]) => {
    const receita = vs.reduce((n, v) => n + receitaProdutos(v), 0);
    const cpv = vs.reduce((n, v) => n + custoVenda(v), 0);
    return {
      receita,
      cpv,
      margem: receita - cpv,
      latas: vs.reduce((n, v) => n + latasDa(v, latas), 0),
      compras: cs.reduce((n, c) => n + c.totalCents, 0),
    };
  };
  const r = resumo(
    pagas.filter((v) => noPeriodo(v.data, iv)),
    compras.filter((c) => noPeriodo(c.data, iv)),
  );
  const brindes = vendas.filter((v) => v.canal === "bonificacao" && noPeriodo(v.data, iv));
  const custoBrindes = brindes.reduce((n, v) => n + custoVenda(v), 0);
  const valorProdutos = custoLata !== null && latasEmEstoque ? latasEmEstoque * custoLata : 0;
  const meses = [
    ...new Set([
      ...pagas.map((v) => v.data.slice(0, 7)),
      ...compras.map((c) => c.data.slice(0, 7)),
    ]),
  ].sort((a, b) => b.localeCompare(a));

  return (
    <>
      <PageHeader
        eyebrow="Quanto sobra: vendas, custo e compras"
        title="Resultados"
        actions={actions}
      />
      <PeriodoNav aba="resultados" periodo={periodo} />
      <KpiStrip cols={4}>
        <Tile
          icon={Banknote}
          label="Receita de produtos"
          value={brl(r.receita)}
          note={`${num(r.latas)} latas · sem o frete cobrado`}
        />
        <Tile
          icon={Coins}
          label="Custo do que foi vendido"
          value={custoLata === null ? "—" : brl(r.cpv)}
          note={
            custoLata === null
              ? "Sem custo por lata ainda"
              : `${brl(custoLata)}/lata · ${custoLataBase}`
          }
        />
        <Tile
          icon={ChartLine}
          label="Margem bruta"
          value={custoLata === null ? "—" : brl(r.margem)}
          tone={r.margem < 0 ? "fail" : "action"}
          note={
            r.receita > 0 && custoLata !== null
              ? `${pct((r.margem / r.receita) * 100)} da receita`
              : "—"
          }
        />
        <Tile
          icon={ShoppingCart}
          label="Compras de insumos"
          value={brl(r.compras)}
          note="pedidos de compra feitos no período"
        />
      </KpiStrip>
      <KpiStrip cols={3}>
        <Tile
          icon={Warehouse}
          label="Insumos em estoque"
          value={brl(valorInsumos)}
          note="pelo custo médio"
        />
        <Tile
          icon={Boxes}
          label="Produto pronto em estoque"
          value={valorProdutos ? brl(valorProdutos) : "—"}
          note={
            latasEmEstoque !== null
              ? `${num(latasEmEstoque)} latas no Bling × custo/lata`
              : "Bling sem resposta"
          }
        />
        <Tile
          icon={Gift}
          label="Custo dos brindes"
          value={custoLata === null ? "—" : brl(custoBrindes)}
          note={`${brindes.length} ${brindes.length === 1 ? "bonificação" : "bonificações"} no período`}
        />
      </KpiStrip>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Margem por produto" />
        <div className={`${TABLE_WRAP} overflow-x-auto`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className={TH}>Produto</th>
                <th className={`${TH} text-right`}>Preço de venda</th>
                <th className={`${TH} text-right`}>Custo de produção</th>
                <th className={`${TH} text-right`}>Margem bruta</th>
              </tr>
            </thead>
            <tbody className="divide-lk-border divide-y">
              {margens.map((m) => {
                const margem = m.custo === null ? null : m.preco - m.custo;
                return (
                  <tr key={m.nome}>
                    <td className={`${TD} font-semibold`}>{m.nome}</td>
                    <td className={`${TD} text-right tabular-nums`}>{brl(m.preco)}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {m.custo === null ? "—" : brl(m.custo)}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {margem === null ? (
                        "—"
                      ) : (
                        <>
                          <span
                            className={`font-semibold ${margem < 0 ? "text-lk-fail" : "text-lk-pass"}`}
                          >
                            {brl(margem)}
                          </span>
                          <span className="text-lk-muted text-xs">
                            {" "}
                            · {pct((margem / m.preco) * 100)}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {meses.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="Por mês" count={meses.length} />
          <div className={`${TABLE_WRAP} overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className={TH}>Mês</th>
                  <th className={`${TH} text-right`}>Receita</th>
                  <th className={`${TH} text-right`}>Custo vendido</th>
                  <th className={`${TH} text-right`}>Margem bruta</th>
                  <th className={`${TH} text-right`}>Compras</th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {meses.map((m) => {
                  const x = resumo(
                    pagas.filter((v) => v.data.startsWith(m)),
                    compras.filter((c) => c.data.startsWith(m)),
                  );
                  return (
                    <tr key={m}>
                      <td className={`${TD} font-medium`}>{mesBR(m)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{brl(x.receita)}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {custoLata === null ? "—" : brl(x.cpv)}
                      </td>
                      <td
                        className={`${TD} text-right font-medium tabular-nums ${x.margem < 0 ? "text-lk-fail" : ""}`}
                      >
                        {custoLata === null ? "—" : brl(x.margem)}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{brl(x.compras)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="text-lk-ink3 text-xs">
        Receita = vendas pagas (site e manuais com nota), sem o frete cobrado. Custo do vendido =
        latas vendidas × custo por lata ({custoLataBase}) + a caixa de cada six pack. Margem bruta é
        antes de impostos, frete de envio, taxa do Pix e despesas fixas. Compras = pedidos de compra
        de insumos pela data do pedido (é saída de caixa, não custo do mês).
      </p>
    </>
  );
}
