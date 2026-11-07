"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CircleCheck,
  ClipboardList,
  Factory,
  Gauge,
  Pencil,
  Coins,
  ShoppingCart,
  Timer,
  Trash2,
  Truck,
  Undo2,
} from "lucide-react";
import {
  COMPLETO_MIN,
  VALIDADE_MESES,
  diasEntre,
  estoqueAoCancelar,
  estoqueAoConcluir,
  indicadores,
  loteAberto,
  situacaoItem,
  somarDias,
  somarMeses,
  totaisLote,
  trocarFornecedor,
  type Etapa,
  type Lote,
  type LoteItem,
  type ProducaoData,
} from "@/lib/producao";
import { Drawer, HINT, INPUT, LABEL, MINI, brl, dia, num, pct } from "./producao-ui";
import {
  Badge,
  Empty,
  KpiStrip,
  SectionTitle,
  TABLE_WRAP,
  TD,
  TH,
  Tile,
  btn,
  type Tone,
} from "./ui";

/**
 * Lotes de produção: cada lote congela o plano (quanto, de quem, quanto
 * custa, quando fica pronto) e registra o que aconteceu (pedidos, chegadas,
 * envase, latas boas, custo pago). Dos concluídos saem os indicadores:
 * rendimento, perda real, custo real × planejado, lotes no prazo e a
 * pontualidade dos fornecedores.
 */

const ETAPA: Record<Etapa, { label: string; tone: Tone; icon: LucideIcon }> = {
  planejado: { label: "Planejado", tone: "muted", icon: ClipboardList },
  pedido: { label: "Insumos pedidos", tone: "running", icon: Truck },
  envasando: { label: "Envasando", tone: "action", icon: Factory },
  concluido: { label: "Concluído", tone: "pass", icon: CircleCheck },
  cancelado: { label: "Cancelado", tone: "muted", icon: Ban },
};

/** "dd/mm/aaaa" curto pra validade. */
const diaAno = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const sinal = (n: number) => (n > 0 ? `+${pct(n * 100)}` : pct(n * 100));

type Change = (next: ProducaoData, soon?: boolean) => void;

/** Topo da aba: os indicadores dos lotes. */
export function LotesKpis({ data, hoje }: { data: ProducaoData; hoje: string }) {
  const ind = indicadores(data.lotes);
  const abertos = data.lotes.filter(loteAberto);
  const prox = proximoMarco(abertos, hoje);
  const u = ind.ultimo;
  const varPct =
    u && u.t.lataReal !== null && u.t.lataPlan
      ? (u.t.lataReal - u.t.lataPlan) / u.t.lataPlan
      : null;
  const semDado = "Aparece com o 1º lote concluído";
  return (
    <KpiStrip cols={4}>
      <Tile
        icon={Factory}
        label="Lotes em andamento"
        value={abertos.length}
        note={prox ?? "Nenhum lote aberto"}
      />
      <Tile
        icon={Gauge}
        label="Rendimento"
        value={ind.rendimento === null ? "—" : pct(ind.rendimento * 100)}
        note={
          ind.perdaReal === null
            ? semDado
            : `Perda real ${pct(ind.perdaReal * 100)} · plano ${pct((ind.perdaPlan ?? 0) * 100)}`
        }
      />
      <Tile
        icon={Coins}
        label="Custo real por lata"
        value={u?.t.lataReal ? brl(u.t.lataReal) : "—"}
        tone={varPct !== null && varPct > 0.02 ? "fail" : "action"}
        note={
          u && u.t.lataPlan !== null && varPct !== null
            ? `${u.l.codigo}: plano ${brl(u.t.lataPlan)} (${sinal(varPct)})`
            : semDado
        }
      />
      <Tile
        icon={Timer}
        label="Lotes no prazo"
        value={ind.otifPct === null ? "—" : pct(ind.otifPct * 100)}
        tone={ind.otifPct !== null && ind.otifPct < 0.9 ? "hold" : "action"}
        note={
          ind.feitos.length ? `${ind.otif} de ${ind.feitos.length} no prazo e completos` : semDado
        }
      />
    </KpiStrip>
  );
}

