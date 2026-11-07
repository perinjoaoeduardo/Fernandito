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

export const CATEGORIAS = ["Líquido", "Ingrediente", "Embalagem", "Serviço", "Outro"] as const;

/**
 * Quanto do insumo vai em cada lata:
 * - `receita`: ingrediente da bebida, `qtd` em ml ou g por 100 mL da parte
 *   em que entra (`parte`: o refri de cola ou o produto final);
 * - `lata`: quantidade fixa por lata envasada (`qtd`);
 * - `pack`: quantidade por six pack montado (`qtd` por pack);
 * - `fernet` / `cola`: formato antigo (ml por lata na receita), convertido
 *   para `receita` ao ler (`normalizar`).
 */
export const USOS = ["receita", "lata", "pack", "fernet", "cola"] as const;

/**
 * Onde o ingrediente entra: no refri de cola (que vira `refriPct` % da
 * bebida) ou direto no produto final (o fernet, por exemplo).
 */
export const PARTES = ["refri", "final"] as const;

export const LATA_ML = 350;

/** Unidades de medida que o cadastro oferece (dá pra digitar outra). */
export const UNIDADES = [
  { grupo: "Volume", itens: ["litro", "ml"] },
  { grupo: "Massa", itens: ["kg", "g"] },
  {
    grupo: "Contagem",
    itens: ["unidade", "lata", "coroa", "caixa", "rolo", "milheiro", "lata envasada"],
  },
] as const;

export type TipoUnidade = "volume" | "massa" | "contagem";

const unidadeLimpa = (u: string) =>
  u
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

/** Volume (litro, ml), massa (kg, g) ou contagem (o resto). */
export function tipoUnidade(u: string): TipoUnidade {
  const x = unidadeLimpa(u);
  if (/^(l|lt|litros?|ml|mililitros?)$/.test(x)) return "volume";
  if (/^(kg|kgs|quilos?|kilos?|quilogramas?|g|gr|gramas?)$/.test(x)) return "massa";
  return "contagem";
}

/** Só unidade de contagem se compra inteira (lata, caixa…); litro e kg aceitam quebrado. */
export const compraInteira = (u: string) => tipoUnidade(u) === "contagem";

/**
 * A receita vem em ml ou g por lata (conforme a unidade do insumo); isto é
 * quanto da unidade de compra vai em cada ml/g: litro e kg = 1/1000; ml e g = 1.
 */
export function fatorReceita(u: string) {
  return /^(ml|mililitros?|g|gr|gramas?)$/.test(unidadeLimpa(u)) ? 1 : 1 / 1000;
}

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
  /** Por lata, por pack, ou (receita) ml/g por 100 mL da parte. */
  qtd: z.number().min(0).max(1e6),
  /** Receita: entra no refri de cola ou no produto final. */
  parte: z.enum(PARTES).default("final"),
  /** Especificação (ex.: "Cristal", "0,6 g/L", "ajustar o pH para 2,5"). */
  especificacao: z.string().trim().max(120).default(""),
  /**
   * Quanto já tem guardado (na unidade do insumo). Muda por movimento
   * (chegada, consumo de lote, contagem), que fica em `movimentos`.
   */
  estoque: z.number().min(0).max(1e9),
  /** Valor do estoque pelo custo médio móvel (centavos). */
  valorEstoqueCents: z.number().min(0).max(1e13).default(0),
  /** Estoque mínimo (ponto de pedido): abaixo disso o painel avisa. */
  estoqueMinimo: z.number().min(0).max(1e9).default(0),
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
  /**
   * Data de produção (dia do envase), AAAA-MM-DD. Os insumos têm de chegar
   * até ela. O nome do campo ficou do tempo em que era "pronto até".
   */
  prontoAte: z.string().max(10).nullable(),
});

/**
 * A receita em si são os insumos com `uso: "receita"`. Aqui fica quanto do
 * produto final é refri de cola (o resto: fernet e o que entrar direto).
 * `fernetMl`/`colaMl` são do formato antigo (ml por lata), só pra converter.
 */
export const receitaSchema = z.object({
  refriPct: z.number().min(0).max(100).default(80),
  fernetMl: z.number().min(0).max(LATA_ML).nullable(),
  colaMl: z.number().min(0).max(LATA_ML).nullable(),
});

/** ml da parte (refri ou produto final) que vão em cada lata. */
export function mlDaParte(parte: (typeof PARTES)[number], refriPct: number) {
  return LATA_ML * (parte === "refri" ? refriPct / 100 : 1);
}

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
  /** A chegada já entrou no estoque (movimento lançado; modelo antigo). */
  noEstoque: z.boolean().default(false),
  /** Custo real do consumo (saída do estoque pelo custo médio), gravado ao concluir. */
  custoRealCents: z.number().min(0).max(1e13).nullable().default(null),
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
  /** Pronto previsto quando o lote foi criado (se pedisse tudo naquele dia, envase incluído). */
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
  /** Lote de antes do painel: só o realizado, fica fora dos indicadores. */
  historico: z.boolean().optional(),
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
  /** Pedido em aberto (a receber) ou já recebido. */
  status: z.enum(["pedido", "recebido"]).default("recebido"),
  /** Pedido em aberto: quando o fornecedor prometeu entregar. */
  previstoEm: dia.default(null),
  /** O recebimento já entrou no estoque (compras antigas, de antes do controle, não). */
  noEstoque: z.boolean().default(false),
});

/** Movimento de estoque (como no SAP: entrada, saída, ajuste). */
export const TIPOS_MOV = ["inicial", "entrada", "saida", "ajuste"] as const;
export const movimentoSchema = z.object({
  id: z.string().min(1).max(40),
  insumoId: z.string().max(40),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: z.enum(TIPOS_MOV),
  /** Quantidade com sinal: + entra, − sai. */
  qtd: z.number().min(-1e9).max(1e9),
  /** Valor com sinal (centavos). */
  valorCents: z.number().min(-1e13).max(1e13),
  /** Saldo depois do movimento. */
  saldoQtd: z.number().min(0).max(1e9),
  saldoValorCents: z.number().min(0).max(1e13),
  /** De onde veio ("PC-0004 · LNF", "Lote L002: consumo", "Contagem"…). */
  origem: z.string().max(80),
  /** Documento de material (MD-00001), como no SAP. */
  doc: z.string().max(20).default(""),
  /** Pedido de compra da entrada (PC-0004). */
  pc: z.string().max(20).nullable().default(null),
  /** Chave pra juntar correções do mesmo item (lote:item, compra). */
  ref: z.string().max(80).nullable(),
  obs: z.string().max(300),
});

/** Item do pedido de compra (um insumo). */
export const pcItemSchema = z.object({
  insumoId: z.string().max(40),
  /** Nome e unidade no momento do pedido. */
  insumo: z.string().max(80),
  unidade: z.string().max(30),
  qtd: z.number().positive().max(1e9),
  /** Valor dos itens, sem o frete (centavos). */
  valorCents: z.number().int().min(0).max(1e12),
  /** Quanto já entrou (soma dos recebimentos). */
  recebido: z.number().min(0).max(1e9).default(0),
});

/** Entrada de mercadoria (o MIGO 101): pode ser parcial. */
export const recebimentoSchema = z.object({
  doc: z.string().max(20),
  data: dia,
  itens: z.array(
    z.object({ idx: z.number().int().min(0).max(99), qtd: z.number().min(0).max(1e9) }),
  ),
  obs: z.string().max(300).default(""),
});

/** Pedido de compra (o ME21N): um fornecedor, vários insumos, número próprio. */
export const pedidoCompraSchema = z.object({
  id: z.string().min(1).max(40),
  numero: z.string().max(20),
  fornecedor: z.string().trim().max(80),
  data: dia,
  /** Prometido pelo fornecedor. */
  previstoEm: dia,
  /** Frete do pedido inteiro: dividido entre os itens pelo valor. */
  freteCents: z.number().int().min(0).max(1e12),
  itens: z.array(pcItemSchema).min(1).max(30),
  recebimentos: z.array(recebimentoSchema).max(60).default([]),
  /** Encerrado sem receber o resto (o que falta não conta mais como "em pedido"). */
  encerrado: z.boolean().default(false),
  /** De antes do controle de estoque: recebido sem movimento (já está no saldo inicial). */
  legado: z.boolean().default(false),
  obs: z.string().max(300).default(""),
});

