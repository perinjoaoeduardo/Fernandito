import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { bling } from "@/lib/bling/client";
import { adicionarCaixa, PESSOAS, type Pessoa } from "@/lib/caixas";
import {
  addToCart,
  findShipmentByTag,
  generateLabel,
  getShipment,
  labelPrintUrl,
  payWithBalance,
} from "@/lib/melhor-envio-label";
import { getAvulso, saveAvulso } from "@/lib/store/avulsos";
import { kvDel, kvGet, kvMGet, kvSAdd, kvSet, kvSetNX, kvSMembers } from "@/lib/store/kv";

/**
 * "Emitir nota" do painel: a pessoa cola um texto (WhatsApp, cartão CNPJ…),
 * o Claude Haiku preenche os campos, a pessoa confere e o sistema:
 *  1. PREPARA: cadastra o cliente no Bling (se não existir), cria o pedido e
 *     gera a nota em RASCUNHO (nada vai pra Sefaz) — mostra o total real.
 *  2. AUTORIZA (só com o clique): manda a nota pra Sefaz, baixa o estoque,
 *     compra a etiqueta no Melhor Envio (se for envio) e lança nas Caixas.
 *
 * Regras fiscais (combinadas com a contadora, nov/2026):
 *  - Brinde/bonificação → "Saída em bonificação – Brinde" (5910/6910).
 *  - Venda pra EMPRESA do RS com IE → "Venda de produção com ST (RS)" (5401):
 *    o preço combinado JÁ inclui o ST, então o preço da nota é ajustado pra o
 *    total (com ST) bater com o combinado.
 *  - Venda pra pessoa física (ou empresa sem IE) → consumidor final (5101/6107).
 *  - Venda pra empresa FORA do RS → bloqueia (cada estado tem regra de ST).
 *
 * A chave da IA é o env `ANTHROPIC_API_KEY` (Vercel). Sem ela, o formulário
 * funciona igual, só não preenche sozinho.
 */

// ── Cadastro (IDs do Bling) ────────────────────────────────────────────────
export const NATUREZA = {
  consumidor: 15111699956,
  bonificacao: 15111699949,
  st: 15111699959,
} as const;

type Caixa = { weightKg: number; widthCm: number; heightCm: number; lengthCm: number };

export const PRODUTOS_NOTA = {
  "FERN-350-6": {
    id: 16718234925,
    nome: "Fernandito - Pack 6 latas 350ml",
    curto: "Six pack",
    unidade: "UN",
    latas: 6,
    tabelaCents: 9499,
    caixa: { weightKg: 2.5, widthCm: 13.8, heightCm: 16.4, lengthCm: 24 } as Caixa | null,
  },
  "FERN-350": {
    id: 16718234916,
    nome: "Fernandito - Lata 350ml",
    curto: "Lata",
    unidade: "UN",
    latas: 1,
    tabelaCents: 1599,
    caixa: null as Caixa | null,
  },
  "FERN-350-2": {
    id: 16741631998,
    nome: "Fernandito - 2 Pack 2 latas 350ml",
    curto: "2 Pack",
    unidade: "UN",
    latas: 2,
    tabelaCents: 4490,
    caixa: { weightKg: 0.74, widthCm: 10, heightCm: 16, lengthCm: 20 } as Caixa | null,
  },
  "FERN-BARRIL-L": {
    id: 16740716066,
    nome: "Fernandito - Litro do barril (chopp)",
    curto: "Litro do barril",
    unidade: "L",
    latas: 0,
    tabelaCents: 2450,
    caixa: null as Caixa | null,
  },
} as const;
export type SkuNota = keyof typeof PRODUTOS_NOTA;
const SKUS = Object.keys(PRODUTOS_NOTA) as [SkuNota, ...SkuNota[]];

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
  /** De quem saíram as caixas (Caixas da equipe). "" = do estoque. */
  quem: z.string(),
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
    quem: "",
    observacoes: "",
    duvidas: [],
  };
}

