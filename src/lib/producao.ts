import { z } from "zod";

/**
 * Produção (aba do painel): insumos, os fornecedores de cada um, a receita e
 * o plano do lote, editados no próprio painel e salvos no banco do site
 * (Redis, `producao:dados`), um cadastro só pra equipe toda. Não passa pelo
 * Bling.
 *
 * A lista é POR INSUMO: cada insumo tem uma ou mais cotações de fornecedor
 * (preço por faixa, mínimo, múltiplo, prazo, frete). A calculadora usa o
 * fornecedor marcado como principal e mostra quanto sairia com cada um, pra
 * dar pra comparar e desenvolver fornecedores novos.
 */

export const CATEGORIAS = ["Líquido", "Embalagem", "Serviço", "Outro"] as const;

/**
 * Quanto do insumo vai em cada lata:
 * - `fernet` / `cola`: vem da receita (ml por lata → litros);
 * - `lata`: quantidade fixa por lata envasada (`qtd`);
 * - `pack`: quantidade por six pack montado (`qtd` por pack).
 */
export const USOS = ["fernet", "cola", "lata", "pack"] as const;

export const LATA_ML = 350;

const faixa = z.object({
  /** A partir de quantas unidades de compra vale este preço. */
  de: z.number().min(0).max(1e9),
  precoCents: z.number().int().min(0).max(1e10),
});

export const fornecedorSchema = z.object({
  id: z.string().min(1).max(40),
  nome: z.string().trim().max(80),
  contato: z.string().trim().max(120),
  faixas: z.array(faixa).min(1).max(10),
  /** Pedido mínimo, na unidade do insumo. */
  minimo: z.number().min(0).max(1e9),
  /** Vende só em múltiplos disso (palete, caixa, milheiro). 0 = qualquer quantidade. */
  multiplo: z.number().min(0).max(1e9),
  prazoDias: z.number().int().min(0).max(3650),
  /** Frete do pedido até o envase (R$ por pedido). */
  freteCents: z.number().int().min(0).max(1e10),
  /** Data da cotação (AAAA-MM-DD): preço velho é preço a conferir. */
  cotadoEm: z.string().max(10).nullable(),
  obs: z.string().trim().max(300),
  /** Cotação de exemplo que ainda não foi editada. */
  exemplo: z.boolean().optional(),
});

export const insumoSchema = z.object({
  id: z.string().min(1).max(40),
  insumo: z.string().trim().min(1).max(80),
  categoria: z.enum(CATEGORIAS),
  unidade: z.string().trim().min(1).max(30),
  uso: z.enum(USOS),
  qtd: z.number().min(0).max(1e6),
  /** Quanto já tem guardado (na unidade do insumo). */
  estoque: z.number().min(0).max(1e9),
  /** Compra a mais pra cobrir perda/quebra deste insumo (%). */
  perdaPct: z.number().min(0).max(90),
  /** Envase/serviço: só começa quando os outros insumos chegam. */
  depois: z.boolean(),
  fornecedores: z.array(fornecedorSchema).max(20),
  /** Fornecedor usado na calculadora (id). Sem ele, vale o primeiro. */
  principal: z.string().max(40).nullable(),
  /** Linha de exemplo que ainda não foi editada. */
  exemplo: z.boolean().optional(),
});

export const planoSchema = z.object({
  litros: z.number().min(0).max(1e7),
  /** Six packs a montar no lote. `null` = todas as latas boas viram pack. */
  sixPacks: z.number().int().min(0).max(1e7).nullable(),
  /** Latas que não saem boas do envase (%). */
  perdaEnvasePct: z.number().min(0).max(90),
  /** Quer o lote pronto até (AAAA-MM-DD). */
  prontoAte: z.string().max(10).nullable(),
});

export const receitaSchema = z.object({
  fernetMl: z.number().min(0).max(LATA_ML).nullable(),
  colaMl: z.number().min(0).max(LATA_ML).nullable(),
});

// ── Lotes de produção ───────────────────────────────────────────────────────

/** Caminho do lote: planejado → insumos pedidos → envasando → concluído. */
export const ETAPAS = ["planejado", "pedido", "envasando", "concluido", "cancelado"] as const;
/** Validade da lata a partir do envase. */
export const VALIDADE_MESES = 12;
/** Lote "completo" = saiu com pelo menos isto das latas boas planejadas. */
export const COMPLETO_MIN = 0.95;

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

/** Um insumo do lote: o planejado (congelado ao criar) e o que aconteceu. */
export const loteItemSchema = z.object({
  insumoId: z.string().max(40),
  insumo: z.string().max(80),
  unidade: z.string().max(30),
  uso: z.enum(USOS),
  categoria: z.enum(CATEGORIAS),
  depois: z.boolean(),
  fornecedorId: z.string().max(40).nullable(),
  fornecedor: z.string().max(80),
  /** Consumo do lote (com a perda do insumo). */
  precisa: z.number().min(0).max(1e9),
  /** Parte que sai do estoque (reservada enquanto o lote está aberto). */
  doEstoque: z.number().min(0).max(1e9),
  comprar: z.number().min(0).max(1e9),
  /** Custo planejado de cada unidade (com o frete diluído). */
  unitCents: z.number().min(0).max(1e10),
  desembolsoCents: z.number().int().min(0).max(1e12),
  /** Prazo prometido pelo fornecedor. */
  prazoDias: z.number().int().min(0).max(3650),
  pedidoEm: dia,
  /** Data prometida de chegada (ou de fim do serviço). */
  previstoEm: dia,
  chegouEm: dia,
  recebido: z.number().min(0).max(1e9).nullable(),
  pagoCents: z.number().int().min(0).max(1e12).nullable(),
});