export const producaoSchema = z.object({
  versao: z.literal(2),
  insumos: z.array(insumoSchema).max(100),
  receita: receitaSchema,
  plano: planoSchema,
  lotes: z.array(loteSchema).max(300).default([]),
  compras: z.array(compraSchema).max(2000).default([]),
  movimentos: z.array(movimentoSchema).max(3000).default([]),
  pedidos: z.array(pedidoCompraSchema).max(1000).default([]),
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
export type Movimento = z.infer<typeof movimentoSchema>;
export type PedidoCompra = z.infer<typeof pedidoCompraSchema>;
export type PcItem = z.infer<typeof pcItemSchema>;
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
      parte: "final",
      especificacao: "",
      estoque: 0,
      valorEstoqueCents: 0,
      estoqueMinimo: 0,
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
    // Receita: ml/g por 100 mL da parte → por lata → unidade de compra.
    const por =
      i.uso === "receita"
        ? ((i.qtd * mlDaParte(i.parte, receita.refriPct)) / 100) * fatorReceita(i.unidade)
        : i.uso === "fernet"
          ? receita.fernetMl === null
            ? null
            : receita.fernetMl * fatorReceita(i.unidade)
          : i.uso === "cola"
            ? receita.colaMl === null
              ? null
              : receita.colaMl * fatorReceita(i.unidade)
            : i.qtd;
    // Líquido, lata e envase vão em toda lata envasada (as perdidas também);
    // embalagem de pack só nos packs montados.
    const unidades = i.uso === "pack" ? packs : envasadas;
    const inteiro = compraInteira(i.unidade);
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
  const receitaOk = data.insumos.some((i) => i.uso === "receita" && i.qtd > 0);
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
 * Até quando pedir cada insumo pra ele chegar até a data de produção (dia
 * do envase). O serviço (envase) é marcado para o próprio dia.
 */
export function pedirAte(linha: LinhaPlano, producao: string) {
  if (linha.i.depois) return producao;
  if (linha.falta <= 0 || !linha.escolhida) return null;
  return somarDias(producao, -linha.escolhida.f.prazoDias);
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

/**
 * Reserva dos lotes abertos (o "consumo previsto"): cada lote reserva tudo
 * que vai consumir de cada insumo, como a reserva do SAP. Serviço não conta.
 */
export function reservas(lotes: Lote[]) {
  const map = new Map<string, number>();
  for (const l of lotes.filter(loteAberto))
    for (const it of l.itens)
      if (it.categoria !== "Serviço")
        map.set(it.insumoId, (map.get(it.insumoId) ?? 0) + it.precisa);
  return map;
}

/**
 * O que sobra pra um lote novo: estoque − reservado pelos lotes abertos +
 * o que ainda vai chegar dos pedidos de compra em aberto.
 */
export function disponiveis(data: ProducaoData) {
  const res = reservas(data.lotes);
  const ped = emPedidoPorInsumo(data);
  return new Map(
    data.insumos.map((i) => [
      i.id,
      Math.max(0, i.estoque - (res.get(i.id) ?? 0) + (ped.get(i.id) ?? 0)),
    ]),
  );
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
          noEstoque: false,
          custoRealCents: null,
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
  const c = cotar(f, falta, compraInteira(item.unidade));
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
      ? Math.round(soma(lata, (it) => it.custoRealCents ?? it.precisa * unitReal(it)) / boasReal)
      : null;

  // Produção prevista: o envase, se já tem data; senão, a última chegada dos
  // insumos. Pronto = produção + o tempo do serviço (envase).
  const servico = Math.max(0, ...l.itens.filter((it) => it.depois).map((it) => it.prazoDias));
  const chegadas = l.itens
    .filter((it) => !it.depois && it.comprar > 0)
    .map((it) => it.chegouEm ?? it.previstoEm ?? somarDias(it.pedidoEm ?? hoje, it.prazoDias));
  const insumosProntos = chegadas.reduce(
    (a, b) => (b > a ? b : a),
    hoje < l.criadoEm ? l.criadoEm : hoje,
  );
  const producaoPrevista = l.envaseEm ?? insumosProntos;
  const prontoPrevisto = l.prontoEm ?? somarDias(producaoPrevista, servico);
  // Meta = a data de produção marcada; sem ela, a mais cedo possível na criação.
  const meta = l.plano.prontoAte ?? somarDias(l.prontoPlanejado, -servico);
  const atraso = diasEntre(meta, producaoPrevista);

  const concluido = l.etapa === "concluido" && boasReal !== null;
  const rendimento = concluido && l.boas > 0 ? boasReal! / l.boas : null;
  const perdaReal = concluido && l.envasadas > 0 ? 1 - boasReal! / l.envasadas : null;
  const noPrazo = concluido && l.envaseEm ? l.envaseEm <= meta : null;
  const completo = concluido ? boasReal! >= l.boas * COMPLETO_MIN : null;
  const durou = l.acabouEm && l.prontoEm ? diasEntre(l.prontoEm, l.acabouEm) : null;
  return {
    desembolso,
    pago,
    lataPlan,
    packPlan,
    lataReal,
    servico,
    producaoPrevista,
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
  // Rendimento e perda: todos os concluídos (o histórico também, se tem plano).
  const comLatas = lotes.filter((l) => l.etapa === "concluido" && l.latasBoas !== null);
  // "No prazo": só os feitos pelo painel (o histórico não tem datas).
  const feitos = comLatas
    .filter((l) => !l.historico)
    .sort((a, b) => (b.prontoEm ?? b.criadoEm).localeCompare(a.prontoEm ?? a.criadoEm));
  const t = feitos.map((l) => ({ l, t: totaisLote(l) }));
  const boasPlan = comLatas.reduce((n, l) => n + l.boas, 0);
  const boasReal = comLatas.reduce((n, l) => n + (l.latasBoas ?? 0), 0);
  const envasadas = comLatas.reduce((n, l) => n + l.envasadas, 0);
  const perdaPlan = envasadas > 0 ? 1 - boasPlan / envasadas : null;
  const otif = t.filter((x) => x.t.noPrazo && x.t.completo).length;
  // Custo real: o lote concluído mais recente que tem custo (o histórico entra se tiver).
  const quando = (l: Lote) => l.prontoEm ?? l.envaseEm ?? l.criadoEm;
  const ultimo =
    comLatas
      .map((l) => ({ l, t: totaisLote(l) }))
      .filter((x) => (x.t.lataReal ?? 0) > 0)
      .sort(
        (a, b) =>
          quando(b.l).localeCompare(quando(a.l)) ||
          b.l.codigo.localeCompare(a.l.codigo, undefined, { numeric: true }),
      )[0] ?? null;
  return {
    feitos: t,
    rendimento: boasPlan > 0 ? boasReal / boasPlan : null,
    perdaReal: envasadas > 0 ? 1 - boasReal / envasadas : null,
    perdaPlan,
    ultimo,
    otif,
    otifPct: t.length ? otif / t.length : null,
  };
}

/**
 * Pontualidade de cada fornecedor (pelo nome), pelos pedidos de compra:
 * cada recebimento comparado com a data prometida do pedido.
 */
export function pontualidade(data: ProducaoData) {
  const map = new Map<string, { entregas: number; noPrazo: number; atrasoTotal: number }>();
  for (const pc of data.pedidos) {
    if (!pc.previstoEm) continue;
    for (const r of pc.recebimentos) {
      if (!r.data) continue;
      const atraso = diasEntre(pc.previstoEm, r.data);
      const k = chaveFornecedor(pc.fornecedor);
      const p = map.get(k) ?? { entregas: 0, noPrazo: 0, atrasoTotal: 0 };
      p.entregas++;
      if (atraso <= 0) p.noPrazo++;
      p.atrasoTotal += Math.max(0, atraso);
      map.set(k, p);
    }
  }
  return map;
}

/** Chave pra juntar o mesmo fornecedor escrito de jeitos diferentes. */
export const chaveFornecedor = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

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

/**
 * Compras recebidas de um insumo (os "últimos pedidos"): cada recebimento
 * de pedido de compra, com a parte do frete. Pedido antigo (legado) sem data
 * de recebimento conta pela ordem.
 */
export function comprasDo(data: ProducaoData, insumoId: string): LinhaCompra[] {
  const linhas: LinhaCompra[] = [];
  data.pedidos.forEach((pc, ordem) => {
    pc.itens.forEach((it, idx) => {
      if (it.insumoId !== insumoId) return;
      const unit = unitPedido(pc, idx);
      for (const r of pc.recebimentos)
        for (const x of r.itens.filter((y) => y.idx === idx && y.qtd > 0)) {
          const total = Math.round(unit * x.qtd);
          linhas.push({
            id: `${pc.id}:${idx}:${r.doc}`,
            lote: null,
            pedido: pc.numero,
            data: r.data ?? pc.data,
            ordem,
            fornecedorId: null,
            fornecedor: pc.fornecedor,
            quantidade: x.qtd,
            totalCents: total,
            freteCents: Math.round(fretePorUnidade(pc, idx) * x.qtd),
            unitCents: unit,
          });
        }
    });
  });
  // Lotes antigos (antes dos pedidos de compra) com compra registrada no próprio lote.
  for (const l of data.lotes.filter((x) => x.etapa !== "cancelado"))
    for (const it of l.itens)
      if (
        it.insumoId === insumoId &&
        it.categoria !== "Serviço" &&
        it.comprar > 0 &&
        it.pagoCents !== null &&
        l.historico
      ) {
        const q = it.recebido ?? it.comprar;
        linhas.push({
          id: `${l.id}:${it.insumoId}`,
          lote: l.codigo,
          pedido: `Lote ${l.codigo}`,
          data: it.chegouEm ?? it.pedidoEm,
          ordem: -1,
          fornecedorId: it.fornecedorId,
          fornecedor: it.fornecedor,
          quantidade: q,
          totalCents: it.pagoCents,
          freteCents: null,
          unitCents: q > 0 ? it.pagoCents / q : 0,
        });
      }
  return linhas.sort((a, b) =>
    a.data && b.data ? a.data.localeCompare(b.data) || a.ordem - b.ordem : a.ordem - b.ordem,
  );
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
          parte: "final",
          especificacao: "",
          estoque: 0,
          valorEstoqueCents: 0,
          estoqueMinimo: 0,
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
          parte: "final",
          especificacao: "",
          estoque: 0,
          valorEstoqueCents: 0,
          estoqueMinimo: 0,
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
      status: "recebido" as const,
      previstoEm: null,
      noEstoque: false,
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
      status: "recebido" as const,
      previstoEm: null,
      noEstoque: false,
    },
  ]);
  return {
    ...data,
    insumos,
    compras: [...data.compras.filter((c) => !c.id.startsWith("lnf-")), ...compras],
    importacoes: [...data.importacoes, IMPORT_LNF],
  };
}

// ── Receita por 100 mL (formato novo) ───────────────────────────────────────

/**
 * Converte o formato antigo (fernet e base de cola em ml por lata) para
 * ingredientes da receita por 100 mL do produto final.
 */
export function normalizar(data: ProducaoData): ProducaoData {
  if (!data.insumos.some((i) => i.uso === "fernet" || i.uso === "cola")) return data;
  return {
    ...data,
    insumos: data.insumos.map((i) => {
      if (i.uso !== "fernet" && i.uso !== "cola") return i;
      const porLata = (i.uso === "fernet" ? data.receita.fernetMl : data.receita.colaMl) ?? 0;
      return {
        ...i,
        uso: "receita" as const,
        parte: "final" as const,
        qtd: Math.round((porLata / LATA_ML) * 100 * 1000) / 1000,
      };
    }),
  };
}

const IMPORT_RECEITA = "receita-refri-fernet-cola-2026-11";

type Ingrediente = {
  id: string;
  nome: RegExp;
  insumo: string;
  especificacao: string;
  categoria: Insumo["categoria"];
  unidade: string;
  parte: (typeof PARTES)[number];
  qtd: number;
  fornecedor: string;
  precoCents: number;
};

/** A planilha "Refri de cola" + "Fernet Cola" (por 100 mL). */
const RECEITA_PLANILHA: Ingrediente[] = [
  {
    id: "acucar",
    nome: /a[cç]u[cç]ar/,
    insumo: "Açúcar cristal",
    especificacao: "Cristal",
    categoria: "Ingrediente",
    unidade: "kg",
    parte: "refri",
    qtd: 11,
    fornecedor: "Dinâmica",
    precoCents: 430,
  },
  {
    id: "preparado-cola",
    nome: /preparado/,
    insumo: "Preparado de cola",
    especificacao: "0,6 g/L",
    categoria: "Ingrediente",
    unidade: "litro",
    parte: "refri",
    qtd: 0.06,
    fornecedor: "Duas Rodas",
    precoCents: 7000,
  },
  {
    id: "corante-caramelo",
    nome: /corante|caramelo/,
    insumo: "Corante caramelo VI",
    especificacao: "0,12%",
    categoria: "Ingrediente",
    unidade: "litro",
    parte: "refri",
    qtd: 0.12,
    fornecedor: "Vêneto",
    precoCents: 1000,
  },
  {
    id: "acido-fosforico",
    nome: /fosf[oó]rico/,
    insumo: "Ácido fosfórico 85%",
    especificacao: "Ajustar o pH para 2,5",
    categoria: "Ingrediente",
    unidade: "kg",
    parte: "refri",
    qtd: 0.05,
    fornecedor: "Delaware",
    precoCents: 1990,
  },
  {
    id: "fernet",
    nome: /fernet/,
    insumo: "Fernet",
    especificacao: "",
    categoria: "Líquido",
    unidade: "litro",
    parte: "final",
    qtd: 20,
    fornecedor: "Casa Bucco",
    precoCents: 3500,
  },
];

/**
 * Lança a receita da planilha: refri de cola (açúcar, preparado, corante,
 * ácido; água QSP) = 80% da bebida, fernet = 20%. Cada ingrediente vira
 * insumo da receita com a cotação do fornecedor (preço por kg ou L, sem
 * prazo/mínimo ainda). O exemplo "Base de cola" sai (virou o refri). Roda
 * uma vez; `null` = já aplicada.
 */
export function importarReceita(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_RECEITA)) return null;
  let insumos = data.insumos.filter(
    (i) =>
      !(
        i.exemplo &&
        i.uso !== "lata" &&
        i.uso !== "pack" &&
        /cola/.test(semAcento(i.insumo)) &&
        !/fernet/.test(semAcento(i.insumo))
      ),
  );
  for (const g of RECEITA_PLANILHA) {
    const f: Fornecedor = {
      id: `f-${g.id}-${semAcento(g.fornecedor).replace(/\W+/g, "-")}`.slice(0, 40),
      nome: g.fornecedor,
      contato: "",
      faixas: [{ de: 0, precoCents: g.precoCents }],
      minimo: 0,
      multiplo: 0,
      prazoDias: 0,
      freteCents: 0,
      cotadoEm: null,
      obs: "Da planilha da receita. Prazo, mínimo e frete ainda não informados.",
    };
    const idx = insumos.findIndex(
      (i) => g.nome.test(semAcento(i.insumo)) && i.uso !== "lata" && i.uso !== "pack",
    );
    const base: Insumo =
      idx >= 0
        ? insumos[idx]
        : {
            id: g.id,
            insumo: g.insumo,
            categoria: g.categoria,
            unidade: g.unidade,
            uso: "receita",
            qtd: g.qtd,
            parte: g.parte,
            especificacao: g.especificacao,
            estoque: 0,
            valorEstoqueCents: 0,
            estoqueMinimo: 0,
            perdaPct: 0,
            depois: false,
            fornecedores: [],
            principal: null,
          };
    const outras = base.fornecedores.filter(
      (x) => !x.exemplo && semAcento(x.nome) !== semAcento(g.fornecedor),
    );
    const novo: Insumo = {
      ...base,
      insumo: base.exemplo ? g.insumo : base.insumo,
      categoria: g.categoria,
      unidade: g.unidade,
      uso: "receita",
      qtd: g.qtd,
      parte: g.parte,
      especificacao: g.especificacao,
      fornecedores: [f, ...outras],
      principal: f.id,
      exemplo: undefined,
    };
    if (idx >= 0) insumos[idx] = novo;
    else insumos = [...insumos, novo];
  }
  // Ingredientes primeiro (na ordem da planilha), depois embalagem e serviço.
  const ordem = (i: Insumo) => {
    const k = RECEITA_PLANILHA.findIndex((g) => g.nome.test(semAcento(i.insumo)));
    return i.uso === "receita" ? (k >= 0 ? k : 50) : 100;
  };
  insumos = [...insumos].sort((a, b) => ordem(a) - ordem(b));
  return {
    ...data,
    insumos,
    receita: { ...data.receita, refriPct: 80 },
    importacoes: [...data.importacoes, IMPORT_RECEITA],
  };
}

