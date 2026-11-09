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
  Plus,
  Coins,
  Timer,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  COMPLETO_MIN,
  VALIDADE_MESES,
  diasEntre,
  baixarLote,
  cancelarLote,
  coberturaLotes,
  indicadores,
  loteAberto,
  somarDias,
  somarMeses,
  totaisLote,
  trocarFornecedor,
  type CoberturaItem,
  type Etapa,
  type Lote,
  type LoteItem,
  type ProducaoData,
} from "@/lib/producao";
import { Ajuda, Drawer, HINT, INPUT, LABEL, MINI, Secao, brl, dia, num, pct } from "./producao-ui";
import { Badge, Empty, KpiStrip, TABLE_WRAP, TD, TH, Tile, btn, type Tone } from "./ui";

/**
 * Lotes de produção = necessidade (como a ordem de produção do SAP): o lote
 * diz quanto vai consumir de cada insumo e reserva isso no estoque. Ele não
 * compra: as compras são os pedidos de compra (PC-0001…), e a cobertura
 * mostra de onde vem cada insumo (estoque, pedido em aberto ou falta
 * comprar). Ao concluir, sai do estoque o consumo, pelo custo médio. Dos
 * concluídos saem os indicadores: rendimento, perda, custo real × plano e
 * lotes no prazo.
 */

