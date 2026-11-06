"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { CalendarClock, Coins, Factory, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { CATEGORIAS, type Insumo, type ProducaoData } from "@/lib/producao";
import { salvarProducao } from "./actions";
import { Badge, Code, KpiStrip, SectionTitle, TABLE_WRAP, TD, TH, Tile, btn } from "./ui";

/**
 * Produção: calculadora (litros → latas, insumos, custo, prazo), a receita e
 * o cadastro de fornecedores. Tudo editável aqui e salvo no banco do site
 * (src/lib/producao.ts) — um cadastro só pra equipe toda, sem Bling.
 */

const LATA_ML = 350;

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number, max = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: max });
/** "0,95" / "1.234,50" / "12" → centavos. */
const toCents = (v: string) => {
  const n = Number(
    v
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, ""),
  );
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const fromCents = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/** A faixa de preço que vale pra essa quantidade. */
const faixaDe = (faixas: Insumo["faixas"], qtd: number) =>
  [...faixas].sort((a, b) => b.de - a.de).find((f) => qtd >= f.de) ?? faixas[0];

const USO_LABEL: Record<Insumo["uso"], string> = {
  fernet: "Da receita: fernet",
  cola: "Da receita: base de cola",
  lata: "Quantidade por lata",
  pack: "Quantidade por six pack",
};

const INPUT =
  "border-lk-input focus:border-lk-action focus:ring-lk-action/15 h-10 rounded-lg border bg-white px-3 outline-none focus:ring-4";
const LABEL = "flex flex-col gap-1.5 text-sm";
const HINT = "text-lk-ink3 text-xs";

const novoId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const VAZIO = (): Insumo => ({
  id: novoId(),
  insumo: "",
  fornecedor: "",
  contato: "",
  categoria: "Embalagem",
  unidade: "unidade",
  uso: "lata",
  qtd: 1,
  faixas: [{ de: 0, precoCents: 0 }],
  minimo: 0,
  prazoDias: 0,
  depois: false,
});