const IMPORT_LOTE1 = "lote-1-historico-2026-11";
/** 1º lote, feito antes do painel: 400 L planejados, 994 latas entregues. */
const LOTE1_LITROS = 400;
const LOTE1_LATAS = 994;

/**
 * Registra o 1º lote (feito antes do painel) como L001 concluído, pra
 * numeração seguir a das latas: o próximo lote do sistema é o L002. Plano
 * de 400 L (1.142 latas), entregues 994: entra no rendimento e na perda;
 * sem custos nem datas, fica fora do custo real e do "no prazo". Sem
 * insumos (o estoque já foi descontado na importação das latas da LNF).
 * Se já existe um L001, não cria outro.
 */
export function importarLote1(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_LOTE1)) return null;
  const marcado = { ...data, importacoes: [...data.importacoes, IMPORT_LOTE1] };
  if (data.lotes.some((l) => l.codigo.toUpperCase() === "L001")) return marcado;
  const hoje = hojeBR();
  const planejadas = Math.floor((LOTE1_LITROS * 1000) / LATA_ML);
  const lote1: Lote = {
    id: "lote-1-historico",
    codigo: "L001",
    etapa: "concluido",
    criadoEm: hoje,
    plano: {
      litros: LOTE1_LITROS,
      sixPacks: null,
      perdaEnvasePct: 0,
      prontoAte: null,
    },
    receita: data.receita,
    envasadas: planejadas,
    boas: planejadas,
    packs: 0,
    prontoPlanejado: hoje,
    itens: [],
    envaseEm: null,
    prontoEm: null,
    validade: null,
    latasBoas: LOTE1_LATAS,
    sixPacksMontados: null,
    acabouEm: null,
    obs: `1º lote, feito antes do painel: ${LOTE1_LITROS} L planejados (${planejadas.toLocaleString("pt-BR")} latas), entregues ${LOTE1_LATAS}.`,
    historico: true,
  };
  return { ...marcado, lotes: [lote1, ...data.lotes] };
}