const SISTEMA = `Tu lê um texto colado por alguém da equipe da Fernandito (fernet com cola em lata, Porto Alegre/RS) e preenche os campos de uma nota fiscal.

Produtos (sku):
- FERN-350-6: six pack (caixa com 6 latas). "caixa", "pack", "six" = six pack.
- FERN-350: lata avulsa 350 ml.
- FERN-350-2: 2 pack (caixinha com 2 latas).
- FERN-BARRIL-L: chopp de barril, vendido por LITRO (barril de 20 L = qtd 20).

Regras:
- tipo: "bonificacao" se for brinde, amostra, presente, bonificação, degustação; senão "venda".
- preco: preço FINAL combinado POR UNIDADE do sku, em reais. Se o texto der o preço por lata e o item for six pack, multiplica por 6. Se der só o total, divide pela quantidade. Bonificação: usa 94.99 (six pack), 15.99 (lata), 44.90 (2 pack), 24.50 (litro). Venda sem preço no texto: 0 e põe em duvidas.
- cliente.pessoa: "PJ" se tiver CNPJ, "PF" se for CPF. documento só com dígitos. ie só com dígitos ("" se não tiver ou for isento).
- endereço: separa rua, número, complemento, bairro, cidade, uf (2 letras), cep (só dígitos).
- entrega: "maos" se for entregue em mãos/retirada/levar pessoalmente; "envio" se for por transportadora, correio, Melhor Envio. Sem informação: "maos".
- quem: se o texto disser de quem saíram as caixas, um destes nomes exatos: ${PESSOAS.join(", ")}. Senão "".
- observacoes: só o que precisa sair na nota (ex.: referência de pedido do cliente). Senão "".
- duvidas: lista curta, em português, do que faltou ou ficou ambíguo (ex.: "Falta a inscrição estadual", "Preço não informado"). Nunca invente dados: campo sem informação fica "".`;

/** Lê o texto colado e devolve o rascunho preenchido (com dúvidas). */
export async function extrairRascunho(texto: string): Promise<Rascunho> {
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error("IA desligada: falta a chave ANTHROPIC_API_KEY na Vercel. Preencha à mão.");
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(rascunhoSchema) },
    system: SISTEMA,
    messages: [{ role: "user", content: texto.slice(0, 8000) }],
  });
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
    },
    itens: r.itens
      .filter((i) => i.qtd > 0)
      .map((i) => ({ ...i, qtd: Math.round(i.qtd), preco: Math.round(i.preco * 100) / 100 })),
    quem: PESSOAS.includes(r.quem as Pessoa) ? r.quem : "",
  };
}

// ── Regras ────────────────────────────────────────────────────────────────
export type Plano = {
  natureza: keyof typeof NATUREZA;
  naturezaLabel: string;
  /** O preço combinado já inclui o ST: a nota sai com preço menor. */
  stIncluso: boolean;
  totalCombinadoCents: number;
  latas: number;
  erros: string[];
  avisos: string[];
};

export function planejar(r: Rascunho): Plano {
  const erros: string[] = [];
  const avisos: string[] = [];
  const c = r.cliente;
  const pj = c.pessoa === "PJ";
  if (pj && c.documento.length !== 14) erros.push("CNPJ precisa ter 14 dígitos.");
  if (!pj && c.documento.length !== 11) erros.push("CPF precisa ter 11 dígitos.");
  if (!c.nome.trim()) erros.push("Falta o nome / razão social.");
  if (!c.rua.trim() || !c.numero.trim() || !c.bairro.trim() || !c.cidade.trim())
    erros.push("Endereço incompleto (rua, número, bairro e cidade).");
  if (!/^[A-Z]{2}$/.test(c.uf)) erros.push("UF com 2 letras (ex.: RS).");
  if (c.cep.length !== 8) erros.push("CEP com 8 dígitos.");
  if (!r.itens.length) erros.push("Coloque pelo menos um item.");
  for (const i of r.itens) {
    if (!(i.qtd > 0)) erros.push(`${PRODUTOS_NOTA[i.sku].curto}: quantidade inválida.`);
    if (!(i.preco > 0)) erros.push(`${PRODUTOS_NOTA[i.sku].curto}: falta o preço.`);
  }

  let natureza: Plano["natureza"];
  if (r.tipo === "bonificacao") natureza = "bonificacao";
  else if (pj && c.ie) {
    natureza = "st";
    if (c.uf !== "RS")
      erros.push(
        "Venda pra empresa fora do RS: cada estado tem regra de ST. Confirme a natureza com a contadora e emita pelo João.",
      );
  } else {
    natureza = "consumidor";
    if (pj) avisos.push("Empresa sem inscrição estadual: sai como consumidor final.");
  }
  if (r.entrega === "envio") {
    const comCaixa = r.itens.filter((i) => PRODUTOS_NOTA[i.sku].caixa);
    const skus = new Set(r.itens.map((i) => i.sku));
    if (comCaixa.length !== r.itens.length || skus.size > 1)
      erros.push(
        "Etiqueta automática só pra um tipo de caixa por envio (six pack OU 2 pack). Para o resto, escolha entrega em mãos e faça a etiqueta à parte.",
      );
  }
  const latas = r.itens.reduce((n, i) => n + PRODUTOS_NOTA[i.sku].latas * i.qtd, 0);
  const totalCombinadoCents = r.itens.reduce((n, i) => n + Math.round(i.preco * 100) * i.qtd, 0);
  return {
    natureza,
    naturezaLabel: {
      st: "Venda de produção com ST (RS) · CFOP 5401",
      consumidor: "Venda a consumidor final · CFOP 5101/6107",
      bonificacao: "Bonificação (brinde) · CFOP 5910/6910",
    }[natureza],
    stIncluso: natureza === "st",
    totalCombinadoCents,
    latas,
    erros,
    avisos,
  };
}