/** A próxima coisa que vai acontecer nos lotes abertos. */
function proximoMarco(abertos: Lote[], hoje: string) {
  const l = [...abertos].sort((a, b) =>
    totaisLote(a, hoje).meta.localeCompare(totaisLote(b, hoje).meta),
  )[0];
  if (!l) return null;
  if (l.etapa === "planejado") return `${l.codigo}: fazer os pedidos`;
  if (l.etapa === "envasando") return `${l.codigo}: envasando`;
  const pend = l.itens
    .filter((it) => !it.depois && it.comprar > 0 && !it.chegouEm && it.previstoEm)
    .sort((a, b) => a.previstoEm!.localeCompare(b.previstoEm!))[0];
  if (!pend) return `${l.codigo}: insumos chegaram, começar envase`;
  return pend.previstoEm! < hoje
    ? `${l.codigo}: ${pend.insumo} atrasado`
    : `${l.codigo}: ${pend.insumo} chega ${dia(pend.previstoEm!)}`;
}

/** Lotes abertos (cartões) e o histórico (tabela). */
export function Lotes({
  data,
  hoje,
  onChange,
}: {
  data: ProducaoData;
  hoje: string;
  onChange: Change;
}) {
  const [editando, setEditando] = useState<Lote | null>(null);
  const abertos = data.lotes
    .filter(loteAberto)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  const fechados = data.lotes
    .filter((l) => !loteAberto(l))
    .sort((a, b) => b.codigo.localeCompare(a.codigo, undefined, { numeric: true }));

  const setLote = (l: Lote, soon = false, insumos = data.insumos) =>
    onChange({ ...data, insumos, lotes: data.lotes.map((x) => (x.id === l.id ? l : x)) }, soon);
  const excluir = (l: Lote) => {
    if (!window.confirm(`Excluir o ${l.codigo}? Ele ainda não tem pedido feito.`)) return;
    onChange({ ...data, lotes: data.lotes.filter((x) => x.id !== l.id) });
  };

  return (
    <>
      <section id="lotes" className="flex scroll-mt-6 flex-col gap-4">
        <SectionTitle title="Lotes em andamento" count={abertos.length} />
        {abertos.length === 0 ? (
          <Empty>Nenhum lote aberto. Planeja um abaixo e clica em “Criar lote”.</Empty>
        ) : (
          abertos.map((l) => (
            <LoteCard
              key={l.id}
              l={l}
              data={data}
              hoje={hoje}
              setLote={setLote}
              onExcluir={() => excluir(l)}
            />
          ))
        )}
      </section>

      {fechados.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="Lotes concluídos" count={fechados.length} />
          <Historico lotes={fechados} hoje={hoje} onEdit={(l) => setEditando(structuredClone(l))} />
          <p className={HINT}>
            Rendimento = latas boas ÷ latas boas planejadas. Perda = latas envasadas que não saíram
            boas. Custo real = o que foi pago ÷ o que chegou, nas quantidades que o lote usou, por
            lata boa. No prazo = envasado até a data de produção e com pelo menos{" "}
            {pct(COMPLETO_MIN * 100)} das latas boas.
          </p>
        </section>
      )}

      {editando && (
        <ConcluidoEditor
          l={editando}
          onCancel={() => setEditando(null)}
          onSave={(l) => {
            setLote(l);
            setEditando(null);
          }}
        />
      )}
    </>
  );
}