const IMPORT_LOTE1_CUSTOS = "lote-1-custos-2026-11";
/** Fernet comprado pro 1º lote (litros, a R$ 35/L). */
const LOTE1_FERNET_L = 90;
/** Alcapone: serviço do 1º lote (centavos). */
const ALCAPONE_L001 = 266431;

/**
 * Custos do 1º lote: latas e coroas pelo preço do 1º pedido da LNF (com
 * frete), fernet 90 L a R$ 35/L, cola de amostra grátis e o
 * serviço da Alcapone (envase). Põe a Alcapone como fornecedora do envase
 * (preço por lata entregue no L001) no lugar do exemplo. As latas e coroas
 * saem do estoque (já descontado), então não viram compra do lote; o fernet
 * e o envase, sim.
 */
export function importarCustosLote1(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_LOTE1_CUSTOS)) return null;
  const marcado = { ...data, importacoes: [...data.importacoes, IMPORT_LOTE1_CUSTOS] };
  const l1 = data.lotes.find((l) => l.historico && l.codigo === "L001");
  if (!l1 || !l1.latasBoas) return marcado;
  const usadas = l1.latasBoas;
  const nome = (i: Insumo) => semAcento(i.insumo);
  const lata = data.insumos.find(
    (i) => i.uso === "lata" && /lata/.test(nome(i)) && !/coroa/.test(nome(i)),
  );
  const coroa = data.insumos.find((i) => i.uso === "lata" && /coroa|tampa/.test(nome(i)));
  const fernet = data.insumos.find((i) => /fernet/.test(nome(i)));
  const envase = data.insumos.find((i) => i.depois || i.categoria === "Serviço");
  const p1 = (k: "lata" | "coroa") => {
    const p = PEDIDOS_LNF[0];
    const frete = Math.round((p.frete * p.lata[1]) / (p.lata[1] + p.coroa[1]));
    return k === "lata"
      ? (p.lata[1] + frete) / p.lata[0]
      : (p.coroa[1] + p.frete - frete) / p.coroa[0];
  };
  const item = (
    i: Insumo | undefined,
    x: Partial<LoteItem> & Pick<LoteItem, "insumo" | "precisa">,
  ): LoteItem => ({
    insumoId: i?.id ?? `l001-${semAcento(x.insumo).replace(/\W+/g, "-")}`.slice(0, 40),
    unidade: i?.unidade ?? "litro",
    uso: i?.uso ?? "receita",
    categoria: i?.categoria ?? "Ingrediente",
    depois: i?.depois ?? false,
    fornecedorId: null,
    fornecedor: "",
    doEstoque: 0,
    comprar: 0,
    unitCents: 0,
    desembolsoCents: 0,
    prazoDias: 0,
    pedidoEm: null,
    previstoEm: null,
    chegouEm: null,
    recebido: null,
    pagoCents: null,
    noEstoque: false,
    custoRealCents: null,
    ...x,
  });
  const refriPct = data.receita.refriPct || 80;
  // Fernet comprado pro L001: 90 L (o plano pedia 80 L = 20% de 400 L); o
  // lote leva o custo de tudo que foi comprado.
  const litrosFernet = LOTE1_FERNET_L;
  const fFernet = fernet?.fornecedores.find((f) => /bucco/.test(semAcento(f.nome)));
  const fLata = lata?.fornecedores.find((f) => semAcento(f.nome) === "lnf");
  const fCoroa = coroa?.fornecedores.find((f) => semAcento(f.nome) === "lnf");

  // Envase: a Alcapone vira a cotação principal (sai o exemplo).
  const fAlcapone: Fornecedor = {
    id: "f-alcapone",
    nome: "Alcapone",
    contato: "",
    faixas: [{ de: 0, precoCents: Math.round(ALCAPONE_L001 / usadas) }],
    minimo: 0,
    multiplo: 0,
    prazoDias: 0,
    freteCents: 0,
    cotadoEm: null,
    obs: `Preço do 1º lote: R$ 2.664,31 pelo serviço, ${usadas} latas entregues. Prazo e forma de cobrança ainda não informados.`,
  };
  const insumos = data.insumos.map((i) =>
    envase && i.id === envase.id
      ? {
          ...i,
          exemplo: undefined,
          fornecedores: [
            fAlcapone,
            ...i.fornecedores.filter((f) => !f.exemplo && f.id !== fAlcapone.id),
          ],
          principal: fAlcapone.id,
        }
      : i,
  );

  const itens: LoteItem[] = [
    item(undefined, {
      insumo: "Cola (amostra grátis)",
      unidade: "litro",
      precisa: (l1.plano.litros * refriPct) / 100,
      fornecedor: "Amostra grátis",
    }),
    item(fernet, {
      insumo: fernet?.insumo ?? "Fernet",
      precisa: litrosFernet,
      comprar: litrosFernet,
      recebido: litrosFernet,
      unitCents: 3500,
      desembolsoCents: Math.round(litrosFernet * 3500),
      pagoCents: Math.round(litrosFernet * 3500),
      fornecedorId: fFernet?.id ?? null,
      fornecedor: fFernet?.nome ?? "Casa Bucco",
    }),
    item(lata, {
      insumo: lata?.insumo ?? "Lata 350ml",
      precisa: usadas,
      doEstoque: usadas,
      unitCents: p1("lata"),
      fornecedorId: fLata?.id ?? null,
      fornecedor: "LNF (1º pedido)",
    }),
    item(coroa, {
      insumo: coroa?.insumo ?? "Coroa (tampa da lata)",
      precisa: usadas,
      doEstoque: usadas,
      unitCents: p1("coroa"),
      fornecedorId: fCoroa?.id ?? null,
      fornecedor: "LNF (1º pedido)",
    }),
    item(envase, {
      insumo: envase?.insumo ?? "Envase",
      categoria: "Serviço",
      depois: true,
      precisa: usadas,
      comprar: usadas,
      recebido: usadas,
      unitCents: ALCAPONE_L001 / usadas,
      desembolsoCents: ALCAPONE_L001,
      pagoCents: ALCAPONE_L001,
      fornecedorId: fAlcapone.id,
      fornecedor: "Alcapone",
    }),
  ];
  return {
    ...marcado,
    insumos,
    lotes: data.lotes.map((l) =>
      l.id === l1.id
        ? {
            ...l,
            itens,
            obs: `${l.obs} Cola de amostra grátis; envase pela Alcapone.`.trim(),
          }
        : l,
    ),
  };
}

const IMPORT_LOTE1_SOBRA = "lote-1-fernet-sobra-2026-11";
/** Fernet que a receita do L001 usou (20% de 400 L); o resto dos 90 L sobrou. */
const LOTE1_FERNET_USADO_L = 80;

/**
 * Dos 90 L de fernet comprados pro L001, o lote usou 80 L (seguiu a
 * receita) e sobraram 10 L: o lote passa a custar só o que usou e os 10 L
 * entram no estoque do fernet (provisório, até a contagem). A compra
 * continua registrada como 90 L.
 */