export function Producao({ initial }: { initial: ProducaoData }) {
  const [data, setData] = useState<ProducaoData>(initial);
  const [litros, setLitros] = useState(1750);
  const [editing, setEditing] = useState<Insumo | null>(null);
  const [saving, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const receitaTimer = useRef<number | undefined>(undefined);

  const persist = (next: ProducaoData) => {
    setData(next);
    start(async () => {
      const r = await salvarProducao(next);
      setStatus(r.ok ? { ok: true, text: "Salvo" } : { ok: false, text: r.error ?? "Não salvou" });
    });
  };

  const { insumos, receita } = data;
  const latas = Math.floor((litros * 1000) / LATA_ML);
  const receitaOk = receita.fernetMl !== null && receita.colaMl !== null;
  const sobraMl = LATA_ML - (receita.fernetMl ?? 0) - (receita.colaMl ?? 0);

  const plan = useMemo(
    () =>
      insumos.map((i) => {
        const por =
          i.uso === "fernet"
            ? receita.fernetMl === null
              ? null
              : receita.fernetMl / 1000
            : i.uso === "cola"
              ? receita.colaMl === null
                ? null
                : receita.colaMl / 1000
              : i.uso === "pack"
                ? i.qtd / 6
                : i.qtd;
        if (por === null) return { i, precisa: null, comprar: 0, faixa: i.faixas[0], custo: 0 };
        const precisa = por * latas;
        const inteiro = i.categoria === "Líquido" ? precisa : Math.ceil(precisa);
        const comprar = Math.max(inteiro, i.minimo);
        const faixa = faixaDe(i.faixas, comprar);
        return { i, precisa, comprar, faixa, custo: Math.round(comprar * faixa.precoCents) };
      }),
    [insumos, receita, latas],
  );
  const custo = plan.reduce((n, p) => n + p.custo, 0);
  const porLata = latas > 0 && receitaOk ? Math.round(custo / latas) : null;
  // Insumos chegam em paralelo; envase/serviço só depois que o último chegar.
  const antes = insumos.filter((i) => !i.depois);
  const depois = insumos.filter((i) => i.depois);
  const espera = antes.length ? Math.max(...antes.map((i) => i.prazoDias)) : 0;
  const prazo = espera + (depois.length ? Math.max(...depois.map((i) => i.prazoDias)) : 0);
  const gargalo = antes.length ? antes.reduce((a, b) => (b.prazoDias > a.prazoDias ? b : a)) : null;
  const temExemplo = insumos.some((i) => i.exemplo);

  const setReceita = (k: "fernetMl" | "colaMl", v: number | null) => {
    const next = { ...data, receita: { ...receita, [k]: v } };
    setData(next);
    window.clearTimeout(receitaTimer.current);
    receitaTimer.current = window.setTimeout(() => persist(next), 700);
  };

  const saveInsumo = (item: Insumo) => {
    const clean = { ...item, exemplo: undefined };
    const exists = insumos.some((i) => i.id === item.id);
    persist({
      ...data,
      insumos: exists ? insumos.map((i) => (i.id === item.id ? clean : i)) : [...insumos, clean],
    });
    setEditing(null);
  };
  const removeInsumo = (id: string) => {
    if (!window.confirm("Excluir este fornecedor/insumo?")) return;
    persist({ ...data, insumos: insumos.filter((i) => i.id !== id) });
    setEditing(null);
  };

  return (
    <>
      {temExemplo && (
        <div className="border-lk-hold/25 bg-lk-hold-bg text-lk-hold rounded-xl border px-5 py-3 text-sm">
          As linhas marcadas <span className="font-semibold">exemplo</span> são de mentira: edita
          com os dados reais ou exclui. Tudo que vocês salvam aqui fica pra equipe toda.
        </div>
      )}

      <KpiStrip cols={4}>
        <Tile
          icon={Factory}
          label="Latas"
          value={num(latas, 0)}
          note={`${num(litros, 0)} L · ${num(Math.floor(latas / 6), 0)} six packs`}
        />
        <Tile
          icon={Coins}
          label="Custo por lata"
          value={porLata === null ? "—" : brl(porLata)}
          note={receitaOk ? `Total ${brl(custo)}` : "Preencher a receita"}
        />
        <Tile
          icon={CalendarClock}
          label="Prazo até pronto"
          value={`${prazo} dias`}
          tone="hold"
          note={gargalo ? `Gargalo: ${gargalo.insumo} (${gargalo.prazoDias} dias)` : "—"}
        />
        <Tile
          icon={Users}
          label="Fornecedores"
          value={new Set(insumos.map((i) => i.fornecedor).filter(Boolean)).size}
          note={`${insumos.length} insumos cadastrados`}
        />
      </KpiStrip>

      {/* ── Calculadora ── */}
      <section className="flex flex-col gap-4">
        <SectionTitle title="Calculadora de produção" />
        <div className={`${TABLE_WRAP} flex flex-col gap-5 p-5`}>
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">Quantos litros produzir?</span>
            <input
              type="number"
              min={0}
              step={50}
              value={litros}
              onChange={(e) => setLitros(Math.max(0, Number(e.target.value) || 0))}
              className={`${INPUT} w-36 text-right tabular-nums`}
            />
            <span className="text-lk-muted">
              L = {num(latas, 0)} latas · {num(Math.floor(latas / 6), 0)} six packs
            </span>
            <span className="ml-auto flex gap-1.5">
              {[500, 1000, 2000, 5000].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLitros(n)}
                  className={`h-8 rounded-md px-3 text-[13px] ${litros === n ? "bg-lk-ink text-white" : "bg-lk-soft text-lk-muted hover:text-lk-ink"}`}
                >
                  {num(n, 0)} L
                </button>
              ))}
            </span>
          </label>

          <div className="border-lk-border -mx-5 overflow-x-auto border-t">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr>
                  <th className={TH}>Insumo</th>
                  <th className={`${TH} text-right`}>Precisa</th>
                  <th className={`${TH} text-right`}>Comprar</th>
                  <th className={`${TH} text-right`}>Preço (faixa)</th>
                  <th className={`${TH} text-right`}>Custo</th>
                  <th className={`${TH} text-right`}>Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-lk-border divide-y">
                {plan.map(({ i, precisa, comprar, faixa, custo: c }) => (
                  <tr key={i.id}>
                    <td className={TD}>
                      <p className="font-semibold">{i.insumo}</p>
                      <p className="text-lk-muted text-xs">{i.fornecedor || "Sem fornecedor"}</p>
                    </td>
                    {precisa === null ? (
                      <td className={`${TD} text-lk-hold text-right`} colSpan={4}>
                        Preencher a receita abaixo
                      </td>
                    ) : (
                      <>
                        <td className={`${TD} text-right tabular-nums`}>
                          {num(precisa)} {i.unidade}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {num(comprar)}
                          {i.minimo > precisa && (
                            <p className="text-lk-hold text-xs">mínimo do fornecedor</p>
                          )}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {brl(faixa.precoCents)}
                          <p className="text-lk-muted text-xs">
                            {faixa.de > 0 ? `a partir de ${num(faixa.de)}` : "faixa base"}
                          </p>
                        </td>
                        <td className={`${TD} text-right font-medium tabular-nums`}>{brl(c)}</td>
                      </>
                    )}
                    <td className={`${TD} text-right tabular-nums`}>
                      {gargalo?.id === i.id ? (
                        <Badge tone="hold">{i.prazoDias} dias · gargalo</Badge>
                      ) : (
                        `${i.prazoDias} dias${i.depois ? " · depois" : ""}`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-lk-border bg-lk-paper border-t">
                  <td className={`${TD} font-semibold`}>Total</td>
                  <td className={TD} />
                  <td className={TD} />
                  <td className={TD} />
                  <td className={`${TD} text-right font-semibold tabular-nums`}>
                    {receitaOk ? brl(custo) : "—"}
                  </td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{prazo} dias</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className={HINT}>
            Latas = litros ÷ 0,35. Comprar = o que precisa, ou o pedido mínimo se for maior. Preço =
            a faixa da quantidade comprada. Prazo = o insumo que mais demora + o envase/serviço.
          </p>
        </div>
      </section>

      {/* ── Receita ── */}
      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Receita"
          aside={
            <span className={`text-xs ${status?.ok === false ? "text-lk-fail" : "text-lk-ink3"}`}>
              {saving ? "Salvando…" : status?.text}
            </span>
          }
        />
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
            {receitaOk && (
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

      {/* ── Fornecedores ── */}
      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Fornecedores"
          count={insumos.length}
          aside={
            <button
              type="button"
              className={btn("primary", "sm")}
              onClick={() => setEditing(VAZIO())}
            >
              <Plus aria-hidden />
              Adicionar
            </button>
          }
        />
        <div className={`${TABLE_WRAP} overflow-x-auto`}>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th className={TH}>Fornecedor</th>
                <th className={TH}>Insumo</th>
                <th className={TH}>Preço por quantidade</th>
                <th className={`${TH} text-right`}>Pedido mínimo</th>
                <th className={`${TH} text-right`}>Prazo</th>
                <th className={TH}>Contato</th>
                <th className={TH}>
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-lk-border divide-y">
              {insumos.map((i) => (
                <tr key={i.id} className="hover:bg-lk-paper/60">
                  <td className={TD}>
                    <p className="font-semibold">{i.fornecedor || "—"}</p>
                    {i.exemplo && <span className="text-lk-hold text-xs">exemplo</span>}
                  </td>
                  <td className={TD}>
                    <p>{i.insumo}</p>
                    <p className="text-lk-muted text-xs">
                      {i.categoria} · {USO_LABEL[i.uso]}
                      {i.uso === "lata" || i.uso === "pack" ? `: ${num(i.qtd)}` : ""}
                    </p>
                  </td>
                  <td className={TD}>
                    <ul className="flex flex-col gap-0.5 tabular-nums">
                      {[...i.faixas]
                        .sort((a, b) => a.de - b.de)
                        .map((f, k, all) => {
                          const next = all[k + 1];
                          return (
                            <li key={`${f.de}-${k}`} className="text-xs">
                              <span className="text-lk-muted">
                                {next
                                  ? `${num(f.de)} a ${num(next.de - 1)}`
                                  : f.de > 0
                                    ? `${num(f.de)} ou mais`
                                    : "qualquer quantidade"}
                                :
                              </span>{" "}
                              <span className="font-medium">{brl(f.precoCents)}</span>
                              <span className="text-lk-muted"> / {i.unidade}</span>
                            </li>
                          );
                        })}
                    </ul>
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {num(i.minimo)} <span className="text-lk-muted text-xs">{i.unidade}</span>
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{i.prazoDias} dias</td>
                  <td className={TD}>{i.contato ? <Code>{i.contato}</Code> : "—"}</td>
                  <td className={`${TD} text-right`}>
                    <button
                      type="button"
                      className={btn("ghost", "sm")}
                      onClick={() => setEditing(structuredClone(i))}
                    >
                      <Pencil aria-hidden />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <Editor
          item={editing}
          isNew={!insumos.some((i) => i.id === editing.id)}
          onCancel={() => setEditing(null)}
          onSave={saveInsumo}
          onDelete={() => removeInsumo(editing.id)}
        />
      )}
    </>
  );
}

/** Painel lateral pra editar/criar um fornecedor-insumo. */
function Editor({
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
  // Preço digitado como texto ("0,95"), convertido ao salvar.
  const [precos, setPrecos] = useState(item.faixas.map((x) => fromCents(x.precoCents)));
  const set = <K extends keyof Insumo>(k: K, v: Insumo[K]) => setF((p) => ({ ...p, [k]: v }));
  const ok = f.insumo.trim().length > 0 && f.unidade.trim().length > 0;

  const save = () => {
    const faixas = f.faixas
      .map((x, k) => ({ de: x.de, precoCents: toCents(precos[k] ?? "0") }))
      .sort((a, b) => a.de - b.de);
    onSave({ ...f, faixas: faixas.length ? faixas : [{ de: 0, precoCents: 0 }] });
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Editar fornecedor"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onCancel}
        className="absolute inset-0 bg-black/30"
      />
      <div className="border-lk-border relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l bg-white shadow-2xl">
        <div className="border-lk-border flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {isNew ? "Novo fornecedor" : "Editar fornecedor"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className={btn("ghost", "sm")}
            aria-label="Fechar"
          >
            <X aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={LABEL}>
              <span className="font-medium">Fornecedor</span>
              <input
                className={INPUT}
                value={f.fornecedor}
                onChange={(e) => set("fornecedor", e.target.value)}
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
            <label className={LABEL}>
              <span className="font-medium">O que fornece</span>
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
              <label className={LABEL}>
                <span className="font-medium">
                  {f.uso === "lata" ? "Por lata" : "Por six pack"}
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className={`${INPUT} text-right tabular-nums`}
                  value={f.qtd}
                  onChange={(e) => set("qtd", Math.max(0, Number(e.target.value) || 0))}
                />
                <span className={HINT}>em {f.unidade || "unidades"}</span>
              </label>
            )}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Preço por quantidade</legend>
            <p className={HINT}>
              Se o preço muda conforme a quantidade, coloca uma linha por faixa. A primeira vale
              desde 0.
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
                  onChange={(e) =>
                    setPrecos((p) => p.map((v, j) => (j === k ? e.target.value : v)))
                  }
                  placeholder="0,00"
                />
                <span className="text-lk-muted truncate">/ {f.unidade}</span>
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
            <label className={LABEL}>
              <span className="font-medium">Pedido mínimo</span>
              <input
                type="number"
                min={0}
                className={`${INPUT} text-right tabular-nums`}
                value={f.minimo}
                onChange={(e) => set("minimo", Math.max(0, Number(e.target.value) || 0))}
              />
              <span className={HINT}>em {f.unidade || "unidades"}</span>
            </label>
            <label className={LABEL}>
              <span className="font-medium">Prazo de entrega</span>
              <input
                type="number"
                min={0}
                className={`${INPUT} text-right tabular-nums`}
                value={f.prazoDias}
                onChange={(e) =>
                  set("prazoDias", Math.max(0, Math.round(Number(e.target.value) || 0)))
                }
              />
              <span className={HINT}>dias</span>
            </label>
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
              <span className={`${HINT} block`}>Soma no prazo depois do insumo mais demorado.</span>
            </span>
          </label>
        </div>

        <div className="border-lk-border mt-auto flex items-center justify-between gap-2 border-t px-6 py-4">
          {!isNew ? (
            <button
              type="button"
              className={`${btn("ghost", "sm")} text-lk-fail`}
              onClick={onDelete}
            >
              <Trash2 aria-hidden />
              Excluir
            </button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <button type="button" className={btn("secondary")} onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className={btn("primary")} disabled={!ok} onClick={save}>
              Salvar
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
