"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Coins, Factory, Users } from "lucide-react";
import { Badge, Code, KpiStrip, SectionTitle, TABLE_WRAP, TD, TH, Tile } from "./ui";

/**
 * Produção (RASCUNHO de layout): fornecedores num lugar só e uma calculadora
 * que diz, pra produzir N litros, quantas latas saem, quanto de cada insumo
 * pedir, quanto custa e em quanto tempo fica pronto.
 *
 * - A RECEITA (quanto fernet e quanto base de cola vai em cada lata) é da
 *   Fernandito: vem em branco e o time preenche. Fica salva só neste navegador
 *   por enquanto (depois vai pro Bling / banco).
 * - Fornecedores, preços, faixas de preço e prazos abaixo são EXEMPLO.
 * - Preço por faixa: o fornecedor cobra menos quanto mais se compra. Vale a
 *   faixa da quantidade que vai ser comprada.
 */

const LATA_ML = 350;
const LATA_L = LATA_ML / 1000;

/** Preço a partir de `de` unidades de compra (a faixa mais alta que couber vale). */
type Faixa = { de: number; precoCents: number };

type Insumo = {
  id: string;
  insumo: string;
  fornecedor: string;
  contato: string;
  unidade: string;
  /**
   * Quanto vai em 1 lata, na unidade de compra. `receita` = vem da receita
   * (fernet / base de cola, em litros, a partir dos ml por lata).
   */
  porLata: number | "receita-fernet" | "receita-cola";
  faixas: Faixa[];
  /** Pedido mínimo, na unidade de compra. */
  minimo: number;
  /** Dias entre pedir e chegar. */
  prazoDias: number;
};

const EXEMPLO: Insumo[] = [
  {
    id: "fernet",
    insumo: "Fernet",
    fornecedor: "Fornecedor A",
    contato: "(51) 0000-0000",
    unidade: "litro",
    porLata: "receita-fernet",
    faixas: [
      { de: 0, precoCents: 6000 },
      { de: 200, precoCents: 5600 },
      { de: 1000, precoCents: 5200 },
    ],
    minimo: 50,
    prazoDias: 10,
  },
  {
    id: "cola",
    insumo: "Base de cola",
    fornecedor: "Fornecedor B",
    contato: "(51) 0000-0000",
    unidade: "litro",
    porLata: "receita-cola",
    faixas: [
      { de: 0, precoCents: 450 },
      { de: 1000, precoCents: 400 },
    ],
    minimo: 200,
    prazoDias: 7,
  },
  {
    id: "lata",
    insumo: "Lata 350ml + tampa",
    fornecedor: "Fornecedor C",
    contato: "(11) 0000-0000",
    unidade: "unidade",
    porLata: 1,
    faixas: [
      { de: 0, precoCents: 95 },
      { de: 10000, precoCents: 85 },
      { de: 30000, precoCents: 78 },
    ],
    minimo: 5000,
    prazoDias: 21,
  },
  {
    id: "rotulo",
    insumo: "Arte/impressão da lata",
    fornecedor: "Fornecedor D",
    contato: "(51) 0000-0000",
    unidade: "unidade",
    porLata: 1,
    faixas: [
      { de: 0, precoCents: 18 },
      { de: 10000, precoCents: 15 },
    ],
    minimo: 5000,
    prazoDias: 15,
  },
  {
    id: "caixa",
    insumo: "Caixa six pack",
    fornecedor: "Fornecedor E",
    contato: "(51) 0000-0000",
    unidade: "caixa",
    porLata: 1 / 6,
    faixas: [
      { de: 0, precoCents: 350 },
      { de: 2000, precoCents: 300 },
    ],
    minimo: 500,
    prazoDias: 12,
  },
  {
    id: "envase",
    insumo: "Envase (terceirizado)",
    fornecedor: "Fornecedor F",
    contato: "(54) 0000-0000",
    unidade: "lata envasada",
    porLata: 1,
    faixas: [{ de: 0, precoCents: 60 }],
    minimo: 3000,
    prazoDias: 5,
  },
];

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number, max = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: max });