function LoteCard({
  l,
  data,
  hoje,
  setLote,
  onExcluir,
}: {
  l: Lote;
  data: ProducaoData;
  hoje: string;
  setLote: (l: Lote, soon?: boolean, insumos?: ProducaoData["insumos"]) => void;
  onExcluir: () => void;
}) {
  const t = totaisLote(l, hoje);
  const e = ETAPA[l.etapa];
  const setItem = (k: number, patch: Partial<LoteItem>, soon = true) =>
    setLote({ ...l, itens: l.itens.map((it, j) => (j === k ? { ...it, ...patch } : it)) }, soon);

  const pedir = () => {
    const insumosProntos = l.itens
      .filter((it) => !it.depois && it.comprar > 0)
      .reduce((a, it) => {
        const d = somarDias(hoje, it.prazoDias);
        return d > a ? d : a;
      }, hoje);
    setLote({
      ...l,
      etapa: "pedido",
      itens: l.itens.map((it) =>
        it.comprar <= 0 && !it.depois
          ? it
          : {
              ...it,
              pedidoEm: it.pedidoEm ?? hoje,
              // Serviço (envase): termina o prazo dele depois que os insumos chegam.
              previstoEm:
                it.previstoEm ??
                (it.depois
                  ? somarDias(insumosProntos, it.prazoDias)
                  : somarDias(it.pedidoEm ?? hoje, it.prazoDias)),
            },
      ),
    });
  };
  const envasar = () => {
    const faltam = l.itens.filter((it) => !it.depois && it.comprar > 0 && !it.chegouEm);
    if (
      faltam.length &&
      !window.confirm(
        `Ainda sem chegada marcada: ${faltam.map((it) => it.insumo).join(", ")}. Começar o envase mesmo assim?`,
      )
    )
      return;
    setLote({ ...l, etapa: "envasando", envaseEm: l.envaseEm ?? hoje });
  };
  const concluir = () => {
    if (l.latasBoas === null) return;
    const envase = l.envaseEm ?? hoje;
    const validade = somarMeses(envase, VALIDADE_MESES);
    if (
      !window.confirm(
        `Concluir o ${l.codigo} com ${num(l.latasBoas, 0)} latas boas?\n\n` +
          `• Validade: ${diaAno(validade)} (envase + ${VALIDADE_MESES} meses)\n` +
          `• O estoque dos insumos é atualizado: sai o que o lote usou, entra o que sobrou da compra.`,
      )
    )
      return;
    const fechado: Lote = {
      ...l,
      etapa: "concluido",
      envaseEm: envase,
      prontoEm: l.prontoEm ?? hoje,
      validade,
      itens: l.itens.map((it) =>
        it.comprar > 0 || it.depois
          ? { ...it, chegouEm: it.chegouEm ?? (it.depois ? (l.prontoEm ?? hoje) : null) }
          : it,
      ),
    };
    setLote(fechado, false, estoqueAoConcluir(data.insumos, fechado));
  };
  const cancelar = () => {
    if (
      !window.confirm(
        `Cancelar o ${l.codigo}? O que já chegou entra no estoque dos insumos e a reserva é liberada.`,
      )
    )
      return;
    setLote({ ...l, etapa: "cancelado" }, false, estoqueAoCancelar(data.insumos, l));
  };
  const voltar = () => setLote({ ...l, etapa: l.etapa === "envasando" ? "pedido" : "planejado" });

  return (
    <div className={TABLE_WRAP}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-lk-mono text-lg font-medium">{l.codigo}</span>
            <Badge tone={e.tone} icon={e.icon}>
              {e.label}
            </Badge>
            {t.atraso > 0 ? (
              <Badge tone="fail">
                Produção {t.atraso} {t.atraso === 1 ? "dia" : "dias"} depois da data
              </Badge>
            ) : (
              <Badge tone="pass">Produção na data</Badge>
            )}
          </p>
          <p className="text-lk-muted text-xs">
            {num(l.plano.litros, 0)} L · {num(l.envasadas, 0)} envasadas · {num(l.boas, 0)} latas
            boas · {num(l.packs, 0)} six packs · criado {dia(l.criadoEm)}
          </p>
          <p className="text-lk-ink3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            Data de produção:
            {l.etapa === "planejado" ? (
              <input
                type="date"
                className={MINI}
                value={l.plano.prontoAte ?? ""}
                min={hoje}
                onChange={(ev) =>
                  setLote({ ...l, plano: { ...l.plano, prontoAte: ev.target.value || null } }, true)
                }
              />
            ) : (
              <span className="text-lk-ink font-medium">{dia(t.meta)}</span>
            )}
            {!l.plano.prontoAte && l.etapa === "planejado" && (
              <span>(sem data: vale {dia(t.meta)}, o mais cedo possível)</span>
            )}
            <span>
              · produção prevista{" "}
              <span className="text-lk-ink font-medium">{dia(t.producaoPrevista)}</span>
            </span>
            <span>· pronto {dia(t.prontoPrevisto)}</span>
            <span>· custo planejado {t.lataPlan === null ? "—" : `${brl(t.lataPlan)}/lata`}</span>
            <span>· compra {brl(t.desembolso)}</span>
          </p>
        </div>
        <span className="flex flex-wrap gap-2">
          {l.etapa === "planejado" && (
            <>
              <button
                type="button"
                className={`${btn("ghost", "sm")} text-lk-fail`}
                onClick={onExcluir}
              >
                <Trash2 aria-hidden />
                Excluir
              </button>
              <button type="button" className={btn("primary", "sm")} onClick={pedir}>
                <ShoppingCart aria-hidden />
                Pedidos feitos
              </button>
            </>
          )}
          {(l.etapa === "pedido" || l.etapa === "envasando") && (
            <>
              <button
                type="button"
                className={`${btn("ghost", "sm")} text-lk-fail`}
                onClick={cancelar}
              >
                <Ban aria-hidden />
                Cancelar lote
              </button>
              <button type="button" className={btn("secondary", "sm")} onClick={voltar}>
                <Undo2 aria-hidden />
                Voltar etapa
              </button>
            </>
          )}
          {l.etapa === "pedido" && (
            <button type="button" className={btn("primary", "sm")} onClick={envasar}>
              <Factory aria-hidden />
              Começar envase
            </button>
          )}
          {l.etapa === "envasando" && (
            <button
              type="button"
              className={btn("primary", "sm")}
              disabled={l.latasBoas === null}
              title={l.latasBoas === null ? "Preenche as latas boas primeiro" : undefined}
              onClick={concluir}
            >
              <CircleCheck aria-hidden />
              Concluir lote
            </button>
          )}
        </span>
      </div>

      <div className="border-lk-border overflow-x-auto border-t">
        {l.etapa === "planejado" ? (
          <TabelaPlanejado l={l} data={data} hoje={hoje} meta={t.meta} setLote={setLote} />
        ) : (
          <TabelaPedidos l={l} hoje={hoje} setItem={setItem} />
        )}
      </div>

      {l.etapa === "envasando" && (
        <div className="border-lk-border bg-lk-paper/60 flex flex-wrap items-end gap-x-6 gap-y-4 border-t px-5 py-4">
          <label className={LABEL}>
            <span className="font-medium">Envase em</span>
            <input
              type="date"
              className={`${INPUT} w-44`}
              value={l.envaseEm ?? ""}
              onChange={(ev) => setLote({ ...l, envaseEm: ev.target.value || null }, true)}
            />
          </label>
          <label className={LABEL}>
            <span className="font-medium">Latas boas</span>
            <input
              type="number"
              min={0}
              placeholder={`plano: ${num(l.boas, 0)}`}
              className={`${INPUT} w-40 text-right tabular-nums`}
              value={l.latasBoas ?? ""}
              onChange={(ev) =>
                setLote(
                  {
                    ...l,
                    latasBoas:
                      ev.target.value === ""
                        ? null
                        : Math.max(0, Math.round(Number(ev.target.value))),
                  },
                  true,
                )
              }
            />
          </label>
          <label className={LABEL}>
            <span className="font-medium">Six packs montados</span>
            <input
              type="number"
              min={0}
              placeholder={`plano: ${num(l.packs, 0)}`}
              className={`${INPUT} w-40 text-right tabular-nums`}
              value={l.sixPacksMontados ?? ""}
              onChange={(ev) =>
                setLote(
                  {
                    ...l,
                    sixPacksMontados:
                      ev.target.value === ""
                        ? null
                        : Math.max(0, Math.round(Number(ev.target.value))),
                  },
                  true,
                )
              }
            />
          </label>
          <label className={`${LABEL} min-w-60 flex-1`}>
            <span className="font-medium">Observações</span>
            <input
              className={INPUT}
              value={l.obs}
              maxLength={500}
              onChange={(ev) => setLote({ ...l, obs: ev.target.value }, true)}
              placeholder="Problema na linha, troca de tampa, amostras…"
            />
          </label>
        </div>
      )}
    </div>
  );
}

