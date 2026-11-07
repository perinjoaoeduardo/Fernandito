"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
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
  criarLote,
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
  type Compra,
  type Fornecedor,
  type Insumo,
  type LinhaCompra,
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
  brl,
  dia,
  fromCents,
  novoId,
  num,
  pct,
  toCents,
} from "./producao-ui";
import { Badge, Code, Empty, KpiStrip, SectionTitle, TABLE_WRAP, TD, TH, Tile, btn } from "./ui";

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
  | { kind: "compra"; insumo: Insumo; item: Compra; isNew: boolean };

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
  precos,
}: {
  initial: ProducaoData;
  /** Preço de venda (centavos), pra margem. */
  precos: { lata: number; pack: number };
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
  const pont = useMemo(() => pontualidade(data.lotes), [data.lotes]);
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

  const putInsumo = (item: Insumo) => {
    const exists = insumos.some((i) => i.id === item.id);
    persist({
      ...data,
      insumos: exists ? insumos.map((i) => (i.id === item.id ? item : i)) : [...insumos, item],
    });
  };
  const saveInsumo = (item: Insumo) => {
    putInsumo({ ...item, exemplo: undefined });
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
  const novaCompra = (insumo: Insumo): Compra => {
    const p = principalDe(insumo);
    const ordem = Math.max(
      0,
      ...data.compras.filter((c) => c.insumoId === insumo.id).map((c) => c.ordem),
    );
    return {
      id: novoId("c"),
      insumoId: insumo.id,
      fornecedorId: p?.id ?? null,
      fornecedor: p?.nome ?? "",
      pedido: `${ordem + 1}º pedido`,
      data: hoje,
      ordem: ordem + 1,
      quantidade: 1,
      valorCents: 0,
      freteCents: 0,
      obs: "",
    };
  };
  const saveCompra = (c: Compra) => {
    const exists = data.compras.some((x) => x.id === c.id);
    persist({
      ...data,
      compras: exists ? data.compras.map((x) => (x.id === c.id ? c : x)) : [...data.compras, c],
    });
    setEditing(null);
  };
  const removeCompra = (id: string) => {
    if (!window.confirm("Excluir esta compra do histórico? (O estoque do insumo não muda.)"))
      return;
    persist({ ...data, compras: data.compras.filter((x) => x.id !== id) });
    setEditing(null);
  };
  const proximo = proximoCodigo(data.lotes);
  const podeCriar = r.receitaOk && r.boas > 0;
  const criar = () => {
    if (!podeCriar) return;
    const novo = criarLote(data, linhas, novoId("l"));
    persist({ ...data, lotes: [...data.lotes, novo] });
    setStatus({ ok: true, text: `${novo.codigo} criado` });
    window.setTimeout(
      () => document.getElementById("lotes")?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  };

  const margens = [
    { nome: "Lata 350ml", preco: precos.lata, custo: r.lataCents },
    { nome: "Six pack", preco: precos.pack, custo: r.packCents },
  ];

  return (
    <>
      {temExemplo && (
        <div className="border-lk-hold/25 bg-lk-hold-bg text-lk-hold rounded-xl border px-5 py-3 text-sm">
          Os insumos e cotações marcados <span className="font-semibold">exemplo</span> são de
          mentira: edita com os dados reais ou exclui. Tudo que vocês salvam aqui fica pra equipe
          toda.
        </div>
      )}

      <LotesKpis data={data} hoje={hoje} />
      <Lotes
        data={data}
        hoje={hoje}
        onChange={(next, soon) => (soon ? persistSoon : persist)(next)}
      />

      {/* ── Planejar novo lote ── */}
      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Planejar novo lote"
          aside={
            <span className={`text-xs ${status?.ok === false ? "text-lk-fail" : "text-lk-ink3"}`}>
              {saving ? "Salvando…" : status?.text}
            </span>
          }
        />
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
              Sem fornecedor: {r.semFornecedor.map((l) => l.i.insumo).join(", ")}. O custo e o prazo
              estão incompletos.
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
                                  {c.faixa.de > 0 ? `a partir de ${num(c.faixa.de)}` : "faixa base"}
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
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{r.prazo} dias</td>
                  {plano.prontoAte && <td className={TD} />}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className={HINT}>
            Latas envasadas = litros ÷ 0,35; boas = envasadas menos a perda no envase. Precisa =
            consumo do lote + a perda do insumo. Comprar = o que falta depois do estoque, subindo
            até o pedido mínimo e o múltiplo do fornecedor principal. Desembolso inclui o frete.
            Prazo = o insumo a comprar que mais demora + o envase/serviço. Disponível = estoque
            menos o que os lotes em andamento já reservaram.
          </p>
          <div className="border-lk-border -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
            <p className="text-lk-muted text-sm">
              {podeCriar
                ? `Gostou do plano? Ele vira o ${proximo}: quantidades, fornecedores e custos ficam guardados, e o estoque usado fica reservado.`
                : "Preencha a receita e os litros para criar um lote."}
            </p>
            <button type="button" className={btn("primary")} disabled={!podeCriar} onClick={criar}>
              <ArrowDown aria-hidden />
              Criar lote {proximo}
            </button>
          </div>
        </div>
      </section>

      {/* ── Margem ── */}
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
        <p className={HINT}>
          Custo = o que o lote consome (líquidos, lata, envase e, no six pack, a embalagem),
          dividido pelas latas boas, com o frete dos insumos. Margem bruta: antes de impostos, taxa
          do Pix e frete de venda. Preço = o do Bling.
        </p>
      </section>

      {/* ── Receita ── */}
      <Receita
        linhas={linhas}
        refriPct={receita.refriPct}
        onRefriPct={setRefriPct}
        onQtd={setQtd}
        onEdit={(i) => setEditing({ kind: "insumo", item: structuredClone(i), isNew: false })}
        onAdd={(parte) => setEditing({ kind: "insumo", item: novoIngrediente(parte), isNew: true })}
      />

      {/* ── Insumos e cotações ── */}
      <section className="flex flex-col gap-4">
        <SectionTitle
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
        />
        {insumos.length === 0 && <Empty>Nenhum insumo ainda.</Empty>}
        {linhas.map((l) => (
          <InsumoCard
            key={l.i.id}
            linha={l}
            hoje={hoje}
            pont={pont}
            reservado={reservado.get(l.i.id) ?? 0}
            compras={comprasDo(data, l.i.id)}
            onAddCompra={() =>
              setEditing({ kind: "compra", insumo: l.i, item: novaCompra(l.i), isNew: true })
            }
            onEditCompra={(id) => {
              const c = data.compras.find((x) => x.id === id);
              if (c)
                setEditing({ kind: "compra", insumo: l.i, item: structuredClone(c), isNew: false });
            }}
            onEdit={() => setEditing({ kind: "insumo", item: structuredClone(l.i), isNew: false })}
            onAddFornecedor={() =>
              setEditing({ kind: "fornecedor", insumo: l.i, item: NOVO_FORNECEDOR(), isNew: true })
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
          (com mínimo, múltiplo, faixa e frete). A estrela marca o principal, que a calculadora usa.
        </p>
      </section>

      {editing?.kind === "insumo" && (
        <InsumoEditor
          item={editing.item}
          isNew={editing.isNew}
          onCancel={() => setEditing(null)}
          onSave={saveInsumo}
          onDelete={() => removeInsumo(editing.item.id)}
        />
      )}
      {editing?.kind === "compra" && (
        <CompraEditor
          item={editing.item}
          insumo={editing.insumo}
          isNew={editing.isNew}
          onCancel={() => setEditing(null)}
          onSave={saveCompra}
          onDelete={() => removeCompra(editing.item.id)}
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
    <section className="flex flex-col gap-4">
      <SectionTitle
        title="Receita"
        aside={<span className={HINT}>por 100 mL, como na planilha</span>}
      />
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
    </section>
  );
}

/** Um insumo e a tabela de cotações dos fornecedores dele. */
function InsumoCard({
  linha,
  hoje,
  pont,
  reservado,
  compras,
  onAddCompra,
  onEditCompra,
  onEdit,
  onAddFornecedor,
  onEditFornecedor,
  onUsar,
}: {
  linha: ReturnType<typeof planejar>[number];
  hoje: string;
  /** Entregas registradas nos lotes, por fornecedor. */
  pont: ReturnType<typeof pontualidade>;
  reservado: number;
  compras: LinhaCompra[];
  onAddCompra: () => void;
  onEditCompra: (id: string) => void;
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

  return (
    <div className={TABLE_WRAP}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {i.insumo}
            {i.exemplo && <span className="text-lk-hold text-xs font-normal">exemplo</span>}
          </p>
          <p className="text-lk-muted text-xs">
            {i.categoria} ·{" "}
            {i.uso === "receita"
              ? `Receita: ${num(i.qtd, 3)} ${medida(i.unidade)} por 100 mL de ${i.parte === "refri" ? "refri" : "produto"}`
              : `${USO_LABEL[i.uso]}${i.uso === "lata" || i.uso === "pack" ? `: ${num(i.qtd)} ${i.unidade}` : ""}`}
            {i.especificacao ? ` (${i.especificacao})` : ""} · compra em {i.unidade}
          </p>
          <p className="text-lk-ink3 mt-1 text-xs">
            Em estoque: <span className="text-lk-ink font-medium">{num(i.estoque)}</span>
            {reservado > 0 ? ` (${num(reservado)} reservado p/ lotes em andamento)` : ""}
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
          <button type="button" className={btn("secondary", "sm")} onClick={onAddFornecedor}>
            <Plus aria-hidden />
            Cotação
          </button>
        </span>
      </div>
      {i.fornecedores.length === 0 ? (
        <p className="border-lk-border text-lk-fail border-t px-5 py-3 text-sm">
          Nenhum fornecedor cadastrado. Adiciona uma cotação.
        </p>
      ) : (
        <div className="border-lk-border overflow-x-auto border-t">
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
                        const p = pont.get(f.id);
                        if (!p) return null;
                        const media =
                          p.entregas > p.noPrazo ? p.atrasoTotal / (p.entregas - p.noPrazo) : 0;
                        return (
                          <p
                            className={`text-xs ${p.noPrazo < p.entregas ? "text-lk-hold" : "text-lk-pass"}`}
                          >
                            {p.noPrazo} de {p.entregas} {p.entregas === 1 ? "entrega" : "entregas"}{" "}
                            no prazo
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
      )}
      <HistoricoCompras i={i} compras={compras} onAdd={onAddCompra} onEdit={onEditCompra} />
    </div>
  );
}

/** Compras já feitas do insumo: registradas à mão + as dos lotes. */
function HistoricoCompras({
  i,
  compras,
  onAdd,
  onEdit,
}: {
  i: Insumo;
  compras: LinhaCompra[];
  onAdd: () => void;
  onEdit: (id: string) => void;
}) {
  if (i.categoria === "Serviço" && compras.length === 0) return null;
  const media = custoMedio(compras);
  const ultimo = compras[compras.length - 1];
  return (
    <div className="border-lk-border border-t">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-sm">
          <span className="font-semibold">Compras</span>
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
        <button type="button" className={btn("ghost", "sm")} onClick={onAdd}>
          <Plus aria-hidden />
          Registrar compra
        </button>
      </div>
      {compras.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed text-sm">
            <thead>
              <tr>
                <th className={`${TH} w-[20%]`}>Pedido</th>
                <th className={`${TH} w-[16%]`}>Fornecedor</th>
                <th className={`${TH} w-[13%] text-right`}>Quantidade</th>
                <th className={`${TH} w-[15%] text-right`}>Valor</th>
                <th className={`${TH} w-[13%] text-right`}>Frete</th>
                <th className={`${TH} w-[15%] text-right`}>Por {i.unidade}</th>
                <th className={`${TH} w-[8%]`}>
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-lk-border divide-y">
              {compras.map((c) => (
                <tr key={c.id}>
                  <td className={TD}>
                    <p className="font-medium">{c.pedido}</p>
                    <p className="text-lk-muted text-xs">
                      {c.data ? dia(c.data) : "sem data"}
                      {c.lote ? " · pelo lote" : ""}
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
                  <td className={`${TD} text-right`}>
                    {c.lote === null && (
                      <button
                        type="button"
                        className={btn("ghost", "sm")}
                        onClick={() => onEdit(c.id)}
                        aria-label={`Editar ${c.pedido}`}
                        title="Editar compra"
                      >
                        <Pencil aria-hidden />
                      </button>
                    )}
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

function CompraEditor({
  item,
  insumo,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  item: Compra;
  insumo: Insumo;
  isNew: boolean;
  onCancel: () => void;
  onSave: (c: Compra) => void;
  onDelete: () => void;
}) {
  const [f, setF] = useState(item);
  const [valor, setValor] = useState(item.valorCents ? fromCents(item.valorCents) : "");
  const [frete, setFrete] = useState(item.freteCents ? fromCents(item.freteCents) : "");
  const set = <K extends keyof Compra>(k: K, v: Compra[K]) => setF((p) => ({ ...p, [k]: v }));
  const un = insumo.unidade || "unidades";
  const total = toCents(valor) + toCents(frete);
  const ok = f.quantidade > 0 && toCents(valor) > 0;
  return (
    <Drawer
      title={`${isNew ? "Registrar compra" : "Editar compra"} · ${insumo.insumo}`}
      isNew={isNew}
      ok={ok}
      onCancel={onCancel}
      onSave={() => onSave({ ...f, valorCents: toCents(valor), freteCents: toCents(frete) })}
      onDelete={onDelete}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          <span className="font-medium">Pedido</span>
          <input
            className={INPUT}
            value={f.pedido}
            onChange={(e) => set("pedido", e.target.value)}
            placeholder="1º pedido, nº da nota…"
          />
        </label>
        <label className={LABEL}>
          <span className="font-medium">Data</span>
          <input
            type="date"
            className={INPUT}
            value={f.data ?? ""}
            onChange={(e) => set("data", e.target.value || null)}
          />
          <span className={HINT}>Sem data: fica na ordem do pedido</span>
        </label>
        <label className={LABEL}>
          <span className="font-medium">Fornecedor</span>
          <select
            className={INPUT}
            value={f.fornecedorId ?? ""}
            onChange={(e) => {
              const forn = insumo.fornecedores.find((x) => x.id === e.target.value);
              setF((p) => ({
                ...p,
                fornecedorId: forn?.id ?? null,
                fornecedor: forn?.nome ?? p.fornecedor,
              }));
            }}
          >
            <option value="">{f.fornecedorId ? "Outro" : f.fornecedor || "Escolher…"}</option>
            {insumo.fornecedores.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome || "Sem nome"}
              </option>
            ))}
          </select>
        </label>
        <NumField
          label="Quantidade"
          value={f.quantidade}
          onChange={(n) => set("quantidade", n)}
          hint={un}
        />
        <label className={LABEL}>
          <span className="font-medium">Valor dos itens</span>
          <span className="flex items-center gap-2">
            <span className="text-lk-muted">R$</span>
            <input
              inputMode="decimal"
              className={`${INPUT} w-full text-right tabular-nums`}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </span>
          <span className={HINT}>Sem o frete</span>
        </label>
        <label className={LABEL}>
          <span className="font-medium">Frete</span>
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
          <span className={HINT}>Se o frete foi junto com outro insumo, só a parte deste</span>
        </label>
      </div>
      {f.quantidade > 0 && total > 0 && (
        <p className="text-sm">
          Sai <span className="font-semibold">{unit(total / f.quantidade)}</span> por {un}, com
          frete.
        </p>
      )}
      <label className={LABEL}>
        <span className="font-medium">Observações</span>
        <textarea
          className={`${INPUT} h-20 py-2`}
          value={f.obs}
          maxLength={300}
          onChange={(e) => set("obs", e.target.value)}
        />
      </label>
      <p className={HINT}>
        Registrar uma compra aqui não muda o estoque do insumo: ajuste em “Editar insumo” se
        precisar. Compras feitas dentro de um lote entram no histórico sozinhas.
      </p>
    </Drawer>
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
  onSave: (i: Insumo) => void;
  onDelete: () => void;
}) {
  const [f, setF] = useState(item);
  const set = <K extends keyof Insumo>(k: K, v: Insumo[K]) => setF((p) => ({ ...p, [k]: v }));
  const conhecidas: readonly string[] = UNIDADES.flatMap((g) => g.itens);
  // Unidade fora da lista (cadastro antigo ou digitada): abre o campo de texto.
  const [outra, setOutra] = useState(!conhecidas.includes(item.unidade));
  const daReceita = f.uso === "receita";
  const ok = f.insumo.trim().length > 0 && f.unidade.trim().length > 0;
  const un = f.unidade || "unidades";

  return (
    <Drawer
      title={isNew ? "Novo insumo" : "Editar insumo"}
      isNew={isNew}
      ok={ok}
      onCancel={onCancel}
      onSave={() => onSave(f)}
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
        <NumField
          label="Em estoque"
          value={f.estoque}
          onChange={(n) => set("estoque", n)}
          hint={`${un} já guardados; descontam da compra`}
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