export function importarSobraFernetLote1(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_LOTE1_SOBRA)) return null;
  const marcado = { ...data, importacoes: [...data.importacoes, IMPORT_LOTE1_SOBRA] };
  const l1 = data.lotes.find((l) => l.historico && l.codigo === "L001");
  const fernet = data.insumos.find((i) => /fernet/.test(semAcento(i.insumo)));
  const it = l1?.itens.find((x) => fernet && x.insumoId === fernet.id);
  if (!l1 || !fernet || !it || it.precisa <= LOTE1_FERNET_USADO_L) return marcado;
  const sobra = (it.recebido ?? it.comprar) - LOTE1_FERNET_USADO_L;
  return {
    ...marcado,
    insumos: data.insumos.map((i) =>
      i.id === fernet.id ? { ...i, estoque: i.estoque + Math.max(0, sobra) } : i,
    ),
    lotes: data.lotes.map((l) =>
      l.id === l1.id
        ? {
            ...l,
            itens: l.itens.map((x) => (x === it ? { ...x, precisa: LOTE1_FERNET_USADO_L } : x)),
            obs: `${l.obs} Fernet: 90 L comprados, 80 L usados, 10 L no estoque.`,
          }
        : l,
    ),
  };
}

const IMPORT_FERNET_LEGADO = "fernet-legado-entra-estoque-2026-11";

/**
 * Os pedidos de fernet registrados quando "registrar compra" não mexia no
 * estoque viraram pedidos "antes do controle" e ficaram fora do estoque
 * (a equipe confirmou que foram entregues). Dá entrada neles. Os da LNF
 * (latas e coroas) já estão no saldo inicial e não entram.
 */
export function entrarFernetLegado(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_FERNET_LEGADO)) return null;
  const fernet = new Set(
    data.insumos.filter((i) => /fernet/.test(semAcento(i.insumo))).map((i) => i.id),
  );
  let d = { ...data, importacoes: [...data.importacoes, IMPORT_FERNET_LEGADO] };
  for (const pc of d.pedidos)
    if (
      pc.legado &&
      !pc.id.startsWith("pc-lnf-") &&
      pc.itens.some((it) => fernet.has(it.insumoId) && it.recebido > 0)
    )
      d = entrarLegado(d, pc.id);
  return d;
}

/** Normaliza e roda as importações que faltam. `null` = nada mudou. */
export function aplicarImportacoes(data: ProducaoData): ProducaoData | null {
  let atual = normalizar(data);
  let mudou = atual !== data;
  for (const imp of [
    importarComprasLNF,
    importarReceita,
    importarLote1,
    importarCustosLote1,
    importarSobraFernetLote1,
    migrarParaPedidos,
    implantarEstoque,
    receberFernetPendente,
    entrarFernetLegado,
  ]) {
    const r = imp(atual);
    if (r) {
      atual = r;
      mudou = true;
    }
  }
  return mudou ? atual : null;
}

// ── Gestão de estoque (como no SAP) ─────────────────────────────────────────
//
// Estoque muda só por movimento: entrada (chegada de compra), saída
// (consumo do lote), ajuste (contagem, correção) e o saldo inicial da
// implantação. Valor pelo custo médio móvel: cada entrada recalcula o custo
// médio; cada saída tira valor por esse custo.