export const loteSchema = z.object({
  id: z.string().min(1).max(40),
  codigo: z.string().trim().min(1).max(20),
  etapa: z.enum(ETAPAS),
  criadoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plano: planoSchema,
  receita: receitaSchema,
  /** Planejado: latas envasadas, boas e six packs. */
  envasadas: z.number().int().min(0).max(1e8),
  boas: z.number().int().min(0).max(1e8),
  packs: z.number().int().min(0).max(1e8),
  /** Pronto previsto quando o lote foi criado (se pedisse tudo naquele dia). */
  prontoPlanejado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  itens: z.array(loteItemSchema).max(100),
  envaseEm: dia,
  /** Quando ficou pronto de verdade (concluído). */
  prontoEm: dia,
  validade: dia,
  latasBoas: z.number().int().min(0).max(1e8).nullable(),
  sixPacksMontados: z.number().int().min(0).max(1e8).nullable(),
  /** Quando o lote acabou (vendeu tudo): mostra quanto tempo um lote dura. */
  acabouEm: dia,
  obs: z.string().max(500),
});

/**
 * Compra registrada à mão (fora de um lote): pedidos antigos ou avulsos.
 * As compras feitas dentro dos lotes entram no histórico sozinhas.
 */
export const compraSchema = z.object({
  id: z.string().min(1).max(40),
  insumoId: z.string().max(40),
  fornecedorId: z.string().max(40).nullable(),
  fornecedor: z.string().trim().max(80),
  /** Como a equipe chama o pedido ("1º pedido", nº da nota…). */
  pedido: z.string().trim().max(40),
  data: dia,
  /** Ordem dos pedidos sem data (1, 2, 3…). */
  ordem: z.number().int().min(0).max(1e6),
  quantidade: z.number().positive().max(1e9),
  /** Valor dos itens, sem o frete. */
  valorCents: z.number().int().min(0).max(1e12),
  /** Parte do frete do pedido que coube a este insumo. */
  freteCents: z.number().int().min(0).max(1e12),
  obs: z.string().trim().max(300),
});

export const producaoSchema = z.object({
  versao: z.literal(2),
  insumos: z.array(insumoSchema).max(100),
  receita: receitaSchema,
  plano: planoSchema,
  lotes: z.array(loteSchema).max(300).default([]),
  compras: z.array(compraSchema).max(2000).default([]),
  /** Importações de dados já aplicadas (cada uma roda uma vez só). */
  importacoes: z.array(z.string().max(60)).max(50).default([]),
  atualizadoEm: z.string().optional(),
});

export type Faixa = z.infer<typeof faixa>;
export type Fornecedor = z.infer<typeof fornecedorSchema>;
export type Insumo = z.infer<typeof insumoSchema>;
export type Plano = z.infer<typeof planoSchema>;
export type Etapa = (typeof ETAPAS)[number];
export type LoteItem = z.infer<typeof loteItemSchema>;
export type Lote = z.infer<typeof loteSchema>;
export type Compra = z.infer<typeof compraSchema>;
export type ProducaoData = z.infer<typeof producaoSchema>;

export const PRODUCAO_KEY = "producao:dados";
/** Cópia do cadastro no formato antigo (uma linha por fornecedor), feita na 1ª gravação nova. */
export const PRODUCAO_BACKUP_V1 = "producao:dados:v1";

export const PLANO_PADRAO: Plano = {
  litros: 1750,
  sixPacks: null,
  perdaEnvasePct: 2,
  prontoAte: null,
};

// ── Formato antigo (até 07/11): uma linha por fornecedor ────────────────────

const legadoSchema = z.object({
  insumos: z.array(
    z.object({
      id: z.string(),
      insumo: z.string(),
      fornecedor: z.string(),
      contato: z.string(),
      categoria: z.enum(CATEGORIAS),
      unidade: z.string(),
      uso: z.enum(USOS),
      qtd: z.number(),
      faixas: z.array(faixa).min(1),
      minimo: z.number(),
      prazoDias: z.number(),
      depois: z.boolean(),
      exemplo: z.boolean().optional(),
    }),
  ),
  receita: z.object({ fernetMl: z.number().nullable(), colaMl: z.number().nullable() }),
  atualizadoEm: z.string().optional(),
});

const chave = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Lê o que está no banco. Formato novo → como está. Formato antigo → junta
 * as linhas do mesmo insumo (mesmo nome e mesmo uso) num insumo só, com cada
 * linha virando uma cotação de fornecedor. Nada se perde.
 */
