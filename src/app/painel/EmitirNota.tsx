"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, Plus, Sparkles, Trash2, Truck } from "lucide-react";
import type { Plano, Prep, Rascunho } from "@/lib/notas";
import { autorizar, conferir, descartar, lerTexto, preparar } from "./actions-notas";
import { CARD, SectionTitle, btn, Select } from "./ui";

const FIELD =
  "border-lk-border focus:border-lk-action focus:ring-lk-action/15 h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-4 disabled:bg-[#f3f4f6] disabled:text-lk-muted";
const LABEL = "text-lk-muted mb-1 block text-xs font-medium";
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Sku = Rascunho["itens"][number]["sku"];
const ITENS: { sku: Sku; label: string; tabela: number }[] = [
  { sku: "FERN-350-6", label: "Six pack (6 latas)", tabela: 94.99 },
  { sku: "FERN-350", label: "Lata avulsa", tabela: 15.99 },
  { sku: "FERN-350-2", label: "2 Pack (2 latas)", tabela: 44.9 },
  { sku: "FERN-BARRIL-L", label: "Litro do barril", tabela: 24.5 },
];
const tabela = (sku: Sku) => ITENS.find((i) => i.sku === sku)!.tabela;

const STATUS: Record<Prep["status"], string> = {
  rascunho: "rascunho",
  aguardando: "aguardando Sefaz",
  emitida: "emitida",
  erro: "ERRO · chamar o João",
  travada: "travada",
  descartada: "descartada",
};