// ── Preparar (rascunho no Bling) ──────────────────────────────────────────
export type Prep = {
  id: string;
  status: "rascunho" | "aguardando" | "emitida" | "erro" | "descartada";
  criadoEm: string;
  rascunho: Rascunho;
  plano: Plano;
  contatoId: number;
  pedidoId: number;
  nfeId: number;
  numero: string | null;
  totalNotaCents: number;
  pdf: string | null;
  chave: string | null;
  etiqueta: { pdf: string | null; rastreio: string | null; erro: string | null } | null;
  estoqueBaixado: boolean;
  caixasLancadas: boolean;
  erro: string | null;
};

type Page<T> = { data: T[] };
type Created = { data: { id: number } };
type Nfe = {
  id: number;
  numero?: string;
  situacao?: number;
  chaveAcesso?: string;
  linkPDF?: string;
  linkDanfe?: string;
  valorNota?: number;
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

async function contato(r: Rascunho): Promise<number> {
  const c = r.cliente;
  const found = await bling<Page<{ id: number }>>(
    `/contatos?numeroDocumento=${c.documento}&limite=1`,
  );
  if (found.data[0]) return found.data[0].id;
  const pj = c.pessoa === "PJ";
  const base = {
    nome: c.nome.trim(),
    ...(c.fantasia.trim() ? { fantasia: c.fantasia.trim() } : {}),
    tipo: pj ? "J" : "F",
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

/** Cria cliente, pedido e nota em RASCUNHO. Nada vai pra Sefaz aqui. */
export async function prepararNota(rascunho: Rascunho, autor: string): Promise<Prep> {
  const r = limpar(rascunhoSchema.parse(rascunho));
  const plano = planejar(r);
  if (plano.erros.length) throw new Error(plano.erros.join(" "));
  const ratio = plano.stIncluso ? Number(await kvGet(RATIO_KEY)) || RATIO_PADRAO : 1;
  const contatoId = await contato(r);
  const data = hojeBR();
  const c = r.cliente;
  const caixas = r.itens.reduce((n, i) => n + (PRODUTOS_NOTA[i.sku].caixa ? i.qtd : 0), 0);
  const peso = r.itens.reduce(
    (n, i) =>
      n + (PRODUTOS_NOTA[i.sku].caixa?.weightKg ?? PRODUTOS_NOTA[i.sku].latas * 0.37) * i.qtd,
    0,
  );
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
        fretePorConta: r.entrega === "envio" ? "0" : "3",
        frete: 0,
        quantidadeVolumes: Math.max(1, caixas),
        pesoBruto: Math.round(peso * 100) / 100,
        etiqueta: {
          nome: c.nome.trim(),
          endereco: c.rua.trim(),
          numero: c.numero.trim(),
          complemento: c.complemento.trim(),
          bairro: c.bairro.trim(),
          municipio: c.cidade.trim(),
          uf: c.uf,
          cep: c.cep,
        },
      },
      ...(r.observacoes.trim() ? { observacoes: r.observacoes.trim() } : {}),
      observacoesInternas:
        `Emitido pelo painel (${autor}). ` +
        (plano.stIncluso
          ? `Combinado R$ ${(plano.totalCombinadoCents / 100).toFixed(2)} com ST incluso: preço da nota ajustado.`
          : ""),
    },
  });
  const pedidoId = pedido.data.id;
  const gerada = await bling<{ data: { id: number } }>(`/pedidos/vendas/${pedidoId}/gerar-nfe`, {
    method: "POST",
  });
  const nfe = (await bling<{ data: Nfe }>(`/nfe/${gerada.data.id}`)).data;
  const totalNotaCents = Math.round((nfe.valorNota ?? 0) * 100);
  // Aprende a conta do ST (pra próxima sair ainda mais perto do combinado).
  if (plano.stIncluso && totalNotaCents > 0) {
    const base = r.itens.reduce((n, i) => n + Math.round((i.preco / ratio) * 100) * i.qtd, 0);
    if (base > 0) {
      const medido = totalNotaCents / base;
      if (medido > 1 && medido < 2) await kvSet(RATIO_KEY, medido.toFixed(5)).catch(() => {});
    }
  }
  const prep: Prep = {
    id: crypto.randomUUID(),
    status: "rascunho",
    criadoEm: new Date().toISOString(),
    rascunho: r,
    plano,
    contatoId,
    pedidoId,
    nfeId: nfe.id,
    numero: nfe.numero ?? null,
    totalNotaCents,
    pdf: nfe.linkPDF ?? nfe.linkDanfe ?? null,
    chave: null,
    etiqueta: null,
    estoqueBaixado: false,
    caixasLancadas: false,
    erro: null,
  };
  await savePrep(prep);
  return prep;
}