export function lerProducao(raw: unknown): ProducaoData | null {
  const novo = producaoSchema.safeParse(raw);
  if (novo.success) return novo.data;
  const velho = legadoSchema.safeParse(raw);
  if (!velho.success) return null;

  const insumos: Insumo[] = [];
  for (const l of velho.data.insumos) {
    const forn: Fornecedor = {
      id: `f-${l.id}`.slice(0, 40),
      nome: l.fornecedor,
      contato: l.contato,
      faixas: l.faixas,
      minimo: l.minimo,
      multiplo: 0,
      prazoDias: Math.round(l.prazoDias),
      freteCents: 0,
      cotadoEm: null,
      obs: "",
      ...(l.exemplo ? { exemplo: true } : {}),
    };
    const same = insumos.find((i) => chave(i.insumo) === chave(l.insumo) && i.uso === l.uso);
    if (same) {
      same.fornecedores.push(forn);
      same.exemplo = same.exemplo && l.exemplo;
      continue;
    }
    insumos.push({
      id: l.id,
      insumo: l.insumo,
      categoria: l.categoria,
      unidade: l.unidade,
      uso: l.uso,
      qtd: l.qtd,
      estoque: 0,
      perdaPct: 0,
      depois: l.depois,
      fornecedores: [forn],
      principal: forn.id,
      ...(l.exemplo ? { exemplo: true } : {}),
    });
  }
  const parsed = producaoSchema.safeParse({
    versao: 2,
    insumos,
    receita: velho.data.receita,
    plano: PLANO_PADRAO,
    lotes: [],
    compras: [],
    importacoes: [],
    atualizadoEm: velho.data.atualizadoEm,
  });
  return parsed.success ? parsed.data : null;
}

// ── Contas (as mesmas na tela e em qualquer outro lugar) ────────────────────

/** A faixa de preço que vale pra essa quantidade. */
export const faixaDe = (faixas: Faixa[], qtd: number) =>
  [...faixas].sort((a, b) => b.de - a.de).find((f) => qtd >= f.de) ?? faixas[0];

export const principalDe = (i: Insumo) =>
  i.fornecedores.find((f) => f.id === i.principal) ?? i.fornecedores[0] ?? null;

/** Arredonda pra cima até o múltiplo (0 = sem múltiplo). */
const ateMultiplo = (n: number, m: number) => (m > 0 ? Math.ceil(n / m - 1e-9) * m : n);

/** O lote: latas envasadas, latas boas e six packs. */
export function lote(plano: Plano) {
  const envasadas = Math.floor((plano.litros * 1000) / LATA_ML);
  const boas = Math.floor(envasadas * (1 - plano.perdaEnvasePct / 100));
  const maxPacks = Math.floor(boas / 6);
  const packs = Math.min(maxPacks, plano.sixPacks ?? maxPacks);
  return { envasadas, boas, packs, maxPacks, avulsas: boas - packs * 6 };
}

export type Cotacao = {
  f: Fornecedor;
  /** Quanto comprar com esse fornecedor (já com mínimo e múltiplo). */
  comprar: number;
  faixa: Faixa;
  /** Desembolso: compra + frete. */
  totalCents: number;
  /** Custo de cada unidade do insumo, com o frete diluído. */
  unitCents: number;
  /** Comprou por causa do mínimo ou do múltiplo, não da necessidade. */
  ajustado: "minimo" | "multiplo" | null;
};

/** Quanto sai comprar `falta` unidades com este fornecedor. */
export function cotar(f: Fornecedor, falta: number, inteiro: boolean): Cotacao {
  const base = inteiro ? Math.ceil(falta - 1e-9) : falta;
  if (base <= 0) {
    const faixa = faixaDe(f.faixas, 0);
    return { f, comprar: 0, faixa, totalCents: 0, unitCents: faixa.precoCents, ajustado: null };
  }
  const comMinimo = Math.max(base, f.minimo);
  const comprar = ateMultiplo(comMinimo, f.multiplo);
  const faixa = faixaDe(f.faixas, comprar);
  const totalCents = Math.round(comprar * faixa.precoCents) + f.freteCents;
  return {
    f,
    comprar,
    faixa,
    totalCents,
    unitCents: totalCents / comprar,
    ajustado: comprar > comMinimo ? "multiplo" : comMinimo > base ? "minimo" : null,
  };
}

export type LinhaPlano = {
  i: Insumo;
  /** Por lata (ou por pack, se `uso` = pack); `null` = falta a receita. */
  por: number | null;
  /** Consumo do lote, já com a perda do insumo. */
  precisa: number | null;
  /** O que falta comprar depois de usar o estoque. */
  falta: number;
  /** Cotação do fornecedor principal (`null` = sem fornecedor). */
  escolhida: Cotacao | null;
  /** Cotações de todos os fornecedores, a mais barata primeiro. */
  cotacoes: Cotacao[];
  /** Custo do que o lote consome (não do que sobra no estoque). */
  consumoCents: number;
  /** Prazo que conta: 0 se não precisa comprar. */
  prazo: number;
};

/**
 * Plano do lote insumo por insumo. `disponivel` = estoque que sobra depois
 * das reservas dos lotes abertos (sem ele, vale o estoque cadastrado).
 */
