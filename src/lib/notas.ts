import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { bling } from "@/lib/bling/client";
import { quoteMelhorEnvio } from "@/lib/melhor-envio";
import {
  addToCart,
  findShipmentByTag,
  generateLabel,
  getShipment,
  labelPrintUrl,
  meBalanceCents,
  payWithBalance,
} from "@/lib/melhor-envio-label";
import { getAvulso, saveAvulso } from "@/lib/store/avulsos";
import { kvDel, kvGet, kvMGet, kvSAdd, kvSet, kvSetNX, kvSMembers } from "@/lib/store/kv";

/**
 * "Emitir nota" do painel (vendas por fora do site e brindes).
 *
 * A pessoa cola um texto, o Claude Haiku preenche os campos, a pessoa confere
 * e o sistema:
 *  1. CONFERE (nada é criado): regras fiscais, documento, endereço, preço,
 *     estoque, cadastro que já existe no Bling, nota repetida, frete e saldo
 *     do Melhor Envio. Qualquer coisa estranha TRAVA com o motivo e "chama o
 *     João" — é melhor parar do que supor.
 *  2. PREPARA: cria cliente, pedido e nota em RASCUNHO no Bling e confere o
 *     rascunho (total e CFOP). Não bateu → trava e tenta apagar o rascunho.
 *  3. EMITE (só com o clique): Sefaz, baixa de estoque e, se for envio, a
 *     etiqueta no Melhor Envio (com o serviço escolhido na conferência).
 *
 * Tudo sai do ESTOQUE (Bling). As "Caixas da equipe" são um diário à parte e
 * não entram aqui.
 *
 * Regras fiscais (contadora, nov/2026):
 *  - Brinde → "Saída em bonificação – Brinde" (5910 no RS / 6910 fora).
 *  - Venda pra EMPRESA do RS (com IE) → "Venda de produção com ST (RS)" (5401).
 *    O preço combinado JÁ inclui o ST: o preço da nota é ajustado pra o total
 *    bater com o combinado.
 *  - Venda pra pessoa física → consumidor final (5101 no RS / 6107 fora).
 *  - Empresa sem IE ou venda pra empresa fora do RS → trava (contadora/João).
 *
 * A chave da IA é o env `ANTHROPIC_API_KEY` (Vercel). Sem ela, o formulário
 * funciona igual, só não preenche sozinho.
 */

const CHAMA = "Não emita: chama o João.";

// ── Cadastro (IDs do Bling) ────────────────────────────────────────────────
export const NATUREZA = {
  consumidor: 15111699956,
  bonificacao: 15111699949,
  st: 15111699959,
  rj: 15112000710,
} as const;
export type Natureza = keyof typeof NATUREZA;

/**
 * O que o Bling JÁ tem cadastrado e já foi emitido com sucesso (nov/2026).
 * Combinação fora daqui TRAVA: precisa a contadora cadastrar a natureza/regra
 * do estado antes. Pra liberar um estado novo: acrescentar aqui (e no guia).
 *  - venda · empresa · RS → ST (5401), preço combinado com ST incluso.
 *  - venda · empresa · RJ → "Venda de produção Fora do Estado (RJ)" (6101),
 *    sem ST (Lei RJ 10.688/2025, com a observação obrigatória na nota).
 *  - venda · pessoa física · qualquer UF → consumidor final (5101 / 6107), a
 *    mesma das vendas do site.
 *  - brinde · RS ou SC → bonificação (5910 / 6910).
 */
const VENDA_EMPRESA_UFS = ["RS", "RJ"];
const BRINDE_UFS = ["RS", "SC"];
const OBS_RJ =
  "Documento emitido por ME/EPP optante pelo Simples Nacional. Operação não sujeita ao regime de ST – Lei RJ nº 10.688/2025.";
/** CFOPs esperados de cada natureza (o rascunho é conferido contra isso). */
const CFOP_OK: Record<keyof typeof NATUREZA, string[]> = {
  consumidor: ["5101", "6107", "6108"],
  bonificacao: ["5910", "6910"],
  st: ["5401"],
  rj: ["6101"],
};

type Caixa = { weightKg: number; widthCm: number; heightCm: number; lengthCm: number };
type Produto = {
  id: number;
  nome: string;
  curto: string;
  unidade: string;
  latas: number;
  /** Valor de tabela (brinde sai com ele). */
  tabela: number;
  /** Faixa normal de preço por unidade numa venda (fora dela, trava). */
  faixa: [number, number];
  caixa: Caixa | null;
};

export const PRODUTOS_NOTA: Record<string, Produto> = {
  "FERN-350-6": {
    id: 16718234925,
    nome: "Fernandito - Pack 6 latas 350ml",
    curto: "Six pack",
    unidade: "UN",
    latas: 6,
    tabela: 94.99,
    faixa: [48, 150],
    caixa: { weightKg: 2.5, widthCm: 13.8, heightCm: 16.4, lengthCm: 24 },
  },
  "FERN-350": {
    id: 16718234916,
    nome: "Fernandito - Lata 350ml",
    curto: "Lata",
    unidade: "UN",
    latas: 1,
    tabela: 15.99,
    faixa: [8, 25],
    caixa: null,
  },
  "FERN-350-2": {
    id: 16741631998,
    nome: "Fernandito - 2 Pack 2 latas 350ml",
    curto: "2 Pack",
    unidade: "UN",
    latas: 2,
    tabela: 44.9,
    faixa: [16, 60],
    caixa: { weightKg: 0.74, widthCm: 10, heightCm: 16, lengthCm: 20 },
  },
  "FERN-BARRIL-L": {
    id: 16740716066,
    nome: "Fernandito - Litro do barril (chopp)",
    curto: "Litro do barril",
    unidade: "L",
    latas: 0,
    tabela: 24.5,
    faixa: [10, 40],
    caixa: null,
  },
};
const SKUS = ["FERN-350-6", "FERN-350", "FERN-350-2", "FERN-BARRIL-L"] as const;
export type SkuNota = (typeof SKUS)[number];
const LATA_ID = 16718234916;