/** Emitir nota: colar texto → conferir → preparar (rascunho) → emitir. */
export function EmitirNota({ vazio, recentes }: { vazio: Rascunho; recentes: Prep[] }) {
  const [texto, setTexto] = useState("");
  const [r, setR] = useState<Rascunho>(vazio);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [freteId, setFreteId] = useState<string | null>(null);
  const [outraMesmo, setOutraMesmo] = useState(false);
  const [modalFrete, setModalFrete] = useState(false);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lista, setLista] = useState<Prep[]>(recentes);
  const [pending, start] = useTransition();
  const [acao, setAcao] = useState("");

  const run = (nome: string, fn: () => Promise<void>) => {
    setErro(null);
    setAcao(nome);
    start(async () => {
      try {
        await fn();
      } catch {
        setErro(
          "A conexão caiu no meio. Recarregue a página e confira em “Últimas notas” antes de repetir.",
        );
      }
      setAcao("");
    });
  };
  const resultado = useRef<HTMLElement>(null);
  const aviso = useRef<HTMLParagraphElement>(null);
  const janela = useRef<HTMLDivElement>(null);
  const atualizar = (p: Prep) => {
    setPrep(p);
    setLista((l) => [p, ...l.filter((x) => x.id !== p.id)].slice(0, 20));
    // O resultado aparece embaixo do formulário: leva a pessoa até ele.
    setTimeout(() => resultado.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  // Erro novo: mostra (fica embaixo do formulário).
  useEffect(() => {
    if (erro) aviso.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [erro]);
  // Janela do frete: Esc fecha e o foco vai pra primeira opção.
  useEffect(() => {
    if (!modalFrete) return;
    janela.current?.querySelector<HTMLButtonElement>("li button:not(:disabled)")?.focus();
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setModalFrete(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [modalFrete]);
  // Qualquer mudança nos campos invalida a conferência.
  const mudar = (fn: (x: Rascunho) => Rascunho) => {
    setR((x) => fn(x));
    setPlano(null);
    setFreteId(null);
    setOutraMesmo(false);
  };
  const setCliente = (k: keyof Rascunho["cliente"], v: string) =>
    mudar((x) => ({ ...x, cliente: { ...x.cliente, [k]: v } }));
  const setItem = (i: number, k: "sku" | "qtd" | "preco", v: string | number) =>
    mudar((x) => ({
      ...x,
      itens: x.itens.map((it, j) => {
        if (j !== i) return it;
        if (k === "sku") {
          const sku = v as Sku;
          return { ...it, sku, preco: x.tipo === "bonificacao" ? tabela(sku) : it.preco };
        }
        return { ...it, [k]: typeof v === "number" ? v : Number(v) || 0 };
      }),
    }));
  const setTipo = (tipo: Rascunho["tipo"]) =>
    mudar((x) => ({
      ...x,
      tipo,
      itens: x.itens.map((it) => ({ ...it, preco: tipo === "bonificacao" ? tabela(it.sku) : 0 })),
    }));

  const ler = () =>
    run("ler", async () => {
      const res = await lerTexto(texto);
      if (!res.ok) return setErro(res.error);
      setR(res.data);
      setPrep(null);
      setPlano(null);
      setFreteId(null);
    });
  const checar = () =>
    run("conferir", async () => {
      const p = await conferir(r);
      if (!p.ok) return setErro(p.error);
      setPlano(p.data);
      setFreteId(null);
      // Envio: abre a janela do Melhor Envio pra escolher o frete.
      if (!p.data.erros.length && p.data.fretes.length) setModalFrete(true);
    });
  const prepararNota = () =>
    run("preparar", async () => {
      const res = await preparar(r, freteId, outraMesmo);
      if (!res.ok) return setErro(res.error);
      atualizar(res.data);
    });
  const emitir = (id: string) =>
    run("emitir", async () => {
      const res = await autorizar(id);
      if (!res.ok) return setErro(res.error);
      atualizar(res.data);
    });
  const jogarFora = (id: string) =>
    run("descartar", async () => {
      const res = await descartar(id);
      if (!res.ok) return setErro(res.error);
      atualizar(res.data);
    });
  const novo = () => {
    setR(vazio);
    setTexto("");
    setPlano(null);
    setFreteId(null);
    setOutraMesmo(false);
    setPrep(null);
    setErro(null);
  };

  const freteEscolhido = plano?.fretes.find((f) => f.id === freteId) ?? null;
  const c = r.cliente;
  const brinde = r.tipo === "bonificacao";
  const totalCombinado = r.itens.reduce((n, i) => n + Math.round(i.preco * 100) * i.qtd, 0);
  const emAndamento = Boolean(prep && !["descartada", "travada"].includes(prep.status));
  const bloqueado = pending || emAndamento;
  const podePreparar =
    !pending &&
    plano !== null &&
    plano.erros.length === 0 &&
    (!plano.pacote || Boolean(freteId)) &&
    (!plano.repetida || outraMesmo);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Colar */}
      <section className={`${CARD} p-5`}>
        <SectionTitle title="1. Cole o texto" />
        <p className="text-lk-muted mt-1 text-sm">
          WhatsApp, cartão CNPJ, o que tiver: quem é o cliente (razão social, CNPJ, IE, endereço com
          CEP), o que vai, preço combinado e se é em mãos ou envio. A IA preenche os campos. Venda e
          brinde pro mesmo cliente = duas notas (uma de cada vez).
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          maxLength={8000}
          disabled={bloqueado}
          placeholder={
            "Ex.: Venda 4 six packs pro Bar do Zé, R$ 13,86 a lata.\nRazão social…, CNPJ…, IE…, endereço com CEP…\nVai por envio, empilhado em 2 pilhas."
          }
          className={`${FIELD} mt-3 h-auto py-2`}
        />
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={novo} disabled={pending} className={btn("ghost", "sm")}>
            Limpar tudo
          </button>
          <button
            type="button"
            onClick={ler}
            disabled={bloqueado || !texto.trim()}
            className={`${btn("primary", "sm")} disabled:opacity-60`}
          >
            <Sparkles aria-hidden />
            {acao === "ler" ? "Lendo…" : "Preencher com IA"}
          </button>
        </div>
      </section>

      {/* 2. Conferir */}
      <section className={`${CARD} p-5`}>
        <SectionTitle title="2. Confira os campos" />
        {r.duvidas.length > 0 && (
          <div className="bg-lk-review-bg text-lk-ink mt-3 rounded-lg px-4 py-3 text-sm">
            <p className="font-medium">A IA ficou em dúvida:</p>
            <ul className="mt-1 list-disc pl-5">
              {r.duvidas.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
        <fieldset disabled={bloqueado} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <label className="col-span-2 sm:col-span-3">
            <span className={LABEL}>O que é</span>
            <Select
              value={r.tipo}
              onChange={(e) => setTipo(e.target.value as Rascunho["tipo"])}
              className={FIELD}
            >
              <option value="venda">Venda</option>
              <option value="bonificacao">Brinde / bonificação (ninguém paga)</option>
            </Select>
          </label>
          <label className="col-span-2 sm:col-span-3">
            <span className={LABEL}>Entrega</span>
            <Select
              value={r.entrega}
              onChange={(e) =>
                mudar((x) => ({ ...x, entrega: e.target.value as Rascunho["entrega"] }))
              }
              className={FIELD}
            >
              <option value="maos">Em mãos (sem etiqueta)</option>
              <option value="envio">Envio (etiqueta no Melhor Envio, a Fernandito paga)</option>
            </Select>
          </label>
          {r.entrega === "envio" && (
            <>
              <label className="col-span-2 sm:col-span-4">
                <span className={LABEL}>Como vão as caixas</span>
                <Select
                  value={r.embalagem}
                  onChange={(e) =>
                    mudar((x) => ({ ...x, embalagem: e.target.value as Rascunho["embalagem"] }))
                  }
                  className={FIELD}
                >
                  <option value="separadas">Cada caixa com sua etiqueta (vários volumes)</option>
                  <option value="empilhado">Tudo junto num volume só, empilhado</option>
                </Select>
              </label>
              {r.embalagem === "empilhado" && (
                <label className="col-span-2 sm:col-span-2">
                  <span className={LABEL}>Quantas pilhas lado a lado</span>
                  <NumInput
                    value={r.pilhas}
                    onValue={(n) => mudar((x) => ({ ...x, pilhas: Math.max(1, n) }))}
                    className={FIELD}
                  />
                </label>
              )}
            </>
          )}

          <label className="col-span-2 sm:col-span-1">
            <span className={LABEL}>Cliente</span>
            <Select
              value={c.pessoa}
              onChange={(e) => setCliente("pessoa", e.target.value)}
              className={FIELD}
            >
              <option value="PJ">Empresa</option>
              <option value="PF">Pessoa</option>
            </Select>
          </label>
          <label className="col-span-2 sm:col-span-2">
            <span className={LABEL}>{c.pessoa === "PJ" ? "CNPJ" : "CPF"}</span>
            <input
              value={c.documento}
              onChange={(e) => setCliente("documento", e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className={FIELD}
            />
          </label>
          <label className="col-span-2 sm:col-span-3">
            <span className={LABEL}>
              Inscrição estadual {c.pessoa === "PJ" ? "(obrigatória)" : "(pessoa não tem)"}
            </span>
            <input
              value={c.ie}
              onChange={(e) => setCliente("ie", e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className={FIELD}
            />
          </label>
          <label className="col-span-2 sm:col-span-3">
            <span className={LABEL}>
              {c.pessoa === "PJ" ? "Razão social (do cartão CNPJ)" : "Nome completo"}
            </span>
            <input
              value={c.nome}
              onChange={(e) => setCliente("nome", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="col-span-2 sm:col-span-3">
            <span className={LABEL}>Nome fantasia</span>
            <input
              value={c.fantasia}
              onChange={(e) => setCliente("fantasia", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="col-span-2 sm:col-span-3">
            <span className={LABEL}>E-mail (recebe a nota; opcional)</span>
            <input
              value={c.email}
              onChange={(e) => setCliente("email", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="col-span-2 sm:col-span-3">
            <span className={LABEL}>Telefone</span>
            <input
              value={c.telefone}
              onChange={(e) => setCliente("telefone", e.target.value.replace(/\D/g, ""))}
              inputMode="tel"
              className={FIELD}
            />
          </label>
          <label className="col-span-2 sm:col-span-4">
            <span className={LABEL}>Rua</span>
            <input
              value={c.rua}
              onChange={(e) => setCliente("rua", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="col-span-1 sm:col-span-1">
            <span className={LABEL}>Número</span>
            <input
              value={c.numero}
              onChange={(e) => setCliente("numero", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="col-span-1 sm:col-span-1">
            <span className={LABEL}>Compl.</span>
            <input
              value={c.complemento}
              onChange={(e) => setCliente("complemento", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="col-span-2 sm:col-span-2">
            <span className={LABEL}>Bairro</span>
            <input
              value={c.bairro}
              onChange={(e) => setCliente("bairro", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="col-span-2 sm:col-span-2">
            <span className={LABEL}>Cidade</span>
            <input
              value={c.cidade}
              onChange={(e) => setCliente("cidade", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="col-span-1 sm:col-span-1">
            <span className={LABEL}>UF</span>
            <input
              value={c.uf}
              maxLength={2}
              onChange={(e) => setCliente("uf", e.target.value.toUpperCase())}
              className={FIELD}
            />
          </label>
          <label className="col-span-1 sm:col-span-1">
            <span className={LABEL}>CEP</span>
            <input
              value={c.cep}
              onChange={(e) => setCliente("cep", e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className={FIELD}
            />
          </label>

          <div className="col-span-2 sm:col-span-6">
            <span className={LABEL}>
              {brinde
                ? "Itens · brinde sai com o valor de tabela (ninguém paga)"
                : "Itens · preço FINAL combinado POR UNIDADE (six pack = preço da caixa, com ST incluso)"}
            </span>
            <div className="flex flex-col gap-2">
              {r.itens.map((it, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_2.5rem] items-center gap-2 sm:grid-cols-[1fr_5.5rem_8rem_2.5rem]"
                >
                  <Select
                    aria-label="Produto"
                    wrapperClassName="col-span-3 sm:col-span-1"
                    value={it.sku}
                    onChange={(e) => setItem(i, "sku", e.target.value)}
                    className={FIELD}
                  >
                    {ITENS.map((o) => (
                      <option key={o.sku} value={o.sku}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  <NumInput
                    aria-label="Quantidade"
                    value={it.qtd}
                    onValue={(n) => setItem(i, "qtd", n)}
                    placeholder="Qtd"
                    className={FIELD}
                  />
                  <NumInput
                    aria-label="Preço por unidade"
                    decimal
                    value={it.preco}
                    disabled={brinde}
                    onValue={(n) => setItem(i, "preco", n)}
                    placeholder="R$ 0,00"
                    className={FIELD}
                  />
                  <button
                    type="button"
                    aria-label="Tirar item"
                    disabled={r.itens.length === 1}
                    onClick={() =>
                      mudar((x) => ({ ...x, itens: x.itens.filter((_, j) => j !== i) }))
                    }
                    className={`${btn("ghost")} size-10 px-0`}
                  >
                    <Trash2 aria-hidden />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  mudar((x) => ({
                    ...x,
                    itens: [
                      ...x.itens,
                      { sku: "FERN-350-6", qtd: 1, preco: brinde ? tabela("FERN-350-6") : 0 },
                    ],
                  }))
                }
                className={`${btn("ghost", "sm")} self-start`}
              >
                <Plus aria-hidden />
                Item
              </button>
            </div>
          </div>
          <label className="col-span-2 sm:col-span-6">
            <span className={LABEL}>Observação que sai na nota (opcional)</span>
            <input
              value={r.observacoes}
              onChange={(e) => mudar((x) => ({ ...x, observacoes: e.target.value }))}
              className={FIELD}
            />
          </label>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {brinde ? "Valor de tabela (não cobrado): " : "Total combinado: "}
            <strong className="tabular-nums">{brl(totalCombinado)}</strong>
          </p>
          <button
            type="button"
            onClick={checar}
            disabled={bloqueado}
            className={`${btn("secondary", "sm")} disabled:opacity-60`}
          >
            {acao === "conferir" ? "Conferindo no Bling e no Melhor Envio…" : "Conferir"}
          </button>
        </div>

        {plano && (
          <div className="border-lk-border mt-3 flex flex-col gap-2 rounded-lg border p-4 text-sm">
            {plano.erros.length > 0 ? (
              <div className="bg-lk-fail-bg text-lk-fail rounded-md px-3 py-2">
                <p className="font-semibold">Travado. Corrija ou chame o João:</p>
                <ul className="mt-1 list-disc pl-5">
                  {plano.erros.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-lk-pass font-semibold">Tudo certo pra preparar.</p>
            )}
            <p>
              <span className="text-lk-muted">Natureza:</span> {plano.naturezaLabel}
            </p>
            <p>
              <span className="text-lk-muted">Estoque:</span>{" "}
              {plano.latas ? `sai ${plano.latas} latas do Bling` : "não mexe (barril)"}
            </p>
            {plano.pacote && (
              <p>
                <span className="text-lk-muted">Caixa da etiqueta:</span> {plano.pacote.descricao}
              </p>
            )}
            {plano.avisos.map((a) => (
              <p key={a} className="text-lk-review">
                {a}
              </p>
            ))}
            {plano.fretes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lk-muted">Frete:</span>
                {freteEscolhido ? (
                  <span>
                    {freteEscolhido.nome} ·{" "}
                    <strong className="tabular-nums">{brl(freteEscolhido.precoCents)}</strong> ·{" "}
                    {freteEscolhido.prazo}
                  </span>
                ) : (
                  <span className="text-lk-fail">escolha o frete</span>
                )}
                <button
                  type="button"
                  onClick={() => setModalFrete(true)}
                  className={btn("secondary", "sm")}
                >
                  <Truck aria-hidden />
                  {freteEscolhido ? "Trocar frete" : "Escolher frete"}
                </button>
              </div>
            )}
            {plano.repetida && (
              <label className="bg-lk-review-bg flex items-start gap-2 rounded-md px-3 py-2">
                <input
                  type="checkbox"
                  checked={outraMesmo}
                  onChange={(e) => setOutraMesmo(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  {plano.repetida} <strong>É outra nota mesmo</strong> (não é a mesma de novo).
                </span>
              </label>
            )}
          </div>
        )}
        {!emAndamento && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={prepararNota}
              disabled={!podePreparar}
              className={`${btn("primary")} disabled:opacity-60`}
            >
              <FileText aria-hidden />
              {acao === "preparar" ? "Preparando no Bling…" : "3. Preparar nota (rascunho)"}
            </button>
          </div>
        )}
      </section>

      {erro && (
        <p
          ref={aviso}
          role="alert"
          className="bg-lk-fail-bg text-lk-fail rounded-lg px-4 py-3 text-sm"
        >
          {erro}
        </p>
      )}

      {/* 3. Rascunho / resultado */}
      {prep && prep.status !== "descartada" && (
        <section ref={resultado} className={`${CARD} scroll-mt-6 p-5`}>
          <SectionTitle
            title={
              prep.status === "emitida"
                ? `Nota ${prep.numero} emitida ✓`
                : prep.status === "travada"
                  ? "Travado"
                  : prep.status === "erro"
                    ? `Nota ${prep.numero ?? ""} com problema`
                    : `Rascunho da nota ${prep.numero ?? ""}`
            }
          />
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-lk-muted text-xs">Cliente</dt>
              <dd>{prep.rascunho.cliente.fantasia || prep.rascunho.cliente.nome}</dd>
            </div>
            <div>
              <dt className="text-lk-muted text-xs">Total da nota (Bling)</dt>
              <dd className="text-lg font-semibold tabular-nums">{brl(prep.totalNotaCents)}</dd>
            </div>
            <div>
              <dt className="text-lk-muted text-xs">
                {prep.rascunho.tipo === "bonificacao" ? "Tabela" : "Combinado"}
              </dt>
              <dd className="tabular-nums">{brl(prep.plano.totalCombinadoCents)}</dd>
            </div>
            <div>
              <dt className="text-lk-muted text-xs">Entrega</dt>
              <dd>
                {prep.frete ? `${prep.frete.nome} · ${brl(prep.frete.precoCents)}` : "Em mãos"}
              </dd>
            </div>
          </dl>
          {prep.erro && (
            <p className="bg-lk-fail-bg text-lk-fail mt-3 rounded-md px-3 py-2 text-sm">
              {prep.erro}
            </p>
          )}
          {prep.etiqueta?.erro && (
            <p className="bg-lk-fail-bg text-lk-fail mt-3 rounded-md px-3 py-2 text-sm">
              {prep.etiqueta.erro}
            </p>
          )}
          {prep.status === "rascunho" && (
            <p className="text-lk-muted mt-3 text-sm">
              Confira a prévia. Se algo estiver errado, <strong>Descartar</strong> e corrija. Emitir
              não tem volta.
            </p>
          )}
          {prep.status === "emitida" && !prep.erro && !prep.etiqueta?.erro && (
            <p className="text-lk-pass mt-3 text-sm">
              Pronto: nota na Sefaz{prep.rascunho.cliente.email ? " e no e-mail do cliente" : ""},
              estoque baixado
              {prep.etiqueta?.pdf
                ? " e etiqueta comprada (também está no painel, em Imprimir e postar)"
                : ""}
              .
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {prep.pdf && prep.status !== "travada" && (
              <a
                href={prep.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className={btn("secondary", "sm")}
              >
                <FileText aria-hidden />
                {prep.status === "emitida" ? "PDF da nota" : "Ver prévia"}
              </a>
            )}
            {prep.etiqueta?.pdf && (
              <a
                href={prep.etiqueta.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className={btn("secondary", "sm")}
              >
                <Truck aria-hidden />
                Etiqueta {prep.etiqueta.rastreio ? `· ${prep.etiqueta.rastreio}` : ""}
              </a>
            )}
            <span className="flex-1" />
            {prep.status === "rascunho" && (
              <button
                type="button"
                onClick={() => jogarFora(prep.id)}
                disabled={pending}
                className={`${btn("ghost", "sm")} disabled:opacity-60`}
              >
                {acao === "descartar" ? "Descartando…" : "Descartar"}
              </button>
            )}
            {prep.status === "rascunho" && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Emitir a nota de ${brl(prep.totalNotaCents)} pra ${prep.rascunho.cliente.fantasia || prep.rascunho.cliente.nome} na Sefaz?${prep.frete ? ` E comprar a etiqueta (${brl(prep.frete.precoCents)})?` : ""} Não tem volta.`,
                    )
                  )
                    emitir(prep.id);
                }}
                disabled={pending}
                className={`${btn("primary")} disabled:opacity-60`}
              >
                {acao === "emitir" ? "Emitindo…" : "4. Emitir na Sefaz"}
              </button>
            )}
            {(prep.status === "aguardando" ||
              (prep.status === "emitida" &&
                prep.rascunho.entrega === "envio" &&
                !prep.etiqueta?.pdf &&
                (prep.etiqueta?.tentativas ?? 0) < 2)) && (
              <button
                type="button"
                onClick={() => emitir(prep.id)}
                disabled={pending}
                className={`${btn("primary", "sm")} disabled:opacity-60`}
              >
                {acao === "emitir"
                  ? "Aguarde…"
                  : prep.status === "aguardando"
                    ? "Conferir de novo"
                    : "Comprar etiqueta"}
              </button>
            )}
            {["emitida", "travada", "erro"].includes(prep.status) && (
              <button type="button" onClick={novo} className={btn("primary", "sm")}>
                Nova nota
              </button>
            )}
          </div>
        </section>
      )}

      {/* Histórico */}
      {lista.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle title="Últimas notas do painel" count={lista.length} />
          <ul className={`${CARD} divide-lk-border divide-y text-sm`}>
            {lista.slice(0, 20).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-20 tabular-nums">{p.numero ? `NF ${p.numero}` : "—"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {p.rascunho.tipo === "bonificacao" ? "🎁 " : ""}
                  {p.rascunho.cliente.fantasia || p.rascunho.cliente.nome}
                </span>
                <span className="tabular-nums">{brl(p.totalNotaCents)}</span>
                <span
                  className={`w-36 text-xs ${p.status === "erro" ? "text-lk-fail font-semibold" : "text-lk-muted"}`}
                >
                  {STATUS[p.status]}
                </span>
                {["rascunho", "aguardando", "erro"].includes(p.status) ||
                (p.status === "emitida" && p.rascunho.entrega === "envio" && !p.etiqueta?.pdf) ? (
                  <button type="button" onClick={() => setPrep(p)} className={btn("ghost", "sm")}>
                    Abrir
                  </button>
                ) : null}
                {p.pdf && p.status === "emitida" && (
                  <a
                    href={p.pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btn("ghost", "sm")}
                  >
                    PDF
                  </a>
                )}
                {p.etiqueta?.pdf && (
                  <a
                    href={p.etiqueta.pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btn("ghost", "sm")}
                  >
                    Etiqueta
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {modalFrete && plano && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="frete-titulo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setModalFrete(false)}
        >
          <div
            ref={janela}
            className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 id="frete-titulo" className="text-lg font-semibold">
                Frete pelo Melhor Envio
              </h2>
              <p className="text-lk-muted mt-1 text-sm">
                {plano.pacote?.descricao} · para {r.cliente.cidade}/{r.cliente.uf} ({r.cliente.cep})
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {plano.fretes.map((f) => {
                const semSaldo = plano.saldoCents !== null && plano.saldoCents < f.precoCents;
                const ativo = freteId === f.id;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={semSaldo}
                      onClick={() => setFreteId(f.id)}
                      aria-pressed={ativo}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:opacity-50 ${
                        ativo
                          ? "border-lk-action ring-lk-action/20 bg-lk-action/5 ring-4"
                          : "border-lk-border hover:bg-[#f8f9fa]"
                      }`}
                    >
                      <span>
                        <span className="font-medium">{f.nome}</span>
                        <span className="text-lk-muted block text-xs">
                          {f.prazo}
                          {semSaldo ? " · saldo não cobre" : ""}
                        </span>
                      </span>
                      <span className="text-base font-semibold tabular-nums">
                        {brl(f.precoCents)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-lk-muted text-xs">
              Saldo no Melhor Envio:{" "}
              <strong>
                {plano.saldoCents === null ? "não consegui ler" : brl(plano.saldoCents)}
              </strong>
              . O pagamento sai desse saldo só quando a nota for emitida (a Fernandito paga, o
              cliente não).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalFrete(false)}
                className={btn("ghost", "sm")}
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={!freteId}
                onClick={() => setModalFrete(false)}
                className={`${btn("primary", "sm")} disabled:opacity-60`}
              >
                Usar este frete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Campo numérico que aceita vírgula: guarda o texto como a pessoa digita
 * ("83," não vira "83") e mostra no formato brasileiro ao sair do campo.
 */
function NumInput({
  value,
  onValue,
  decimal = false,
  ...props
}: {
  value: number;
  onValue: (n: number) => void;
  decimal?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const fmt = (n: number) => (n ? (decimal ? n.toFixed(2).replace(".", ",") : String(n)) : "");
  const parse = (t: string) => {
    const limpo = t.replace(/[^\d,.]/g, "");
    const n = limpo.includes(",")
      ? Number(limpo.replace(/\./g, "").replace(",", "."))
      : Number(limpo);
    return Number.isFinite(n) ? n : 0;
  };
  const [txt, setTxt] = useState(fmt(value));
  const [antes, setAntes] = useState(value);
  // Mudou de fora (IA, trocar pra brinde, limpar): mostra o valor novo.
  if (value !== antes) {
    setAntes(value);
    if (parse(txt) !== value) setTxt(fmt(value));
  }
  return (
    <input
      {...props}
      value={txt}
      inputMode={decimal ? "decimal" : "numeric"}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = parse(e.target.value);
        setAntes(n);
        onValue(n);
      }}
      onBlur={() => setTxt(fmt(parse(txt)))}
    />
  );
}