export function planejar(data: ProducaoData, disponivel?: Map<string, number>): LinhaPlano[] {
  const { envasadas, packs } = lote(data.plano);
  const { receita } = data;
  return data.insumos.map((i) => {
    const por =
      i.uso === "fernet"
        ? receita.fernetMl === null
          ? null
          : receita.fernetMl / 1000
        : i.uso === "cola"
          ? receita.colaMl === null
            ? null
            : receita.colaMl / 1000
          : i.qtd;
    // Líquido, lata e envase vão em toda lata envasada (as perdidas também);
    // embalagem de pack só nos packs montados.
    const unidades = i.uso === "pack" ? packs : envasadas;
    const inteiro = i.categoria !== "Líquido";
    if (por === null)
      return {
        i,
        por,
        precisa: null,
        falta: 0,
        escolhida: null,
        cotacoes: [],
        consumoCents: 0,
        prazo: 0,
      };
    const bruto = por * unidades * (1 + i.perdaPct / 100);
    const precisa = inteiro ? Math.ceil(bruto - 1e-9) : bruto;
    const temos = Math.max(0, disponivel?.get(i.id) ?? i.estoque);
    // Serviço (envase) não tem estoque: é sempre contratado.
    const falta = i.categoria === "Serviço" ? precisa : Math.max(0, precisa - temos);
    const cotacoes = i.fornecedores
      .map((f) => cotar(f, falta, inteiro))
      .sort((a, b) => a.totalCents - b.totalCents || a.f.prazoDias - b.f.prazoDias);
    const p = principalDe(i);
    const escolhida = p ? (cotacoes.find((c) => c.f.id === p.id) ?? null) : null;
    // O que vem do estoque também custa: vale o preço da cotação principal.
    const consumoCents = escolhida ? Math.round(precisa * escolhida.unitCents) : 0;
    return {
      i,
      por,
      precisa,
      falta,
      escolhida,
      cotacoes,
      consumoCents,
      prazo: falta > 0 && escolhida ? escolhida.f.prazoDias : 0,
    };
  });
}

/** Totais do plano: custos, prazo, gargalo e o "pedir até" de cada insumo. */
export function resumo(data: ProducaoData, linhas: LinhaPlano[]) {
  const l = lote(data.plano);
  const receitaOk = data.receita.fernetMl !== null && data.receita.colaMl !== null;
  const desembolso = linhas.reduce((n, x) => n + (x.escolhida?.totalCents ?? 0), 0);
  const consumoLata = linhas
    .filter((x) => x.i.uso !== "pack")
    .reduce((n, x) => n + x.consumoCents, 0);
  const consumoPack = linhas
    .filter((x) => x.i.uso === "pack")
    .reduce((n, x) => n + x.consumoCents, 0);
  // Custo por lata BOA: as que se perdem no envase pesam nas que sobram.
  const lataCents = receitaOk && l.boas > 0 ? Math.round(consumoLata / l.boas) : null;
  const embalagemPackCents = l.packs > 0 ? Math.round(consumoPack / l.packs) : 0;
  const packCents = lataCents === null ? null : lataCents * 6 + embalagemPackCents;

  const antes = linhas.filter((x) => !x.i.depois);
  const depois = linhas.filter((x) => x.i.depois);
  const espera = Math.max(0, ...antes.map((x) => x.prazo));
  // O serviço (envase) leva o tempo dele mesmo se não houver nada a comprar.
  const servico = Math.max(0, ...depois.map((x) => principalDe(x.i)?.prazoDias ?? 0));
  const prazo = espera + servico;
  const gargalo = antes.reduce<LinhaPlano | null>(
    (a, b) => (b.prazo > (a?.prazo ?? 0) ? b : a),
    null,
  );
  const semFornecedor = linhas.filter((x) => x.falta > 0 && !x.escolhida);
  return {
    ...l,
    receitaOk,
    desembolso,
    lataCents,
    packCents,
    embalagemPackCents,
    prazo,
    espera,
    servico,
    gargalo,
    semFornecedor,
  };
}

// ── Datas (dia de Brasília, AAAA-MM-DD) ─────────────────────────────────────