const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "),
);

// ── O que a IA preenche (e a pessoa confere) ───────────────────────────────
export const rascunhoSchema = z.object({
  tipo: z.enum(["venda", "bonificacao"]),
  cliente: z.object({
    pessoa: z.enum(["PJ", "PF"]),
    documento: z.string(),
    nome: z.string(),
    fantasia: z.string(),
    ie: z.string(),
    email: z.string(),
    telefone: z.string(),
    cep: z.string(),
    rua: z.string(),
    numero: z.string(),
    complemento: z.string(),
    bairro: z.string(),
    cidade: z.string(),
    uf: z.string(),
  }),
  itens: z.array(
    z.object({
      sku: z.enum(SKUS),
      qtd: z.number(),
      /** Preço FINAL combinado por unidade, em reais (com ST incluso). */
      preco: z.number(),
    }),
  ),
  entrega: z.enum(["maos", "envio"]),
  /** Envio: cada caixa com sua etiqueta, ou tudo empilhado num volume só. */
  embalagem: z.enum(["separadas", "empilhado"]),
  /** Empilhado: quantas pilhas lado a lado (ex.: 6 packs em 2 pilhas de 3). */
  pilhas: z.number(),
  observacoes: z.string(),
  /** O que a IA não achou ou ficou em dúvida (pra pessoa conferir). */
  duvidas: z.array(z.string()),
});
export type Rascunho = z.infer<typeof rascunhoSchema>;

export function rascunhoVazio(): Rascunho {
  return {
    tipo: "venda",
    cliente: {
      pessoa: "PJ",
      documento: "",
      nome: "",
      fantasia: "",
      ie: "",
      email: "",
      telefone: "",
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "RS",
    },
    itens: [{ sku: "FERN-350-6", qtd: 1, preco: 0 }],
    entrega: "maos",
    embalagem: "separadas",
    pilhas: 1,
    observacoes: "",
    duvidas: [],
  };
}

const SISTEMA = `Tu lê um texto colado por alguém da equipe da Fernandito (fernet com cola em lata, Porto Alegre/RS) e preenche os campos de uma nota fiscal.

Produtos (sku):
- FERN-350-6: six pack (caixa com 6 latas). "caixa", "pack", "six", "6-pack" = six pack.
- FERN-350: lata avulsa 350 ml.
- FERN-350-2: 2 pack (caixinha com 2 latas), "two pack", "2-pack".
- FERN-BARRIL-L: chopp de barril, vendido por LITRO (barril de 20 L = qtd 20).

Regras:
- tipo: "bonificacao" se for brinde, amostra, presente, bonificação, degustação; senão "venda". Se o texto tiver uma venda E um brinde, preenche SÓ a venda e põe em duvidas: "Tem um brinde junto: faça uma segunda nota pra ele".
- preco: preço FINAL combinado POR UNIDADE do sku, em reais. Se o texto der o preço por lata e o item for six pack, multiplica por 6 (2 pack: por 2). Se der só o total, divide pela quantidade. Bonificação: 94.99 (six pack), 15.99 (lata), 44.90 (2 pack), 24.50 (litro). Venda sem preço no texto: 0 e põe em duvidas.
- cliente.pessoa: "PJ" se tiver CNPJ, "PF" se for CPF. documento só com dígitos. ie só com dígitos ("" se não tiver).
- cliente.nome: razão social (empresa) ou nome completo (pessoa). Se só tiver o nome fantasia, põe em fantasia, deixa nome "" e põe em duvidas "Falta a razão social".
- endereço: separa rua, número, complemento, bairro, cidade, uf (2 letras), cep (só dígitos).
- entrega: "maos" se for entregue em mãos/retirada/levar pessoalmente; "envio" se for por transportadora, correio, Melhor Envio, etiqueta. Sem informação: "maos".
- embalagem: "empilhado" se o texto disser que as caixas vão juntas/empilhadas num volume só (e pilhas = quantas pilhas, ex.: "2 pilhas de 3" = 2); senão "separadas" e pilhas = 1.
- observacoes: só o que precisa sair na nota (ex.: número do pedido do cliente). Senão "".
- duvidas: lista curta, em português, do que faltou ou ficou ambíguo (ex.: "Falta a inscrição estadual", "Preço não informado", "Falta o CEP"). Nunca invente dados: campo sem informação fica "".`;

