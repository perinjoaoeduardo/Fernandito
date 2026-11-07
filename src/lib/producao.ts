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

export const producaoSchema = z.object({
  versao: z.literal(2),
  insumos: z.array(insumoSchema).max(100),
  receita: z.object({
    fernetMl: z.number().min(0).max(LATA_ML).nullable(),
    colaMl: z.number().min(0).max(LATA_ML).nullable(),
  }),
  plano: planoSchema,
  atualizadoEm: z.string().optional(),
});

export type Faixa = z.infer<typeof faixa>;
export type Fornecedor = z.infer<typeof fornecedorSchema>;
export type Insumo = z.infer<typeof insumoSchema>;
export type Plano = z.infer<typeof planoSchema>;
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

/** Plano do lote insumo por insumo. */
export function planejar(data: ProducaoData): LinhaPlano[] {
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
    const falta = Math.max(0, precisa - i.estoque);
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