/** Lote planejado: ainda dá pra trocar o fornecedor de cada insumo. */
function TabelaPlanejado({
  l,
  data,
  hoje,
  meta,
  setLote,
}: {
  l: Lote;
  data: ProducaoData;
  hoje: string;
  meta: string;
  setLote: (l: Lote, soon?: boolean) => void;
}) {
  return (
    <table className="w-full min-w-[960px] text-sm">
      <thead>
        <tr>
          <th className={TH}>Insumo</th>
          <th className={TH}>Fornecedor</th>
          <th className={`${TH} text-right`}>Precisa</th>
          <th className={`${TH} text-right`}>Do estoque</th>
          <th className={`${TH} text-right`}>Comprar</th>
          <th className={`${TH} text-right`}>Desembolso</th>
          <th className={`${TH} text-right`}>Prazo</th>
          <th className={`${TH} text-right`}>Pedir até</th>
        </tr>
      </thead>
      <tbody className="divide-lk-border divide-y">
        {l.itens.map((it, k) => {
          const insumo = data.insumos.find((i) => i.id === it.insumoId);
          const compra = it.comprar > 0 || it.depois;
          const ate = !compra ? null : it.depois ? meta : somarDias(meta, -it.prazoDias);
          const passou = ate !== null && ate < hoje;
          return (
            <tr key={it.insumoId}>
              <td className={`${TD} font-semibold`}>{it.insumo}</td>
              <td className={TD}>
                {insumo && insumo.fornecedores.length > 1 ? (
                  <select
                    className={`${MINI} max-w-56`}
                    value={it.fornecedorId ?? ""}
                    onChange={(ev) => {
                      const f = insumo.fornecedores.find((x) => x.id === ev.target.value);
                      if (!f) return;
                      setLote({
                        ...l,
                        itens: l.itens.map((x, j) => (j === k ? trocarFornecedor(x, f) : x)),
                      });
                    }}
                  >
                    {insumo.fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome || "Sem nome"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-lk-muted">{it.fornecedor || "Sem fornecedor"}</span>
                )}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {num(it.precisa)} <span className="text-lk-muted text-xs">{it.unidade}</span>
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {it.doEstoque > 0 ? num(it.doEstoque) : "—"}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {it.comprar > 0 ? num(it.comprar) : <span className="text-lk-pass">nada</span>}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {it.desembolsoCents > 0 ? brl(it.desembolsoCents) : "—"}
              </td>
              <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
                {compra ? `${it.prazoDias} dias` : "—"}
              </td>
              <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
                {ate === null ? (
                  <span className="text-lk-muted">—</span>
                ) : passou ? (
                  <Badge tone="fail">{dia(ate)} · passou</Badge>
                ) : (
                  dia(ate)
                )}
                {it.depois && ate !== null && (
                  <p className="text-lk-muted text-xs">dia do envase</p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const SIT: Record<string, { tone: Tone; text: (d: number) => string }> = {
  chegou: { tone: "pass", text: (d) => (d > 0 ? `Chegou ${d} d atrasado` : "Chegou no prazo") },
  "no-prazo": { tone: "running", text: () => "Aguardando" },
  atrasado: { tone: "fail", text: (d) => `Atrasado ${d} d` },
  "a-pedir": { tone: "hold", text: () => "Sem pedido" },
  estoque: { tone: "muted", text: () => "Do estoque" },
};

/** Lote em andamento: datas de pedido e chegada, quanto chegou e quanto pagou. */
function TabelaPedidos({
  l,
  hoje,
  setItem,
}: {
  l: Lote;
  hoje: string;
  setItem: (k: number, patch: Partial<LoteItem>, soon?: boolean) => void;
}) {
  const CELL = `${TD} px-2!`;
  const date = (k: number, key: "pedidoEm" | "previstoEm" | "chegouEm", v: string | null) => (
    <input
      type="date"
      aria-label={key}
      className={`${MINI} w-full min-w-0`}
      value={v ?? ""}
      onChange={(ev) => {
        const d = ev.target.value || null;
        const it = l.itens[k];
        // Mudou o dia do pedido: a data prometida acompanha (prazo do fornecedor).
        setItem(
          k,
          key === "pedidoEm" && d
            ? { pedidoEm: d, previstoEm: somarDias(d, it.prazoDias) }
            : { [key]: d },
        );
      }}
    />
  );
  return (
    <table className="w-full min-w-[1000px] table-fixed text-sm">
      <thead>
        <tr>
          <th className={`${TH} w-[17%]`}>Insumo</th>
          <th className={`${TH} w-[10%] text-right`}>Comprar</th>
          <th className={`${TH} w-[15%] px-2!`}>Pedido em</th>
          <th className={`${TH} w-[15%] px-2!`}>Prometido p/</th>
          <th className={`${TH} w-[15%] px-2!`}>Chegou em</th>
          <th className={`${TH} w-[13%] px-2!`}>Recebido · pago R$</th>
          <th className={`${TH} w-[15%]`}>Situação</th>
        </tr>
      </thead>
      <tbody className="divide-lk-border divide-y">
        {l.itens.map((it, k) => {
          const sit = situacaoItem(it, hoje);
          const s = SIT[sit.s];
          if (sit.s === "estoque")
            return (
              <tr key={it.insumoId}>
                <td className={TD}>
                  <p className="font-semibold">{it.insumo}</p>
                </td>
                <td className={`${TD} text-lk-muted`} colSpan={5}>
                  {num(it.precisa)} {it.unidade} saem do estoque
                </td>
                <td className={TD}>
                  <Badge tone={s.tone}>{s.text(sit.dias)}</Badge>
                </td>
              </tr>
            );
          return (
            <tr key={it.insumoId}>
              <td className={TD}>
                <p className="font-semibold">{it.insumo}</p>
                <p className="text-lk-muted text-xs">
                  {it.fornecedor || "Sem fornecedor"} · {it.prazoDias} d
                </p>
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {num(it.comprar)}
                <p className="text-lk-muted text-xs">{it.unidade}</p>
                <p className="text-lk-muted text-xs">{brl(it.desembolsoCents)}</p>
              </td>
              <td className={CELL}>{date(k, "pedidoEm", it.pedidoEm)}</td>
              <td className={CELL}>{date(k, "previstoEm", it.previstoEm)}</td>
              <td className={CELL}>
                {date(k, "chegouEm", it.chegouEm)}
                {!it.chegouEm && (
                  <button
                    type="button"
                    className="text-lk-action-strong mt-1 block text-xs hover:underline"
                    onClick={() =>
                      setItem(k, { chegouEm: hoje, recebido: it.recebido ?? it.comprar }, false)
                    }
                  >
                    {it.depois ? "Feito hoje" : "Chegou hoje"}
                  </button>
                )}
              </td>
              <td className={`${CELL} space-y-1`}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={`${it.insumo}: quantidade recebida`}
                  title="Quantidade recebida"
                  placeholder={num(it.comprar)}
                  className={`${MINI} w-full min-w-0 text-right`}
                  value={it.recebido ?? ""}
                  onChange={(ev) =>
                    setItem(k, {
                      recebido:
                        ev.target.value === "" ? null : Math.max(0, Number(ev.target.value)),
                    })
                  }
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label={`${it.insumo}: valor pago em reais`}
                  title="Valor pago (R$), com frete"
                  placeholder={`R$ ${(it.desembolsoCents / 100).toFixed(2)}`}
                  className={`${MINI} w-full min-w-0 text-right`}
                  value={it.pagoCents === null ? "" : it.pagoCents / 100}
                  onChange={(ev) =>
                    setItem(k, {
                      pagoCents:
                        ev.target.value === ""
                          ? null
                          : Math.max(0, Math.round(Number(ev.target.value) * 100)),
                    })
                  }
                />
              </td>
              <td className={TD}>
                <Badge tone={s.tone}>{s.text(sit.dias)}</Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Tabela dos lotes concluídos/cancelados: planejado × real. */
function Historico({
  lotes,
  hoje,
  onEdit,
}: {
  lotes: Lote[];
  hoje: string;
  onEdit: (l: Lote) => void;
}) {
  return (
    <div className={`${TABLE_WRAP} overflow-x-auto`}>
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr>
            <th className={TH}>Lote</th>
            <th className={TH}>Envase · validade</th>
            <th className={`${TH} text-right`}>Latas boas</th>
            <th className={`${TH} text-right`}>Perda</th>
            <th className={`${TH} text-right`}>Custo por lata</th>
            <th className={TH}>Prazo</th>
            <th className={`${TH} text-right`}>Durou</th>
            <th className={TH}>
              <span className="sr-only">Editar</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-lk-border divide-y">
          {lotes.map((l) => {
            const t = totaisLote(l, hoje);
            const e = ETAPA[l.etapa];
            if (l.etapa === "cancelado")
              return (
                <tr key={l.id} className="opacity-60">
                  <td className={TD}>
                    <span className="font-lk-mono font-medium">{l.codigo}</span>
                  </td>
                  <td className={TD} colSpan={7}>
                    <Badge tone={e.tone} icon={e.icon}>
                      {e.label}
                    </Badge>
                    <span className="text-lk-muted ml-2 text-xs">
                      {num(l.plano.litros, 0)} L planejados em {dia(l.criadoEm)}
                    </span>
                  </td>
                </tr>
              );
            const atraso = l.envaseEm ? diasEntre(t.meta, l.envaseEm) : null;
            const varCusto =
              t.lataReal !== null && t.lataPlan ? (t.lataReal - t.lataPlan) / t.lataPlan : null;
            return (
              <tr key={l.id} className="hover:bg-lk-paper/60">
                <td className={TD}>
                  <p className="font-lk-mono font-medium">{l.codigo}</p>
                  <p className="text-lk-muted text-xs whitespace-nowrap">
                    {num(l.plano.litros, 0)} L
                  </p>
                  {l.obs && <p className="text-lk-ink3 mt-0.5 max-w-48 text-xs">{l.obs}</p>}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <p>{l.envaseEm ? diaAno(l.envaseEm) : "—"}</p>
                  <p className="text-lk-muted text-xs">
                    validade {l.validade ? diaAno(l.validade) : "—"}
                  </p>
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  <p className="font-medium">{num(l.latasBoas ?? 0, 0)}</p>
                  <p className="text-lk-muted text-xs">
                    plano {num(l.boas, 0)} ·{" "}
                    <span className={t.completo ? "" : "text-lk-fail"}>
                      {t.rendimento === null ? "—" : pct(t.rendimento * 100)}
                    </span>
                  </p>
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  <p>{t.perdaReal === null ? "—" : pct(t.perdaReal * 100)}</p>
                  <p className="text-lk-muted text-xs">plano {pct(l.plano.perdaEnvasePct)}</p>
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  <p className="font-medium">{t.lataReal === null ? "—" : brl(t.lataReal)}</p>
                  <p className="text-lk-muted text-xs">
                    plano {t.lataPlan === null ? "—" : brl(t.lataPlan)}
                    {varCusto !== null && (
                      <span className={varCusto > 0.02 ? "text-lk-fail" : "text-lk-pass"}>
                        {" "}
                        ({sinal(varCusto)})
                      </span>
                    )}
                  </p>
                </td>
                <td className={TD}>
                  {atraso === null ? (
                    "—"
                  ) : atraso <= 0 ? (
                    <Badge tone="pass">No prazo</Badge>
                  ) : (
                    <Badge tone="fail">
                      {atraso} {atraso === 1 ? "dia" : "dias"} de atraso
                    </Badge>
                  )}
                  <p className="text-lk-muted mt-1 text-xs whitespace-nowrap">
                    produção {dia(t.meta)} · envase {l.envaseEm ? dia(l.envaseEm) : "—"}
                  </p>
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  {t.durou !== null ? (
                    `${t.durou} dias`
                  ) : (
                    <span className="text-lk-muted text-xs">ainda vendendo</span>
                  )}
                </td>
                <td className={`${TD} text-right`}>
                  <button
                    type="button"
                    className={btn("ghost", "sm")}
                    onClick={() => onEdit(l)}
                    aria-label={`Editar ${l.codigo}`}
                    title="Editar"
                  >
                    <Pencil aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Corrigir um lote concluído (datas, latas boas, quando acabou, pagamentos). */
function ConcluidoEditor({
  l,
  onCancel,
  onSave,
}: {
  l: Lote;
  onCancel: () => void;
  onSave: (l: Lote) => void;
}) {
  const [f, setF] = useState(l);
  const set = <K extends keyof Lote>(k: K, v: Lote[K]) => setF((p) => ({ ...p, [k]: v }));
  const date = (
    k: "envaseEm" | "prontoEm" | "validade" | "acabouEm",
    label: string,
    hint?: string,
  ) => (
    <label className={LABEL}>
      <span className="font-medium">{label}</span>
      <input
        type="date"
        className={INPUT}
        value={f[k] ?? ""}
        onChange={(ev) => set(k, ev.target.value || null)}
      />
      {hint && <span className={HINT}>{hint}</span>}
    </label>
  );
  return (
    <Drawer
      title={`Lote ${l.codigo}`}
      isNew
      ok
      onCancel={onCancel}
      onSave={() => onSave(f)}
      onDelete={() => {}}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {date("envaseEm", "Envase em")}
        {date("prontoEm", "Pronto em")}
        {date("validade", "Validade", `Envase + ${VALIDADE_MESES} meses, a não ser que mudem aqui`)}
        {date("acabouEm", "Acabou em", "Quando a última lata do lote foi vendida")}
        <label className={LABEL}>
          <span className="font-medium">Latas boas</span>
          <input
            type="number"
            min={0}
            className={`${INPUT} text-right tabular-nums`}
            value={f.latasBoas ?? ""}
            onChange={(ev) =>
              set(
                "latasBoas",
                ev.target.value === "" ? null : Math.max(0, Math.round(Number(ev.target.value))),
              )
            }
          />
        </label>
        <label className={LABEL}>
          <span className="font-medium">Six packs montados</span>
          <input
            type="number"
            min={0}
            className={`${INPUT} text-right tabular-nums`}
            value={f.sixPacksMontados ?? ""}
            onChange={(ev) =>
              set(
                "sixPacksMontados",
                ev.target.value === "" ? null : Math.max(0, Math.round(Number(ev.target.value))),
              )
            }
          />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Insumos: chegada e valor pago</legend>
        {f.itens.map((it, k) =>
          it.comprar <= 0 && !it.depois ? null : (
            <div key={it.insumoId} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-36 shrink-0 truncate">{it.insumo}</span>
              <input
                type="date"
                className={`${MINI} w-36`}
                value={it.chegouEm ?? ""}
                aria-label={`${it.insumo}: chegou em`}
                onChange={(ev) =>
                  set(
                    "itens",
                    f.itens.map((x, j) =>
                      j === k ? { ...x, chegouEm: ev.target.value || null } : x,
                    ),
                  )
                }
              />
              <span className="text-lk-muted">R$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={`${MINI} w-28 text-right`}
                aria-label={`${it.insumo}: valor pago`}
                placeholder={(it.desembolsoCents / 100).toFixed(2)}
                value={it.pagoCents === null ? "" : it.pagoCents / 100}
                onChange={(ev) =>
                  set(
                    "itens",
                    f.itens.map((x, j) =>
                      j === k
                        ? {
                            ...x,
                            pagoCents:
                              ev.target.value === ""
                                ? null
                                : Math.max(0, Math.round(Number(ev.target.value) * 100)),
                          }
                        : x,
                    ),
                  )
                }
              />
            </div>
          ),
        )}
        <p className={HINT}>
          Mudar isto corrige os indicadores, mas não mexe no estoque dos insumos: se precisar,
          ajusta o estoque no próprio insumo.
        </p>
      </fieldset>
      <label className={LABEL}>
        <span className="font-medium">Observações</span>
        <textarea
          className={`${INPUT} h-20 py-2`}
          value={f.obs}
          maxLength={500}
          onChange={(ev) => set("obs", ev.target.value)}
        />
      </label>
    </Drawer>
  );
}