/** Lê o texto colado e devolve o rascunho preenchido (com dúvidas). */
export async function extrairRascunho(texto: string): Promise<Rascunho> {
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error(
      "A IA está desligada (falta a chave ANTHROPIC_API_KEY na Vercel). Preencha os campos à mão.",
    );
  const client = new Anthropic();
  let response;
  try {
    response = await client.messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(rascunhoSchema) },
      system: SISTEMA,
      messages: [{ role: "user", content: texto.slice(0, 8000) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      throw new Error("A chave da IA está errada ou foi apagada. Preencha à mão e avisa o João.");
    if (error instanceof Anthropic.RateLimitError)
      throw new Error("A IA está ocupada agora. Tenta de novo em 1 minuto ou preencha à mão.");
    if (error instanceof Anthropic.APIError && error.status === 402)
      throw new Error("A conta da IA ficou sem crédito. Preencha à mão e avisa o João.");
    throw new Error("A IA não respondeu. Tenta de novo ou preencha à mão.");
  }
  if (response.stop_reason === "refusal" || !response.parsed_output)
    throw new Error("A IA não conseguiu ler esse texto. Preencha à mão.");
  return limpar(response.parsed_output);
}

const digitos = (s: string) => s.replace(/\D/g, "");

function limpar(r: Rascunho): Rascunho {
  const c = r.cliente;
  return {
    ...r,
    cliente: {
      ...c,
      documento: digitos(c.documento),
      ie: digitos(c.ie),
      cep: digitos(c.cep),
      uf: c.uf.trim().toUpperCase().slice(0, 2),
      telefone: digitos(c.telefone),
      email: c.email.trim(),
      nome: c.nome.trim(),
      fantasia: c.fantasia.trim(),
    },
    itens: r.itens.map((i) => ({
      ...i,
      qtd: Math.round(i.qtd),
      // Brinde sai sempre com o valor de tabela (ninguém paga).
      preco:
        r.tipo === "bonificacao" ? PRODUTOS_NOTA[i.sku].tabela : Math.round(i.preco * 100) / 100,
    })),
    pilhas: Math.max(1, Math.round(r.pilhas || 1)),
  };
}

// ── Documentos ────────────────────────────────────────────────────────────
function cpfOk(d: string) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
function cnpjOk(d: string) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    const pesos =
      n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

// ── Regras (sem tocar em nada) ────────────────────────────────────────────
export type OpcaoFrete = { id: string; nome: string; precoCents: number; prazo: string };
export type Plano = {
  natureza: keyof typeof NATUREZA;
  naturezaLabel: string;
  /** O preço combinado já inclui o ST: a nota sai com preço menor. */
  stIncluso: boolean;
  totalCombinadoCents: number;
  latas: number;
  /** Envio: a caixa (uma) e quantas iguais vão (volumes). */
  pacote: { caixa: Caixa; volumes: number; descricao: string } | null;
  fretes: OpcaoFrete[];
  /** Saldo do Melhor Envio em centavos (null = não deu pra ler). */
  saldoCents: number | null;
  /** Já tem nota pra esse cliente nas últimas 24 h (pede confirmação). */
  repetida: string | null;
  erros: string[];
  avisos: string[];
};

function regras(r: Rascunho): Plano {
  const erros: string[] = [];
  const avisos: string[] = [];
  const c = r.cliente;
  const pj = c.pessoa === "PJ";

  if (pj ? !cnpjOk(c.documento) : !cpfOk(c.documento))
    erros.push(`${pj ? "CNPJ" : "CPF"} inválido (confira os números).`);
  if (!c.nome) erros.push(pj ? "Falta a razão social (do cartão CNPJ)." : "Falta o nome completo.");
  if (pj && !c.ie)
    erros.push(
      `Empresa sem inscrição estadual. A Sefaz rejeita sem a IE (consulte no Sintegra). Se a empresa for isenta: ${CHAMA}`,
    );
  if (!pj && c.ie) erros.push("Pessoa física não tem inscrição estadual: apague a IE.");
  if (!c.rua.trim() || !c.numero.trim() || !c.bairro.trim() || !c.cidade.trim())
    erros.push("Endereço incompleto (rua, número, bairro e cidade).");
  if (!UFS.has(c.uf)) erros.push("UF inválida (2 letras, ex.: RS).");
  if (!/^\d{8}$/.test(c.cep)) erros.push("CEP com 8 dígitos.");
  else if ((c.uf === "RS") !== c.cep.startsWith("9"))
    erros.push("O CEP não é do estado informado (CEP do RS começa com 9). Confira.");
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) erros.push("E-mail inválido.");

  if (!r.itens.length) erros.push("Coloque pelo menos um item.");
  const vistos = new Set<string>();
  for (const i of r.itens) {
    const p = PRODUTOS_NOTA[i.sku];
    if (vistos.has(i.sku)) erros.push(`${p.curto} aparece duas vezes: junte numa linha só.`);
    vistos.add(i.sku);
    if (!(i.qtd >= 1 && i.qtd <= 500)) erros.push(`${p.curto}: quantidade inválida.`);
    if (r.tipo === "venda") {
      if (!(i.preco > 0)) erros.push(`${p.curto}: falta o preço.`);
      else if (i.preco < p.faixa[0] || i.preco > p.faixa[1])
        erros.push(
          `${p.curto}: preço de R$ ${i.preco.toFixed(2)} por unidade está fora do normal (R$ ${p.faixa[0]} a R$ ${p.faixa[1]}). Confira se é por lata ou por caixa. Se estiver certo: ${CHAMA}`,
        );
    }
  }

  let natureza: Natureza;
  if (r.tipo === "bonificacao") {
    natureza = "bonificacao";
    if (UFS.has(c.uf) && !BRINDE_UFS.includes(c.uf))
      erros.push(
        `Brinde pra ${c.uf}: ainda não emitimos bonificação pra esse estado (só ${BRINDE_UFS.join(" e ")}). ${CHAMA}`,
      );
  } else if (pj) {
    natureza = c.uf === "RJ" ? "rj" : "st";
    if (UFS.has(c.uf) && !VENDA_EMPRESA_UFS.includes(c.uf))
      erros.push(
        `Venda pra empresa de ${c.uf}: a natureza desse estado não está cadastrada no Bling (só ${VENDA_EMPRESA_UFS.join(" e ")}). Cada estado tem regra de ST. ${CHAMA}`,
      );
  } else natureza = "consumidor";

  // Envio: monta a caixa (ou as caixas) da etiqueta.
  let pacote: Plano["pacote"] = null;
  if (r.entrega === "envio" && r.itens.length) {
    const skus = new Set(r.itens.map((i) => i.sku));
    const item = r.itens[0];
    const p = PRODUTOS_NOTA[item.sku];
    if (skus.size > 1)
      erros.push(
        "Envio automático é de um produto só por nota (six pack OU 2 pack). Faça uma nota pra cada.",
      );
    else if (!p.caixa)
      erros.push(`${p.curto} não tem caixa de envio cadastrada: só entrega em mãos. ${CHAMA}`);
    else if (r.embalagem === "empilhado") {
      const pilhas = Math.min(r.pilhas, item.qtd);
      const altura = Math.ceil(item.qtd / pilhas);
      const caixa = {
        lengthCm: p.caixa.lengthCm,
        widthCm: Math.round(p.caixa.widthCm * pilhas * 10) / 10,
        heightCm: Math.round(p.caixa.heightCm * altura * 10) / 10,
        weightKg: Math.round(p.caixa.weightKg * item.qtd * 100) / 100,
      };
      if (
        [caixa.lengthCm, caixa.widthCm, caixa.heightCm].some((n) => n > 100) ||
        caixa.weightKg > 30
      )
        erros.push(
          `Empilhado fica grande demais pra um volume (${caixa.lengthCm} × ${caixa.widthCm} × ${caixa.heightCm} cm, ${caixa.weightKg} kg; limite 100 cm por lado e 30 kg). Use caixas separadas ou mais pilhas.`,
        );
      pacote = {
        caixa,
        volumes: 1,
        descricao: `1 volume: ${pilhas} pilha(s) de ${altura} · ${caixa.lengthCm} × ${caixa.widthCm} × ${caixa.heightCm} cm · ${caixa.weightKg} kg`,
      };
    } else {
      if (item.qtd > 20)
        erros.push("Mais de 20 caixas separadas numa etiqueta: use empilhado ou chama o João.");
      pacote = {
        caixa: p.caixa,
        volumes: item.qtd,
        descricao: `${item.qtd} volume(s) iguais, cada um ${p.caixa.lengthCm} × ${p.caixa.widthCm} × ${p.caixa.heightCm} cm · ${p.caixa.weightKg} kg (etiquetas 1/${item.qtd}…)`,
      };
    }
  }

  const latas = r.itens.reduce((n, i) => n + PRODUTOS_NOTA[i.sku].latas * i.qtd, 0);
  const totalCombinadoCents = r.itens.reduce((n, i) => n + Math.round(i.preco * 100) * i.qtd, 0);
  if (r.tipo === "bonificacao")
    avisos.push("Brinde: sai com o valor de tabela na nota, mas ninguém paga.");
  return {
    natureza,
    naturezaLabel: {
      st: "Venda com ST (RS) · CFOP 5401 · o ST já está dentro do preço combinado",
      rj: "Venda pra empresa do RJ · CFOP 6101 · sem ST (Lei RJ 10.688/2025, observação automática)",
      consumidor: `Venda a consumidor final · CFOP ${c.uf === "RS" ? "5101" : "6107"}`,
      bonificacao: `Bonificação (brinde) · CFOP ${c.uf === "RS" ? "5910" : "6910"}`,
    }[natureza],
    stIncluso: natureza === "st",
    totalCombinadoCents,
    latas,
    pacote,
    fretes: [],
    saldoCents: null,
    repetida: null,
    erros,
    avisos,
  };
}

