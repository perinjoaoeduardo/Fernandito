"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Coins, Factory, Users } from "lucide-react";
import { Badge, Code, KpiStrip, SectionTitle, TABLE_WRAP, TD, TH, Tile } from "./ui";

/**
 * Produção (RASCUNHO de layout): fornecedores num lugar só e uma calculadora
 * que diz, pra produzir N latas, quanto de cada insumo pedir, quanto custa e
 * em quanto tempo fica pronto. Os números aqui são EXEMPLO: o time vai trocar
 * pelos reais (e depois isso vira cadastro salvo no banco).
 */

type Insumo = {
  id: string;
  insumo: string;
  fornecedor: string;
  contato: string;
  /** Quanto vai em 1 lata, na unidade de compra. */
  porLata: number;
  unidade: string;
  /** Preço por unidade de compra, em centavos. */
  precoCents: number;
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
    porLata: 0.07,
    unidade: "litro",
    precoCents: 6000,
    minimo: 50,
    prazoDias: 10,
  },
  {
    id: "cola",
    insumo: "Base de cola",
    fornecedor: "Fornecedor B",
    contato: "(51) 0000-0000",
    porLata: 0.28,
    unidade: "litro",
    precoCents: 450,
    minimo: 200,
    prazoDias: 7,
  },
  {
    id: "lata",
    insumo: "Lata 350ml + tampa",
    fornecedor: "Fornecedor C",
    contato: "(11) 0000-0000",
    porLata: 1,
    unidade: "unidade",
    precoCents: 95,
    minimo: 5000,
    prazoDias: 21,
  },
  {
    id: "rotulo",
    insumo: "Arte/impressão da lata",
    fornecedor: "Fornecedor D",
    contato: "(51) 0000-0000",
    porLata: 1,
    unidade: "unidade",
    precoCents: 18,
    minimo: 5000,
    prazoDias: 15,
  },
  {
    id: "caixa",
    insumo: "Caixa six pack",
    fornecedor: "Fornecedor E",
    contato: "(51) 0000-0000",
    porLata: 1 / 6,
    unidade: "caixa",
    precoCents: 350,
    minimo: 500,
    prazoDias: 12,
  },
  {
    id: "envase",
    insumo: "Envase (terceirizado)",
    fornecedor: "Fornecedor F",
    contato: "(54) 0000-0000",
    porLata: 1,
    unidade: "lata envasada",
    precoCents: 60,
    minimo: 3000,
    prazoDias: 5,
  },
];

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number, max = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: max });

export function Producao() {
  const [latas, setLatas] = useState(5000);
  const plan = useMemo(
    () =>
      EXEMPLO.map((i) => {
        const precisa = i.porLata * latas;
        // Pedido mínimo do fornecedor: compra pelo menos isso.
        const comprar = Math.max(i.unidade === "litro" ? precisa : Math.ceil(precisa), i.minimo);
        return { ...i, precisa, comprar, custo: Math.round(comprar * i.precoCents) };
      }),
    [latas],
  );
  const custo = plan.reduce((n, i) => n + i.custo, 0);
  const porLata = latas > 0 ? Math.round(custo / latas) : 0;
  // Insumos chegam em paralelo; o envase só começa quando o último chegar.
  const envase = EXEMPLO.find((i) => i.id === "envase")!;
  const espera = Math.max(...EXEMPLO.filter((i) => i.id !== "envase").map((i) => i.prazoDias));
  const prazo = espera + envase.prazoDias;
  const gargalo = plan
    .filter((i) => i.id !== "envase")
    .reduce((a, b) => (b.prazoDias > a.prazoDias ? b : a));
  const litros = latas * 0.35;

  return (
    <>
      <div className="border-lk-hold/25 bg-lk-hold-bg text-lk-hold rounded-xl border px-5 py-3 text-sm">
        <span className="font-semibold">Rascunho.</span> Layout pro time pensar a área de produção.
        Fornecedores e números abaixo são de exemplo, não são reais.
      </div>

      <KpiStrip cols={4}>
        <Tile
          icon={Users}
          label="Fornecedores"
          value={EXEMPLO.length}
          note="Cadastrados (exemplo)"
        />
        <Tile
          icon={Coins}
          label="Custo por lata"
          value={brl(porLata)}
          note={`Pra ${num(latas, 0)} latas`}
        />
        <Tile
          icon={CalendarClock}
          label="Prazo até pronto"
          value={`${prazo} dias`}
          tone="hold"
          note={`Gargalo: ${gargalo.insumo} (${gargalo.prazoDias} dias)`}
        />
        <Tile
          icon={Factory}
          label="Volume"
          value={`${num(litros, 0)} L`}
          note={`${num(latas / 6, 0)} six packs`}
        />
      </KpiStrip>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Calculadora de produção" />
        <div className={`${TABLE_WRAP} flex flex-col gap-5 p-5`}>
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">Quantas latas produzir?</span>
            <input
              type="number"
              min={0}
              step={100}
              value={latas}
              onChange={(e) => setLatas(Math.max(0, Number(e.target.value) || 0))}
              className="border-lk-input focus:border-lk-action focus:ring-lk-action/15 h-10 w-36 rounded-lg border bg-white px-3 text-right tabular-nums outline-none focus:ring-4"
            />
            <span className="text-lk-muted">
              = {num(litros, 0)} litros · {num(latas / 6, 0)} six packs
            </span>
            <span className="ml-auto flex gap-1.5">
              {[1000, 5000, 10000].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLatas(n)}
                  className={`h-8 rounded-md px-3 text-[13px] ${latas === n ? "bg-lk-ink text-white" : "bg-lk-soft text-lk-muted hover:text-lk-ink"}`}
                >
                  {num(n, 0)}
                </button>
              ))}
            </span>
          </label>

          <div className="border-lk-border -mx-5 overflow-x-auto border-t">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr>
                  <th className={TH}>Insumo</th>
                  <th className={`${TH} text-right`}>Precisa</th>
                  <th className={`${TH} text-right`}>Comprar</th>
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
                    <td className={`${TD} text-right tabular-nums`}>
                      {num(i.precisa)} {i.unidade}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {num(i.comprar)}
                      {i.comprar > i.precisa && (
                        <p className="text-lk-hold text-xs">mínimo do fornecedor</p>
                      )}
                    </td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{brl(i.custo)}</td>
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
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{brl(custo)}</td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{prazo} dias</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-lk-ink3 text-xs">
            Prazo = o insumo que mais demora a chegar + o envase. Comprar = o que precisa, ou o
            pedido mínimo do fornecedor se for maior.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Fornecedores" count={EXEMPLO.length} />
        <div className={`${TABLE_WRAP} overflow-x-auto`}>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <th className={TH}>Fornecedor</th>
                <th className={TH}>Insumo</th>
                <th className={`${TH} text-right`}>Preço</th>
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
                  <td className={`${TD} text-right tabular-nums`}>
                    {brl(i.precoCents)} <span className="text-lk-muted text-xs">/ {i.unidade}</span>
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