const ETAPA: Record<Etapa, { label: string; tone: Tone; icon: LucideIcon }> = {
  planejado: { label: "Planejado", tone: "muted", icon: ClipboardList },
  pedido: { label: "Planejado", tone: "muted", icon: ClipboardList },
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
  const prox = proximoMarco(data, abertos, hoje);
  const u = ind.ultimo;
  const varPct =
    u && !u.l.historico && u.t.lataReal !== null && u.t.lataPlan
      ? (u.t.lataReal - u.t.lataPlan) / u.t.lataPlan
      : null;
  const semDado = "Disponível após o 1º lote do painel";
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
          u && u.l.historico
            ? `${u.l.codigo} · sem plano para comparação`
            : u && u.t.lataPlan !== null && varPct !== null
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
function proximoMarco(data: ProducaoData, abertos: Lote[], hoje: string) {
  const l = [...abertos].sort((a, b) =>
    totaisLote(a, hoje).meta.localeCompare(totaisLote(b, hoje).meta),
  )[0];
  if (!l) return null;
  if (l.etapa === "envasando") return `${l.codigo}: envasando`;
  const cob = [...(coberturaLotes(data, hoje).get(l.id)?.values() ?? [])];
  const falta = cob.filter((c) => c.falta > 1e-9).length;
  if (falta) return `${l.codigo}: falta comprar ${falta} ${falta === 1 ? "insumo" : "insumos"}`;
  const chega = cob
    .map((c) => c.chegaEm)
    .filter(Boolean)
    .sort()
    .pop();
  return chega && chega > hoje
    ? `${l.codigo}: insumos chegam até ${dia(chega)}`
    : `${l.codigo}: insumos em estoque, pronto para o envase`;
}

/** Lotes abertos (cartões) e o histórico (tabela). */
export function Lotes({
  data,
  hoje,
  onChange,
  onPlanejar,
}: {
  data: ProducaoData;
  hoje: string;
  onChange: Change;
  /** Abre a tela de planejamento (para criar um lote). */
  onPlanejar: () => void;
}) {
  const [editando, setEditando] = useState<Lote | null>(null);
  const abertos = data.lotes
    .filter(loteAberto)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  const fechados = data.lotes
    .filter((l) => !loteAberto(l))
    .sort((a, b) => b.codigo.localeCompare(a.codigo, undefined, { numeric: true }));
  const cobertura = coberturaLotes(data, hoje);

  const setLote = (l: Lote, soon = false, insumos = data.insumos) =>
    onChange({ ...data, insumos, lotes: data.lotes.map((x) => (x.id === l.id ? l : x)) }, soon);
  const excluir = (l: Lote) => {
    if (!window.confirm(`Excluir o ${l.codigo}? A reserva dos insumos será liberada.`)) return;
    onChange({ ...data, lotes: data.lotes.filter((x) => x.id !== l.id) });
  };

  return (
    <>
      <Secao
        id="lotes"
        fixa
        title="Lotes em andamento"
        count={abertos.length}
        aside={
          <button type="button" className={btn("secondary", "sm")} onClick={onPlanejar}>
            <Plus aria-hidden />
            Planejar novo lote
          </button>
        }
      >
        {abertos.length === 0 ? (
          <Empty>Nenhum lote em andamento. Para criar um lote, utilize a tela Planejamento.</Empty>
        ) : (
          abertos.map((l) => (
            <LoteCard
              key={l.id}
              l={l}
              data={data}
              hoje={hoje}
              cob={cobertura.get(l.id) ?? new Map()}
              setLote={setLote}
              onChange={onChange}
              onExcluir={() => excluir(l)}
            />
          ))
        )}
      </Secao>

      {fechados.length > 0 && (
        <Secao id="concluidos" fixa title="Lotes concluídos" count={fechados.length}>
          <Historico lotes={fechados} hoje={hoje} onEdit={(l) => setEditando(structuredClone(l))} />
          <Ajuda>
            <p>Rendimento: latas boas em relação às latas boas planejadas.</p>
            <p>Perda: latas envasadas que não resultaram em latas boas.</p>
            <p>
              Custo real: consumo de cada insumo pelo custo médio do estoque, somado ao serviço
              pago, dividido pelas latas boas.
            </p>
            <p>
              No prazo: envasado até a data de produção e com pelo menos {pct(COMPLETO_MIN * 100)}{" "}
              das latas boas.
            </p>
          </Ajuda>
        </Secao>
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
  cob,
  setLote,
  onChange,
  onExcluir,
}: {
  l: Lote;
  data: ProducaoData;
  hoje: string;
  /** De onde vem cada insumo (estoque, pedido, falta). */
  cob: Map<string, CoberturaItem>;
  setLote: (l: Lote, soon?: boolean) => void;
  /** Mudanças que mexem no estoque (conclusão). */
  onChange: Change;
  onExcluir: () => void;
}) {
  const t = totaisLote(l, hoje);
  const e = ETAPA[l.etapa];
  const planejado = l.etapa === "planejado" || l.etapa === "pedido";
  const cobs = [...cob.values()];
  const faltam = l.itens.filter((it) => (cob.get(it.insumoId)?.falta ?? 0) > 1e-9);
  // Dá pra produzir quando tudo está coberto: no dia em que chega o último pedido.
  const chega =
    cobs
      .map((c) => c.chegaEm)
      .filter(Boolean)
      .sort()
      .pop() ?? null;
  const possivel = faltam.length ? null : chega && chega > hoje ? chega : hoje;
  const atraso = possivel ? diasEntre(t.meta, possivel) : null;

  const envasar = () => {
    if (
      faltam.length &&
      !window.confirm(
        `Ainda há insumos a comprar: ${faltam.map((it) => it.insumo).join(", ")}. Iniciar o envase mesmo assim?`,
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
          `• O consumo de cada insumo será baixado do estoque pelo custo médio.`,
      )
    )
      return;
    onChange(
      baixarLote(data, {
        ...l,
        etapa: "concluido",
        envaseEm: envase,
        prontoEm: l.prontoEm ?? hoje,
        validade,
      }),
    );
  };
  const cancelar = () => {
    if (!window.confirm(`Cancelar o ${l.codigo}? A reserva dos insumos será liberada.`)) return;
    onChange(cancelarLote(data, l));
  };
  const setItem = (k: number, patch: Partial<LoteItem>) =>
    setLote({ ...l, itens: l.itens.map((it, j) => (j === k ? { ...it, ...patch } : it)) }, true);

  return (
    <div className={TABLE_WRAP}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-lk-mono text-lg font-medium">{l.codigo}</span>
            <Badge tone={e.tone} icon={e.icon}>
              {e.label}
            </Badge>
            {planejado &&
              (faltam.length ? (
                <Badge tone="hold">
                  Falta comprar {faltam.length} {faltam.length === 1 ? "insumo" : "insumos"}
                </Badge>
              ) : atraso !== null && atraso > 0 ? (
                <Badge tone="fail">
                  Insumos chegam {atraso} {atraso === 1 ? "dia" : "dias"} depois da data
                </Badge>
              ) : (
                <Badge tone="pass">Insumos cobertos</Badge>
              ))}
          </p>
          <p className="text-lk-muted text-xs">
            {num(l.plano.litros, 0)} L · {num(l.envasadas, 0)} envasadas · {num(l.boas, 0)} latas
            boas · {num(l.packs, 0)} six packs · criado {dia(l.criadoEm)}
          </p>
          <p className="text-lk-ink3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            Data de produção:
            {planejado ? (
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
            {!l.plano.prontoAte && planejado && (
              <span>(sem data definida: considera-se {dia(t.meta)})</span>
            )}
            {planejado && (
              <span>
                · produção possível{" "}
                <span className="text-lk-ink font-medium">
                  {possivel
                    ? possivel === hoje
                      ? "hoje"
                      : `em ${dia(possivel)}`
                    : "após as compras"}
                </span>
              </span>
            )}
            <span>· custo planejado {t.lataPlan === null ? "—" : `${brl(t.lataPlan)}/lata`}</span>
          </p>
        </div>
        <span className="flex flex-wrap gap-2">
          {planejado && (
            <>
              <button
                type="button"
                className={`${btn("ghost", "sm")} text-lk-fail`}
                onClick={onExcluir}
              >
                <Trash2 aria-hidden />
                Excluir
              </button>
              <button type="button" className={btn("primary", "sm")} onClick={envasar}>
                <Factory aria-hidden />
                Iniciar envase
              </button>
            </>
          )}
          {l.etapa === "envasando" && (
            <>
              <button
                type="button"
                className={`${btn("ghost", "sm")} text-lk-fail`}
                onClick={cancelar}
              >
                <Ban aria-hidden />
                Cancelar lote
              </button>
              <button
                type="button"
                className={btn("secondary", "sm")}
                onClick={() => setLote({ ...l, etapa: "planejado" })}
              >
                <Undo2 aria-hidden />
                Voltar etapa
              </button>
              <button
                type="button"
                className={btn("primary", "sm")}
                disabled={l.latasBoas === null}
                title={l.latasBoas === null ? "Informe primeiro as latas boas" : undefined}
                onClick={concluir}
              >
                <CircleCheck aria-hidden />
                Concluir lote
              </button>
            </>
          )}
        </span>
      </div>

      <div className="border-lk-border overflow-x-auto border-t">
        <TabelaCobertura
          l={l}
          data={data}
          hoje={hoje}
          meta={t.meta}
          cob={cob}
          setLote={setLote}
          setItem={setItem}
        />
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

/**
 * O que o lote consome e de onde vem: do estoque, de pedidos de compra em
 * aberto (com a chegada) ou falta comprar (com o "pedir até"). O serviço
 * (envase) tem fornecedor e valor do próprio lote.
 */
function TabelaCobertura({
  l,
  data,
  hoje,
  meta,
  cob,
  setLote,
  setItem,
}: {
  l: Lote;
  data: ProducaoData;
  hoje: string;
  meta: string;
  cob: Map<string, CoberturaItem>;
  setLote: (l: Lote, soon?: boolean) => void;
  setItem: (k: number, patch: Partial<LoteItem>) => void;
}) {
  return (
    <table className="w-full min-w-[960px] table-fixed text-sm">
      <thead>
        <tr>
          <th className={`${TH} w-[20%]`}>Insumo</th>
          <th className={`${TH} w-[13%] text-right`}>Consome</th>
          <th className={`${TH} w-[13%] text-right`}>Do estoque</th>
          <th className={`${TH} w-[22%]`}>De pedidos</th>
          <th className={`${TH} w-[18%]`}>Falta comprar</th>
          <th className={`${TH} w-[14%] text-right`}>Custo previsto</th>
        </tr>
      </thead>
      <tbody className="divide-lk-border divide-y">
        {l.itens.map((it, k) => {
          const insumo = data.insumos.find((i) => i.id === it.insumoId);
          const custo = Math.round(it.precisa * it.unitCents);
          if (it.categoria === "Serviço")
            return (
              <tr key={it.insumoId}>
                <td className={TD}>
                  <p className="font-semibold">{it.insumo}</p>
                  <p className="text-lk-muted text-xs">serviço do lote</p>
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  {num(it.precisa)} <span className="text-lk-muted text-xs">{it.unidade}</span>
                </td>
                <td className={TD} colSpan={2}>
                  {insumo && insumo.fornecedores.length > 1 && l.etapa !== "envasando" ? (
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
                  <span className="text-lk-muted text-xs">
                    {" "}
                    · agendar até {dia(somarDias(meta, -it.prazoDias))}
                  </span>
                </td>
                <td className={TD}>
                  {l.etapa === "envasando" ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={`${it.insumo}: valor pago`}
                      title="Valor pago pelo serviço (R$)"
                      placeholder={`pago (R$ ${(it.desembolsoCents / 100).toFixed(2)})`}
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
                  ) : (
                    <span className="text-lk-muted text-xs">valor informado no envase</span>
                  )}
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  {brl(it.pagoCents ?? it.desembolsoCents)}
                </td>
              </tr>
            );
          const c = cob.get(it.insumoId);
          const pedirAte = insumo
            ? somarDias(meta, -(principalDoInsumo(insumo)?.prazoDias ?? 0))
            : null;
          return (
            <tr key={it.insumoId}>
              <td className={TD}>
                <p className="font-semibold">{it.insumo}</p>
                <p className="text-lk-muted text-xs">
                  em estoque {num(insumo?.estoque ?? 0)} {it.unidade}
                  {it.uso === "pack" ? ` · ${num(l.packs, 0)} six packs` : ""}
                </p>
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {num(it.precisa)} <span className="text-lk-muted text-xs">{it.unidade}</span>
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {c && c.doEstoque > 1e-9 ? (
                  num(c.doEstoque)
                ) : (
                  <span className="text-lk-muted">—</span>
                )}
              </td>
              <td className={TD}>
                {c && c.dePedidos > 1e-9 ? (
                  <>
                    <span className="tabular-nums">{num(c.dePedidos)}</span>{" "}
                    <span className="font-lk-mono text-xs">{c.pcs.join(", ")}</span>
                    {c.chegaEm && (
                      <p
                        className={`text-xs ${c.chegaEm < hoje ? "text-lk-fail" : c.chegaEm > meta ? "text-lk-hold" : "text-lk-muted"}`}
                      >
                        chega {dia(c.chegaEm)}
                        {c.chegaEm < hoje
                          ? " (atrasado)"
                          : c.chegaEm > meta
                            ? " (após a data)"
                            : ""}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-lk-muted">—</span>
                )}
              </td>
              <td className={TD}>
                {c && c.falta > 1e-9 ? (
                  <>
                    <Badge tone={pedirAte && pedirAte < hoje ? "fail" : "hold"}>
                      {num(c.falta)} {it.unidade}
                    </Badge>
                    {pedirAte && (
                      <p
                        className={`text-xs ${pedirAte < hoje ? "text-lk-fail" : "text-lk-muted"}`}
                      >
                        pedir até {dia(pedirAte)}
                      </p>
                    )}
                  </>
                ) : (
                  <Badge tone="pass">coberto</Badge>
                )}
              </td>
              <td className={`${TD} text-right tabular-nums`}>{brl(custo)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const principalDoInsumo = (i: ProducaoData["insumos"][number]) =>
  i.fornecedores.find((f) => f.id === i.principal) ?? i.fornecedores[0] ?? null;

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
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr>
            <th className={TH}>Lote</th>
            <th className={TH}>Envase · validade</th>
            <th className={`${TH} text-right`}>Latas boas</th>
            <th className={`${TH} text-right`}>Perda</th>
            <th className={`${TH} text-right`}>Custo por lata</th>
            <th className={TH}>Prazo</th>
            <th className={`${TH} text-right`}>Duração</th>
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
            if (l.historico)
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
                    <p className="font-medium">{t.lataReal ? brl(t.lataReal) : "—"}</p>
                    <p className="text-lk-muted text-xs">sem plano para comparação</p>
                  </td>
                  <td className={`${TD} text-lk-muted text-xs`}>Anterior ao painel, sem datas</td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {t.durou !== null ? (
                      `${t.durou} dias`
                    ) : (
                      <span className="text-lk-muted text-xs">—</span>
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
                    <span className="text-lk-muted text-xs">em venda</span>
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
        onChange={(ev) => {
          const v = ev.target.value || null;
          // Pôs a data do envase e a validade está vazia: calcula (+12 meses).
          if (k === "envaseEm" && v && !f.validade)
            setF((p) => ({ ...p, envaseEm: v, validade: somarMeses(v, VALIDADE_MESES) }));
          else set(k, v);
        }}
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
        {date(
          "validade",
          "Validade",
          `Envase + ${VALIDADE_MESES} meses, salvo alteração neste campo`,
        )}
        {date("acabouEm", "Esgotado em", "Data em que a última lata do lote foi vendida")}
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
                aria-label={`${it.insumo}: recebido em`}
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
          Estas alterações corrigem os indicadores, mas não modificam o estoque dos insumos. Se
          necessário, ajuste o estoque no cadastro do insumo.
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