type Page<T> = { data: T[] };
type Created = { data: { id: number } };
type ContatoBling = {
  id: number;
  nome?: string;
  ie?: string;
  indicadorIe?: number;
  endereco?: { geral?: { uf?: string; municipio?: string; cep?: string } };
};

async function contatoExistente(documento: string): Promise<ContatoBling | null> {
  const found = await bling<Page<{ id: number }>>(
    `/contatos?numeroDocumento=${documento}&limite=1`,
  );
  if (!found.data[0]) return null;
  try {
    return (await bling<{ data: ContatoBling }>(`/contatos/${found.data[0].id}`)).data;
  } catch {
    return { id: found.data[0].id };
  }
}

/** Confere tudo (inclusive Bling e Melhor Envio) sem criar nada. */
export async function conferirNota(rascunho: Rascunho): Promise<Plano> {
  const r = limpar(rascunhoSchema.parse(rascunho));
  const plano = regras(r);
  if (plano.erros.length) return plano;

  // Estoque (as latas saem do Bling).
  if (plano.latas > 0) {
    try {
      const s = await bling<Page<{ saldoVirtualTotal?: number; saldoFisicoTotal?: number }>>(
        `/estoques/saldos?idsProdutos[]=${LATA_ID}`,
      );
      const saldo = s.data[0]?.saldoVirtualTotal ?? s.data[0]?.saldoFisicoTotal ?? 0;
      if (saldo < plano.latas)
        plano.erros.push(
          `Estoque do Bling tem ${saldo} latas e a nota precisa de ${plano.latas}. ${CHAMA}`,
        );
    } catch {
      plano.erros.push(`Não consegui ler o estoque no Bling. Tenta de novo em 1 minuto.`);
    }
  }

  // Cliente que já existe no Bling: a nota usa o cadastro de LÁ.
  try {
    const existe = await contatoExistente(r.cliente.documento);
    if (existe && existe.ie !== undefined) {
      const ieBling = digitos(existe.ie ?? "");
      const ufBling = existe.endereco?.geral?.uf ?? "";
      if (ieBling !== r.cliente.ie)
        plano.erros.push(
          `Esse cliente já está no Bling com IE ${ieBling || "VAZIA"} (aqui: ${r.cliente.ie || "vazia"}). A nota sairia com a do Bling e pode ser rejeitada. ${CHAMA}`,
        );
      if (ufBling && ufBling !== r.cliente.uf)
        plano.erros.push(
          `Esse cliente está no Bling com UF ${ufBling} (aqui: ${r.cliente.uf}). ${CHAMA}`,
        );
      if (!plano.erros.length)
        plano.avisos.push(
          `Cliente já cadastrado no Bling (${existe.nome ?? "—"}): a nota usa o endereço de lá.`,
        );
    }
  } catch {
    plano.erros.push("Não consegui consultar o cliente no Bling. Tenta de novo em 1 minuto.");
  }

  // Nota repetida (mesmo cliente nas últimas 24 h).
  const recentes = await listarPreps().catch(() => [] as Prep[]);
  const dia = Date.now() - 24 * 60 * 60 * 1000;
  const igual = recentes.find(
    (p) =>
      p.rascunho.cliente.documento === r.cliente.documento &&
      p.rascunho.tipo === r.tipo &&
      ["rascunho", "aguardando", "emitida"].includes(p.status) &&
      new Date(p.criadoEm).getTime() > dia,
  );
  if (igual)
    plano.repetida = `Já tem ${igual.status === "emitida" ? `a NF ${igual.numero} emitida` : "um rascunho"} hoje pra esse cliente (${(igual.totalNotaCents / 100).toFixed(2)}).`;

  // Frete e saldo do Melhor Envio.
  if (plano.pacote) {
    const valorUnit = Math.round(plano.totalCombinadoCents / plano.pacote.volumes);
    try {
      const opcoes = await quoteMelhorEnvio(r.cliente.cep, [
        { qty: plano.pacote.volumes, priceCents: valorUnit, ...plano.pacote.caixa },
      ]);
      plano.fretes = opcoes
        .map((o) => ({
          id: o.id,
          nome: `${o.carrier} ${o.service}`,
          precoCents: o.priceCents,
          prazo: `${o.days.min}–${o.days.max} dias úteis`,
        }))
        .sort((a, b) => a.precoCents - b.precoCents);
      if (!plano.fretes.length) throw new Error("sem opções");
    } catch {
      plano.erros.push(
        `Nenhuma transportadora atende esse CEP (${r.cliente.cep}) com essa caixa. Confira o CEP. Se estiver certo: ${CHAMA}`,
      );
    }
    try {
      const saldo = await meBalanceCents();
      plano.saldoCents = saldo;
      const barato = plano.fretes[0]?.precoCents ?? 0;
      if (barato && saldo < barato)
        plano.erros.push(
          `Saldo do Melhor Envio (R$ ${(saldo / 100).toFixed(2)}) não paga a etiqueta (R$ ${(barato / 100).toFixed(2)}). Coloque saldo antes de emitir.`,
        );
    } catch {
      plano.avisos.push("Não consegui ler o saldo do Melhor Envio (confira antes de emitir).");
    }
  }
  return plano;
}