const ehServico = (i: { categoria: string }) => i.categoria === "Serviço";
let seqMov = 0;
const idMov = () =>
  `m${Date.now().toString(36)}${(seqMov++ % 1296).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Custo médio móvel (centavos por unidade); `null` sem estoque. */
export function custoMedioMovel(i: Insumo) {
  return i.estoque > 0 ? i.valorEstoqueCents / i.estoque : null;
}

/** Preço de referência: custo médio, senão a última entrada, senão a cotação principal. */
export function precoReferencia(data: ProducaoData, i: Insumo) {
  const cm = custoMedioMovel(i);
  if (cm !== null && cm > 0) return cm;
  const ultima = [...data.movimentos]
    .reverse()
    .find((m) => m.insumoId === i.id && m.qtd > 0 && m.valorCents > 0);
  if (ultima) return ultima.valorCents / ultima.qtd;
  const p = principalDe(i);
  return p ? faixaDe(p.faixas, 0).precoCents : 0;
}

export type NovoMovimento = {
  insumoId: string;
  tipo: Movimento["tipo"];
  /** Entrada/saída: quantidade (positiva). Ajuste: com sinal (pode ser 0, só valor). */
  qtd: number;
  /** Entrada: valor pago (com frete). Ajuste: valor com sinal (correção). */
  valorCents?: number;
  data?: string;
  origem: string;
  /** Mesma chave e mesmo dia: a correção se junta à anterior (não vira uma por tecla). */
  ref?: string | null;
  mesclar?: boolean;
  obs?: string;
  /** Documento de material (o mesmo pra todas as linhas de um recebimento). */
  doc?: string;
  /** Pedido de compra da entrada. */
  pc?: string | null;
};

/** Próximo documento de material: MD-00001, MD-00002… */
export function proximoDoc(data: ProducaoData) {
  const n = Math.max(0, ...data.movimentos.map((m) => Number(/^MD-(\d+)$/.exec(m.doc)?.[1] ?? 0)));
  return `MD-${String(n + 1).padStart(5, "0")}`;
}

/** Lança um movimento e atualiza estoque e valor do insumo. Serviço não tem estoque. */
export function movimentar(data: ProducaoData, m: NovoMovimento): ProducaoData {
  const i = data.insumos.find((x) => x.id === m.insumoId);
  if (!i || ehServico(i)) return data;
  const dia = m.data ?? hojeBR();
  let dq: number;
  let dv: number;
  if (m.tipo === "entrada" || m.tipo === "inicial") {
    dq = Math.abs(m.qtd);
    dv = m.valorCents ?? dq * precoReferencia(data, i);
  } else if (m.tipo === "saida") {
    dq = -Math.abs(m.qtd);
    dv = 0; // calculado abaixo pelo custo médio
  } else {
    dq = m.qtd;
    dv = m.valorCents ?? (dq > 0 ? dq * precoReferencia(data, i) : 0);
  }
  if (!dq && !dv) return data;
  // Saída (ou ajuste pra baixo sem valor dado): tira pelo custo médio.
  if (dq < 0 && (m.tipo === "saida" || m.valorCents === undefined)) {
    const cm = custoMedioMovel(i) ?? 0;
    dv = -Math.min(i.valorEstoqueCents, -dq * cm);
  }
  const novoQtd = Math.max(0, i.estoque + dq);
  let novoValor = Math.max(0, i.valorEstoqueCents + dv);
  if (novoQtd === 0) novoValor = 0;
  const faltou = i.estoque + dq < 0 ? " (o estoque não cobria tudo)" : "";
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const insumos = data.insumos.map((x) =>
    x.id === i.id ? { ...x, estoque: r3(novoQtd), valorEstoqueCents: Math.round(novoValor) } : x,
  );
  const ultimo = data.movimentos[data.movimentos.length - 1];
  if (
    m.mesclar &&
    m.ref &&
    ultimo &&
    ultimo.ref === m.ref &&
    ultimo.insumoId === i.id &&
    ultimo.data === dia &&
    ultimo.tipo === m.tipo
  ) {
    const junto = {
      ...ultimo,
      qtd: r3(ultimo.qtd + dq),
      valorCents: Math.round(ultimo.valorCents + dv),
      saldoQtd: r3(novoQtd),
      saldoValorCents: Math.round(novoValor),
    };
    const movimentos = data.movimentos.slice(0, -1);
    return {
      ...data,
      insumos,
      movimentos: junto.qtd || junto.valorCents ? [...movimentos, junto] : movimentos,
    };
  }
  const mov: Movimento = {
    id: idMov(),
    insumoId: i.id,
    data: dia,
    tipo: m.tipo,
    qtd: r3(dq),
    valorCents: Math.round(dv),
    saldoQtd: r3(novoQtd),
    saldoValorCents: Math.round(novoValor),
    origem: m.origem.slice(0, 80),
    doc: m.doc ?? proximoDoc(data),
    pc: m.pc ?? null,
    ref: m.ref ?? null,
    obs: `${m.obs ?? ""}${faltou}`.trim().slice(0, 300),
  };
  return { ...data, insumos, movimentos: [...data.movimentos, mov] };
}

/** Insumo novo com estoque inicial (vira o saldo inicial, ao custo informado). */
export function criarInsumoComEstoque(
  data: ProducaoData,
  i: Insumo,
  custoUnitCents: number,
): ProducaoData {
  const qtd = i.estoque;
  const base = {
    ...data,
    insumos: [...data.insumos, { ...i, estoque: 0, valorEstoqueCents: 0 }],
  };
  if (!qtd || ehServico(i)) return base;
  return movimentar(base, {
    insumoId: i.id,
    tipo: "inicial",
    qtd,
    valorCents: Math.round(qtd * custoUnitCents),
    origem: "Estoque inicial (cadastro)",
  });
}

/** Contagem: o estoque passa a ser o contado (ajuste da diferença). */
export function contagem(
  data: ProducaoData,
  insumoId: string,
  contado: number,
  dia: string,
  obs: string,
): ProducaoData {
  const i = data.insumos.find((x) => x.id === insumoId);
  if (!i) return data;
  const dq = contado - i.estoque;
  if (!dq) return data;
  return movimentar(data, {
    insumoId,
    tipo: "ajuste",
    qtd: dq,
    data: dia,
    origem: "Contagem de estoque",
    obs: obs || `Contado: ${contado}`,
  });
}

/**
 * Concluir o lote: sai do estoque o consumo de cada insumo (pelo custo
 * médio, o "261" do SAP), e o custo real fica gravado no item. Serviço não
 * tem estoque: o custo é o pago (ou o previsto). Recebe o lote já com
 * etapa e datas.
 */
export function baixarLote(data: ProducaoData, l: Lote): ProducaoData {
  let d = data;
  const dia = l.envaseEm ?? l.prontoEm ?? hojeBR();
  const doc = proximoDoc(d);
  const itens = l.itens.map((it) => {
    if (it.categoria === "Serviço")
      return { ...it, custoRealCents: it.pagoCents ?? it.desembolsoCents };
    if (it.precisa <= 0) return { ...it, custoRealCents: 0 };
    const insumo = d.insumos.find((x) => x.id === it.insumoId);
    // O que o estoque não cobria também foi usado: vale o preço de referência.
    const faltou = insumo ? Math.max(0, it.precisa - insumo.estoque) : 0;
    const custoFalta = insumo && faltou > 0 ? faltou * precoReferencia(d, insumo) : 0;
    const antes = d.movimentos.length;
    d = movimentar(d, {
      insumoId: it.insumoId,
      tipo: "saida",
      qtd: it.precisa,
      data: dia,
      origem: `Lote ${l.codigo}: consumo`,
      ref: `${l.id}:${it.insumoId}:consumo`,
      doc,
    });
    const mov = d.movimentos.length > antes ? d.movimentos[d.movimentos.length - 1] : null;
    return { ...it, custoRealCents: Math.round((mov ? -mov.valorCents : 0) + custoFalta) };
  });
  return { ...d, lotes: d.lotes.map((x) => (x.id === l.id ? { ...l, itens } : x)) };
}

/** Cancelar: só libera a reserva (compras são dos pedidos, não do lote). */
export function cancelarLote(data: ProducaoData, l: Lote): ProducaoData {
  return {
    ...data,
    lotes: data.lotes.map((x) => (x.id === l.id ? { ...l, etapa: "cancelado" as const } : x)),
  };
}

export type PedidoAberto = {
  id: string;
  pcId: string;
  numero: string;
  fornecedor: string;
  /** O que falta receber. */
  qtd: number;
  valorCents: number;
  pedidoEm: string | null;
  previstoEm: string | null;
};

/** Itens de pedidos de compra ainda a receber, de um insumo (o mais cedo primeiro). */
export function pedidosAbertos(data: ProducaoData, insumoId: string): PedidoAberto[] {
  return data.pedidos
    .filter((pc) => !pc.encerrado)
    .flatMap((pc) =>
      pc.itens
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it.insumoId === insumoId && restante(it) > 0)
        .map(({ it, idx }) => ({
          id: `${pc.id}:${idx}`,
          pcId: pc.id,
          numero: pc.numero,
          fornecedor: pc.fornecedor,
          qtd: restante(it),
          valorCents: Math.round(unitPedido(pc, idx) * restante(it)),
          pedidoEm: pc.data,
          previstoEm: pc.previstoEm,
        })),
    )
    .sort((a, b) => (a.previstoEm ?? "9999").localeCompare(b.previstoEm ?? "9999"));
}

export type SituacaoEstoque = "ok" | "abaixo" | "falta" | "sem" | "atrasado";

/**
 * A posição de um insumo (o MMBE + MD04 do SAP): estoque, reservado pelos
 * lotes, em pedido, projetado e a sugestão de compra (respeitando o mínimo
 * e o múltiplo do fornecedor principal).
 */
export function posicao(data: ProducaoData, i: Insumo, hoje = hojeBR()) {
  const reservado = reservas(data.lotes).get(i.id) ?? 0;
  const abertos = pedidosAbertos(data, i.id);
  const emPedido = abertos.reduce((n, p) => n + p.qtd, 0);
  const proxima = abertos.find((p) => p.previstoEm)?.previstoEm ?? null;
  const atrasado = abertos.some((p) => p.previstoEm && p.previstoEm < hoje);
  const projetado = i.estoque - reservado + emPedido;
  // Comprar: o que falta pros lotes + pra voltar ao mínimo.
  const falta = Math.max(0, i.estoqueMinimo - projetado, -projetado);
  const principal = principalDe(i);
  const sugestao =
    falta > 0 ? (principal ? cotar(principal, falta, compraInteira(i.unidade)) : null) : null;
  const ultimas = comprasDo(data, i.id);
  const ultimo = ultimas[ultimas.length - 1] ?? null;
  const situacao: SituacaoEstoque = atrasado
    ? "atrasado"
    : projetado < 0
      ? "falta"
      : i.estoqueMinimo > 0 && projetado < i.estoqueMinimo
        ? "abaixo"
        : i.estoque <= 0 && emPedido <= 0
          ? "sem"
          : "ok";
  return {
    estoque: i.estoque,
    reservado,
    livre: i.estoque - reservado,
    emPedido,
    proxima,
    atrasado,
    projetado,
    falta,
    sugestao: sugestao ? sugestao.comprar : falta > 0 ? falta : 0,
    sugestaoValorCents: sugestao?.totalCents ?? null,
    fornecedorSugerido: principal?.nome ?? null,
    valorCents: i.valorEstoqueCents,
    custoMedio: custoMedioMovel(i),
    ultimoPreco: ultimo?.unitCents ?? null,
    minimo: i.estoqueMinimo,
    situacao,
    abertos,
  };
}

// ── Pedidos de compra (como no SAP: ME21N / MIGO / ME2N) ────────────────────

/** Próximo número de pedido: PC-0001, PC-0002… (um só pra todos os insumos). */
export function proximoPC(data: ProducaoData) {
  const n = Math.max(0, ...data.pedidos.map((p) => Number(/^PC-(\d+)$/.exec(p.numero)?.[1] ?? 0)));
  return `PC-${String(n + 1).padStart(4, "0")}`;
}

/** O que falta receber de um item. */
export const restante = (it: PcItem) => Math.max(0, it.qtd - it.recebido);

/** Frete por unidade do item (o frete do pedido dividido pelo valor dos itens). */
export function fretePorUnidade(pc: PedidoCompra, idx: number) {
  const total = pc.itens.reduce((n, x) => n + x.valorCents, 0);
  const it = pc.itens[idx];
  if (!it || it.qtd <= 0) return 0;
  const parte =
    total > 0 ? (pc.freteCents * it.valorCents) / total : pc.freteCents / pc.itens.length;
  return parte / it.qtd;
}

/** Custo de cada unidade do item, com a parte do frete. */
export function unitPedido(pc: PedidoCompra, idx: number) {
  const it = pc.itens[idx];
  if (!it || it.qtd <= 0) return 0;
  return it.valorCents / it.qtd + fretePorUnidade(pc, idx);
}

export type SituacaoPedido = "aberto" | "parcial" | "recebido" | "encerrado" | "atrasado";

export function situacaoPedido(pc: PedidoCompra, hoje = hojeBR()): SituacaoPedido {
  const falta = pc.itens.some((it) => restante(it) > 0);
  if (!falta) return "recebido";
  if (pc.encerrado) return "encerrado";
  if (pc.previstoEm && pc.previstoEm < hoje) return "atrasado";
  return pc.itens.some((it) => it.recebido > 0) ? "parcial" : "aberto";
}

/** Total do pedido (itens + frete). */
export const totalPedido = (pc: PedidoCompra) =>
  pc.itens.reduce((n, it) => n + it.valorCents, 0) + pc.freteCents;

/** Quanto de cada insumo ainda vai chegar dos pedidos em aberto. */
export function emPedidoPorInsumo(data: ProducaoData) {
  const map = new Map<string, number>();
  for (const pc of data.pedidos)
    if (!pc.encerrado)
      for (const it of pc.itens) map.set(it.insumoId, (map.get(it.insumoId) ?? 0) + restante(it));
  return map;
}

/**
 * Cria ou altera um pedido de compra (cabeçalho e itens). Pedido novo ganha
 * o número. Item já recebido não pode ficar com menos que o recebido.
 */
export function salvarPedido(data: ProducaoData, pc: PedidoCompra): ProducaoData {
  const antes = data.pedidos.find((x) => x.id === pc.id);
  const itens = pc.itens.map((it) => {
    const insumo = data.insumos.find((i) => i.id === it.insumoId);
    return {
      ...it,
      insumo: insumo?.insumo ?? it.insumo,
      unidade: insumo?.unidade ?? it.unidade,
      qtd: Math.max(it.qtd, it.recebido),
    };
  });
  const novo = { ...pc, itens, numero: antes?.numero ?? (pc.numero || proximoPC(data)) };
  return {
    ...data,
    pedidos: antes ? data.pedidos.map((x) => (x.id === pc.id ? novo : x)) : [...data.pedidos, novo],
  };
}

/**
 * Entrada de mercadoria (MIGO 101): lança o que chegou de cada item,
 * entra no estoque pelo custo do pedido (com a parte do frete) e gera um
 * documento de material pro recebimento todo.
 */
export function receberPedido(
  data: ProducaoData,
  pcId: string,
  dia: string,
  linhas: { idx: number; qtd: number }[],
  obs = "",
): ProducaoData {
  const pc = data.pedidos.find((x) => x.id === pcId);
  const validas = linhas.filter((l) => l.qtd > 0 && pc?.itens[l.idx]);
  if (!pc || !validas.length) return data;
  const doc = proximoDoc(data);
  let d = data;
  for (const l of validas) {
    const it = pc.itens[l.idx];
    d = movimentar(d, {
      insumoId: it.insumoId,
      tipo: "entrada",
      qtd: l.qtd,
      valorCents: Math.round(unitPedido(pc, l.idx) * l.qtd),
      data: dia,
      origem: `${pc.numero} · ${pc.fornecedor || "fornecedor"}`,
      ref: `${pc.id}:${l.idx}`,
      doc,
      pc: pc.numero,
    });
  }
  const novo: PedidoCompra = {
    ...pc,
    itens: pc.itens.map((it, idx) => ({
      ...it,
      recebido: it.recebido + validas.filter((l) => l.idx === idx).reduce((n, l) => n + l.qtd, 0),
    })),
    recebimentos: [...pc.recebimentos, { doc, data: dia, itens: validas, obs }],
  };
  return { ...d, pedidos: d.pedidos.map((x) => (x.id === pc.id ? novo : x)) };
}

/** Estorno de um recebimento (o 102): sai do estoque o que ele pôs. */
export function estornarRecebimento(data: ProducaoData, pcId: string, doc: string): ProducaoData {
  const pc = data.pedidos.find((x) => x.id === pcId);
  const r = pc?.recebimentos.find((x) => x.doc === doc);
  if (!pc || !r) return data;
  let d = data;
  const novoDoc = proximoDoc(d);
  if (!pc.legado)
    for (const l of r.itens) {
      const it = pc.itens[l.idx];
      if (!it || l.qtd <= 0) continue;
      d = movimentar(d, {
        insumoId: it.insumoId,
        tipo: "ajuste",
        qtd: -l.qtd,
        valorCents: -Math.round(unitPedido(pc, l.idx) * l.qtd),
        origem: `${pc.numero}: estorno da entrada ${doc}`,
        ref: `${pc.id}:${l.idx}`,
        doc: novoDoc,
        pc: pc.numero,
      });
    }
  const novo: PedidoCompra = {
    ...pc,
    itens: pc.itens.map((it, idx) => ({
      ...it,
      recebido: Math.max(
        0,
        it.recebido - r.itens.filter((l) => l.idx === idx).reduce((n, l) => n + l.qtd, 0),
      ),
    })),
    recebimentos: pc.recebimentos.filter((x) => x.doc !== doc),
  };
  return { ...d, pedidos: d.pedidos.map((x) => (x.id === pc.id ? novo : x)) };
}

/**
 * Pedido "antes do controle de estoque" que na verdade nunca entrou no
 * estoque (ex.: compra registrada quando o registro não mexia no estoque):
 * lança agora a entrada do que foi recebido, pelo custo do pedido.
 */
export function entrarLegado(data: ProducaoData, pcId: string): ProducaoData {
  const pc = data.pedidos.find((x) => x.id === pcId);
  if (!pc || !pc.legado) return data;
  const doc = proximoDoc(data);
  let d = data;
  const dia = pc.recebimentos.find((r) => r.data)?.data ?? pc.data ?? hojeBR();
  pc.itens.forEach((it, idx) => {
    if (it.recebido <= 0) return;
    d = movimentar(d, {
      insumoId: it.insumoId,
      tipo: "entrada",
      qtd: it.recebido,
      valorCents: Math.round(unitPedido(pc, idx) * it.recebido),
      data: dia,
      origem: `${pc.numero} · ${pc.fornecedor || "fornecedor"} (entrada lançada depois)`,
      ref: `${pc.id}:${idx}`,
      doc,
      pc: pc.numero,
    });
  });
  const novo: PedidoCompra = {
    ...pc,
    legado: false,
    recebimentos: pc.recebimentos.map((r) => ({
      ...r,
      doc: r.doc && r.doc !== "MIGRADO" ? r.doc : doc,
      obs: "Entrada no estoque lançada depois",
    })),
  };
  return { ...d, pedidos: d.pedidos.map((x) => (x.id === pc.id ? novo : x)) };
}

/** Exclui um pedido sem recebimento. */
export function excluirPedido(data: ProducaoData, pcId: string): ProducaoData {
  const pc = data.pedidos.find((x) => x.id === pcId);
  if (!pc || pc.recebimentos.length) return data;
  return { ...data, pedidos: data.pedidos.filter((x) => x.id !== pcId) };
}

// ── Cobertura dos lotes (o MRP: necessidade × estoque × pedidos) ───────────

export type CoberturaItem = {
  /** Sai do estoque que já está aqui. */
  doEstoque: number;
  /** Vem de pedidos em aberto. */
  dePedidos: number;
  /** Pedidos usados e a chegada do último. */
  pcs: string[];
  chegaEm: string | null;
  /** Falta comprar (sem pedido). */
  falta: number;
};

/**
 * Distribui estoque e pedidos em aberto entre os lotes abertos, na ordem
 * da data de produção: o primeiro lote pega o estoque, depois os pedidos
 * pela data de chegada. O que não cobre é o que falta comprar.
 */
export function coberturaLotes(data: ProducaoData, hoje = hojeBR()) {
  const res = new Map<string, Map<string, CoberturaItem>>();
  const abertos = data.lotes
    .filter(loteAberto)
    .map((l) => ({ l, meta: totaisLote(l, hoje).meta }))
    .sort(
      (a, b) =>
        a.meta.localeCompare(b.meta) ||
        a.l.codigo.localeCompare(b.l.codigo, undefined, { numeric: true }),
    );
  for (const i of data.insumos) {
    if (i.categoria === "Serviço") continue;
    let estoque = i.estoque;
    const pedidos = pedidosAbertos(data, i.id).map((p) => ({ ...p }));
    for (const { l } of abertos) {
      for (const it of l.itens.filter((x) => x.insumoId === i.id && x.categoria !== "Serviço")) {
        let precisa = it.precisa;
        const doEstoque = Math.min(estoque, precisa);
        estoque -= doEstoque;
        precisa -= doEstoque;
        let dePedidos = 0;
        const pcs: string[] = [];
        let chegaEm: string | null = null;
        for (const p of pedidos) {
          if (precisa <= 1e-9) break;
          if (p.qtd <= 0) continue;
          const usa = Math.min(p.qtd, precisa);
          p.qtd -= usa;
          precisa -= usa;
          dePedidos += usa;
          if (!pcs.includes(p.numero)) pcs.push(p.numero);
          if (p.previstoEm && (!chegaEm || p.previstoEm > chegaEm)) chegaEm = p.previstoEm;
        }
        const m = res.get(l.id) ?? new Map<string, CoberturaItem>();
        m.set(it.insumoId, { doEstoque, dePedidos, pcs, chegaEm, falta: Math.max(0, precisa) });
        res.set(l.id, m);
      }
    }
  }
  return res;
}

const IMPORT_ESTOQUE = "estoque-implantacao-2026-11";

/**
 * Implantação do controle de estoque: o estoque de hoje vira saldo inicial,
 * valorizado pelo custo médio das compras registradas (ou pela cotação
 * principal, se não houver compra).
 */
export function implantarEstoque(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_ESTOQUE)) return null;
  const dia = hojeBR();
  const movimentos: Movimento[] = [];
  const insumos = data.insumos.map((i) => {
    if (ehServico(i) || i.estoque <= 0 || i.valorEstoqueCents > 0) return i;
    const media = custoMedio(comprasDo(data, i.id)).unitCents;
    const unit = media ?? precoReferencia(data, i);
    const valor = Math.round(i.estoque * unit);
    movimentos.push({
      id: idMov(),
      insumoId: i.id,
      data: dia,
      tipo: "inicial",
      qtd: i.estoque,
      valorCents: valor,
      saldoQtd: i.estoque,
      saldoValorCents: valor,
      origem: "Implantação do controle de estoque",
      doc: "",
      pc: null,
      ref: null,
      obs: media !== null ? "Valor pelo custo médio das compras" : "Valor pela cotação principal",
    });
    return { ...i, valorEstoqueCents: valor };
  });
  return {
    ...data,
    insumos,
    movimentos: [...data.movimentos, ...movimentos],
    importacoes: [...data.importacoes, IMPORT_ESTOQUE],
  };
}

const IMPORT_FERNET_ENTREGUE = "fernet-pedidos-entregues-2026-11";

/**
 * Todo fernet que estava "a receber" já foi entregue (avisado pela equipe):
 * os itens de fernet dos pedidos de compra em aberto recebem o que falta.
 * Data: a prometida, se já passou; senão, hoje.
 */
export function receberFernetPendente(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_FERNET_ENTREGUE)) return null;
  const hoje = hojeBR();
  const fernet = new Set(
    data.insumos.filter((i) => /fernet/.test(semAcento(i.insumo))).map((i) => i.id),
  );
  let d = { ...data, importacoes: [...data.importacoes, IMPORT_FERNET_ENTREGUE] };
  for (const pc of d.pedidos.filter((x) => !x.encerrado && !x.legado)) {
    const linhas = pc.itens
      .map((it, idx) => ({ idx, qtd: fernet.has(it.insumoId) ? restante(it) : 0 }))
      .filter((l) => l.qtd > 0);
    if (linhas.length)
      d = receberPedido(
        d,
        pc.id,
        pc.previstoEm && pc.previstoEm <= hoje ? pc.previstoEm : hoje,
        linhas,
        "Entregue (confirmado pela equipe)",
      );
  }
  return d;
}

const IMPORT_PEDIDOS = "compras-viram-pedidos-2026-11";

/**
 * Passa as compras pro modelo de pedidos de compra (PC-0001…):
 * - compras registradas: as do mesmo pedido (nome, fornecedor, ordem/data)
 *   viram um pedido com vários itens e o frete somado. Recebidas antes do
 *   controle de estoque = legado (sem movimento); recebidas depois já têm
 *   o movimento (só ganham o número). A receber = pedido em aberto.
 * - insumos de lotes abertos já pedidos e ainda não chegados viram pedidos
 *   em aberto (um por lote e fornecedor); os lotes voltam a ser só
 *   necessidade (etapa "planejado").
 * - movimentos ganham número de documento (MD-00001…) e o nº do pedido.
 */
export function migrarParaPedidos(data: ProducaoData): ProducaoData | null {
  if (data.importacoes.includes(IMPORT_PEDIDOS)) return null;
  const grupos = new Map<string, Compra[]>();
  // Antigas (de antes do controle de estoque) primeiro: os pedidos da LNF são PC-0001 a PC-0003.
  const antiga = (c: Compra) => (c.status === "recebido" && !c.noEstoque ? 0 : 1);
  const ordenadas = [...data.compras].sort(
    (a, b) =>
      antiga(a) - antiga(b) || a.ordem - b.ordem || (a.data ?? "").localeCompare(b.data ?? ""),
  );
  for (const c of ordenadas) {
    const k = [c.pedido, chaveFornecedor(c.fornecedor), c.ordem, c.data ?? "", c.status].join("|");
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  let n = Math.max(0, ...data.pedidos.map((p) => Number(/^PC-(\d+)$/.exec(p.numero)?.[1] ?? 0)));
  const num = () => `PC-${String(++n).padStart(4, "0")}`;
  const novos: PedidoCompra[] = [];
  const pcDaCompra = new Map<string, string>();
  for (const cs of grupos.values()) {
    const c0 = cs[0];
    const numero = num();
    const recebido = c0.status === "recebido";
    const legado = recebido && cs.every((c) => !c.noEstoque);
    cs.forEach((c) => pcDaCompra.set(c.id, numero));
    novos.push({
      id: `pc-${c0.id}`.slice(0, 40),
      numero,
      fornecedor: c0.fornecedor,
      data: c0.data,
      previstoEm: c0.previstoEm,
      freteCents: cs.reduce((s, c) => s + c.freteCents, 0),
      itens: cs.map((c) => {
        const insumo = data.insumos.find((i) => i.id === c.insumoId);
        return {
          insumoId: c.insumoId,
          insumo: insumo?.insumo ?? "Insumo",
          unidade: insumo?.unidade ?? "",
          qtd: c.quantidade,
          valorCents: c.valorCents,
          recebido: recebido ? c.quantidade : 0,
        };
      }),
      recebimentos: recebido
        ? [
            {
              doc: legado ? "" : "MIGRADO",
              data: c0.data,
              itens: cs.map((c, idx) => ({ idx, qtd: c.quantidade })),
              obs: legado ? "Antes do controle de estoque (já no saldo inicial)" : "",
            },
          ]
        : [],
      encerrado: false,
      legado,
      obs: [c0.pedido && !/^\d+º pedido$/.test(c0.pedido) ? c0.pedido : "", ...cs.map((c) => c.obs)]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 300),
    });
  }
  // Lotes abertos: o que foi pedido e não chegou vira pedido em aberto.
  const lotes = data.lotes.map((l) => {
    if (!loteAberto(l)) return l;
    const porForn = new Map<string, LoteItem[]>();
    for (const it of l.itens)
      if (
        it.categoria !== "Serviço" &&
        it.comprar > 0 &&
        it.pedidoEm &&
        !it.chegouEm &&
        !it.noEstoque
      )
        porForn.set(it.fornecedor, [...(porForn.get(it.fornecedor) ?? []), it]);
    for (const [forn, its] of porForn)
      novos.push({
        id: `pc-${l.id}-${chaveFornecedor(forn).replace(/\W+/g, "-")}`.slice(0, 40),
        numero: num(),
        fornecedor: forn,
        data: its[0].pedidoEm,
        previstoEm:
          its
            .map((x) => x.previstoEm)
            .filter(Boolean)
            .sort()
            .pop() ?? null,
        freteCents: 0,
        itens: its.map((it) => ({
          insumoId: it.insumoId,
          insumo: it.insumo,
          unidade: it.unidade,
          qtd: it.comprar,
          valorCents: it.desembolsoCents,
          recebido: 0,
        })),
        recebimentos: [],
        encerrado: false,
        legado: false,
        obs: `Pedido do lote ${l.codigo}`,
      });
    return l.etapa === "pedido" ? { ...l, etapa: "planejado" as const } : l;
  });
  // Documento de material nos movimentos (na ordem em que aconteceram).
  let md = 0;
  const movimentos = data.movimentos.map((m) => ({
    ...m,
    doc: m.doc || `MD-${String(++md).padStart(5, "0")}`,
    pc: m.pc ?? (m.ref?.startsWith("compra:") ? (pcDaCompra.get(m.ref.slice(7)) ?? null) : null),
  }));
  return {
    ...data,
    pedidos: [...data.pedidos, ...novos],
    compras: [],
    lotes,
    movimentos,
    importacoes: [...data.importacoes, IMPORT_PEDIDOS],
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
  receita: { refriPct: 80, fernetMl: null, colaMl: null },
  plano: PLANO_PADRAO,
  lotes: [],
  compras: [],
  movimentos: [],
  pedidos: [],
  importacoes: [],
  insumos: [
    {
      id: "fernet",
      insumo: "Fernet",
      categoria: "Líquido",
      unidade: "litro",
      uso: "receita",
      qtd: 20,
      parte: "final",
      especificacao: "",
      estoque: 0,
      valorEstoqueCents: 0,
      estoqueMinimo: 0,
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
      uso: "receita",
      qtd: 0,
      parte: "refri",
      especificacao: "",
      estoque: 0,
      valorEstoqueCents: 0,
      estoqueMinimo: 0,
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
      parte: "final",
      especificacao: "",
      estoque: 0,
      valorEstoqueCents: 0,
      estoqueMinimo: 0,
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
      parte: "final",
      especificacao: "",
      estoque: 0,
      valorEstoqueCents: 0,
      estoqueMinimo: 0,
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
      parte: "final",
      especificacao: "",
      estoque: 0,
      valorEstoqueCents: 0,
      estoqueMinimo: 0,
      perdaPct: 0,
      depois: true,
      fornecedores: [forn("f-envase", "Fornecedor E", [{ de: 0, precoCents: 60 }], 3000, 5)],
      principal: "f-envase",
      exemplo: true,
    },
  ],
};
