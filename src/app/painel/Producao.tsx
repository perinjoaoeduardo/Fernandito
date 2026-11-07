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
  criarLote,
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
  type Fornecedor,
  type Insumo,
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
  | { kind: "fornecedor"; insumo: Insumo; item: Fornecedor; isNew: boolean };

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
  const prontoEm = somarDias(hoje, r.prazo);
  const folga = plano.prontoAte ? diasEntre(prontoEm, plano.prontoAte) : null;
  const sobraMl = LATA_ML - (receita.fernetMl ?? 0) - (receita.colaMl ?? 0);
  const temExemplo = insumos.some((i) => i.exemplo || i.fornecedores.some((f) => f.exemplo));
  const aComprar = linhas.filter((l) => l.falta > 0);

  const setPlano = (patch: Partial<Plano>) =>
    persistSoon({ ...data, plano: { ...plano, ...patch } });
  const setReceita = (k: "fernetMl" | "colaMl", v: number | null) =>
    persistSoon({ ...data, receita: { ...receita, [k]: v } });

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
            label="Pronto em"
            value={dia(prontoEm)}
            tone={folga !== null && folga < 0 ? "fail" : "hold"}
            note={
              r.gargalo && r.gargalo.prazo > 0
                ? `${r.prazo} dias · gargalo: ${r.gargalo.i.insumo}`
                : `${r.prazo} dias`
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
              <span className="font-medium">Quero pronto até</span>
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
              <span className={HINT}>Mostra até quando pedir cada insumo</span>
            </label>
          </div>

          <p className="text-sm">
            Pedindo hoje, fica pronto em <span className="font-semibold">{dia(prontoEm)}</span> (
            {r.espera} dias esperando insumo + {r.servico} de envase/serviço).{" "}
            {folga !== null &&
              (folga >= 0 ? (
                <span className="text-lk-pass font-medium">
                  Dá tempo pra {dia(plano.prontoAte!)}: sobram {folga} dias.
                </span>
              ) : (
                <span className="text-lk-fail font-medium">
                  Não dá pra {dia(plano.prontoAte!)}: faltam {-folga} dias. Veja o gargalo ou um
                  fornecedor mais rápido.
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
                  const ate = plano.prontoAte ? pedirAte(l, plano.prontoAte, r.servico) : null;
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
                            {num(l.precisa)} {i.unidade}
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
                                {num(c.comprar)}
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
                            <p className="text-lk-muted text-xs">começar até</p>
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
      <section className="flex flex-col gap-4">
        <SectionTitle title="Receita" />
        <div className={`${TABLE_WRAP} flex flex-wrap items-start gap-x-10 gap-y-5 p-5`}>
          {(
            [
              ["fernetMl", "Fernet"],
              ["colaMl", "Base de cola"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className={LABEL}>
              <span className="font-medium">{label}</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={LATA_ML}
                  inputMode="decimal"
                  placeholder="—"
                  value={receita[k] ?? ""}
                  onChange={(e) =>
                    setReceita(
                      k,
                      e.target.value === ""
                        ? null
                        : Math.min(LATA_ML, Math.max(0, Number(e.target.value))),
                    )
                  }
                  className={`${INPUT} w-28 text-right tabular-nums`}
                />
                <span className="text-lk-muted">ml por lata</span>
              </span>
              {receita[k] !== null && (
                <span className={HINT}>{num(((receita[k] ?? 0) / LATA_ML) * 100)}% da lata</span>
              )}
            </label>
          ))}
          <div className={LABEL}>
            <span className="font-medium">Lata</span>
            <span className="text-lk-muted flex h-10 items-center">{LATA_ML} ml</span>
            {r.receitaOk && (
              <span className={`text-xs ${sobraMl < 0 ? "text-lk-fail" : "text-lk-ink3"}`}>
                {sobraMl < 0
                  ? `Passou ${num(-sobraMl)} ml da lata`
                  : sobraMl > 0
                    ? `Sobram ${num(sobraMl)} ml (água, gás, outros)`
                    : "Fecha os 350 ml"}
              </span>
            )}
          </div>
        </div>
      </section>

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

/** Um insumo e a tabela de cotações dos fornecedores dele. */
function InsumoCard({
  linha,
  hoje,
  pont,
  reservado,
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
  onEdit: () => void;
  onAddFornecedor: () => void;
  onEditFornecedor: (f: Fornecedor) => void;
  onUsar: (id: string) => void;
}) {
  const { i } = linha;
  const principal = principalDe(i);
  // Compara pelo que falta comprar; se não falta nada, por um lote inteiro.
  const qtd = linha.falta > 0 ? linha.falta : (linha.precisa ?? 0);
  const inteiro = i.categoria !== "Líquido";
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
            {i.categoria} · {USO_LABEL[i.uso]}
            {i.uso === "lata" || i.uso === "pack" ? `: ${num(i.qtd)} ${i.unidade}` : ""} · compra em{" "}
            {i.unidade}
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
  onSave: (i: Insumo) => void;
  onDelete: () => void;
}) {
  const [f, setF] = useState(item);
  const set = <K extends keyof Insumo>(k: K, v: Insumo[K]) => setF((p) => ({ ...p, [k]: v }));
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
          <input
            className={INPUT}
            value={f.unidade}
            onChange={(e) => set("unidade", e.target.value)}
            placeholder="litro, unidade, caixa…"
          />
          <span className={HINT}>Todas as cotações usam esta unidade</span>
        </label>
        <label className={LABEL}>
          <span className="font-medium">Quanto vai na produção</span>
          <select
            className={INPUT}
            value={f.uso}
            onChange={(e) => set("uso", e.target.value as Insumo["uso"])}
          >
            {(Object.keys(USO_LABEL) as Insumo["uso"][]).map((u) => (
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