// ── Preparar (rascunho no Bling) ──────────────────────────────────────────
export type Prep = {
  id: string;
  status: "rascunho" | "aguardando" | "emitida" | "erro" | "travada" | "descartada";
  criadoEm: string;
  rascunho: Rascunho;
  plano: Plano;
  frete: OpcaoFrete | null;
  contatoId: number;
  pedidoId: number;
  nfeId: number;
  numero: string | null;
  totalNotaCents: number;
  pdf: string | null;
  chave: string | null;
  etiqueta: {
    pdf: string | null;
    rastreio: string | null;
    erro: string | null;
    tentativas: number;
  } | null;
  estoqueBaixado: boolean;
  erro: string | null;
};

type Nfe = {
  id: number;
  numero?: string;
  situacao?: number;
  chaveAcesso?: string;
  linkPDF?: string;
  linkDanfe?: string;
  valorNota?: number;
  itens?: { cfop?: string }[];
};

const PREP_KEY = (id: string) => `nota:prep:${id}`;
const PREP_SET = "nota:preps";
const PREP_TTL = 60 * 60 * 24 * 120;
const RATIO_KEY = "nota:st:ratio";
// Total com ST ÷ preço da nota, medido nas notas de nov/2026 (CFOP 5401).
const RATIO_PADRAO = 1.18672;

