"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ChevronRight,
  ClipboardCheck,
  PackageCheck,
  Undo2,
  CalendarClock,
  Coins,
  Factory,
  Pencil,
  Plus,
  ShoppingCart,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  CATEGORIAS,
  LATA_ML,
  UNIDADES,
  compraInteira,
  fatorReceita,
  mlDaParte,
  comprasDo,
  tipoUnidade,
  contagem,
  criarInsumoComEstoque,
  criarLote,
  chaveFornecedor,
  faixaDe,
  proximoPC,
  entrarLegado,
  estornarRecebimento,
  excluirPedido,
  posicao,
  receberPedido,
  restante,
  salvarPedido,
  situacaoPedido,
  totalPedido,
  unitPedido,
  custoMedio,
  disponiveis,
  pontualidade,
  proximoCodigo,
  reservas,
  cotar,
  diasEntre,
  hojeBR,
  pedirAte,
  planejar,
  principalDe,
  resumo,
  somarDias,
  type PedidoCompra,
  type Fornecedor,
  type Insumo,
  type LinhaCompra,
  type Movimento,
  type Plano,
  type ProducaoData,
} from "@/lib/producao";
import { salvarProducao } from "./actions";
import { Lotes, LotesKpis } from "./Lotes";
import {
  Drawer,
  HINT,
  INPUT,
  LABEL,
  MINI,
  NumField,
  Secao,
  abrirSecao,
  brl,
  dia,
  fromCents,
  novoId,
  num,
  pct,
  toCents,
} from "./producao-ui";
import { Badge, Code, Empty, KpiStrip, TABLE_WRAP, TD, TH, Tile, btn } from "./ui";

/**
 * Produção: plano do lote (litros → latas boas, six packs, perda, data),
 * o que comprar de cada insumo, margem por produto, a receita e os insumos
 * com as cotações de cada fornecedor. Tudo editável aqui e salvo no banco do
 * site (src/lib/producao.ts) — um cadastro só pra equipe toda, sem Bling.
 */

const USO_LABEL: Record<Insumo["uso"], string> = {
  receita: "Ingrediente da receita",
  fernet: "Da receita: fernet",
  cola: "Da receita: base de cola",
  lata: "Quantidade por lata",
  pack: "Quantidade por six pack",
};

const NOVO_INSUMO = (): Insumo => ({
  id: novoId("i"),
  insumo: "",
  categoria: "Embalagem",
  unidade: "unidade",
  uso: "lata",
  qtd: 1,
  parte: "final",
  especificacao: "",
  estoque: 0,
  valorEstoqueCents: 0,
  estoqueMinimo: 0,
  perdaPct: 0,
  depois: false,
  fornecedores: [],
  principal: null,
});
const NOVO_FORNECEDOR = (): Fornecedor => ({
  id: novoId("f"),
  nome: "",
  contato: "",
  faixas: [{ de: 0, precoCents: 0 }],
  minimo: 0,
  multiplo: 0,
  prazoDias: 0,
  freteCents: 0,
  cotadoEm: hojeBR(),
  obs: "",
});

type Editing =
  | { kind: "insumo"; item: Insumo; isNew: boolean }
  | { kind: "fornecedor"; insumo: Insumo; item: Fornecedor; isNew: boolean }
  | { kind: "pedido"; pc: PedidoCompra; isNew: boolean }
  | { kind: "receber"; pcId: string }
  | { kind: "contagem"; insumo: Insumo };

/** Custo de uma unidade com até 3 casas (R$ 1,026). */
const unit = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });

export function Producao({
  initial,
  modo,
}: {
  initial: ProducaoData;
  /** Qual aba: "producao" (lotes, planejar, receita) ou "compras" (estoque de insumos, pedidos, cadastro). */
  modo: "producao" | "compras";
}) {
  const [data, setData] = useState<ProducaoData>(initial);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const persist = (next: ProducaoData) => {
    setData(next);
    window.clearTimeout(timer.current);
    start(async () => {
      const r = await salvarProducao(next);
      setStatus(r.ok ? { ok: true, text: "Salvo" } : { ok: false, text: r.error ?? "Não salvou" });
    });
  };
  /** Campos digitados (receita, plano): salva 0,7 s depois da última tecla. */
  const persistSoon = (next: ProducaoData) => {
    setData(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persist(next), 700);
  };

  const { insumos, receita, plano } = data;
  // O lote novo só conta com o estoque que os lotes abertos não reservaram.
  const disp = useMemo(() => disponiveis(data), [data]);
  const reservado = useMemo(() => reservas(data.lotes), [data.lotes]);
  const pont = useMemo(() => pontualidade(data), [data]);
  const linhas = useMemo(() => planejar(data, disp), [data, disp]);
  const r = useMemo(() => resumo(data, linhas), [data, linhas]);
  const hoje = hojeBR();
  // Mais cedo que dá pra produzir (envasar) pedindo hoje, e quando fica pronto.
  const producaoEm = somarDias(hoje, r.espera);
  const prontoEm = somarDias(hoje, r.prazo);
  const folga = plano.prontoAte ? diasEntre(producaoEm, plano.prontoAte) : null;
  const temExemplo = insumos.some((i) => i.exemplo || i.fornecedores.some((f) => f.exemplo));
  const aComprar = linhas.filter((l) => l.falta > 0);

  const setPlano = (patch: Partial<Plano>) =>
    persistSoon({ ...data, plano: { ...plano, ...patch } });
  const setRefriPct = (v: number) => persistSoon({ ...data, receita: { ...receita, refriPct: v } });
  const setQtd = (id: string, qtd: number) =>
    persistSoon({ ...data, insumos: insumos.map((i) => (i.id === id ? { ...i, qtd } : i)) });
  const novoIngrediente = (parte: "refri" | "final"): Insumo => ({
    ...NOVO_INSUMO(),
    categoria: "Ingrediente",
    unidade: "kg",
    uso: "receita",
    qtd: 0,
    parte,
  });

  // Estoque e valor só mudam por movimento: o cadastro nunca sobrescreve.
  const putInsumo = (item: Insumo) => {
    const atual = insumos.find((i) => i.id === item.id);
    persist({
      ...data,
      insumos: atual
        ? insumos.map((i) =>
            i.id === item.id
              ? { ...item, estoque: atual.estoque, valorEstoqueCents: atual.valorEstoqueCents }
              : i,
          )
        : [...insumos, item],
    });
  };
  const saveInsumo = (item: Insumo, custoInicialCents = 0) => {
    const clean = { ...item, exemplo: undefined };
    if (insumos.some((i) => i.id === item.id)) putInsumo(clean);
    else persist(criarInsumoComEstoque(data, clean, custoInicialCents));
    setEditing(null);
  };
  const removeInsumo = (id: string) => {
    if (!window.confirm("Excluir este insumo e todas as cotações dele?")) return;
    persist({ ...data, insumos: insumos.filter((i) => i.id !== id) });
    setEditing(null);
  };
  const saveFornecedor = (insumo: Insumo, f: Fornecedor) => {
    const exists = insumo.fornecedores.some((x) => x.id === f.id);
    const clean = { ...f, exemplo: undefined };
    const fornecedores = exists
      ? insumo.fornecedores.map((x) => (x.id === f.id ? clean : x))
      : [...insumo.fornecedores, clean];
    putInsumo({ ...insumo, fornecedores, principal: insumo.principal ?? f.id });
    setEditing(null);
  };
  const removeFornecedor = (insumo: Insumo, id: string) => {
    if (!window.confirm("Excluir esta cotação?")) return;
    const fornecedores = insumo.fornecedores.filter((x) => x.id !== id);
    putInsumo({
      ...insumo,
      fornecedores,
      principal: insumo.principal === id ? (fornecedores[0]?.id ?? null) : insumo.principal,
    });
    setEditing(null);
  };
  const usarFornecedor = (insumo: Insumo, id: string) => putInsumo({ ...insumo, principal: id });
  // ── Pedidos de compra (PC-0001…) ──
  /** Pedido novo, já com os itens (ex.: a sugestão de compra de um fornecedor). */
  const novoPedido = (fornecedor: string, itens: PedidoCompra["itens"], prazoDias = 0) =>
    setEditing({
      kind: "pedido",
      isNew: true,
      pc: {
        id: novoId("pc"),
        numero: "",
        fornecedor,
        data: hoje,
        previstoEm: somarDias(hoje, prazoDias),
        freteCents: 0,
        itens: itens.length
          ? itens
          : [
              {
                insumoId: insumos[0]?.id ?? "",
                insumo: "",
                unidade: "",
                qtd: 1,
                valorCents: 0,
                recebido: 0,
              },
            ],
        recebimentos: [],
        encerrado: false,
        legado: false,
        jaContado: false,
        obs: "",
      },
    });
  /** Pedido de um insumo só, com o fornecedor principal e a sugestão (ou 1). */
  const pedirInsumo = (i: Insumo, qtd?: number) => {
    const p = principalDe(i);
    const q = qtd && qtd > 0 ? qtd : 1;
    const c = p ? cotar(p, q, compraInteira(i.unidade)) : null;
    novoPedido(
      p?.nome ?? "",
      [
        {
          insumoId: i.id,
          insumo: i.insumo,
          unidade: i.unidade,
          qtd: c?.comprar ?? q,
          valorCents: c ? Math.round(c.comprar * c.faixa.precoCents) : 0,
          recebido: 0,
        },
      ],
      p?.prazoDias ?? 0,
    );
  };
  const savePedido = (pc: PedidoCompra) => {
    persist(salvarPedido(data, pc));
    setEditing(null);
    abrirSecao("pedidos");
  };
  const pcReceber =
    editing?.kind === "receber" ? (data.pedidos.find((x) => x.id === editing.pcId) ?? null) : null;
  const receberPc = (dia: string, linhas: { idx: number; qtd: number }[], obs: string) => {
    if (!pcReceber) return;
    persist(receberPedido(data, pcReceber.id, dia, linhas, obs));
    setEditing(null);
  };
  const estornarPc = (doc: string) => {
    if (!pcReceber) return;
    if (!window.confirm(`Estornar a entrada ${doc}? O que ela pôs no estoque sai.`)) return;
    persist(estornarRecebimento(data, pcReceber.id, doc));
  };
  const deletePedido = (pcId: string) => {
    if (!window.confirm("Excluir este pedido de compra?")) return;
    persist(excluirPedido(data, pcId));
    setEditing(null);
  };
  const proximo = proximoCodigo(data.lotes);
  const podeCriar = r.receitaOk && r.boas > 0;
  const criar = () => {
    if (!podeCriar) return;
    const novo = criarLote(data, linhas, novoId("l"));
    persist({ ...data, lotes: [...data.lotes, novo] });
    setStatus({ ok: true, text: `${novo.codigo} criado` });
    abrirSecao("lotes");
    window.setTimeout(
      () => document.getElementById("lotes")?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  };

  return (
    <>
      {temExemplo && (
        <div className="border-lk-hold/25 bg-lk-hold-bg text-lk-hold rounded-xl border px-5 py-3 text-sm">
          Os insumos e cotações marcados <span className="font-semibold">exemplo</span> são de
          mentira: edita com os dados reais ou exclui. Tudo que vocês salvam aqui fica pra equipe
          toda.
        </div>
      )}

      {modo === "producao" && (
        <>
          <LotesKpis data={data} hoje={hoje} />
          <Lotes
            data={data}
            hoje={hoje}
            onChange={(next, soon) => (soon ? persistSoon : persist)(next)}
          />
        </>
      )}

      {modo === "compras" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lk-muted text-sm">
              Comprou um insumo? Lance o pedido aqui; quando chegar, dê entrada pelo
              &quot;Receber&quot; do pedido.
            </p>
            <button type="button" className={btn("primary")} onClick={() => novoPedido("", [])}>
              <ShoppingCart aria-hidden />
              Novo pedido de compra
            </button>
          </div>
          <ComprasKpis data={data} hoje={hoje} />
          {/* ── Estoque de insumos (visão geral, como o MMBE do SAP) ── */}
          <EstoqueGeral data={data} hoje={hoje} onPedir={novoPedido} />
          {/* ── Pedidos de compra (ME2N) ── */}
          <PedidosCompra
            data={data}
            hoje={hoje}
            onNovo={() => novoPedido("", [])}
            onAbrir={(pcId) => setEditing({ kind: "receber", pcId })}
          />
        </>
      )}

      {/* ── Planejar novo lote ── */}
      {modo === "producao" && (
        <Secao
          id="planejar"
          defaultOpen
          title="Planejar novo lote"
          aside={
            <span className={`text-xs ${status?.ok === false ? "text-lk-fail" : "text-lk-ink3"}`}>
              {saving ? "Salvando…" : status?.text}
            </span>
          }
        >
          <KpiStrip cols={4}>
            <Tile
              icon={Factory}
              label="Latas boas"
              value={num(r.boas, 0)}
              note={`${num(r.envasadas, 0)} envasadas · ${num(r.packs, 0)} six packs`}
            />
            <Tile
              icon={Coins}
              label="Custo por lata"
              value={r.lataCents === null ? "—" : brl(r.lataCents)}
              note={
                r.packCents === null ? "Preencher a receita" : `Six pack ${brl(r.packCents)} pronto`
              }
            />
            <Tile
              icon={ShoppingCart}
              label="Comprar agora"
              value={r.receitaOk ? brl(r.desembolso) : "—"}
              note={
                aComprar.length
                  ? `${aComprar.length} ${aComprar.length === 1 ? "insumo" : "insumos"} · com frete`
                  : "Tudo já em estoque"
              }
            />
            <Tile
              icon={CalendarClock}
              label="Dá pra produzir em"
              value={dia(producaoEm)}
              tone={folga !== null && folga < 0 ? "fail" : "hold"}
              note={
                r.gargalo && r.gargalo.prazo > 0
                  ? `${r.espera} dias · gargalo: ${r.gargalo.i.insumo}`
                  : `${r.espera} dias`
              }
            />
          </KpiStrip>
          <div className={`${TABLE_WRAP} flex flex-col gap-5 p-5`}>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
              <label className={LABEL}>
                <span className="font-medium">Litros a produzir</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={plano.litros}
                  onChange={(e) => setPlano({ litros: Math.max(0, Number(e.target.value) || 0) })}
                  className={`${INPUT} w-32 text-right tabular-nums`}
                />
                <span className="flex gap-1">
                  {[500, 1000, 2000, 5000].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPlano({ litros: n })}
                      className={`h-7 rounded-md px-2 text-xs ${plano.litros === n ? "bg-lk-ink text-white" : "bg-lk-soft text-lk-muted hover:text-lk-ink"}`}
                    >
                      {num(n, 0)} L
                    </button>
                  ))}
                </span>
              </label>
              <label className={LABEL}>
                <span className="font-medium">Perda no envase</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={90}
                    step={0.5}
                    value={plano.perdaEnvasePct}
                    onChange={(e) =>
                      setPlano({
                        perdaEnvasePct: Math.min(90, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                    className={`${INPUT} w-20 text-right tabular-nums`}
                  />
                  <span className="text-lk-muted">%</span>
                </span>
                <span className={HINT}>Latas amassadas, mal cheias, amostras</span>
              </label>
              <label className={LABEL}>
                <span className="font-medium">Six packs a montar</span>
                <input
                  type="number"
                  min={0}
                  max={r.maxPacks}
                  placeholder={`todas (${num(r.maxPacks, 0)})`}
                  value={plano.sixPacks ?? ""}
                  onChange={(e) =>
                    setPlano({
                      sixPacks:
                        e.target.value === ""
                          ? null
                          : Math.min(r.maxPacks, Math.max(0, Math.round(Number(e.target.value)))),
                    })
                  }
                  className={`${INPUT} w-36 text-right tabular-nums`}
                />
                <span className={HINT}>
                  {r.avulsas > 0
                    ? `Sobram ${num(r.avulsas, 0)} latas avulsas`
                    : "Todas as latas boas em pack"}
                </span>
              </label>
              <label className={LABEL}>
                <span className="font-medium">Data de produção</span>
                <span className="flex items-center gap-2">
                  <input
                    type="date"
                    min={hoje}
                    value={plano.prontoAte ?? ""}
                    onChange={(e) => setPlano({ prontoAte: e.target.value || null })}
                    className={`${INPUT} w-44 tabular-nums`}
                  />
                  {plano.prontoAte && (
                    <button
                      type="button"
                      className={btn("ghost", "sm")}
                      aria-label="Limpar data"
                      onClick={() => setPlano({ prontoAte: null })}
                    >
                      <X aria-hidden />
                    </button>
                  )}
                </span>
                <span className={HINT}>Dia do envase: mostra até quando pedir cada insumo</span>
              </label>
            </div>

            <p className="text-sm">
              Pedindo hoje, os insumos chegam e dá pra produzir em{" "}
              <span className="font-semibold">{dia(producaoEm)}</span> ({r.espera} dias); com{" "}
              {r.servico} de envase, fica pronto em{" "}
              <span className="font-semibold">{dia(prontoEm)}</span>.{" "}
              {folga !== null &&
                (folga >= 0 ? (
                  <span className="text-lk-pass font-medium">
                    Dá pra produzir em {dia(plano.prontoAte!)}: sobram {folga} dias.
                  </span>
                ) : (
                  <span className="text-lk-fail font-medium">
                    Não dá pra produzir em {dia(plano.prontoAte!)}: faltam {-folga} dias. Veja o
                    gargalo ou um fornecedor mais rápido.
                  </span>
                ))}
            </p>

            {r.semFornecedor.length > 0 && (
              <p className="text-lk-fail flex items-center gap-2 text-sm">
                <TriangleAlert aria-hidden className="size-4" />
                Sem fornecedor: {r.semFornecedor.map((l) => l.i.insumo).join(", ")}. O custo e o
                prazo estão incompletos.
              </p>
            )}

            <div className="border-lk-border -mx-5 overflow-x-auto border-t">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr>
                    <th className={TH}>Insumo</th>
                    <th className={`${TH} text-right`}>Precisa</th>
                    <th className={`${TH} text-right`}>Disponível</th>
                    <th className={`${TH} text-right`}>Comprar</th>
                    <th className={`${TH} text-right`}>Preço (faixa)</th>
                    <th className={`${TH} text-right`}>Desembolso</th>
                    <th className={`${TH} text-right`}>Prazo</th>
                    {plano.prontoAte && <th className={`${TH} text-right`}>Pedir até</th>}
                  </tr>
                </thead>
                <tbody className="divide-lk-border divide-y">
                  {linhas.map((l) => {
                    const { i, escolhida: c } = l;
                    const p = principalDe(i);
                    const melhor = l.cotacoes[0];
                    const economia =
                      c && melhor && melhor.f.id !== c.f.id ? c.totalCents - melhor.totalCents : 0;
                    const ate = plano.prontoAte ? pedirAte(l, plano.prontoAte) : null;
                    const atraso = ate ? diasEntre(hoje, ate) : null;
                    return (
                      <tr key={i.id}>
                        <td className={TD}>
                          <p className="font-semibold">{i.insumo}</p>
                          <p className="text-lk-muted text-xs">
                            {p ? p.nome || "Fornecedor sem nome" : "Sem fornecedor"}
                          </p>
                          {economia > 0 && (
                            <p className="text-lk-pass text-xs">
                              {melhor.f.nome || "Outro"} sai {brl(economia)} mais barato
                            </p>
                          )}
                        </td>
                        {l.precisa === null ? (
                          <td className={`${TD} text-lk-hold text-right`} colSpan={5}>
                            Preencher a receita abaixo
                          </td>
                        ) : (
                          <>
                            <td className={`${TD} text-right tabular-nums`}>
                              {num(l.precisa, l.precisa < 10 ? 2 : 1)} {i.unidade}
                              {i.perdaPct > 0 && (
                                <p className="text-lk-muted text-xs">
                                  com {pct(i.perdaPct)} de perda
                                </p>
                              )}
                            </td>
                            <td className={`${TD} text-right tabular-nums`}>
                              {i.categoria === "Serviço"
                                ? "—"
                                : (disp.get(i.id) ?? 0) > 0
                                  ? num(disp.get(i.id) ?? 0)
                                  : "—"}
                              {(reservado.get(i.id) ?? 0) > 0 && (
                                <p className="text-lk-muted text-xs">
                                  {num(reservado.get(i.id) ?? 0)} reservado
                                </p>
                              )}
                            </td>
                            <td className={`${TD} text-right tabular-nums`}>
                              {l.falta <= 0 ? (
                                <span className="text-lk-pass">nada</span>
                              ) : c ? (
                                <>
                                  {num(c.comprar, c.comprar < 10 ? 2 : 1)}
                                  {c.ajustado && (
                                    <p className="text-lk-hold text-xs">
                                      {c.ajustado === "minimo"
                                        ? "mínimo do fornecedor"
                                        : `múltiplo de ${num(c.f.multiplo)}`}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <span className="text-lk-fail">{num(l.falta)}</span>
                              )}
                            </td>
                            <td className={`${TD} text-right tabular-nums`}>
                              {c ? (
                                <>
                                  {brl(c.faixa.precoCents)}
                                  <p className="text-lk-muted text-xs">
                                    {c.faixa.de > 0
                                      ? `a partir de ${num(c.faixa.de)}`
                                      : "faixa base"}
                                  </p>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className={`${TD} text-right font-medium tabular-nums`}>
                              {c && c.totalCents > 0 ? (
                                <>
                                  {brl(c.totalCents)}
                                  {c.f.freteCents > 0 && (
                                    <p className="text-lk-muted text-xs font-normal">
                                      frete {brl(c.f.freteCents)}
                                    </p>
                                  )}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          </>
                        )}
                        <td className={`${TD} text-right tabular-nums`}>
                          {r.gargalo?.i.id === i.id && l.prazo > 0 ? (
                            <Badge tone="hold">{l.prazo} dias · gargalo</Badge>
                          ) : i.depois ? (
                            `${principalDe(i)?.prazoDias ?? 0} dias · depois`
                          ) : l.falta > 0 ? (
                            `${l.prazo} dias`
                          ) : (
                            <span className="text-lk-muted">—</span>
                          )}
                        </td>
                        {plano.prontoAte && (
                          <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
                            {ate === null ? (
                              <span className="text-lk-muted">—</span>
                            ) : atraso! < 0 ? (
                              <Badge tone="fail">{dia(ate)} · passou</Badge>
                            ) : atraso! <= 3 ? (
                              <Badge tone="hold">{dia(ate)}</Badge>
                            ) : (
                              dia(ate)
                            )}
                            {i.depois && ate !== null && (
                              <p className="text-lk-muted text-xs">dia do envase</p>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-lk-border bg-lk-paper border-t">
                    <td className={`${TD} font-semibold`} colSpan={5}>
                      Total da compra
                    </td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>
                      {r.receitaOk ? brl(r.desembolso) : "—"}
                    </td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>
                      {r.prazo} dias
                    </td>
                    {plano.prontoAte && <td className={TD} />}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className={HINT}>
              Latas envasadas = litros ÷ 0,35; boas = envasadas menos a perda no envase. Precisa =
              consumo do lote + a perda do insumo (caixa de six pack: uma por six pack montado).
              Comprar = o que falta depois do estoque, subindo até o pedido mínimo e o múltiplo do
              fornecedor principal. Desembolso inclui o frete. Prazo = o insumo a comprar que mais
              demora + o envase/serviço. Disponível = estoque menos o que os lotes em andamento já
              reservaram.
            </p>
            <div className="border-lk-border -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
              <p className="text-lk-muted text-sm">
                {podeCriar
                  ? `Gostou do plano? Ele vira o ${proximo}: quantidades, fornecedores e custos ficam guardados, e o estoque usado fica reservado.`
                  : "Preencha a receita e os litros para criar um lote."}
              </p>
              <button
                type="button"
                className={btn("primary")}
                disabled={!podeCriar}
                onClick={criar}
              >
                <ArrowDown aria-hidden />
                Criar lote {proximo}
              </button>
            </div>
          </div>
        </Secao>
      )}

      {/* ── Receita (cadastro da produção) ── */}
      {modo === "producao" && (
        <Receita
          linhas={linhas}
          refriPct={receita.refriPct}
          onRefriPct={setRefriPct}
          onQtd={setQtd}
          onEdit={(i) => setEditing({ kind: "insumo", item: structuredClone(i), isNew: false })}
          onAdd={(parte) =>
            setEditing({ kind: "insumo", item: novoIngrediente(parte), isNew: true })
          }
        />
      )}

      {/* ── Insumos e cotações (cadastro de compras) ── */}
      {modo === "compras" && (
        <Secao
          id="insumos"
          title="Insumos e fornecedores"
          count={insumos.length}
          aside={
            <button
              type="button"
              className={btn("primary", "sm")}
              onClick={() => setEditing({ kind: "insumo", item: NOVO_INSUMO(), isNew: true })}
            >
              <Plus aria-hidden />
              Adicionar insumo
            </button>
          }
        >
          {insumos.length === 0 && <Empty>Nenhum insumo ainda.</Empty>}
          {linhas.map((l) => (
            <InsumoCard
              key={l.i.id}
              linha={l}
              hoje={hoje}
              pont={pont}
              reservado={reservado.get(l.i.id) ?? 0}
              compras={comprasDo(data, l.i.id)}
              pos={posicao(data, l.i, hoje)}
              movimentos={data.movimentos.filter((m) => m.insumoId === l.i.id)}
              lotesQueUsam={data.lotes
                .filter((x) => x.etapa !== "concluido" && x.etapa !== "cancelado")
                .flatMap((x) =>
                  x.itens
                    .filter((it) => it.insumoId === l.i.id && it.precisa > 0)
                    .map((it) => ({ codigo: x.codigo, qtd: it.precisa, data: x.plano.prontoAte })),
                )}
              onNovoPedido={() => pedirInsumo(l.i, posicao(data, l.i, hoje).sugestao)}
              onReceber={(pcId) => setEditing({ kind: "receber", pcId })}
              onContagem={() => setEditing({ kind: "contagem", insumo: l.i })}
              onEdit={() =>
                setEditing({ kind: "insumo", item: structuredClone(l.i), isNew: false })
              }
              onAddFornecedor={() =>
                setEditing({
                  kind: "fornecedor",
                  insumo: l.i,
                  item: NOVO_FORNECEDOR(),
                  isNew: true,
                })
              }
              onEditFornecedor={(f) =>
                setEditing({
                  kind: "fornecedor",
                  insumo: l.i,
                  item: structuredClone(f),
                  isNew: false,
                })
              }
              onUsar={(id) => usarFornecedor(l.i, id)}
            />
          ))}
          <p className={HINT}>
            &quot;Neste lote&quot; = quanto sairia comprar com cada fornecedor o que este lote pede
            (com mínimo, múltiplo, faixa e frete). A estrela marca o principal, que a calculadora
            usa.
          </p>
        </Secao>
      )}

      {editing?.kind === "insumo" && (
        <InsumoEditor
          item={editing.item}
          isNew={editing.isNew}
          onCancel={() => setEditing(null)}
          onSave={saveInsumo}
          onDelete={() => removeInsumo(editing.item.id)}
        />
      )}
      {editing?.kind === "contagem" && (
        <ContagemEditor
          insumo={insumos.find((i) => i.id === editing.insumo.id) ?? editing.insumo}
          hoje={hoje}
          onCancel={() => setEditing(null)}
          onSave={(contado, dia, obs) => {
            persist(contagem(data, editing.insumo.id, contado, dia, obs));
            setEditing(null);
          }}
        />
      )}
      {editing?.kind === "pedido" && (
        <PedidoEditor
          pc={editing.pc}
          isNew={editing.isNew}
          insumos={insumos}
          proximo={proximoPC(data)}
          onCancel={() => setEditing(null)}
          onSave={savePedido}
          onDelete={() => deletePedido(editing.pc.id)}
        />
      )}
      {pcReceber && (
        <ReceberEditor
          pc={pcReceber}
          hoje={hoje}
          onCancel={() => setEditing(null)}
          onReceber={receberPc}
          onEstornar={estornarPc}
          onEntrarLegado={() => {
            if (
              !window.confirm(
                `Dar entrada no estoque do que o ${pcReceber.numero} recebeu? Use só se essas quantidades ainda não estão no estoque.`,
              )
            )
              return;
            persist(entrarLegado(data, pcReceber.id));
          }}
          onEditar={() =>
            setEditing({ kind: "pedido", pc: structuredClone(pcReceber), isNew: false })
          }
        />
      )}
      {editing?.kind === "fornecedor" && (
        <FornecedorEditor
          item={editing.item}
          insumo={editing.insumo}
          isNew={editing.isNew}
          onCancel={() => setEditing(null)}
          onSave={(f) => saveFornecedor(editing.insumo, f)}
          onDelete={() => removeFornecedor(editing.insumo, editing.item.id)}
        />
      )}
    </>
  );
}

/** "g" para o que é comprado por peso, "mL" para volume. */
const medida = (unidade: string) => {
  const t = tipoUnidade(unidade);
  return t === "massa" ? "g" : t === "volume" ? "mL" : unidade;
};
/** Valor pequeno (centavos) com até 4 casas: R$ 0,0042. */
const miudo = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: cents < 10 ? 4 : 2,
  });

/**
 * A receita como na planilha: o refri de cola (por 100 mL de refri) e o
 * Fernet Cola (por 100 mL do produto, com o refri em % da bebida). Custo
 * de cada ingrediente pela cotação principal (preço por kg ou L, com frete).
 */
function Receita({
  linhas,
  refriPct,
  onRefriPct,
  onQtd,
  onEdit,
  onAdd,
}: {
  linhas: ReturnType<typeof planejar>;
  refriPct: number;
  onRefriPct: (v: number) => void;
  onQtd: (id: string, qtd: number) => void;
  onEdit: (i: Insumo) => void;
  onAdd: (parte: "refri" | "final") => void;
}) {
  const ing = linhas.filter((l) => l.i.uso === "receita");
  const refri = ing.filter((l) => l.i.parte === "refri");
  const final = ing.filter((l) => l.i.parte === "final");
  // Custo em 100 mL da parte: quantidade (ml/g) → unidade de compra × preço.
  const custo100 = (l: (typeof ing)[number]) =>
    l.escolhida ? l.i.qtd * fatorReceita(l.i.unidade) * l.escolhida.unitCents : null;
  const soma = (ls: typeof ing) => ls.reduce((n, l) => n + (custo100(l) ?? 0), 0);
  const ml = (ls: typeof ing) =>
    ls.filter((l) => medida(l.i.unidade) === "mL").reduce((n, l) => n + l.i.qtd, 0);
  const refri100 = soma(refri);
  const refriNoFinal = (refri100 * refriPct) / 100;
  const final100 = refriNoFinal + soma(final);
  const fechaFinal = 100 - refriPct - ml(final);
  const QTD = `${MINI} w-24 text-right`;

  const linha = (l: (typeof ing)[number], porLataMl: number) => {
    const c = custo100(l);
    const p = principalDe(l.i);
    return (
      <tr key={l.i.id} className="hover:bg-lk-paper/60">
        <td className={TD}>
          <button
            type="button"
            className="text-left font-semibold hover:underline"
            onClick={() => onEdit(l.i)}
          >
            {l.i.insumo}
          </button>
          {l.i.especificacao && <p className="text-lk-muted text-xs">{l.i.especificacao}</p>}
        </td>
        <td className={`${TD} text-right`}>
          <input
            type="number"
            min={0}
            step="any"
            aria-label={`${l.i.insumo}: quantidade por 100 mL`}
            className={QTD}
            value={l.i.qtd}
            onChange={(e) => onQtd(l.i.id, Math.max(0, Number(e.target.value) || 0))}
          />
        </td>
        <td className={`${TD} text-lk-muted`}>{medida(l.i.unidade)}</td>
        <td className={`${TD} text-right tabular-nums`}>
          {l.escolhida ? `${miudo(l.escolhida.unitCents)}/${l.i.unidade}` : "—"}
        </td>
        <td className={`${TD} text-right tabular-nums`}>{c === null ? "—" : miudo(c)}</td>
        <td className={`${TD} text-right tabular-nums`}>
          {c === null ? "—" : miudo((c * porLataMl) / 100)}
        </td>
        <td className={TD}>{p?.nome || <span className="text-lk-fail">Sem fornecedor</span>}</td>
      </tr>
    );
  };
  const cabeca = (titulo: string, sub: string, parte: "refri" | "final") => (
    <tr className="bg-lk-hold-bg/60">
      <td className={`${TD} font-semibold`} colSpan={6}>
        {titulo} <span className="text-lk-muted text-xs font-normal">· {sub}</span>
      </td>
      <td className={`${TD} text-right`}>
        <button type="button" className={btn("ghost", "sm")} onClick={() => onAdd(parte)}>
          <Plus aria-hidden />
          Ingrediente
        </button>
      </td>
    </tr>
  );

  return (
    <Secao
      id="receita"
      title="Receita"
      aside={<span className={HINT}>por 100 mL, como na planilha</span>}
    >
      <div className={`${TABLE_WRAP} overflow-x-auto`}>
        <table className="w-full min-w-[980px] table-fixed text-sm">
          <thead>
            <tr>
              <th className={`${TH} w-[24%]`}>Ingrediente</th>
              <th className={`${TH} w-[13%] text-right`}>Quantidade/100 mL</th>
              <th className={`${TH} w-[7%]`}>Unidade</th>
              <th className={`${TH} w-[15%] text-right`}>Custo do ingrediente</th>
              <th className={`${TH} w-[13%] text-right`}>Custo em 100 mL</th>
              <th className={`${TH} w-[12%] text-right`}>Por lata</th>
              <th className={`${TH} w-[16%]`}>Fornecedor</th>
            </tr>
          </thead>
          <tbody className="divide-lk-border divide-y">
            {cabeca("Refri de cola", "por 100 mL de refri", "refri")}
            <tr>
              <td className={TD}>
                <p className="font-semibold">Água</p>
                <p className="text-lk-muted text-xs">Água potável fervida</p>
              </td>
              <td className={`${TD} text-lk-muted text-right`}>QSP</td>
              <td className={`${TD} text-lk-muted`} colSpan={5}>
                Completa os 100 mL
                {ml(refri) > 0 ? ` (os outros líquidos somam ${num(ml(refri), 2)} mL)` : ""}
              </td>
            </tr>
            {refri.map((l) => linha(l, mlDaParte("refri", refriPct)))}
            <tr className="bg-lk-paper">
              <td className={`${TD} font-medium`} colSpan={4}>
                Custo do refri
              </td>
              <td className={`${TD} text-right font-medium tabular-nums`}>{miudo(refri100)}</td>
              <td className={`${TD} text-lk-muted text-right text-xs`}>{miudo(refri100 * 10)}/L</td>
              <td className={TD} />
            </tr>

            {cabeca("Fernet Cola", "por 100 mL do produto final", "final")}
            <tr>
              <td className={`${TD} font-semibold`}>Refri de cola</td>
              <td className={`${TD} text-right`}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  aria-label="Refri de cola: mL por 100 mL"
                  className={QTD}
                  value={refriPct}
                  onChange={(e) =>
                    onRefriPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                  }
                />
              </td>
              <td className={`${TD} text-lk-muted`}>mL</td>
              <td className={`${TD} text-right tabular-nums`}>{miudo(refri100 * 10)}/L</td>
              <td className={`${TD} text-right tabular-nums`}>{miudo(refriNoFinal)}</td>
              <td className={`${TD} text-right tabular-nums`}>{miudo(refriNoFinal * 3.5)}</td>
              <td className={`${TD} text-lk-muted`}>feito aqui</td>
            </tr>
            {final.map((l) => linha(l, mlDaParte("final", refriPct)))}
          </tbody>
          <tfoot>
            <tr className="border-lk-border bg-lk-paper border-t">
              <td className={`${TD} font-semibold`}>Total</td>
              <td className={`${TD} text-right font-semibold tabular-nums`}>
                {num(refriPct + ml(final), 2)}
              </td>
              <td className={`${TD} text-lk-muted`}>mL</td>
              <td className={TD} />
              <td className={`${TD} text-right font-semibold tabular-nums`}>{miudo(final100)}</td>
              <td className={`${TD} text-right font-semibold tabular-nums`}>
                {miudo(final100 * 3.5)}
              </td>
              <td
                className={`${TD} text-xs ${Math.abs(fechaFinal) < 0.01 ? "text-lk-pass" : "text-lk-fail"}`}
              >
                {Math.abs(fechaFinal) < 0.01
                  ? "Fecha 100 mL"
                  : fechaFinal > 0
                    ? `Faltam ${num(fechaFinal, 2)} mL`
                    : `Passou ${num(-fechaFinal, 2)} mL`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={HINT}>
        Quantidade em mL (comprado por litro/ml) ou g (comprado por kg/g). Custo do ingrediente = a
        cotação principal na quantidade do lote, com frete. Por lata = {LATA_ML} mL ({num(refriPct)}
        % de refri). Sem as perdas: a calculadora acima soma a perda de cada insumo. Clique no nome
        para editar o ingrediente.
      </p>
    </Secao>
  );
}

/** Um insumo e a tabela de cotações dos fornecedores dele. */
function InsumoCard({
  linha,
  hoje,
  pont,
  reservado,
  compras,
  pos,
  movimentos,
  lotesQueUsam,
  onNovoPedido,
  onReceber,
  onContagem,
  onEdit,
  onAddFornecedor,
  onEditFornecedor,
  onUsar,
}: {
  linha: ReturnType<typeof planejar>[number];
  hoje: string;
  /** Entregas dos pedidos de compra, por fornecedor. */
  pont: ReturnType<typeof pontualidade>;
  reservado: number;
  compras: LinhaCompra[];
  pos: ReturnType<typeof posicao>;
  movimentos: Movimento[];
  /** Lotes abertos que vão consumir este insumo. */
  lotesQueUsam: { codigo: string; qtd: number; data: string | null }[];
  onNovoPedido: () => void;
  onReceber: (pcId: string) => void;
  onContagem: () => void;
  onEdit: () => void;
  onAddFornecedor: () => void;
  onEditFornecedor: (f: Fornecedor) => void;
  onUsar: (id: string) => void;
}) {
  const { i } = linha;
  const principal = principalDe(i);
  // Compara pelo que falta comprar; se não falta nada, por um lote inteiro.
  const qtd = linha.falta > 0 ? linha.falta : (linha.precisa ?? 0);
  const inteiro = compraInteira(i.unidade);
  const cotacoes = i.fornecedores.map((f) => cotar(f, qtd, inteiro));
  const menor = cotacoes.length > 1 ? Math.min(...cotacoes.map((c) => c.totalCents)) : null;
  // Fechado: só o resumo; clicando no nome abrem as cotações e as compras.
  const [aberto, setAberto] = useState(false);

  return (
    <div className={TABLE_WRAP}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setAberto((o) => !o)}
            aria-expanded={aberto}
            className="hover:text-lk-action-strong -ml-1 flex flex-wrap items-center gap-1.5 rounded-md px-1 text-left font-semibold transition-colors"
          >
            <ChevronRight
              aria-hidden
              className={`text-lk-muted size-4 shrink-0 transition-transform duration-150 ${aberto ? "rotate-90" : ""}`}
            />
            {i.insumo}
            {i.exemplo && <span className="text-lk-hold text-xs font-normal">exemplo</span>}
            {!aberto && (
              <span className="text-lk-muted text-xs font-normal">
                {principal
                  ? `· ${principal.nome || "sem nome"}${i.fornecedores.length > 1 ? ` + ${i.fornecedores.length - 1}` : ""}`
                  : "· sem fornecedor"}
                {compras.length > 0
                  ? ` · ${compras.length} ${compras.length === 1 ? "compra" : "compras"}`
                  : ""}
              </span>
            )}
          </button>
          <p className="text-lk-muted text-xs">
            {i.categoria} ·{" "}
            {i.uso === "receita"
              ? `Receita: ${num(i.qtd, 3)} ${medida(i.unidade)} por 100 mL de ${i.parte === "refri" ? "refri" : "produto"}`
              : `${USO_LABEL[i.uso]}${i.uso === "lata" || i.uso === "pack" ? `: ${num(i.qtd)} ${i.unidade}` : ""}`}
            {i.especificacao ? ` (${i.especificacao})` : ""} · compra em {i.unidade}
          </p>
          <p className="text-lk-ink3 mt-1 text-xs">
            Em estoque: <span className="text-lk-ink font-medium">{num(i.estoque)}</span>
            {i.categoria !== "Serviço" && i.valorEstoqueCents > 0
              ? ` · ${brl(i.valorEstoqueCents)}`
              : ""}
            {reservado > 0 ? ` (${num(reservado)} reservado p/ lotes em andamento)` : ""}
            {pos.emPedido > 0 ? ` · ${num(pos.emPedido)} em pedido` : ""}
            {i.perdaPct > 0 ? ` · perda ${pct(i.perdaPct)}` : ""}
            {i.depois ? " · serviço: começa depois dos outros" : ""}
            {i.fornecedores.length === 1 && " · um fornecedor só"}
          </p>
        </div>
        <span className="flex gap-2">
          <button type="button" className={btn("ghost", "sm")} onClick={onEdit}>
            <Pencil aria-hidden />
            Editar insumo
          </button>
          <button
            type="button"
            className={btn("secondary", "sm")}
            onClick={() => {
              setAberto(true);
              onAddFornecedor();
            }}
          >
            <Plus aria-hidden />
            Cotação
          </button>
        </span>
      </div>
      {aberto && i.categoria !== "Serviço" && (
        <FichaEstoque
          i={i}
          pos={pos}
          hoje={hoje}
          lotesQueUsam={lotesQueUsam}
          onNovoPedido={onNovoPedido}
          onReceber={onReceber}
          onContagem={onContagem}
        />
      )}
      {aberto &&
        (i.fornecedores.length === 0 ? (
          <p className="border-lk-border text-lk-fail border-t px-5 py-3 text-sm">
            Nenhum fornecedor cadastrado. Adiciona uma cotação.
          </p>
        ) : (
          <div className="border-lk-border overflow-x-auto border-t">
            <p className="px-5 py-3 text-sm">
              <span className="font-semibold">Cotações</span>
              <span className="text-lk-muted"> · {i.fornecedores.length}</span>
            </p>
            <table className="w-full min-w-[980px] table-fixed text-sm">
              <thead>
                <tr>
                  <th className={`${TH} w-[21%]`}>Fornecedor</th>
                  <th className={`${TH} w-[22%]`}>Preço por quantidade</th>
                  <th className={`${TH} w-[12%] text-right`}>Mínimo</th>
                  <th className={`${TH} w-[8%] text-right`}>Prazo</th>
                  <th className={`${TH} w-[8%] text-right`}>Frete</th>
                  <th className={`${TH} w-[13%] text-right`}>Neste lote</th>
                  <th className={`${TH} w-[16%]`}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {cotacoes.map((c) => {
                  const f = c.f;
                  const eh = principal?.id === f.id;
                  const idade = f.cotadoEm ? diasEntre(f.cotadoEm, hoje) : null;
                  return (
                    <tr key={f.id} className={eh ? "bg-lk-paper/60" : "hover:bg-lk-paper/60"}>
                      <td className={TD}>
                        <p className="flex flex-wrap items-center gap-x-1.5 font-semibold">
                          {eh && (
                            <Star
                              aria-label="Principal"
                              className="text-lk-action-strong size-3.5 fill-current"
                            />
                          )}
                          {f.nome || "—"}
                          {f.exemplo && (
                            <span className="text-lk-hold text-xs font-normal">exemplo</span>
                          )}
                        </p>
                        {f.contato && (
                          <p className="mt-0.5">
                            <Code>{f.contato}</Code>
                          </p>
                        )}
                        <p
                          className={`text-xs ${idade !== null && idade > 90 ? "text-lk-hold" : "text-lk-ink3"}`}
                        >
                          {idade === null
                            ? "Sem data de cotação"
                            : idade <= 0
                              ? "Cotado hoje"
                              : `Cotado há ${idade} ${idade === 1 ? "dia" : "dias"}${idade > 90 ? " · conferir preço" : ""}`}
                        </p>
                        {(() => {
                          const p = pont.get(chaveFornecedor(f.nome));
                          if (!p) return null;
                          const media =
                            p.entregas > p.noPrazo ? p.atrasoTotal / (p.entregas - p.noPrazo) : 0;
                          return (
                            <p
                              className={`text-xs ${p.noPrazo < p.entregas ? "text-lk-hold" : "text-lk-pass"}`}
                            >
                              {p.noPrazo} de {p.entregas}{" "}
                              {p.entregas === 1 ? "entrega" : "entregas"} no prazo
                              {media > 0 ? ` · atrasa ${num(media)} d quando atrasa` : ""}
                            </p>
                          );
                        })()}
                        {f.obs && <p className="text-lk-muted mt-0.5 text-xs">{f.obs}</p>}
                      </td>
                      <td className={TD}>
                        <ul className="flex flex-col gap-0.5 tabular-nums">
                          {[...f.faixas]
                            .sort((a, b) => a.de - b.de)
                            .map((x, k, all) => {
                              const next = all[k + 1];
                              return (
                                <li key={`${x.de}-${k}`} className="text-xs">
                                  <span className="text-lk-muted">
                                    {next
                                      ? `${num(x.de)} a ${num(next.de - 1)}`
                                      : x.de > 0
                                        ? `${num(x.de)} ou mais`
                                        : "qualquer quantidade"}
                                    :
                                  </span>{" "}
                                  <span className="font-medium">{brl(x.precoCents)}</span>
                                  <span className="text-lk-muted"> / {i.unidade}</span>
                                </li>
                              );
                            })}
                        </ul>
                      </td>
                      <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
                        {num(f.minimo)}
                        <p className="text-lk-muted text-xs">
                          {f.multiplo > 0
                            ? `de ${num(f.multiplo)} em ${num(f.multiplo)}`
                            : "qualquer qtd."}
                        </p>
                      </td>
                      <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
                        {f.prazoDias} dias
                      </td>
                      <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
                        {f.freteCents > 0 ? brl(f.freteCents) : "—"}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {qtd > 0 ? (
                          <>
                            <p className="font-medium">{brl(c.totalCents)}</p>
                            <p className="text-lk-muted text-xs">
                              {num(c.comprar)} {i.unidade} · {brl(Math.round(c.unitCents))}/un.
                            </p>
                            {menor !== null && c.totalCents === menor && (
                              <Badge tone="pass">mais barato</Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-lk-muted">—</span>
                        )}
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="flex flex-wrap justify-end gap-1">
                          {!eh && (
                            <button
                              type="button"
                              className={btn("ghost", "sm")}
                              onClick={() => onUsar(f.id)}
                            >
                              <Star aria-hidden />
                              Usar este
                            </button>
                          )}
                          <button
                            type="button"
                            className={btn("ghost", "sm")}
                            onClick={() => onEditFornecedor(f)}
                            aria-label={`Editar cotação de ${f.nome || "fornecedor"}`}
                            title="Editar cotação"
                          >
                            <Pencil aria-hidden />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      {aberto && <HistoricoCompras i={i} compras={compras} />}
      {aberto && i.categoria !== "Serviço" && <Movimentacoes i={i} movimentos={movimentos} />}
    </div>
  );
}

/** Topo da aba Compras e insumos. */
function ComprasKpis({ data, hoje }: { data: ProducaoData; hoje: string }) {
  const pos = data.insumos
    .filter((i) => i.categoria !== "Serviço")
    .map((i) => ({ i, p: posicao(data, i, hoje) }));
  const valor = pos.reduce((n, x) => n + x.p.valorCents, 0);
  const abertos = data.pedidos.filter((pc) => {
    const s = situacaoPedido(pc, hoje);
    return s !== "recebido" && s !== "encerrado";
  });
  const aReceber = abertos.reduce(
    (n, pc) => n + pc.itens.reduce((m, it, idx) => m + unitPedido(pc, idx) * restante(it), 0),
    0,
  );
  const atrasados = abertos.filter((pc) => situacaoPedido(pc, hoje) === "atrasado");
  const comprar = pos.filter((x) => x.p.sugestao > 0);
  const valorComprar = comprar.reduce((n, x) => n + (x.p.sugestaoValorCents ?? 0), 0);
  return (
    <KpiStrip cols={4}>
      <Tile
        icon={Coins}
        label="Insumos em estoque"
        value={brl(valor)}
        note={`${pos.filter((x) => x.p.estoque > 0).length} insumos com saldo`}
      />
      <Tile
        icon={ShoppingCart}
        label="A comprar"
        value={comprar.length}
        tone={comprar.length ? "hold" : "action"}
        note={comprar.length ? `cerca de ${brl(valorComprar)}` : "Nada falta pros lotes"}
      />
      <Tile
        icon={PackageCheck}
        label="Pedidos em aberto"
        value={abertos.length}
        note={abertos.length ? `${brl(Math.round(aReceber))} a receber` : "Nada a caminho"}
      />
      <Tile
        icon={TriangleAlert}
        label="Pedidos atrasados"
        value={atrasados.length}
        tone="fail"
        note={atrasados.length ? atrasados.map((pc) => pc.numero).join(", ") : "Tudo no prazo"}
      />
    </KpiStrip>
  );
}

/**
 * Todos os insumos numa tabela (o MMBE/MD04 do SAP): estoque, reservado
 * pros lotes, em pedido, projetado, a sugestão de compra e o valor.
 */
function EstoqueGeral({
  data,
  hoje,
  onPedir,
}: {
  data: ProducaoData;
  hoje: string;
  onPedir: (fornecedor: string, itens: PedidoCompra["itens"], prazoDias?: number) => void;
}) {
  const linhas = data.insumos
    .filter((i) => i.categoria !== "Serviço")
    .map((i) => ({ i, p: posicao(data, i, hoje) }));
  const total = linhas.reduce((n, l) => n + l.p.valorCents, 0);
  const alerta = linhas.filter((l) =>
    ["abaixo", "atrasado", "falta"].includes(l.p.situacao),
  ).length;
  // Pedir: junta no mesmo pedido tudo que tem sugestão com o mesmo fornecedor principal.
  const pedir = (forn: string) => {
    const doForn = linhas.filter(
      (l) =>
        l.p.sugestao > 0 && chaveFornecedor(l.p.fornecedorSugerido ?? "") === chaveFornecedor(forn),
    );
    const prazo = Math.max(0, ...doForn.map((l) => principalDe(l.i)?.prazoDias ?? 0));
    onPedir(
      forn,
      doForn.map((l) => {
        const p = principalDe(l.i);
        const preco = p ? faixaDe(p.faixas, l.p.sugestao).precoCents : 0;
        return {
          insumoId: l.i.id,
          insumo: l.i.insumo,
          unidade: l.i.unidade,
          qtd: l.p.sugestao,
          valorCents: Math.round(l.p.sugestao * preco),
          recebido: 0,
        };
      }),
      prazo,
    );
  };
  return (
    <Secao
      id="estoque"
      defaultOpen
      title="Estoque de insumos"
      count={linhas.length}
      aside={
        <span className="text-lk-muted text-sm">
          Valor em estoque: <span className="text-lk-ink font-semibold">{brl(total)}</span>
          {alerta > 0 && (
            <span className="text-lk-hold">
              {" "}
              · {alerta} {alerta === 1 ? "precisa" : "precisam"} de atenção
            </span>
          )}
        </span>
      }
    >
      <div className={`${TABLE_WRAP} overflow-x-auto`}>
        <table className="w-full min-w-[960px] table-fixed text-sm">
          <thead>
            <tr>
              <th className={`${TH} w-[15%]`}>Insumo</th>
              <th className={`${TH} w-[9%] text-right`}>Em estoque</th>
              <th className={`${TH} w-[9%] text-right`}>Reservado</th>
              <th className={`${TH} w-[10%] text-right`}>Em pedido</th>
              <th className={`${TH} w-[9%] text-right`}>Projetado</th>
              <th className={`${TH} w-[15%]`}>Comprar</th>
              <th className={`${TH} w-[9%] text-right`}>Custo médio</th>
              <th className={`${TH} w-[10%] text-right`}>Valor</th>
              <th className={`${TH} w-[14%]`}>Situação</th>
            </tr>
          </thead>
          <tbody className="divide-lk-border divide-y">
            {linhas.map(({ i, p }) => {
              const sit = SITUACAO[p.situacao];
              return (
                <tr key={i.id} className="hover:bg-lk-paper/60">
                  <td className={TD}>
                    <p className="font-semibold">{i.insumo}</p>
                    <p className="text-lk-muted text-xs">
                      {i.categoria} · {i.unidade}
                      {p.minimo > 0 ? ` · mín. ${num(p.minimo)}` : ""}
                    </p>
                  </td>
                  <td className={`${TD} text-right font-medium tabular-nums`}>{num(p.estoque)}</td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {p.reservado > 0 ? num(p.reservado) : <span className="text-lk-muted">—</span>}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {p.emPedido > 0 ? (
                      <>
                        <p>{num(p.emPedido)}</p>
                        {p.proxima && (
                          <p className={`text-xs ${p.atrasado ? "text-lk-fail" : "text-lk-muted"}`}>
                            chega {dia(p.proxima)}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-lk-muted">—</span>
                    )}
                  </td>
                  <td
                    className={`${TD} text-right tabular-nums ${p.projetado < 0 ? "text-lk-fail font-medium" : p.minimo > 0 && p.projetado < p.minimo ? "text-lk-hold font-medium" : ""}`}
                  >
                    {num(p.projetado)}
                  </td>
                  <td className={TD}>
                    {p.sugestao > 0 ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="tabular-nums">
                          {num(p.sugestao)}{" "}
                          <span className="text-lk-muted text-xs">{i.unidade}</span>
                        </span>
                        {p.fornecedorSugerido ? (
                          <button
                            type="button"
                            className="text-lk-action-strong text-xs font-medium hover:underline"
                            onClick={() => pedir(p.fornecedorSugerido!)}
                          >
                            Pedir à {p.fornecedorSugerido}
                          </button>
                        ) : (
                          <span className="text-lk-fail text-xs">sem fornecedor</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-lk-muted">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {p.custoMedio === null ? "—" : unit(p.custoMedio)}
                  </td>
                  <td className={`${TD} text-right font-medium tabular-nums`}>
                    {p.valorCents > 0 ? brl(p.valorCents) : "—"}
                  </td>
                  <td className={TD}>
                    <Badge tone={sit.tone}>{sit.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-lk-border bg-lk-paper border-t">
              <td className={`${TD} font-semibold`} colSpan={7}>
                Total
              </td>
              <td className={`${TD} text-right font-semibold tabular-nums`}>{brl(total)}</td>
              <td className={TD} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={HINT}>
        Reservado = o que os lotes em andamento vão consumir. Projetado = estoque − reservado + em
        pedido. Comprar = o que falta pros lotes e pra voltar ao mínimo, no lote de compra do
        fornecedor principal (mínimo e múltiplo); &quot;Pedir&quot; abre um pedido com todos os
        itens desse fornecedor. Valor pelo custo médio móvel.
      </p>
    </Secao>
  );
}

const SIT_PC: Record<
  ReturnType<typeof situacaoPedido>,
  { label: string; tone: "pass" | "hold" | "fail" | "muted" | "running" }
> = {
  aberto: { label: "Aberto", tone: "running" },
  parcial: { label: "Recebido em parte", tone: "hold" },
  recebido: { label: "Recebido", tone: "pass" },
  encerrado: { label: "Encerrado", tone: "muted" },
  atrasado: { label: "Atrasado", tone: "fail" },
};

/** Lista dos pedidos de compra (o ME2N): os em aberto primeiro. */
function PedidosCompra({
  data,
  hoje,
  onNovo,
  onAbrir,
}: {
  data: ProducaoData;
  hoje: string;
  onNovo: () => void;
  onAbrir: (pcId: string) => void;
}) {
  const [todos, setTodos] = useState(false);
  const lista = [...data.pedidos]
    .map((pc) => ({ pc, s: situacaoPedido(pc, hoje) }))
    .sort(
      (a, b) =>
        Number(a.s === "recebido" || a.s === "encerrado") -
          Number(b.s === "recebido" || b.s === "encerrado") ||
        b.pc.numero.localeCompare(a.pc.numero, undefined, { numeric: true }),
    );
  const abertos = lista.filter((x) => x.s !== "recebido" && x.s !== "encerrado");
  const mostrados = todos ? lista : abertos;
  return (
    <Secao
      id="pedidos"
      defaultOpen
      title="Pedidos de compra"
      count={abertos.length}
      aside={
        <span className="flex items-center gap-3">
          <label className="text-lk-muted flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              className="accent-lk-action"
              checked={todos}
              onChange={(e) => setTodos(e.target.checked)}
            />
            mostrar recebidos ({lista.length - abertos.length})
          </label>
          <button type="button" className={btn("secondary", "sm")} onClick={onNovo}>
            <Plus aria-hidden />
            Novo pedido
          </button>
        </span>
      }
    >
      {mostrados.length === 0 ? (
        <Empty>
          {lista.length ? "Nenhum pedido em aberto." : "Nenhum pedido de compra ainda."}
        </Empty>
      ) : (
        <div className={`${TABLE_WRAP} overflow-x-auto`}>
          <table className="w-full min-w-[1000px] table-fixed text-sm">
            <thead>
              <tr>
                <th className={`${TH} w-[10%]`}>Pedido</th>
                <th className={`${TH} w-[14%]`}>Fornecedor</th>
                <th className={`${TH} w-[28%]`}>Itens (recebido / pedido)</th>
                <th className={`${TH} w-[10%]`}>Pedido em</th>
                <th className={`${TH} w-[10%]`}>Chega</th>
                <th className={`${TH} w-[11%] text-right`}>Valor</th>
                <th className={`${TH} w-[17%]`}>Situação</th>
              </tr>
            </thead>
            <tbody className="divide-lk-border divide-y">
              {mostrados.map(({ pc, s }) => {
                const sit = SIT_PC[s];
                return (
                  <tr
                    key={pc.id}
                    className="hover:bg-lk-paper/60 cursor-pointer"
                    onClick={() => onAbrir(pc.id)}
                  >
                    <td className={TD}>
                      <button
                        type="button"
                        className="font-lk-mono text-lk-action-strong font-medium hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrir(pc.id);
                        }}
                      >
                        {pc.numero}
                      </button>
                    </td>
                    <td className={TD}>{pc.fornecedor || "—"}</td>
                    <td className={TD}>
                      <ul className="flex flex-col gap-0.5 text-xs">
                        {pc.itens.map((it, k) => (
                          <li key={k} className="tabular-nums">
                            <span className="text-lk-ink font-medium">{it.insumo}</span>{" "}
                            <span className="text-lk-muted">
                              {num(it.recebido)} / {num(it.qtd)} {it.unidade}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>
                      {pc.data ? dia(pc.data) : "—"}
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>
                      {pc.previstoEm ? dia(pc.previstoEm) : "—"}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{brl(totalPedido(pc))}</td>
                    <td className={TD}>
                      <Badge tone={sit.tone}>{sit.label}</Badge>
                      {pc.legado && pc.jaContado && (
                        <p className="text-lk-muted text-sm">
                          Pedido de antes do controle de estoque, já contado (no saldo inicial ou no
                          consumo de um lote).
                        </p>
                      )}
                      {pc.legado && !pc.jaContado && (
                        <p className="text-lk-muted mt-1 text-xs">antes do controle de estoque</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={HINT}>
        Cada pedido tem um número (PC-0001…), um fornecedor e um ou mais insumos; o frete é do
        pedido e se divide entre os itens pelo valor. Clique no pedido pra receber (entrada no
        estoque, pode ser em partes), estornar uma entrada ou editar.
      </p>
    </Secao>
  );
}

/** Criar/editar um pedido de compra (o ME21N/ME22N). */
function PedidoEditor({
  pc,
  isNew,
  insumos,
  proximo,
  onCancel,
  onSave,
  onDelete,
}: {
  pc: PedidoCompra;
  isNew: boolean;
  insumos: Insumo[];
  proximo: string;
  onCancel: () => void;
  onSave: (pc: PedidoCompra) => void;
  onDelete: () => void;
}) {
  const [f, setF] = useState(pc);
  const [valores, setValores] = useState(
    pc.itens.map((it) => (it.valorCents ? fromCents(it.valorCents) : "")),
  );
  const [frete, setFrete] = useState(pc.freteCents ? fromCents(pc.freteCents) : "");
  const set = <K extends keyof PedidoCompra>(k: K, v: PedidoCompra[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const setItem = (k: number, patch: Partial<PedidoCompra["itens"][number]>) =>
    setF((p) => ({ ...p, itens: p.itens.map((it, j) => (j === k ? { ...it, ...patch } : it)) }));
  const fornecedores = [
    ...new Set(insumos.flatMap((i) => i.fornecedores.map((x) => x.nome)).filter(Boolean)),
  ];
  // Preço da cotação desse fornecedor pro insumo (sugestão quando o valor está vazio).
  const sugerido = (insumoId: string, qtd: number) => {
    const i = insumos.find((x) => x.id === insumoId);
    const c = i?.fornecedores.find(
      (x) => chaveFornecedor(x.nome) === chaveFornecedor(f.fornecedor),
    );
    return c ? Math.round(qtd * faixaDe(c.faixas, qtd).precoCents) : 0;
  };
  const itensFinal = f.itens.map((it, k) => ({
    ...it,
    valorCents: valores[k] ? toCents(valores[k]) : sugerido(it.insumoId, it.qtd),
  }));
  const total = itensFinal.reduce((n, it) => n + it.valorCents, 0) + toCents(frete);
  const ok =
    f.fornecedor.trim().length > 0 &&
    f.itens.length > 0 &&
    f.itens.every((it) => it.insumoId && it.qtd > 0);
  const recebeu = pc.recebimentos.length > 0;
  return (
    <Drawer
      title={isNew ? `Novo pedido de compra · ${proximo}` : `Editar ${pc.numero}`}
      isNew={isNew || recebeu}
      ok={ok}
      onCancel={onCancel}
      onSave={() => onSave({ ...f, itens: itensFinal, freteCents: toCents(frete) })}
      onDelete={onDelete}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${LABEL} sm:col-span-2`}>
          <span className="font-medium">Fornecedor</span>
          <input
            className={INPUT}
            list="fornecedores-pc"
            value={f.fornecedor}
            onChange={(e) => set("fornecedor", e.target.value)}
            placeholder="Nome do fornecedor"
          />
          <datalist id="fornecedores-pc">
            {fornecedores.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <label className={LABEL}>
          <span className="font-medium">Data do pedido</span>
          <input
            type="date"
            className={INPUT}
            value={f.data ?? ""}
            onChange={(e) => set("data", e.target.value || null)}
          />
        </label>
        <label className={LABEL}>
          <span className="font-medium">Chega em (prometido)</span>
          <input
            type="date"
            className={INPUT}
            value={f.previstoEm ?? ""}
            onChange={(e) => set("previstoEm", e.target.value || null)}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Itens</legend>
        {f.itens.map((it, k) => {
          const insumo = insumos.find((i) => i.id === it.insumoId);
          const sug = sugerido(it.insumoId, it.qtd);
          return (
            <div
              key={k}
              className="border-lk-border flex flex-wrap items-end gap-2 rounded-lg border p-3"
            >
              <label className={`${LABEL} min-w-44 flex-1`}>
                <span className="text-xs">Insumo</span>
                <select
                  className={INPUT}
                  value={it.insumoId}
                  disabled={it.recebido > 0}
                  onChange={(e) => setItem(k, { insumoId: e.target.value })}
                >
                  {insumos
                    .filter((i) => i.categoria !== "Serviço")
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.insumo}
                      </option>
                    ))}
                </select>
              </label>
              <label className={`${LABEL} w-28`}>
                <span className="text-xs">Quantidade</span>
                <input
                  type="number"
                  min={it.recebido}
                  step="any"
                  className={`${INPUT} text-right tabular-nums`}
                  value={it.qtd}
                  onChange={(e) =>
                    setItem(k, { qtd: Math.max(it.recebido, Number(e.target.value) || 0) })
                  }
                />
              </label>
              <span className="text-lk-muted pb-2.5 text-xs">{insumo?.unidade}</span>
              <label className={`${LABEL} w-32`}>
                <span className="text-xs">Valor (sem frete)</span>
                <input
                  inputMode="decimal"
                  className={`${INPUT} text-right tabular-nums`}
                  value={valores[k] ?? ""}
                  placeholder={sug ? fromCents(sug) : "0,00"}
                  onChange={(e) =>
                    setValores((v) => v.map((x, j) => (j === k ? e.target.value : x)))
                  }
                />
              </label>
              {it.recebido === 0 && f.itens.length > 1 && (
                <button
                  type="button"
                  aria-label="Tirar item"
                  className={btn("ghost", "sm")}
                  onClick={() => {
                    setF((p) => ({ ...p, itens: p.itens.filter((_, j) => j !== k) }));
                    setValores((v) => v.filter((_, j) => j !== k));
                  }}
                >
                  <X aria-hidden />
                </button>
              )}
              {it.recebido > 0 && (
                <span className="text-lk-muted w-full text-xs">
                  Já recebido: {num(it.recebido)} {insumo?.unidade}
                </span>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className={`${btn("secondary", "sm")} self-start`}
          onClick={() => {
            const i = insumos.find((x) => x.categoria !== "Serviço");
            setF((p) => ({
              ...p,
              itens: [
                ...p.itens,
                {
                  insumoId: i?.id ?? "",
                  insumo: "",
                  unidade: "",
                  qtd: 1,
                  valorCents: 0,
                  recebido: 0,
                },
              ],
            }));
            setValores((v) => [...v, ""]);
          }}
        >
          <Plus aria-hidden />
          Adicionar item
        </button>
        <p className={HINT}>
          Valor em branco usa o preço da cotação desse fornecedor (o cinza no campo).
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          <span className="font-medium">Frete do pedido</span>
          <span className="flex items-center gap-2">
            <span className="text-lk-muted">R$</span>
            <input
              inputMode="decimal"
              className={`${INPUT} w-full text-right tabular-nums`}
              value={frete}
              onChange={(e) => setFrete(e.target.value)}
              placeholder="0,00"
            />
          </span>
          <span className={HINT}>Dividido entre os itens pelo valor</span>
        </label>
        <div className={LABEL}>
          <span className="font-medium">Total do pedido</span>
          <span className="flex h-10 items-center text-base font-semibold tabular-nums">
            {brl(total)}
          </span>
        </div>
      </div>
      {!isNew && pc.itens.some((it) => restante(it) > 0) && recebeu && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.encerrado}
            onChange={(e) => set("encerrado", e.target.checked)}
            className="accent-lk-action mt-0.5 size-4"
          />
          <span>
            Encerrar: o fornecedor não vai entregar o resto
            <span className={`${HINT} block`}>
              O que falta deixa de contar como &quot;em pedido&quot;.
            </span>
          </span>
        </label>
      )}
      <label className={LABEL}>
        <span className="font-medium">Observações</span>
        <textarea
          className={`${INPUT} h-20 py-2`}
          value={f.obs}
          maxLength={300}
          onChange={(e) => set("obs", e.target.value)}
          placeholder="Condição de pagamento, nota fiscal, contato…"
        />
      </label>
      {recebeu && !isNew && (
        <p className={HINT}>Pedido com entrada não pode ser excluído: estorne as entradas antes.</p>
      )}
    </Drawer>
  );
}

/** Entrada de mercadoria (o MIGO): o que chegou de cada item, e os estornos. */
function ReceberEditor({
  pc,
  hoje,
  onCancel,
  onReceber,
  onEstornar,
  onEntrarLegado,
  onEditar,
}: {
  pc: PedidoCompra;
  hoje: string;
  onCancel: () => void;
  onReceber: (dia: string, linhas: { idx: number; qtd: number }[], obs: string) => void;
  onEstornar: (doc: string) => void;
  onEntrarLegado: () => void;
  onEditar: () => void;
}) {
  const [quando, setQuando] = useState(pc.previstoEm && pc.previstoEm < hoje ? hoje : hoje);
  const [qtds, setQtds] = useState(pc.itens.map((it) => restante(it)));
  const [obs, setObs] = useState("");
  const aberto = pc.itens.some((it) => restante(it) > 0) && !pc.encerrado;
  const linhas = qtds.map((qtd, idx) => ({ idx, qtd })).filter((l) => l.qtd > 0);
  const s = SIT_PC[situacaoPedido(pc, hoje)];
  return (
    <Drawer
      title={`${pc.numero} · ${pc.fornecedor || "fornecedor"}`}
      isNew
      ok={aberto && linhas.length > 0}
      onCancel={onCancel}
      onSave={() => onReceber(quando, linhas, obs)}
      onDelete={() => {}}
    >
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={s.tone}>{s.label}</Badge>
        <span className="text-lk-muted">
          pedido {pc.data ? dia(pc.data) : "—"} · chega {pc.previstoEm ? dia(pc.previstoEm) : "—"} ·{" "}
          {brl(totalPedido(pc))}
          {pc.freteCents > 0 ? ` (frete ${brl(pc.freteCents)})` : ""}
        </span>
        <button type="button" className={`${btn("ghost", "sm")} ml-auto`} onClick={onEditar}>
          <Pencil aria-hidden />
          Editar pedido
        </button>
      </p>
      {pc.legado && (
        <div className="border-lk-hold/25 bg-lk-hold-bg flex flex-col gap-2 rounded-lg border p-3 text-sm">
          <p className="text-lk-hold">
            Pedido de antes do controle de estoque: o recebido dele <b>não</b> foi somado no estoque
            (considerado já contado no saldo inicial). Se não estava contado, dê entrada agora.
          </p>
          <button
            type="button"
            className={`${btn("secondary", "sm")} self-start`}
            onClick={onEntrarLegado}
          >
            <PackageCheck aria-hidden />
            Dar entrada no estoque
          </button>
        </div>
      )}
      {aberto ? (
        <>
          <p className="text-sm font-semibold">Entrada de mercadoria</p>
          <label className={LABEL}>
            <span className="font-medium">Recebido em</span>
            <input
              type="date"
              className={`${INPUT} w-44`}
              value={quando}
              onChange={(e) => setQuando(e.target.value || hoje)}
            />
          </label>
          <div className="flex flex-col gap-2">
            {pc.itens.map((it, k) => (
              <div
                key={k}
                className="border-lk-border flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{it.insumo}</p>
                  <p className="text-lk-muted text-xs tabular-nums">
                    pedido {num(it.qtd)} · recebido {num(it.recebido)} · falta {num(restante(it))}{" "}
                    {it.unidade}
                    {" · "}
                    {unit(unitPedido(pc, k))}/{it.unidade} com frete
                  </p>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-lk-muted text-xs">chegou</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    disabled={restante(it) <= 0}
                    aria-label={`${it.insumo}: quantidade que chegou`}
                    className={`${MINI} w-28 text-right`}
                    value={qtds[k]}
                    onChange={(e) =>
                      setQtds((q) =>
                        q.map((x, j) => (j === k ? Math.max(0, Number(e.target.value) || 0) : x)),
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <label className={LABEL}>
            <span className="font-medium">Observação</span>
            <input
              className={INPUT}
              value={obs}
              maxLength={300}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Nº da nota, avaria, entrega parcial…"
            />
          </label>
          <p className={HINT}>
            Salvar lança a entrada no estoque (um documento de material pra todo o recebimento) e
            recalcula o custo médio. Pode receber em partes.
          </p>
        </>
      ) : (
        <p className="text-lk-muted text-sm">
          {pc.encerrado ? "Pedido encerrado." : "Tudo recebido."} Nada a dar entrada.
        </p>
      )}
      {pc.recebimentos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Entradas</p>
          {pc.recebimentos.map((r) => (
            <div
              key={r.doc || r.data || "legado"}
              className="flex flex-wrap items-center gap-3 text-sm"
            >
              <span className="font-lk-mono text-xs">{r.doc || "—"}</span>
              <span className="text-lk-muted">{r.data ? dia(r.data) : "sem data"}</span>
              <span className="flex-1 text-xs">
                {r.itens
                  .map(
                    (x) =>
                      `${num(x.qtd)} ${pc.itens[x.idx]?.unidade ?? ""} ${pc.itens[x.idx]?.insumo ?? ""}`,
                  )
                  .join(" · ")}
                {r.obs ? ` — ${r.obs}` : ""}
              </span>
              {!pc.legado && r.doc && r.doc !== "MIGRADO" && (
                <button
                  type="button"
                  className={`${btn("ghost", "sm")} text-lk-fail`}
                  onClick={() => onEstornar(r.doc)}
                >
                  <Undo2 aria-hidden />
                  Estornar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

const SITUACAO: Record<
  ReturnType<typeof posicao>["situacao"],
  { label: string; tone: "pass" | "hold" | "fail" | "muted" }
> = {
  ok: { label: "OK", tone: "pass" },
  falta: { label: "Falta pros lotes", tone: "fail" },
  abaixo: { label: "Abaixo do mínimo", tone: "hold" },
  sem: { label: "Sem estoque", tone: "muted" },
  atrasado: { label: "Pedido atrasado", tone: "fail" },
};

/** Um número pequeno da ficha. */
function Num({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-lk-muted text-xs">{label}</span>
      <span className="text-lk-ink text-base font-semibold tabular-nums">{value}</span>
      {note && <span className="text-lk-ink3 truncate text-xs">{note}</span>}
    </div>
  );
}

/** Ficha do material: posição de estoque, valor, pedidos em aberto e o que os lotes vão usar. */
function FichaEstoque({
  i,
  pos,
  hoje,
  lotesQueUsam,
  onNovoPedido,
  onReceber,
  onContagem,
}: {
  i: Insumo;
  pos: ReturnType<typeof posicao>;
  hoje: string;
  lotesQueUsam: { codigo: string; qtd: number; data: string | null }[];
  onNovoPedido: () => void;
  onReceber: (pcId: string) => void;
  onContagem: () => void;
}) {
  const sit = SITUACAO[pos.situacao];
  const un = i.unidade;
  return (
    <div className="border-lk-border border-t">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <p className="flex items-center gap-2 text-sm">
          <span className="font-semibold">Estoque</span>
          <Badge tone={sit.tone}>{sit.label}</Badge>
          {pos.sugestao > 0 && (
            <span className="text-lk-hold text-xs">
              comprar {num(pos.sugestao)} {un}
              {pos.fornecedorSugerido ? ` (${pos.fornecedorSugerido})` : ""}
            </span>
          )}
        </p>
        <span className="flex gap-2">
          <button type="button" className={btn("ghost", "sm")} onClick={onContagem}>
            <ClipboardCheck aria-hidden />
            Contagem
          </button>
          <button type="button" className={btn("secondary", "sm")} onClick={onNovoPedido}>
            <ShoppingCart aria-hidden />
            Novo pedido de compra
          </button>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
        <Num
          label="Em estoque"
          value={`${num(pos.estoque)} ${un}`}
          note={pos.reservado > 0 ? `${num(pos.reservado)} reservado pros lotes` : "nada reservado"}
        />
        <Num
          label="Em pedido"
          value={`${num(pos.emPedido)} ${un}`}
          note={pos.proxima ? `próxima chegada ${dia(pos.proxima)}` : "nada a caminho"}
        />
        <Num
          label="Projetado"
          value={`${num(pos.projetado)} ${un}`}
          note={pos.minimo > 0 ? `mínimo ${num(pos.minimo)}` : "estoque − reservado + pedido"}
        />
        <Num
          label="Custo médio"
          value={pos.custoMedio === null ? "—" : `${unit(pos.custoMedio)}`}
          note={`por ${un}, com frete`}
        />
        <Num label="Valor do estoque" value={brl(pos.valorCents)} note="custo médio × estoque" />
        <Num
          label="Último preço"
          value={pos.ultimoPreco === null ? "—" : unit(pos.ultimoPreco)}
          note={
            pos.ultimoPreco !== null && pos.custoMedio !== null && pos.custoMedio > 0
              ? `${pos.ultimoPreco >= pos.custoMedio ? "+" : ""}${pct(((pos.ultimoPreco - pos.custoMedio) / pos.custoMedio) * 100)} vs médio`
              : "do último pedido"
          }
        />
      </div>
      {lotesQueUsam.length > 0 && (
        <p className="text-lk-muted px-5 pb-3 text-xs">
          Reservado pros lotes:{" "}
          {lotesQueUsam
            .map((l) => `${l.codigo} ${num(l.qtd)} ${un}${l.data ? ` (${dia(l.data)})` : ""}`)
            .join(" · ")}
        </p>
      )}
      <div className="border-lk-border border-t">
        <p className="px-5 py-3 text-sm">
          <span className="font-semibold">Pedidos em aberto</span>
          <span className="text-lk-muted"> · {pos.abertos.length}</span>
          {pos.abertos.length === 0 && <span className="text-lk-muted"> · nada a receber</span>}
        </p>
        {pos.abertos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] table-fixed text-sm">
              <thead>
                <tr>
                  <th className={`${TH} w-[14%]`}>Pedido</th>
                  <th className={`${TH} w-[20%]`}>Fornecedor</th>
                  <th className={`${TH} w-[15%] text-right`}>Falta receber</th>
                  <th className={`${TH} w-[14%] text-right`}>Valor</th>
                  <th className={`${TH} w-[12%]`}>Pedido em</th>
                  <th className={`${TH} w-[13%]`}>Chega</th>
                  <th className={`${TH} w-[12%]`}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {pos.abertos.map((p) => {
                  const atraso = p.previstoEm ? diasEntre(p.previstoEm, hoje) : 0;
                  return (
                    <tr key={p.id}>
                      <td className={`${TD} font-lk-mono font-medium`}>{p.numero}</td>
                      <td className={TD}>{p.fornecedor || "—"}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {num(p.qtd)} <span className="text-lk-muted text-xs">{un}</span>
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{brl(p.valorCents)}</td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {p.pedidoEm ? dia(p.pedidoEm) : "—"}
                      </td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {p.previstoEm ? (
                          atraso > 0 ? (
                            <Badge tone="fail">
                              {dia(p.previstoEm)} · {atraso} d atraso
                            </Badge>
                          ) : (
                            dia(p.previstoEm)
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${TD} text-right`}>
                        <button
                          type="button"
                          className={btn("secondary", "sm")}
                          onClick={() => onReceber(p.pcId)}
                        >
                          <PackageCheck aria-hidden />
                          Receber
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const TIPO_MOV: Record<
  Movimento["tipo"],
  { label: string; tone: "pass" | "hold" | "running" | "muted" }
> = {
  inicial: { label: "Saldo inicial", tone: "muted" },
  entrada: { label: "Entrada", tone: "pass" },
  saida: { label: "Saída", tone: "running" },
  ajuste: { label: "Ajuste", tone: "hold" },
};

/** Movimentações do insumo (as mais novas primeiro). */
function Movimentacoes({ i, movimentos }: { i: Insumo; movimentos: Movimento[] }) {
  const [todas, setTodas] = useState(false);
  const lista = [...movimentos].reverse();
  const mostradas = todas ? lista : lista.slice(0, 8);
  return (
    <div className="border-lk-border border-t">
      <p className="px-5 py-3 text-sm">
        <span className="font-semibold">Movimentações</span>
        <span className="text-lk-muted"> · {movimentos.length}</span>
      </p>
      {lista.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed text-sm">
            <thead>
              <tr>
                <th className={`${TH} w-[11%]`}>Data</th>
                <th className={`${TH} w-[12%]`}>Tipo</th>
                <th className={`${TH} w-[29%]`}>Origem</th>
                <th className={`${TH} w-[12%] text-right`}>Quantidade</th>
                <th className={`${TH} w-[12%] text-right`}>Valor</th>
                <th className={`${TH} w-[12%] text-right`}>Saldo</th>
                <th className={`${TH} w-[12%] text-right`}>Valor do saldo</th>
              </tr>
            </thead>
            <tbody className="divide-lk-border divide-y">
              {mostradas.map((m) => {
                const t = TIPO_MOV[m.tipo];
                return (
                  <tr key={m.id}>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>{dia(m.data)}</td>
                    <td className={TD}>
                      <Badge tone={t.tone}>{t.label}</Badge>
                    </td>
                    <td className={TD}>
                      <p>{m.origem}</p>
                      {m.obs && <p className="text-lk-muted text-xs">{m.obs}</p>}
                    </td>
                    <td
                      className={`${TD} text-right font-medium tabular-nums ${m.qtd < 0 ? "text-lk-fail" : ""}`}
                    >
                      {m.qtd > 0 ? "+" : ""}
                      {num(m.qtd)}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{brl(m.valorCents)}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {num(m.saldoQtd)} <span className="text-lk-muted text-xs">{i.unidade}</span>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{brl(m.saldoValorCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {lista.length > 8 && (
        <button
          type="button"
          className="text-lk-action-strong px-5 py-3 text-xs hover:underline"
          onClick={() => setTodas((v) => !v)}
        >
          {todas ? "Mostrar só as últimas" : `Ver todas (${lista.length})`}
        </button>
      )}
    </div>
  );
}

/** Contagem de estoque: o contado vira o estoque (ajuste da diferença). */
function ContagemEditor({
  insumo,
  hoje,
  onCancel,
  onSave,
}: {
  insumo: Insumo;
  hoje: string;
  onCancel: () => void;
  onSave: (contado: number, dia: string, obs: string) => void;
}) {
  const [contado, setContado] = useState(insumo.estoque);
  const [quando, setQuando] = useState(hoje);
  const [obs, setObs] = useState("");
  const dif = contado - insumo.estoque;
  return (
    <Drawer
      title={`Contagem · ${insumo.insumo}`}
      isNew
      ok={dif !== 0}
      onCancel={onCancel}
      onSave={() => onSave(contado, quando, obs)}
      onDelete={() => {}}
    >
      <p className="text-sm">
        No sistema:{" "}
        <span className="font-semibold">
          {num(insumo.estoque)} {insumo.unidade}
        </span>
        {insumo.valorEstoqueCents > 0 ? ` (${brl(insumo.valorEstoqueCents)})` : ""}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumField
          label="Quantidade contada"
          value={contado}
          onChange={setContado}
          hint={insumo.unidade}
        />
        <label className={LABEL}>
          <span className="font-medium">Data da contagem</span>
          <input
            type="date"
            className={INPUT}
            value={quando}
            onChange={(e) => setQuando(e.target.value || hoje)}
          />
        </label>
      </div>
      {dif !== 0 && (
        <p className={`text-sm ${dif < 0 ? "text-lk-fail" : "text-lk-pass"}`}>
          Ajuste de {dif > 0 ? "+" : ""}
          {num(dif)} {insumo.unidade}, pelo custo médio.
        </p>
      )}
      <label className={LABEL}>
        <span className="font-medium">Observação</span>
        <input
          className={INPUT}
          value={obs}
          maxLength={300}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Ex.: contagem mensal, perda na armazenagem"
        />
      </label>
    </Drawer>
  );
}

/** Compras já feitas do insumo: registradas à mão + as dos lotes. */
function HistoricoCompras({ i, compras }: { i: Insumo; compras: LinhaCompra[] }) {
  if (i.categoria === "Serviço" && compras.length === 0) return null;
  const media = custoMedio(compras);
  const ultimo = compras[compras.length - 1];
  return (
    <div className="border-lk-border border-t">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-sm">
          <span className="font-semibold">Últimos pedidos</span>
          <span className="text-lk-muted"> · {compras.length}</span>
          {media.unitCents !== null && (
            <span className="text-lk-muted text-xs">
              {"  "}· custo médio{" "}
              <span className="text-lk-ink font-medium">{unit(media.unitCents)}</span> por{" "}
              {i.unidade} com frete ({num(media.qtd, 0)} un., {brl(media.total)})
              {ultimo && compras.length > 1 && (
                <>
                  {" "}
                  · último <span className="text-lk-ink font-medium">{unit(ultimo.unitCents)}</span>
                </>
              )}
            </span>
          )}
        </p>
      </div>
      {compras.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed text-sm">
            <thead>
              <tr>
                <th className={`${TH} w-[20%]`}>Pedido</th>
                <th className={`${TH} w-[20%]`}>Fornecedor</th>
                <th className={`${TH} w-[14%] text-right`}>Quantidade</th>
                <th className={`${TH} w-[16%] text-right`}>Valor</th>
                <th className={`${TH} w-[14%] text-right`}>Frete</th>
                <th className={`${TH} w-[16%] text-right`}>Por {i.unidade}</th>
              </tr>
            </thead>
            <tbody className="divide-lk-border divide-y">
              {compras.map((c) => (
                <tr key={c.id}>
                  <td className={TD}>
                    <p className={c.lote ? "font-medium" : "font-lk-mono font-medium"}>
                      {c.pedido}
                    </p>
                    <p className="text-lk-muted text-xs">
                      {c.data ? `recebido ${dia(c.data)}` : "sem data"}
                    </p>
                  </td>
                  <td className={TD}>{c.fornecedor || "—"}</td>
                  <td className={`${TD} text-right tabular-nums`}>{num(c.quantidade)}</td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {brl(c.totalCents - (c.freteCents ?? 0))}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {c.freteCents === null ? (
                      <span className="text-lk-muted text-xs">no valor</span>
                    ) : c.freteCents > 0 ? (
                      brl(c.freteCents)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${TD} text-right font-medium tabular-nums`}>
                    {unit(c.unitCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InsumoEditor({
  item,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  item: Insumo;
  isNew: boolean;
  onCancel: () => void;
  onSave: (i: Insumo, custoInicialCents?: number) => void;
  onDelete: () => void;
}) {
  const [f, setF] = useState(item);
  const set = <K extends keyof Insumo>(k: K, v: Insumo[K]) => setF((p) => ({ ...p, [k]: v }));
  const conhecidas: readonly string[] = UNIDADES.flatMap((g) => g.itens);
  // Unidade fora da lista (cadastro antigo ou digitada): abre o campo de texto.
  const [outra, setOutra] = useState(!conhecidas.includes(item.unidade));
  const [custoInicial, setCustoInicial] = useState("");
  const daReceita = f.uso === "receita";
  const ok = f.insumo.trim().length > 0 && f.unidade.trim().length > 0;
  const un = f.unidade || "unidades";

  return (
    <Drawer
      title={isNew ? "Novo insumo" : "Editar insumo"}
      isNew={isNew}
      ok={ok}
      onCancel={onCancel}
      onSave={() => onSave(f, toCents(custoInicial))}
      onDelete={onDelete}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${LABEL} sm:col-span-2`}>
          <span className="font-medium">Insumo</span>
          <input
            className={INPUT}
            value={f.insumo}
            onChange={(e) => set("insumo", e.target.value)}
            placeholder="Ex.: Lata 350ml + tampa"
          />
        </label>
        <label className={LABEL}>
          <span className="font-medium">Categoria</span>
          <select
            className={INPUT}
            value={f.categoria}
            onChange={(e) => set("categoria", e.target.value as Insumo["categoria"])}
          >
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          <span className="font-medium">Unidade de compra</span>
          <select
            className={INPUT}
            value={outra ? "__outra" : f.unidade}
            onChange={(e) => {
              if (e.target.value === "__outra") {
                setOutra(true);
                return;
              }
              setOutra(false);
              set("unidade", e.target.value);
            }}
          >
            {UNIDADES.map((g) => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.itens.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="__outra">Outra…</option>
          </select>
          {outra && (
            <input
              className={INPUT}
              value={f.unidade}
              onChange={(e) => set("unidade", e.target.value)}
              placeholder="Ex.: fardo, bobina"
              aria-label="Outra unidade"
            />
          )}
          <span className={HINT}>
            Todas as cotações usam esta unidade
            {daReceita &&
              (tipoUnidade(f.unidade) === "massa"
                ? ". Por peso: a receita pede g por 100 mL."
                : tipoUnidade(f.unidade) === "volume"
                  ? ". A receita pede mL por 100 mL."
                  : ". Na receita: use litro, ml, kg ou g.")}
          </span>
          {!isNew && f.unidade !== item.unidade && item.fornecedores.length > 0 && (
            <span className="text-lk-hold text-xs">
              Mudou a unidade: confira o preço das cotações (agora é por {f.unidade || "…"}).
            </span>
          )}
        </label>
        <label className={LABEL}>
          <span className="font-medium">Quanto vai na produção</span>
          <select
            className={INPUT}
            value={f.uso}
            onChange={(e) => set("uso", e.target.value as Insumo["uso"])}
          >
            {(Object.keys(USO_LABEL) as Insumo["uso"][])
              // Formato antigo (fernet/cola por lata) só aparece se ainda estiver em uso.
              .filter((u) => (u !== "fernet" && u !== "cola") || u === item.uso)
              .map((u) => (
                <option key={u} value={u}>
                  {USO_LABEL[u]}
                </option>
              ))}
          </select>
        </label>
        {(f.uso === "lata" || f.uso === "pack") && (
          <NumField
            label={f.uso === "lata" ? "Por lata" : "Por six pack"}
            value={f.qtd}
            onChange={(n) => set("qtd", n)}
            hint={`em ${un}`}
          />
        )}
        {f.uso === "receita" && (
          <>
            <label className={LABEL}>
              <span className="font-medium">Entra em</span>
              <select
                className={INPUT}
                value={f.parte}
                onChange={(e) => set("parte", e.target.value as Insumo["parte"])}
              >
                <option value="refri">Refri de cola</option>
                <option value="final">Produto final (Fernet Cola)</option>
              </select>
            </label>
            <NumField
              label="Quantidade por 100 mL"
              value={f.qtd}
              onChange={(n) => set("qtd", n)}
              hint={`em ${medida(f.unidade)} por 100 mL de ${f.parte === "refri" ? "refri" : "produto"}`}
            />
            <label className={`${LABEL} sm:col-span-2`}>
              <span className="font-medium">Especificação</span>
              <input
                className={INPUT}
                value={f.especificacao}
                maxLength={120}
                onChange={(e) => set("especificacao", e.target.value)}
                placeholder="Ex.: Cristal, 0,6 g/L, ajustar o pH para 2,5"
              />
            </label>
          </>
        )}
        {isNew ? (
          <>
            <NumField
              label="Estoque inicial"
              value={f.estoque}
              onChange={(n) => set("estoque", n)}
              hint={`${un} que já estão guardados`}
            />
            {f.estoque > 0 && (
              <label className={LABEL}>
                <span className="font-medium">Custo de cada {f.unidade || "unidade"}</span>
                <span className="flex items-center gap-2">
                  <span className="text-lk-muted">R$</span>
                  <input
                    inputMode="decimal"
                    className={`${INPUT} w-full text-right tabular-nums`}
                    value={custoInicial}
                    onChange={(e) => setCustoInicial(e.target.value)}
                    placeholder="0,00"
                  />
                </span>
                <span className={HINT}>Valoriza o estoque inicial</span>
              </label>
            )}
          </>
        ) : (
          <div className={LABEL}>
            <span className="font-medium">Em estoque</span>
            <span className="text-lk-ink flex h-10 items-center tabular-nums">
              {num(item.estoque)} {un}
              {item.valorEstoqueCents > 0 ? ` · ${brl(item.valorEstoqueCents)}` : ""}
            </span>
            <span className={HINT}>Muda por chegada, consumo de lote ou contagem</span>
          </div>
        )}
        <NumField
          label="Estoque mínimo"
          value={f.estoqueMinimo}
          onChange={(n) => set("estoqueMinimo", n)}
          hint={`${un}: abaixo disso (projetado) o painel avisa`}
        />
        <NumField
          label="Perda deste insumo (%)"
          value={f.perdaPct}
          max={90}
          step={0.5}
          onChange={(n) => set("perdaPct", n)}
          hint="Compra a mais pra cobrir quebra/perda na linha"
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={f.depois}
          onChange={(e) => set("depois", e.target.checked)}
          className="accent-lk-action mt-0.5 size-4"
        />
        <span>
          É envase/serviço: só começa depois que os outros insumos chegam
          <span className={`${HINT} block`}>O prazo dele soma depois do insumo mais demorado.</span>
        </span>
      </label>
      <p className={HINT}>Fornecedores, preços e prazos ficam nas cotações do insumo.</p>
    </Drawer>
  );
}

function FornecedorEditor({
  item,
  insumo,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  item: Fornecedor;
  insumo: Insumo;
  isNew: boolean;
  onCancel: () => void;
  onSave: (f: Fornecedor) => void;
  onDelete: () => void;
}) {
  const [f, setF] = useState(item);
  // Preços digitados como texto ("0,95"), convertidos ao salvar.
  const [precos, setPrecos] = useState(item.faixas.map((x) => fromCents(x.precoCents)));
  const [frete, setFrete] = useState(item.freteCents ? fromCents(item.freteCents) : "");
  const set = <K extends keyof Fornecedor>(k: K, v: Fornecedor[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const ok = f.nome.trim().length > 0;
  const un = insumo.unidade || "unidades";

  const save = () => {
    const faixas = f.faixas
      .map((x, k) => ({ de: x.de, precoCents: toCents(precos[k] ?? "0") }))
      .sort((a, b) => a.de - b.de);
    onSave({
      ...f,
      faixas: faixas.length ? faixas : [{ de: 0, precoCents: 0 }],
      freteCents: toCents(frete),
    });
  };

  return (
    <Drawer
      title={`${isNew ? "Nova cotação" : "Editar cotação"} · ${insumo.insumo}`}
      isNew={isNew}
      ok={ok}
      onCancel={onCancel}
      onSave={save}
      onDelete={onDelete}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          <span className="font-medium">Fornecedor</span>
          <input
            className={INPUT}
            value={f.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Nome da empresa"
          />
        </label>
        <label className={LABEL}>
          <span className="font-medium">Contato</span>
          <input
            className={INPUT}
            value={f.contato}
            onChange={(e) => set("contato", e.target.value)}
            placeholder="Telefone, e-mail ou pessoa"
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Preço por quantidade</legend>
        <p className={HINT}>
          Se o preço muda conforme a quantidade, coloca uma linha por faixa. A primeira vale desde
          0.
        </p>
        {f.faixas.map((x, k) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <span className="text-lk-muted w-20 shrink-0">A partir de</span>
            <input
              type="number"
              min={0}
              className={`${INPUT} w-28 text-right tabular-nums`}
              value={x.de}
              disabled={k === 0}
              onChange={(e) =>
                set(
                  "faixas",
                  f.faixas.map((y, j) =>
                    j === k ? { ...y, de: Math.max(0, Number(e.target.value) || 0) } : y,
                  ),
                )
              }
            />
            <span className="text-lk-muted">R$</span>
            <input
              inputMode="decimal"
              className={`${INPUT} w-28 text-right tabular-nums`}
              value={precos[k] ?? ""}
              onChange={(e) => setPrecos((p) => p.map((v, j) => (j === k ? e.target.value : v)))}
              placeholder="0,00"
            />
            <span className="text-lk-muted truncate">/ {un}</span>
            {k > 0 && (
              <button
                type="button"
                aria-label="Remover faixa"
                className={btn("ghost", "sm")}
                onClick={() => {
                  set(
                    "faixas",
                    f.faixas.filter((_, j) => j !== k),
                  );
                  setPrecos((p) => p.filter((_, j) => j !== k));
                }}
              >
                <X aria-hidden />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className={`${btn("secondary", "sm")} self-start`}
          onClick={() => {
            const last = f.faixas[f.faixas.length - 1]?.de ?? 0;
            set("faixas", [...f.faixas, { de: last ? last * 2 : 1000, precoCents: 0 }]);
            setPrecos((p) => [...p, ""]);
          }}
        >
          <Plus aria-hidden />
          Adicionar faixa
        </button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumField
          label="Pedido mínimo"
          value={f.minimo}
          onChange={(n) => set("minimo", n)}
          hint={`em ${un}`}
        />
        <NumField
          label="Vende de quanto em quanto"
          value={f.multiplo}
          onChange={(n) => set("multiplo", n)}
          hint={`palete, caixa, milheiro (em ${un}); 0 = livre`}
        />
        <NumField
          label="Prazo de entrega"
          value={f.prazoDias}
          step={1}
          onChange={(n) => set("prazoDias", Math.round(n))}
          hint="dias corridos até chegar no envase"
        />
        <label className={LABEL}>
          <span className="font-medium">Frete do pedido</span>
          <span className="flex items-center gap-2">
            <span className="text-lk-muted">R$</span>
            <input
              inputMode="decimal"
              className={`${INPUT} w-full text-right tabular-nums`}
              value={frete}
              onChange={(e) => setFrete(e.target.value)}
              placeholder="0,00"
            />
          </span>
          <span className={HINT}>Até o envase; entra no custo</span>
        </label>
        <label className={LABEL}>
          <span className="font-medium">Data da cotação</span>
          <input
            type="date"
            className={`${INPUT} tabular-nums`}
            value={f.cotadoEm ?? ""}
            onChange={(e) => set("cotadoEm", e.target.value || null)}
          />
          <span className={HINT}>Depois de 90 dias o painel avisa pra conferir</span>
        </label>
      </div>
      <label className={LABEL}>
        <span className="font-medium">Observações</span>
        <textarea
          className={`${INPUT} h-20 py-2`}
          value={f.obs}
          maxLength={300}
          onChange={(e) => set("obs", e.target.value)}
          placeholder="Condição de pagamento, qualidade, amostra pedida…"
        />
      </label>
    </Drawer>
  );
}