// ── Autorizar (Sefaz + estoque + etiqueta + caixas) ───────────────────────
const NFE_OK = [5, 6, 7];
const NFE_FAIL: Record<number, string> = {
  2: "cancelada",
  4: "rejeitada pela Sefaz",
  9: "denegada",
  11: "bloqueada",
};

async function deposito() {
  const d = await bling<Page<{ id: number; padrao?: boolean }>>("/depositos?situacao=1&limite=100");
  const dep = d.data.find((x) => x.padrao) ?? d.data[0];
  if (!dep) throw new Error("nenhum depósito ativo no Bling");
  return dep.id;
}

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Manda pra Sefaz e faz o resto. Pode chamar de novo: cada passo que já foi
 * feito é pulado (nota já autorizada, estoque já baixado, etiqueta já comprada).
 */
export async function autorizarNota(id: string): Promise<Prep> {
  const prep = await getPrep(id);
  if (!prep) throw new Error("Rascunho não encontrado (expirou?). Prepare de novo.");
  if (prep.status === "descartada") throw new Error("Esse rascunho foi descartado.");
  if (!(await kvSetNX(`nota:lock:${id}`, "1", 90))) throw new Error("Já está emitindo. Aguarde.");
  try {
    // 1. Sefaz.
    let nfe = (await bling<{ data: Nfe }>(`/nfe/${prep.nfeId}`)).data;
    if (!NFE_OK.includes(nfe.situacao ?? 0) && !NFE_FAIL[nfe.situacao ?? 0]) {
      if (prep.status === "rascunho" && (nfe.situacao ?? 1) === 1)
        await bling(`/nfe/${prep.nfeId}/enviar?enviarEmail=true`, { method: "POST" });
      for (let t = 0; t < 6; t++) {
        nfe = (await bling<{ data: Nfe }>(`/nfe/${prep.nfeId}`)).data;
        if (NFE_OK.includes(nfe.situacao ?? 0) || NFE_FAIL[nfe.situacao ?? 0]) break;
        await espera(2500);
      }
    }
    prep.numero = nfe.numero ?? prep.numero;
    prep.pdf = nfe.linkPDF ?? nfe.linkDanfe ?? prep.pdf;
    if (NFE_FAIL[nfe.situacao ?? 0]) {
      prep.status = "erro";
      prep.erro = `Nota ${NFE_FAIL[nfe.situacao ?? 0]}. Veja o motivo no Bling (Notas fiscais), corrija o cadastro e prepare de novo.`;
      await savePrep(prep);
      return prep;
    }
    if (!NFE_OK.includes(nfe.situacao ?? 0)) {
      prep.status = "aguardando";
      prep.erro = "A Sefaz ainda não respondeu. Clique em “Conferir de novo” em 1 minuto.";
      await savePrep(prep);
      return prep;
    }
    prep.status = "emitida";
    prep.chave = nfe.chaveAcesso ?? null;
    prep.erro = null;
    await savePrep(prep);

    const r = prep.rascunho;
    // 2. Estoque (as naturezas não baixam sozinhas; o barril não tem estoque).
    if (!prep.estoqueBaixado && prep.plano.latas > 0) {
      const dep = await deposito();
      await bling("/estoques", {
        method: "POST",
        body: {
          produto: { id: PRODUTOS_NOTA["FERN-350"].id },
          deposito: { id: dep },
          operacao: "S",
          quantidade: prep.plano.latas,
          observacoes: `Baixa NF ${prep.numero} (painel) - ${r.cliente.nome}`.slice(0, 200),
        },
      });
      prep.estoqueBaixado = true;
      await savePrep(prep);
    }

    // 3. Caixas da equipe.
    if (!prep.caixasLancadas && r.quem) {
      const caixas = r.itens.reduce((n, i) => n + (i.sku === "FERN-350-6" ? i.qtd : 0), 0);
      if (caixas > 0)
        await adicionarCaixa({
          id: `nota-${prep.id.slice(0, 8)}`,
          pessoa: r.quem as Pessoa,
          tipo: r.tipo === "bonificacao" ? "brinde" : "vendeu",
          qtd: caixas,
          destino: (r.cliente.fantasia || r.cliente.nome).slice(0, 120),
          para: null,
          nota: `NF ${prep.numero} (emitida pelo painel)`,
          data: hojeBR(),
          criadoEm: new Date().toISOString(),
        });
      prep.caixasLancadas = true;
      await savePrep(prep);
    }

    // 4. Etiqueta (só envio).
    if (r.entrega === "envio" && !prep.etiqueta?.pdf) {
      try {
        prep.etiqueta = await comprarEtiqueta(prep);
      } catch (error) {
        prep.etiqueta = {
          pdf: null,
          rastreio: null,
          erro: `Etiqueta não saiu: ${(error as Error).message}. Tente “Comprar etiqueta” de novo (não paga em dobro).`,
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
  if (!prep.chave) throw new Error("nota sem chave de acesso");
  const item = r.itens[0];
  const p = PRODUTOS_NOTA[item.sku];
  if (!p.caixa) throw new Error("produto sem caixa de envio");
  const ref = `nota-${prep.id.slice(0, 8)}`;
  const valorCents = prep.totalNotaCents || prep.plano.totalCombinadoCents;
  const fone =
    c.telefone || (process.env.ME_FROM_PHONE?.trim() || "51993383764").replace(/\D/g, "");
  const existing = await findShipmentByTag(ref);
  const meId =
    existing?.id ??
    (await addToCart({
      orderId: ref,
      shippingId: "auto",
      invoiceKey: prep.chave,
      to: {
        name: c.nome.trim(),
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
      box: p.caixa,
      volumes: item.qtd,
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
    nome: c.nome.trim(),
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
    transportadora: "Melhor Envio",
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
  if (prep.status === "emitida") throw new Error("Nota já emitida: cancele no Bling.");
  const falhas: string[] = [];
  await bling(`/nfe/${prep.nfeId}`, { method: "DELETE" }).catch(() => falhas.push("nota"));
  await bling(`/pedidos/vendas/${prep.pedidoId}`, { method: "DELETE" }).catch(() =>
    falhas.push("pedido"),
  );
  prep.status = "descartada";
  prep.erro = falhas.length
    ? `Apague no Bling: ${falhas.join(" e ")} (rascunho nº ${prep.numero ?? "—"}).`
    : null;
  await savePrep(prep);
  return prep;
}