export async function getPrep(id: string): Promise<Prep | null> {
  const raw = await kvGet(PREP_KEY(id));
  return raw ? (JSON.parse(raw) as Prep) : null;
}
async function savePrep(p: Prep) {
  await kvSet(PREP_KEY(p.id), JSON.stringify(p), PREP_TTL);
  await kvSAdd(PREP_SET, p.id);
}
export async function listarPreps(): Promise<Prep[]> {
  const ids = await kvSMembers(PREP_SET);
  if (!ids.length) return [];
  const raw = await kvMGet(...ids.map(PREP_KEY));
  return raw
    .filter((x): x is string => Boolean(x))
    .map((x) => JSON.parse(x) as Prep)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

function hojeBR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function criarContato(r: Rascunho): Promise<number> {
  const c = r.cliente;
  const existe = await contatoExistente(c.documento);
  if (existe) return existe.id;
  const base = {
    nome: c.nome,
    ...(c.fantasia ? { fantasia: c.fantasia } : {}),
    tipo: c.pessoa === "PJ" ? "J" : "F",
    situacao: "A",
    numeroDocumento: c.documento,
    ...(c.ie ? { ie: c.ie, indicadorIe: "1" } : { indicadorIe: "9" }),
    ...(c.email ? { email: c.email, emailNotaFiscal: c.email } : {}),
    endereco: {
      geral: {
        endereco: c.rua.trim(),
        numero: c.numero.trim(),
        complemento: c.complemento.trim(),
        bairro: c.bairro.trim(),
        municipio: c.cidade.trim(),
        uf: c.uf,
        cep: c.cep,
      },
    },
  };
  try {
    const created = await bling<Created>("/contatos", {
      method: "POST",
      body: { ...base, ...(c.telefone ? { telefone: c.telefone } : {}) },
    });
    return created.data.id;
  } catch {
    // Telefone num formato que o Bling recusa: vai sem.
    const created = await bling<Created>("/contatos", { method: "POST", body: base });
    return created.data.id;
  }
}

async function apagarRascunho(nfeId: number, pedidoId: number) {
  const falhas: string[] = [];
  await bling(`/nfe/${nfeId}`, { method: "DELETE" }).catch(() => falhas.push("a nota"));
  await bling(`/pedidos/vendas/${pedidoId}`, { method: "DELETE" }).catch(() =>
    falhas.push("o pedido"),
  );
  return falhas;
}

/**
 * Confere de novo (o servidor não confia na tela), cria cliente, pedido e nota
 * em RASCUNHO e confere o rascunho. Nada vai pra Sefaz aqui.
 */
export async function prepararNota(
  rascunho: Rascunho,
  opcoes: { freteId: string | null; confirmaRepetida: boolean },
): Promise<Prep> {
  const r = limpar(rascunhoSchema.parse(rascunho));
  const plano = await conferirNota(r);
  if (plano.erros.length) throw new Error(plano.erros.join(" "));
  if (plano.repetida && !opcoes.confirmaRepetida)
    throw new Error(`${plano.repetida} Marque "É outra nota mesmo" se for.`);
  const frete = plano.pacote ? (plano.fretes.find((f) => f.id === opcoes.freteId) ?? null) : null;
  if (plano.pacote && !frete) throw new Error("Escolha o frete.");
  if (frete && plano.saldoCents !== null && plano.saldoCents < frete.precoCents)
    throw new Error(
      `Saldo do Melhor Envio (R$ ${(plano.saldoCents / 100).toFixed(2)}) não paga esse frete. Escolha outro ou coloque saldo.`,
    );

  if (!(await kvSetNX(`nota:preparando:${r.cliente.documento}`, "1", 60)))
    throw new Error("Já está preparando uma nota pra esse cliente. Aguarde.");
  try {
    const ratio = plano.stIncluso ? Number(await kvGet(RATIO_KEY)) || RATIO_PADRAO : 1;
    const contatoId = await criarContato(r);
    const data = hojeBR();
    const c = r.cliente;
    const peso = plano.pacote
      ? plano.pacote.caixa.weightKg * plano.pacote.volumes
      : r.itens.reduce((n, i) => n + (PRODUTOS_NOTA[i.sku].caixa?.weightKg ?? 0.37) * i.qtd, 0);
    const pedido = await bling<Created>("/pedidos/vendas", {
      method: "POST",
      body: {
        contato: { id: contatoId },
        data,
        dataSaida: data,
        dataPrevista: data,
        itens: r.itens.map((i) => {
          const p = PRODUTOS_NOTA[i.sku];
          return {
            produto: { id: p.id },
            codigo: i.sku,
            descricao: p.nome,
            unidade: p.unidade,
            quantidade: i.qtd,
            valor: Math.round((i.preco / ratio) * 100) / 100,
            naturezaOperacao: { id: NATUREZA[plano.natureza] },
          };
        }),
        parcelas: [],
        transporte: {
          // Envio: frete por conta da Fernandito (CIF). Em mãos: transporte próprio.
          fretePorConta: r.entrega === "envio" ? "0" : "3",
          frete: 0,
          quantidadeVolumes: plano.pacote?.volumes ?? 1,
          pesoBruto: Math.round(peso * 100) / 100,
          etiqueta: {
            nome: c.fantasia || c.nome,
            endereco: c.rua.trim(),
            numero: c.numero.trim(),
            complemento: c.complemento.trim(),
            bairro: c.bairro.trim(),
            municipio: c.cidade.trim(),
            uf: c.uf,
            cep: c.cep,
          },
        },
        ...(() => {
          // RJ: a observação da lei vai sempre (pedido da contadora).
          const obs = [r.observacoes.trim(), plano.natureza === "rj" ? OBS_RJ : ""]
            .filter(Boolean)
            .join(" ");
          return obs ? { observacoes: obs } : {};
        })(),
        observacoesInternas:
          `Emitido pelo painel (aba Emitir nota). ` +
          (plano.stIncluso
            ? `Combinado R$ ${(plano.totalCombinadoCents / 100).toFixed(2)} com ST incluso: preço da nota ajustado. `
            : "") +
          (frete
            ? `Frete ${frete.nome} R$ ${(frete.precoCents / 100).toFixed(2)} (Fernandito paga).`
            : ""),
      },
    });
    const pedidoId = pedido.data.id;
    const gerada = await bling<{ data: { id: number } }>(`/pedidos/vendas/${pedidoId}/gerar-nfe`, {
      method: "POST",
    });
    const nfe = (await bling<{ data: Nfe }>(`/nfe/${gerada.data.id}`)).data;
    const totalNotaCents = Math.round((nfe.valorNota ?? 0) * 100);

    const prep: Prep = {
      id: crypto.randomUUID(),
      status: "rascunho",
      criadoEm: new Date().toISOString(),
      rascunho: r,
      plano,
      frete,
      contatoId,
      pedidoId,
      nfeId: nfe.id,
      numero: nfe.numero ?? null,
      totalNotaCents,
      pdf: nfe.linkPDF ?? nfe.linkDanfe ?? null,
      chave: null,
      etiqueta: null,
      estoqueBaixado: false,
      erro: null,
    };

    // Confere o rascunho: total e CFOP. Não bateu → trava (e tenta apagar).
    const problemas: string[] = [];
    const diff = Math.abs(totalNotaCents - plano.totalCombinadoCents);
    if (!totalNotaCents) problemas.push("o Bling não devolveu o total da nota");
    else if (diff > (plano.stIncluso ? 100 : 1))
      problemas.push(
        `o total da nota (R$ ${(totalNotaCents / 100).toFixed(2)}) não bate com o combinado (R$ ${(plano.totalCombinadoCents / 100).toFixed(2)})`,
      );
    const cfops = [...new Set((nfe.itens ?? []).map((i) => i.cfop ?? ""))];
    if (cfops.some((cf) => !CFOP_OK[plano.natureza].includes(cf)))
      problemas.push(
        `o CFOP saiu ${cfops.join(", ")} (esperado ${CFOP_OK[plano.natureza].join(" ou ")})`,
      );
    if (problemas.length) {
      const falhas = await apagarRascunho(nfe.id, pedidoId);
      prep.status = "travada";
      prep.erro =
        `Travei: ${problemas.join("; ")}. ${CHAMA}` +
        (falhas.length
          ? ` Ficou no Bling pra apagar: ${falhas.join(" e ")} (rascunho nº ${prep.numero ?? "—"}).`
          : " O rascunho foi apagado do Bling.");
      await savePrep(prep);
      return prep;
    }

    // Aprende a conta do ST (pra próxima sair ainda mais perto do combinado).
    if (plano.stIncluso) {
      const base = r.itens.reduce((n, i) => n + Math.round((i.preco / ratio) * 100) * i.qtd, 0);
      const medido = base > 0 ? totalNotaCents / base : 0;
      if (medido > 1.05 && medido < 1.5) await kvSet(RATIO_KEY, medido.toFixed(5)).catch(() => {});
    }
    await savePrep(prep);
    return prep;
  } finally {
    await kvDel(`nota:preparando:${r.cliente.documento}`).catch(() => {});
  }
}

// ── Emitir (Sefaz + estoque + etiqueta) ───────────────────────────────────
const NFE_OK = [5, 6, 7];
const NFE_FAIL: Record<number, string> = {
  2: "cancelada",
  4: "REJEITADA pela Sefaz",
  9: "DENEGADA pela Sefaz",
  11: "bloqueada",
};

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Manda pra Sefaz e faz o resto. Pode chamar de novo: cada passo que já foi
 * feito é pulado (nota já autorizada, estoque já baixado, etiqueta já comprada).
 */
export async function autorizarNota(id: string): Promise<Prep> {
  const prep = await getPrep(id);
  if (!prep) throw new Error("Rascunho não encontrado (expirou?). Prepare de novo.");
  if (["descartada", "travada"].includes(prep.status))
    throw new Error("Esse rascunho não pode ser emitido. Prepare de novo.");
  if (prep.status === "erro") throw new Error(prep.erro ?? CHAMA);
  if (!(await kvSetNX(`nota:lock:${id}`, "1", 120))) throw new Error("Já está emitindo. Aguarde.");
  try {
    const r = prep.rascunho;
    // 0. Antes da Sefaz: ainda tem saldo pra etiqueta? (depois de emitida não tem volta)
    if (prep.status === "rascunho" && prep.frete) {
      const saldo = await meBalanceCents().catch(() => null);
      if (saldo !== null && saldo < prep.frete.precoCents)
        throw new Error(
          `Saldo do Melhor Envio (R$ ${(saldo / 100).toFixed(2)}) não paga a etiqueta (R$ ${(prep.frete.precoCents / 100).toFixed(2)}). Coloque saldo e clique em Emitir de novo.`,
        );
    }

    // 1. Sefaz.
    let nfe = (await bling<{ data: Nfe }>(`/nfe/${prep.nfeId}`)).data;
    if (!NFE_OK.includes(nfe.situacao ?? 0) && !NFE_FAIL[nfe.situacao ?? 0]) {
      if ((nfe.situacao ?? 1) === 1)
        await bling(`/nfe/${prep.nfeId}/enviar?enviarEmail=${r.cliente.email ? "true" : "false"}`, {
          method: "POST",
        });
      for (let t = 0; t < 8; t++) {
        nfe = (await bling<{ data: Nfe }>(`/nfe/${prep.nfeId}`)).data;
        if (NFE_OK.includes(nfe.situacao ?? 0) || NFE_FAIL[nfe.situacao ?? 0]) break;
        await espera(2500);
      }
    }
    prep.numero = nfe.numero ?? prep.numero;
    prep.pdf = nfe.linkPDF ?? nfe.linkDanfe ?? prep.pdf;
    if (NFE_FAIL[nfe.situacao ?? 0]) {
      prep.status = "erro";
      prep.erro = `Nota ${prep.numero ?? ""} ${NFE_FAIL[nfe.situacao ?? 0]}. Não tente de novo nem prepare outra: ${CHAMA} (o motivo está no Bling, em Notas fiscais).`;
      await savePrep(prep);
      return prep;
    }
    if (!NFE_OK.includes(nfe.situacao ?? 0)) {
      prep.status = "aguardando";
      prep.erro =
        "A Sefaz ainda não respondeu. Clique em “Conferir de novo” em 1 minuto (não emita outra).";
      await savePrep(prep);
      return prep;
    }
    prep.status = "emitida";
    prep.chave = nfe.chaveAcesso ?? null;
    prep.erro = null;
    await savePrep(prep);

    // 2. Estoque (as naturezas não baixam sozinhas; o barril não tem estoque).
    if (!prep.estoqueBaixado && prep.plano.latas > 0) {
      try {
        const dep = await bling<Page<{ id: number; padrao?: boolean }>>(
          "/depositos?situacao=1&limite=100",
        );
        const deposito = dep.data.find((x) => x.padrao) ?? dep.data[0];
        if (!deposito) throw new Error("sem depósito");
        await bling("/estoques", {
          method: "POST",
          body: {
            produto: { id: LATA_ID },
            deposito: { id: deposito.id },
            operacao: "S",
            quantidade: prep.plano.latas,
            observacoes:
              `Baixa NF ${prep.numero} (painel) - ${r.cliente.fantasia || r.cliente.nome}`.slice(
                0,
                200,
              ),
          },
        });
        prep.estoqueBaixado = true;
      } catch {
        prep.erro = `A nota saiu, mas o estoque NÃO baixou (${prep.plano.latas} latas). Avisa o João.`;
      }
      await savePrep(prep);
    }

    // 3. Etiqueta (só envio). Duas tentativas; depois, chama o João.
    if (r.entrega === "envio" && !prep.etiqueta?.pdf) {
      const tentativas = (prep.etiqueta?.tentativas ?? 0) + 1;
      try {
        prep.etiqueta = { ...(await comprarEtiqueta(prep)), tentativas };
      } catch (error) {
        prep.etiqueta = {
          pdf: null,
          rastreio: null,
          tentativas,
          erro:
            tentativas >= 2
              ? `A etiqueta não saiu de novo (${(error as Error).message}). A nota está emitida: não emita outra. ${CHAMA}`
              : `A nota saiu, mas a etiqueta não (${(error as Error).message}). Clique em “Comprar etiqueta” (não paga em dobro).`,
        };
      }
      await savePrep(prep);
    }
    return prep;
  } finally {
    await kvDel(`nota:lock:${id}`).catch(() => {});
  }
}

async function comprarEtiqueta(prep: Prep) {
  const r = prep.rascunho;
  const c = r.cliente;
  const pacote = prep.plano.pacote;
  if (!prep.chave) throw new Error("nota sem chave de acesso");
  if (!pacote || !prep.frete) throw new Error("sem caixa/frete definidos");
  const item = r.itens[0];
  const p = PRODUTOS_NOTA[item.sku];
  const ref = `nota-${prep.id.slice(0, 8)}`;
  const valorCents = prep.totalNotaCents || prep.plano.totalCombinadoCents;
  const fone =
    c.telefone || (process.env.ME_FROM_PHONE?.trim() || "51993383764").replace(/\D/g, "");
  const existing = await findShipmentByTag(ref);
  const meId =
    existing?.id ??
    (await addToCart({
      orderId: ref,
      shippingId: prep.frete.id,
      invoiceKey: prep.chave,
      to: {
        name: (c.fantasia || c.nome).slice(0, 60),
        phone: fone,
        email: c.email,
        cpf: c.pessoa === "PF" ? c.documento : "",
        cnpj: c.pessoa === "PJ" ? c.documento : "",
        ie: c.ie,
        street: c.rua.trim(),
        number: c.numero.trim(),
        complement: c.complemento.trim(),
        district: c.bairro.trim(),
        city: c.cidade.trim(),
        uf: c.uf,
        cep: c.cep,
      },
      items: [{ name: p.nome, qty: item.qtd, unitCents: Math.round(valorCents / item.qtd) }],
      totalProductsCents: valorCents,
      box: pacote.caixa,
      volumes: pacote.volumes,
    }));
  const ja = existing && ["generated", "released", "posted", "delivered"].includes(existing.status);
  if (!ja) {
    await payWithBalance(meId).catch((error: Error) => {
      if (!/pago|paid|j[aá] /i.test(error.message)) throw error;
    });
    await generateLabel(meId);
  }
  const shipment = await getShipment(meId);
  const pdf = await labelPrintUrl(meId);
  const old = await getAvulso(ref);
  await saveAvulso({
    id: ref,
    tipo: r.tipo === "bonificacao" ? "bonificacao" : "manual",
    nome: c.fantasia || c.nome,
    cidade: c.cidade.trim(),
    uf: c.uf,
    cep: c.cep,
    rua: c.rua.trim(),
    numero: c.numero.trim(),
    complemento: c.complemento.trim(),
    bairro: c.bairro.trim(),
    fone: c.telefone,
    item: p.nome,
    qtd: item.qtd,
    valorCents,
    transportadora: prep.frete.nome,
    nf: { chave: prep.chave, numero: prep.numero },
    meId,
    stage: old?.stage ?? "ready",
    status: shipment.status,
    tracking: shipment.tracking ?? shipment.selfTracking ?? null,
    trackingUrl: shipment.trackingUrl,
    printUrl: pdf,
    postedAt: shipment.postedAt,
    postedByHand: old?.postedByHand ?? null,
    checkedAt: new Date().toISOString(),
    error: null,
    createdAt: old?.createdAt ?? new Date().toISOString(),
  });
  return { pdf, rastreio: shipment.tracking ?? shipment.selfTracking ?? null, erro: null };
}

/** Joga fora um rascunho (tenta apagar nota e pedido no Bling). */
export async function descartarNota(id: string): Promise<Prep> {
  const prep = await getPrep(id);
  if (!prep) throw new Error("Rascunho não encontrado.");
  if (prep.status === "emitida" || prep.status === "erro" || prep.status === "aguardando")
    throw new Error(`Essa nota já foi pra Sefaz: não dá pra descartar daqui. ${CHAMA}`);
  const falhas = prep.status === "rascunho" ? await apagarRascunho(prep.nfeId, prep.pedidoId) : [];
  prep.status = "descartada";
  prep.erro = falhas.length
    ? `Apague no Bling: ${falhas.join(" e ")} (rascunho nº ${prep.numero ?? "—"}).`
    : null;
  await savePrep(prep);
  return prep;
}