/** A faixa de preço que vale pra essa quantidade. */
const faixaDe = (faixas: Faixa[], qtd: number) =>
  [...faixas].sort((a, b) => b.de - a.de).find((f) => qtd >= f.de) ?? faixas[0];

const RECEITA_KEY = "fernandito:painel:receita";

const INPUT =
  "border-lk-input focus:border-lk-action focus:ring-lk-action/15 h-10 rounded-lg border bg-white px-3 text-right tabular-nums outline-none focus:ring-4";

function savedReceita(): { fernetMl: number | null; colaMl: number | null } {
  try {
    const saved = JSON.parse(localStorage.getItem(RECEITA_KEY) ?? "null");
    if (saved) return { fernetMl: saved.fernetMl ?? null, colaMl: saved.colaMl ?? null };
  } catch {
    // sem receita salva
  }
  return { fernetMl: null, colaMl: null };
}

/** Só no navegador: a receita salva vem do localStorage. */
export const Producao = dynamic(() => Promise.resolve(ProducaoTela), {
  ssr: false,
  loading: () => <div className="bg-lk-paper h-96 animate-pulse rounded-xl" />,
});

function ProducaoTela() {
  const [litros, setLitros] = useState(1750);
  // Receita: ml de cada um por lata (350 ml no total). Em branco até o time preencher.
  const [fernetMl, setFernetMl] = useState<number | null>(() => savedReceita().fernetMl);
  const [colaMl, setColaMl] = useState<number | null>(() => savedReceita().colaMl);
  useEffect(() => {
    try {
      localStorage.setItem(RECEITA_KEY, JSON.stringify({ fernetMl, colaMl }));
    } catch {
      // navegador sem armazenamento: só não lembra
    }
  }, [fernetMl, colaMl]);

  const latas = Math.floor((litros * 1000) / LATA_ML);
  const receitaOk = fernetMl !== null && colaMl !== null;
  const receitaMl = (fernetMl ?? 0) + (colaMl ?? 0);
  const outrosMl = LATA_ML - receitaMl;

  const plan = useMemo(
    () =>
      EXEMPLO.map((i) => {
        const por =
          i.porLata === "receita-fernet"
            ? fernetMl === null
              ? null
              : fernetMl / 1000
            : i.porLata === "receita-cola"
              ? colaMl === null
                ? null
                : colaMl / 1000
              : i.porLata;
        if (por === null) return { ...i, precisa: null, comprar: null, faixa: null, custo: null };
        const precisa = por * latas;
        // Pedido mínimo do fornecedor: compra pelo menos isso. Só líquido em fração.
        const comprar = Math.max(i.unidade === "litro" ? precisa : Math.ceil(precisa), i.minimo);
        const faixa = faixaDe(i.faixas, comprar);
        return { ...i, precisa, comprar, faixa, custo: Math.round(comprar * faixa.precoCents) };
      }),
    [latas, fernetMl, colaMl],
  );
  const custo = plan.reduce((n, i) => n + (i.custo ?? 0), 0);
  const porLata = latas > 0 && receitaOk ? Math.round(custo / latas) : null;
  // Insumos chegam em paralelo; o envase só começa quando o último chegar.
  const envase = EXEMPLO.find((i) => i.id === "envase")!;
  const espera = Math.max(...EXEMPLO.filter((i) => i.id !== "envase").map((i) => i.prazoDias));
  const prazo = espera + envase.prazoDias;
  const gargalo = EXEMPLO.filter((i) => i.id !== "envase").reduce((a, b) =>
    b.prazoDias > a.prazoDias ? b : a,
  );

  const mlField = (label: string, value: number | null, set: (v: number | null) => void) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={LATA_ML}
          step={1}
          inputMode="decimal"
          placeholder="—"
          value={value ?? ""}
          onChange={(e) => set(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
          className={`${INPUT} w-28`}
        />
        <span className="text-lk-muted">ml por lata</span>
      </span>
      {value !== null && (
        <span className="text-lk-ink3 text-xs">{num((value / LATA_ML) * 100)}% da lata</span>
      )}
    </label>
  );

  return (
    <>
      <div className="border-lk-hold/25 bg-lk-hold-bg text-lk-hold rounded-xl border px-5 py-3 text-sm">
        <span className="font-semibold">Rascunho.</span> Fornecedores, preços, faixas e prazos são
        de exemplo. A receita vocês preenchem (fica salva neste navegador).
      </div>

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
          note={`Gargalo: ${gargalo.insumo} (${gargalo.prazoDias} dias)`}
        />
        <Tile
          icon={Users}
          label="Fornecedores"
          value={EXEMPLO.length}
          note="Cadastrados (exemplo)"
        />
      </KpiStrip>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Receita" />
        <div className={`${TABLE_WRAP} flex flex-wrap items-start gap-x-10 gap-y-5 p-5`}>
          {mlField("Fernet", fernetMl, setFernetMl)}
          {mlField("Base de cola", colaMl, setColaMl)}
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Lata</span>
            <span className="text-lk-muted flex h-10 items-center">{LATA_ML} ml</span>
            {receitaOk && (
              <span className={`text-xs ${outrosMl < 0 ? "text-lk-fail" : "text-lk-ink3"}`}>
                {outrosMl < 0
                  ? `Passou ${num(-outrosMl)} ml da lata`
                  : outrosMl > 0
                    ? `Sobram ${num(outrosMl)} ml (água, gás, outros)`
                    : "Fecha os 350 ml"}
              </span>
            )}
          </div>
        </div>
      </section>

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
              className={`${INPUT} w-36`}
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
                {plan.map((i) => (
                  <tr key={i.id}>
                    <td className={TD}>
                      <p className="font-semibold">{i.insumo}</p>
                      <p className="text-lk-muted text-xs">{i.fornecedor}</p>
                    </td>
                    {i.precisa === null ? (
                      <td className={`${TD} text-lk-hold text-right`} colSpan={4}>
                        Preencher a receita acima
                      </td>
                    ) : (
                      <>
                        <td className={`${TD} text-right tabular-nums`}>
                          {num(i.precisa)} {i.unidade}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {num(i.comprar!)}
                          {i.minimo > i.precisa && (
                            <p className="text-lk-hold text-xs">mínimo do fornecedor</p>
                          )}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {brl(i.faixa!.precoCents)}
                          <p className="text-lk-muted text-xs">
                            {i.faixa!.de > 0 ? `a partir de ${num(i.faixa!.de)}` : "faixa base"}
                          </p>
                        </td>
                        <td className={`${TD} text-right font-medium tabular-nums`}>
                          {brl(i.custo!)}
                        </td>
                      </>
                    )}
                    <td className={`${TD} text-right tabular-nums`}>
                      {i.id === gargalo.id ? (
                        <Badge tone="hold">{i.prazoDias} dias · gargalo</Badge>
                      ) : (
                        `${i.prazoDias} dias`
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
          <p className="text-lk-ink3 text-xs">
            Latas = litros ÷ 0,35. Comprar = o que precisa, ou o pedido mínimo do fornecedor se for
            maior. Preço = a faixa da quantidade comprada. Prazo = o insumo que mais demora a chegar
            + o envase.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Fornecedores" count={EXEMPLO.length} />
        <div className={`${TABLE_WRAP} overflow-x-auto`}>
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr>
                <th className={TH}>Fornecedor</th>
                <th className={TH}>Insumo</th>
                <th className={TH}>Preço por quantidade</th>
                <th className={`${TH} text-right`}>Pedido mínimo</th>
                <th className={`${TH} text-right`}>Prazo</th>
                <th className={TH}>Contato</th>
              </tr>
            </thead>
            <tbody className="divide-lk-border divide-y">
              {EXEMPLO.map((i) => (
                <tr key={i.id} className="hover:bg-lk-paper/60">
                  <td className={`${TD} font-semibold`}>{i.fornecedor}</td>
                  <td className={TD}>{i.insumo}</td>
                  <td className={TD}>
                    <ul className="flex flex-col gap-0.5 tabular-nums">
                      {i.faixas.map((f, k) => {
                        const next = i.faixas[k + 1];
                        return (
                          <li key={f.de} className="text-xs">
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
                  <td className={TD}>
                    <Code>{i.contato}</Code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