export function hojeBR() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string) {
  return Math.round(
    (new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

/**
 * Até quando pedir cada insumo pra ficar pronto em `prontoAte`: o serviço
 * (envase) começa `servico` dias antes; os insumos têm de chegar até lá.
 */
export function pedirAte(linha: LinhaPlano, prontoAte: string, servico: number) {
  if (linha.i.depois) return somarDias(prontoAte, -(principalDe(linha.i)?.prazoDias ?? 0));
  if (linha.falta <= 0 || !linha.escolhida) return null;
  return somarDias(prontoAte, -servico - linha.escolhida.f.prazoDias);
}

// ── Lotes: criar, trocar fornecedor, totais e indicadores ──────────────────

const ABERTAS: Etapa[] = ["planejado", "pedido", "envasando"];
export const loteAberto = (l: Lote) => ABERTAS.includes(l.etapa);

export function somarMeses(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** Próximo número: L001, L002… (o maior que existe + 1). */
export function proximoCodigo(lotes: Lote[]) {
  const n = Math.max(0, ...lotes.map((l) => Number(/^L(\d+)$/i.exec(l.codigo)?.[1] ?? 0)));
  return `L${String(n + 1).padStart(3, "0")}`;
}

/** Estoque de cada insumo já reservado pelos lotes abertos. */
export function reservas(lotes: Lote[]) {
  const map = new Map<string, number>();
  for (const l of lotes.filter(loteAberto))
    for (const it of l.itens) map.set(it.insumoId, (map.get(it.insumoId) ?? 0) + it.doEstoque);
  return map;
}

/** Estoque que sobra pra um lote novo (cadastrado − reservado). */
export function disponiveis(data: ProducaoData) {
  const res = reservas(data.lotes);
  return new Map(data.insumos.map((i) => [i.id, Math.max(0, i.estoque - (res.get(i.id) ?? 0))]));
}

/** Congela o plano atual num lote novo. */
export function criarLote(data: ProducaoData, linhas: LinhaPlano[], id: string): Lote {
  const l = lote(data.plano);
  const r = resumo(data, linhas);
  const hoje = hojeBR();
  return {
    id,
    codigo: proximoCodigo(data.lotes),
    etapa: "planejado",
    criadoEm: hoje,
    plano: data.plano,
    receita: data.receita,
    envasadas: l.envasadas,
    boas: l.boas,
    packs: l.packs,
    prontoPlanejado: somarDias(hoje, r.prazo),
    itens: linhas
      .filter((x) => x.precisa !== null && x.precisa > 0)
      .map((x) => {
        const c = x.escolhida;
        // 3 casas bastam (litro com ml); evita 353,50000000000006 no banco.
        const r3 = (n: number) => Math.round(n * 1000) / 1000;
        const precisa = r3(x.precisa ?? 0);
        return {
          insumoId: x.i.id,
          insumo: x.i.insumo,
          unidade: x.i.unidade,
          uso: x.i.uso,
          categoria: x.i.categoria,
          depois: x.i.depois,
          fornecedorId: c?.f.id ?? null,
          fornecedor: c?.f.nome ?? "",
          precisa,
          doEstoque: r3(Math.max(0, precisa - x.falta)),
          comprar: r3(c?.comprar ?? x.falta),
          unitCents: c?.unitCents ?? 0,
          desembolsoCents: c?.totalCents ?? 0,
          prazoDias: c?.f.prazoDias ?? 0,
          pedidoEm: null,
          previstoEm: null,
          chegouEm: null,
          recebido: null,
          pagoCents: null,
        };
      }),
    envaseEm: null,
    prontoEm: null,
    validade: null,
    latasBoas: null,
    sixPacksMontados: null,
    acabouEm: null,
    obs: "",
  };
}

/** Lote ainda planejado: troca o fornecedor de um insumo (refaz a cotação). */
export function trocarFornecedor(item: LoteItem, f: Fornecedor): LoteItem {
  const falta = Math.max(0, item.precisa - item.doEstoque);
  const c = cotar(f, falta, item.categoria !== "Líquido");
  return {
    ...item,
    fornecedorId: f.id,
    fornecedor: f.nome,
    comprar: c.comprar,
    unitCents: c.unitCents,
    desembolsoCents: c.totalCents,
    prazoDias: f.prazoDias,
  };
}

/** Custo real de cada unidade: o que foi pago ÷ o que chegou (sem isso, o planejado). */
const unitReal = (it: LoteItem) => {
  const qtd = it.recebido ?? it.comprar;
  return it.pagoCents !== null && qtd > 0 ? it.pagoCents / qtd : it.unitCents;
};

export type Situacao = "chegou" | "no-prazo" | "atrasado" | "a-pedir" | "estoque";

/** Como está um insumo do lote em relação ao prometido. */
export function situacaoItem(it: LoteItem, hoje: string) {
  if (it.comprar <= 0 && !it.depois) return { s: "estoque" as Situacao, dias: 0 };
  if (!it.pedidoEm) return { s: "a-pedir" as Situacao, dias: 0 };
  if (it.chegouEm)
    return {
      s: "chegou" as Situacao,
      dias: it.previstoEm ? diasEntre(it.previstoEm, it.chegouEm) : 0,
    };
  if (it.previstoEm && it.previstoEm < hoje)
    return { s: "atrasado" as Situacao, dias: diasEntre(it.previstoEm, hoje) };
  return { s: "no-prazo" as Situacao, dias: 0 };
}

/** Tudo que o painel mostra de um lote: planejado × real e as datas. */
export function totaisLote(l: Lote, hoje = hojeBR()) {
  const lata = l.itens.filter((it) => it.uso !== "pack");
  const pack = l.itens.filter((it) => it.uso === "pack");
  const soma = (xs: LoteItem[], f: (it: LoteItem) => number) => xs.reduce((n, it) => n + f(it), 0);
  const desembolso = soma(l.itens, (it) => it.desembolsoCents);
  const pago = soma(l.itens, (it) => it.pagoCents ?? 0);
  const lataPlan =
    l.boas > 0 ? Math.round(soma(lata, (it) => it.precisa * it.unitCents) / l.boas) : null;
  const packPlan =
    lataPlan === null
      ? null
      : lataPlan * 6 +
        (l.packs > 0 ? Math.round(soma(pack, (it) => it.precisa * it.unitCents) / l.packs) : 0);
  const boasReal = l.latasBoas;
  const lataReal =
    boasReal && boasReal > 0
      ? Math.round(soma(lata, (it) => it.precisa * unitReal(it)) / boasReal)
      : null;

  // Previsão de pronto: a última chegada dos insumos + o serviço (envase).
  const servico = Math.max(0, ...l.itens.filter((it) => it.depois).map((it) => it.prazoDias));
  const chegadas = l.itens
    .filter((it) => !it.depois && it.comprar > 0)
    .map((it) => it.chegouEm ?? it.previstoEm ?? somarDias(it.pedidoEm ?? hoje, it.prazoDias));
  const insumosProntos = chegadas.reduce(
    (a, b) => (b > a ? b : a),
    hoje < l.criadoEm ? l.criadoEm : hoje,
  );
  const prontoPrevisto =
    l.prontoEm ??
    (l.envaseEm ? somarDias(l.envaseEm, servico) : somarDias(insumosProntos, servico));
  const meta = l.plano.prontoAte ?? l.prontoPlanejado;
  const atraso = diasEntre(meta, prontoPrevisto);

  const concluido = l.etapa === "concluido" && boasReal !== null;
  const rendimento = concluido && l.boas > 0 ? boasReal! / l.boas : null;
  const perdaReal = concluido && l.envasadas > 0 ? 1 - boasReal! / l.envasadas : null;
  const noPrazo = concluido && l.prontoEm ? l.prontoEm <= meta : null;
  const completo = concluido ? boasReal! >= l.boas * COMPLETO_MIN : null;
  const durou = l.acabouEm && l.prontoEm ? diasEntre(l.prontoEm, l.acabouEm) : null;
  return {
    desembolso,
    pago,
    lataPlan,
    packPlan,
    lataReal,
    servico,
    prontoPrevisto,
    meta,
    atraso,
    rendimento,
    perdaReal,
    noPrazo,
    completo,
    durou,
  };
}

/** Indicadores dos lotes concluídos (o topo da aba). */
export function indicadores(lotes: Lote[]) {
  const feitos = lotes
    .filter((l) => l.etapa === "concluido" && l.latasBoas !== null)
    .sort((a, b) => (b.prontoEm ?? b.criadoEm).localeCompare(a.prontoEm ?? a.criadoEm));
  const t = feitos.map((l) => ({ l, t: totaisLote(l) }));
  const boasPlan = feitos.reduce((n, l) => n + l.boas, 0);
  const boasReal = feitos.reduce((n, l) => n + (l.latasBoas ?? 0), 0);
  const envasadas = feitos.reduce((n, l) => n + l.envasadas, 0);
  const perdaPlan = envasadas > 0 ? 1 - boasPlan / envasadas : null;
  const otif = t.filter((x) => x.t.noPrazo && x.t.completo).length;
  return {
    feitos: t,
    rendimento: boasPlan > 0 ? boasReal / boasPlan : null,
    perdaReal: envasadas > 0 ? 1 - boasReal / envasadas : null,
    perdaPlan,
    ultimo: t[0] ?? null,
    otif,
    otifPct: t.length ? otif / t.length : null,
  };
}

/** Pontualidade de cada fornecedor, pelas chegadas registradas nos lotes. */
export function pontualidade(lotes: Lote[]) {
  const map = new Map<string, { entregas: number; noPrazo: number; atrasoTotal: number }>();
  for (const l of lotes)
    for (const it of l.itens) {
      if (!it.fornecedorId || !it.chegouEm || !it.previstoEm) continue;
      const atraso = diasEntre(it.previstoEm, it.chegouEm);
      const p = map.get(it.fornecedorId) ?? { entregas: 0, noPrazo: 0, atrasoTotal: 0 };
      p.entregas++;
      if (atraso <= 0) p.noPrazo++;
      p.atrasoTotal += Math.max(0, atraso);
      map.set(it.fornecedorId, p);
    }
  return map;
}

/**
 * Concluir: o estoque de cada insumo vira estoque − usado + recebido
 * (o que veio a mais por mínimo/múltiplo fica guardado). Serviço não tem estoque.
 */
export function estoqueAoConcluir(insumos: Insumo[], l: Lote) {
  return insumos.map((i) => {
    const its = l.itens.filter((it) => it.insumoId === i.id && it.categoria !== "Serviço");
    if (!its.length) return i;
    const delta = its.reduce((n, it) => n + (it.recebido ?? it.comprar) - it.precisa, 0);
    return { ...i, estoque: Math.max(0, i.estoque + delta) };
  });
}

/** Cancelar: o que já chegou entra no estoque (a reserva some sozinha). */
export function estoqueAoCancelar(insumos: Insumo[], l: Lote) {
  return insumos.map((i) => {
    const its = l.itens.filter(
      (it) => it.insumoId === i.id && it.categoria !== "Serviço" && it.chegouEm,
    );
    if (!its.length) return i;
    const delta = its.reduce((n, it) => n + (it.recebido ?? it.comprar), 0);
    return { ...i, estoque: i.estoque + delta };
  });
}

// ── Histórico de compras ────────────────────────────────────────────────────

export type LinhaCompra = {
  id: string;
  /** `null` = registrada à mão; senão, o código do lote. */
  lote: string | null;
  pedido: string;
  data: string | null;
  ordem: number;
  fornecedorId: string | null;
  fornecedor: string;
  quantidade: number;
  /** Total pago, com frete. */
  totalCents: number;
  /** Frete (`null` = não separado, compras de lote). */
  freteCents: number | null;
  unitCents: number;
};

/** Compras de um insumo: as registradas + as dos lotes (com chegada ou valor pago). */
export function comprasDo(data: ProducaoData, insumoId: string): LinhaCompra[] {
  const registradas: LinhaCompra[] = data.compras
    .filter((c) => c.insumoId === insumoId)
    .map((c) => ({
      id: c.id,
      lote: null,
      pedido: c.pedido,
      data: c.data,
      ordem: c.ordem,
      fornecedorId: c.fornecedorId,
      fornecedor: c.fornecedor,
      quantidade: c.quantidade,
      totalCents: c.valorCents + c.freteCents,
      freteCents: c.freteCents,
      unitCents: (c.valorCents + c.freteCents) / c.quantidade,
    }));
  const deLotes: LinhaCompra[] = data.lotes
    .filter((l) => l.etapa !== "cancelado")
    .flatMap((l) =>
      l.itens
        .filter(
          (it) =>
            it.insumoId === insumoId &&
            it.categoria !== "Serviço" &&
            it.comprar > 0 &&
            (it.chegouEm || it.pagoCents !== null),
        )
        .map((it) => {
          const quantidade = it.recebido ?? it.comprar;
          const totalCents = it.pagoCents ?? it.desembolsoCents;
          return {
            id: `${l.id}:${it.insumoId}`,
            lote: l.codigo,
            pedido: `Lote ${l.codigo}`,
            data: it.chegouEm ?? it.pedidoEm,
            ordem: 1e6,
            fornecedorId: it.fornecedorId,
            fornecedor: it.fornecedor,
            quantidade,
            totalCents,
            freteCents: null,
            unitCents: quantidade > 0 ? totalCents / quantidade : 0,
          };
        }),
    );
  // Registradas na ordem do pedido (ou por data, se as duas têm); as dos
  // lotes depois, por data.
  return [...registradas, ...deLotes].sort((a, b) => {
    if (a.data && b.data) return a.data.localeCompare(b.data) || a.ordem - b.ordem;
    if (!a.lote && !b.lote) return a.ordem - b.ordem;
    return (a.lote ? 1 : 0) - (b.lote ? 1 : 0);
  });
}

/** Custo médio (com frete) de tudo que já foi comprado do insumo. */
export function custoMedio(linhas: LinhaCompra[]) {
  const qtd = linhas.reduce((n, l) => n + l.quantidade, 0);
  const total = linhas.reduce((n, l) => n + l.totalCents, 0);
  return { qtd, total, unitCents: qtd > 0 ? total / qtd : null };
}

// ── Importação: pedidos de latas e coroas da LNF (até 11/2026) ──────────────

const IMPORT_LNF = "latas-coroas-lnf-2026-11";
/** Latas usadas no 1º lote (feito antes do painel): sai do estoque comprado. */
const LATAS_1O_LOTE = 994;
const PEDIDOS_LNF = [
  { n: 1, lata: [1584, 171527], coroa: [1170, 58905], frete: 29500 },
  { n: 2, lata: [1584, 154069], coroa: [1755, 84970], frete: 13200 },
  { n: 3, lata: [1584, 154069], coroa: [1755, 84970], frete: 13200 },
] as const;

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Lança os 3 pedidos de latas e coroas da LNF: insumos "Lata 350ml" e
 * "Coroa" (separa o exemplo "Lata 350ml + tampa"), cotação da LNF com o
 * preço do último pedido, histórico de compras (frete de cada pedido
 * dividido entre lata e coroa pelo valor) e o estoque que sobrou depois do
 * 1º lote. Roda uma vez (`importacoes`); `null` = já aplicada.
 */
export function importarComprasLNF(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_LNF)) return null;
  const nome = (i: Insumo) => semAcento(i.insumo);
  const insumos = [...data.insumos];

  const pedidos = PEDIDOS_LNF.map((p) => {
    const freteLata = Math.round((p.frete * p.lata[1]) / (p.lata[1] + p.coroa[1]));
    return { ...p, freteLata, freteCoroa: p.frete - freteLata };
  });
  const ultimo = pedidos[pedidos.length - 1];
  const soma = (k: "lata" | "coroa") => pedidos.reduce((n, p) => n + p[k][0], 0);

  const cotacao = (
    id: string,
    qtd: number,
    valor: number,
    frete: number,
    oque: string,
  ): Fornecedor => ({
    id,
    nome: "LNF",
    contato: "",
    faixas: [{ de: 0, precoCents: Math.round(valor / qtd) }],
    minimo: 0,
    multiplo: 0,
    prazoDias: 0,
    freteCents: frete,
    cotadoEm: null,
    obs: `Preço do último pedido (${qtd} ${oque}). Frete do pedido dividido entre latas e coroas pelo valor. Prazo ainda não informado.`,
  });

  /** Põe/atualiza a cotação da LNF no insumo e deixa ela como principal. */
  const comLNF = (i: Insumo, f: Fornecedor, estoque: number): Insumo => {
    const outras = i.fornecedores.filter((x) => !x.exemplo && semAcento(x.nome) !== "lnf");
    return {
      ...i,
      estoque,
      fornecedores: [f, ...outras],
      principal: f.id,
      exemplo: undefined,
    };
  };

  // Lata: o insumo de lata que já existe (o exemplo "Lata + tampa" vira só lata).
  const lataIdx = insumos.findIndex(
    (i) => /lata/.test(nome(i)) && !/coroa/.test(nome(i)) && i.uso === "lata",
  );
  const fLata = cotacao("f-lnf-lata", ultimo.lata[0], ultimo.lata[1], ultimo.freteLata, "latas");
  const estoqueLata = Math.max(0, soma("lata") - LATAS_1O_LOTE);
  const baseLata: Insumo =
    lataIdx >= 0
      ? insumos[lataIdx]
      : {
          id: "lata",
          insumo: "Lata 350ml",
          categoria: "Embalagem",
          unidade: "lata",
          uso: "lata",
          qtd: 1,
          estoque: 0,
          perdaPct: 1,
          depois: false,
          fornecedores: [],
          principal: null,
        };
  const lata = comLNF(
    {
      ...baseLata,
      insumo: /tampa|\+/.test(nome(baseLata)) ? "Lata 350ml" : baseLata.insumo,
      unidade: baseLata.exemplo ? "lata" : baseLata.unidade,
    },
    fLata,
    estoqueLata,
  );
  if (lataIdx >= 0) insumos[lataIdx] = lata;
  else insumos.push(lata);

  // Coroa (tampa da lata): usa a que existir ou cria logo depois da lata.
  const coroaIdx = insumos.findIndex(
    (i) => i.id !== lata.id && /coroa|tampa/.test(nome(i)) && i.uso === "lata",
  );
  const fCoroa = cotacao(
    "f-lnf-coroa",
    ultimo.coroa[0],
    ultimo.coroa[1],
    ultimo.freteCoroa,
    "coroas",
  );
  const estoqueCoroa = Math.max(0, soma("coroa") - LATAS_1O_LOTE);
  const coroa = comLNF(
    coroaIdx >= 0
      ? insumos[coroaIdx]
      : {
          id: "coroa",
          insumo: "Coroa (tampa da lata)",
          categoria: "Embalagem",
          unidade: "coroa",
          uso: "lata",
          qtd: 1,
          estoque: 0,
          perdaPct: 1,
          depois: false,
          fornecedores: [],
          principal: null,
        },
    fCoroa,
    estoqueCoroa,
  );
  if (coroaIdx >= 0) insumos[coroaIdx] = coroa;
  else insumos.splice(insumos.indexOf(lata) + 1, 0, coroa);

  const compras: Compra[] = pedidos.flatMap((p) => [
    {
      id: `lnf-${p.n}-lata`,
      insumoId: lata.id,
      fornecedorId: fLata.id,
      fornecedor: "LNF",
      pedido: `${p.n}º pedido`,
      data: null,
      ordem: p.n,
      quantidade: p.lata[0],
      valorCents: p.lata[1],
      freteCents: p.freteLata,
      obs: `Frete do pedido: R$ ${(p.frete / 100).toFixed(2).replace(".", ",")} (com as coroas)`,
    },
    {
      id: `lnf-${p.n}-coroa`,
      insumoId: coroa.id,
      fornecedorId: fCoroa.id,
      fornecedor: "LNF",
      pedido: `${p.n}º pedido`,
      data: null,
      ordem: p.n,
      quantidade: p.coroa[0],
      valorCents: p.coroa[1],
      freteCents: p.freteCoroa,
      obs: `Frete do pedido: R$ ${(p.frete / 100).toFixed(2).replace(".", ",")} (com as latas)`,
    },
  ]);
  return {
    ...data,
    insumos,
    compras: [...data.compras.filter((c) => !c.id.startsWith("lnf-")), ...compras],
    importacoes: [...data.importacoes, IMPORT_LNF],
  };
}

// ── Exemplos (ponto de partida pra editar ou apagar) ────────────────────────

const forn = (
  id: string,
  nome: string,
  faixas: Faixa[],
  minimo: number,
  prazoDias: number,
  extra: Partial<Fornecedor> = {},
): Fornecedor => ({
  id,
  nome,
  contato: "",
  faixas,
  minimo,
  multiplo: 0,
  prazoDias,
  freteCents: 0,
  cotadoEm: null,
  obs: "",
  exemplo: true,
  ...extra,
});

export const EXEMPLO: ProducaoData = {
  versao: 2,
  receita: { fernetMl: null, colaMl: null },
  plano: PLANO_PADRAO,
  lotes: [],
  compras: [],
  importacoes: [],
  insumos: [
    {
      id: "fernet",
      insumo: "Fernet",
      categoria: "Líquido",
      unidade: "litro",
      uso: "fernet",
      qtd: 0,
      estoque: 0,
      perdaPct: 1,
      depois: false,
      fornecedores: [
        forn(
          "f-fernet",
          "Fornecedor A",
          [
            { de: 0, precoCents: 6000 },
            { de: 200, precoCents: 5600 },
          ],
          50,
          10,
        ),
      ],
      principal: "f-fernet",
      exemplo: true,
    },
    {
      id: "cola",
      insumo: "Base de cola",
      categoria: "Líquido",
      unidade: "litro",
      uso: "cola",
      qtd: 0,
      estoque: 0,
      perdaPct: 1,
      depois: false,
      fornecedores: [forn("f-cola", "Fornecedor B", [{ de: 0, precoCents: 450 }], 200, 7)],
      principal: "f-cola",
      exemplo: true,
    },
    {
      id: "lata",
      insumo: "Lata 350ml + tampa",
      categoria: "Embalagem",
      unidade: "unidade",
      uso: "lata",
      qtd: 1,
      estoque: 0,
      perdaPct: 1,
      depois: false,
      fornecedores: [
        forn(
          "f-lata",
          "Fornecedor C",
          [
            { de: 0, precoCents: 95 },
            { de: 10000, precoCents: 85 },
          ],
          5000,
          21,
          { multiplo: 1000 },
        ),
        forn("f-lata-2", "Fornecedor C2 (cotação)", [{ de: 0, precoCents: 90 }], 3000, 30, {
          multiplo: 500,
          freteCents: 25000,
        }),
      ],
      principal: "f-lata",
      exemplo: true,
    },
    {
      id: "caixa",
      insumo: "Caixa six pack",
      categoria: "Embalagem",
      unidade: "caixa",
      uso: "pack",
      qtd: 1,
      estoque: 0,
      perdaPct: 0,
      depois: false,
      fornecedores: [forn("f-caixa", "Fornecedor D", [{ de: 0, precoCents: 350 }], 500, 12)],
      principal: "f-caixa",
      exemplo: true,
    },
    {
      id: "envase",
      insumo: "Envase",
      categoria: "Serviço",
      unidade: "lata envasada",
      uso: "lata",
      qtd: 1,
      estoque: 0,
      perdaPct: 0,
      depois: true,
      fornecedores: [forn("f-envase", "Fornecedor E", [{ de: 0, precoCents: 60 }], 3000, 5)],
      principal: "f-envase",
      exemplo: true,
    },
  ],
};
