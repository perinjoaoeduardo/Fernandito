import "server-only";
import { z } from "zod";
import { kvGet, kvSet } from "@/lib/store/kv";

/**
 * Caixas da equipe: quem está com quantas caixas (six packs) e pra onde elas
 * foram. Registro manual, do jeito mais simples: cada um manda no WhatsApp
 * ("peguei 10", "entreguei 2 pro bar X", "dei 1 de brinde pra Y") e alguém
 * lança aqui, colando o texto da mensagem. O saldo de cada pessoa é a soma.
 * Fica tudo guardado pra conferir depois (ou passar pra uma IA analisar).
 */

export const PESSOAS = ["Lorenzo", "Matheus", "João", "Fernando", "Al Capone"] as const;
export type Pessoa = (typeof PESSOAS)[number];

/** O que aconteceu. `sinal`: soma (+1) ou tira (−1) do saldo de quem registrou. */
export const TIPOS_CAIXA = {
  pegou: { label: "Pegou caixas", sinal: 1 },
  vendeu: { label: "Entregou pra venda", sinal: -1 },
  brinde: { label: "Brinde / bonificação", sinal: -1 },
  consumo: { label: "Consumo próprio", sinal: -1 },
  passou: { label: "Passou pra outra pessoa", sinal: -1 },
  devolveu: { label: "Devolveu pro estoque", sinal: -1 },
  ajuste: { label: "Ajuste de contagem", sinal: 1 },
} as const;
export type TipoCaixa = keyof typeof TIPOS_CAIXA;

export const registroCaixaSchema = z.object({
  id: z.string().min(1).max(40),
  pessoa: z.enum(PESSOAS),
  tipo: z.enum(Object.keys(TIPOS_CAIXA) as [TipoCaixa, ...TipoCaixa[]]),
  /** Caixas. No ajuste pode ser negativo (contou menos do que o saldo). */
  qtd: z.number().int().min(-10000).max(10000),
  /** Pra quem / pra onde (cliente, evento, bar…). */
  destino: z.string().trim().max(120).default(""),
  /** "Passou pra outra pessoa": quem recebeu (o saldo dela sobe). */
  para: z.enum(PESSOAS).nullable().default(null),
  /** Texto livre: a mensagem do WhatsApp colada, detalhes. */
  nota: z.string().trim().max(2000).default(""),
  /** Dia em que aconteceu (AAAA-MM-DD). */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  criadoEm: z.string(),
});
export type RegistroCaixa = z.infer<typeof registroCaixaSchema>;

const KEY = "caixas:registros";

export async function listarCaixas(): Promise<RegistroCaixa[]> {
  const raw = await kvGet(KEY);
  if (!raw) return [];
  const parsed = z.array(registroCaixaSchema).safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : [];
}

/** Regrava a lista inteira (com cópia de segurança da anterior). */
export async function salvarCaixas(registros: RegistroCaixa[]) {
  await gravar(registros);
}

async function gravar(registros: RegistroCaixa[]) {
  // Cópia do anterior por 30 dias (desfazer um erro de lançamento).
  const before = await kvGet(KEY);
  if (before) await kvSet(`${KEY}:bak:${Date.now()}`, before, 60 * 60 * 24 * 30).catch(() => {});
  await kvSet(KEY, JSON.stringify(registros));
}

export async function adicionarCaixa(r: RegistroCaixa) {
  const atual = await listarCaixas();
  await gravar([...atual, registroCaixaSchema.parse(r)]);
}

export async function apagarCaixa(id: string) {
  const atual = await listarCaixas();
  await gravar(atual.filter((r) => r.id !== id));
}

/** Quanto cada registro mexe no saldo de cada pessoa. */
export function efeitos(r: RegistroCaixa): { pessoa: Pessoa; delta: number }[] {
  const base = TIPOS_CAIXA[r.tipo].sinal * r.qtd;
  const out = [{ pessoa: r.pessoa, delta: base }];
  if (r.tipo === "passou" && r.para) out.push({ pessoa: r.para, delta: r.qtd });
  return out;
}

export type ResumoPessoa = {
  pessoa: Pessoa;
  saldo: number;
  pegou: number;
  vendeu: number;
  brinde: number;
  consumo: number;
  recebeu: number;
  passou: number;
};

export function resumoCaixas(registros: RegistroCaixa[]): ResumoPessoa[] {
  const m = new Map<Pessoa, ResumoPessoa>(
    PESSOAS.map((p) => [
      p,
      { pessoa: p, saldo: 0, pegou: 0, vendeu: 0, brinde: 0, consumo: 0, recebeu: 0, passou: 0 },
    ]),
  );
  for (const r of registros) {
    for (const e of efeitos(r)) m.get(e.pessoa)!.saldo += e.delta;
    const me = m.get(r.pessoa)!;
    if (r.tipo === "pegou") me.pegou += r.qtd;
    if (r.tipo === "vendeu") me.vendeu += r.qtd;
    if (r.tipo === "brinde") me.brinde += r.qtd;
    if (r.tipo === "consumo") me.consumo += r.qtd;
    if (r.tipo === "passou") {
      me.passou += r.qtd;
      if (r.para) m.get(r.para)!.recebeu += r.qtd;
    }
  }
  return [...m.values()];
}

/**
 * Lançamentos combinados no chat, gravados sozinhos quando a aba abre. Cada um
 * entra uma vez só: se alguém apagar depois, não volta. Pra lançar mais, é só
 * acrescentar aqui com um id novo.
 */
const INICIAIS: Omit<RegistroCaixa, "criadoEm">[] = [
  {
    id: "joao-20261125-pegou15",
    pessoa: "João",
    tipo: "pegou",
    qtd: 15,
    destino: "",
    para: null,
    nota: "Peguei 15 six packs: 3 pra Caxias, 2 pra Bruna em POA, 10 ficam comigo.",
    data: "2026-11-25",
  },
  {
    id: "joao-20261125-cli1",
    pessoa: "João",
    tipo: "vendeu",
    qtd: 1,
    destino: "Elisete · Caxias do Sul",
    para: null,
    nota: "Venda, entrega em mãos.",
    data: "2026-11-25",
  },
  {
    id: "joao-20261125-cli2",
    pessoa: "João",
    tipo: "vendeu",
    qtd: 2,
    destino: "Cliente 2 · Caxias do Sul",
    para: null,
    nota: "Venda, comprou 2 caixas, entrega em mãos.",
    data: "2026-11-25",
  },
  {
    id: "joao-20261125-cli3",
    pessoa: "João",
    tipo: "vendeu",
    qtd: 2,
    destino: "Bruna · Porto Alegre",
    para: null,
    nota: "Venda, comprou 2 caixas, entrega em mãos.",
    data: "2026-11-25",
  },
  {
    id: "matheus-20261125-pegou30",
    pessoa: "Matheus",
    tipo: "pegou",
    qtd: 30,
    destino: "",
    para: null,
    nota: "Pegou 30 six packs.",
    data: "2026-11-25",
  },
  {
    id: "lorenzo-20261125-pegou30",
    pessoa: "Lorenzo",
    tipo: "pegou",
    qtd: 30,
    destino: "",
    para: null,
    nota: "Pegou 30 six packs.",
    data: "2026-11-25",
  },
  {
    id: "matheus-20261125-adriano",
    pessoa: "Matheus",
    tipo: "vendeu",
    qtd: 5,
    destino: "Adriano · Porto Alegre",
    para: null,
    nota: "Venda de 30 latas (5 caixas) × R$ 13,86 = R$ 415,80.",
    data: "2026-11-25",
  },
  {
    id: "joao-20261126-consumo1",
    pessoa: "João",
    tipo: "consumo",
    qtd: 1,
    destino: "",
    para: null,
    nota: "1 six pack pra consumo pessoal.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-vendas13",
    pessoa: "Lorenzo",
    tipo: "vendeu",
    qtd: 13,
    destino: "Vendas em mãos (clientes a detalhar)",
    para: null,
    nota: "Entregou 13 caixas em mãos, de vendas.",
    data: "2026-11-26",
  },
  {
    id: "matheus-20261126-leticia3",
    pessoa: "Matheus",
    tipo: "vendeu",
    qtd: 3,
    destino: "Leticia",
    para: null,
    nota: "3 caixas entregues pra Leticia (compra).",
    data: "2026-11-26",
  },
  {
    id: "matheus-20261126-amostras2",
    pessoa: "Matheus",
    tipo: "brinde",
    qtd: 2,
    destino: "Amostras",
    para: null,
    nota: "2 caixas usadas como amostras.",
    data: "2026-11-26",
  },
  {
    id: "matheus-20261126-vendas20",
    pessoa: "Matheus",
    tipo: "vendeu",
    qtd: 20,
    destino: "Vendas (15 enviadas pra POA com o motorista + 5 restantes, incl. Ponto 24h)",
    para: null,
    nota: "Tudo o que o Matheus pegou virou venda: as 30 vão ser entregues.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-lote1-2",
    pessoa: "Lorenzo",
    tipo: "vendeu",
    qtd: 2,
    destino: "Clientes do 1º lote · em mãos",
    para: null,
    nota: "2 caixas entregues em mãos pra quem tinha comprado no primeiro lote.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-envio4",
    pessoa: "Lorenzo",
    tipo: "vendeu",
    qtd: 4,
    destino: "Envio hoje",
    para: null,
    nota: "4 caixas pra enviar hoje.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-pai1",
    pessoa: "Lorenzo",
    tipo: "vendeu",
    qtd: 1,
    destino: "Pai do Lorenzo",
    para: null,
    nota: "1 caixa que o pai comprou.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-praia3",
    pessoa: "Lorenzo",
    tipo: "vendeu",
    qtd: 3,
    destino: "Amigos do pai (praia) · entrega pelo pai",
    para: null,
    nota: "O pai entrega 3 caixas pra amigos que compraram na praia.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-revendedor1",
    pessoa: "Lorenzo",
    tipo: "brinde",
    qtd: 1,
    destino: "Potencial revendedor",
    para: null,
    nota: "1 caixa de presente pra um cara que pode virar vendedor.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-pegou30b",
    pessoa: "João",
    tipo: "pegou",
    qtd: 30,
    destino: "",
    para: null,
    nota: "João pegou mais 30 caixas.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-nando15",
    pessoa: "João",
    tipo: "passou",
    qtd: 16,
    destino: "Casa do Nando",
    para: "Fernando",
    nota: "João deixou 16 das 30 novas na casa do Nando.",
    data: "2026-11-26",
  },
  {
    id: "fernando-20261126-vendas7",
    pessoa: "Fernando",
    tipo: "vendeu",
    qtd: 7,
    destino: "Clientes do Nando (entrega em mãos)",
    para: null,
    nota: "Das 16 que o João deixou: 7 vendidas, o Nando entrega.",
    data: "2026-11-26",
  },
  {
    id: "fernando-20261126-consumo1",
    pessoa: "Fernando",
    tipo: "consumo",
    qtd: 1,
    destino: "",
    para: null,
    nota: "1 caixa de consumo próprio.",
    data: "2026-11-26",
  },
  {
    id: "lorenzo-20261126-amostras1",
    pessoa: "Lorenzo",
    tipo: "brinde",
    qtd: 1,
    destino: "Potenciais clientes (amostras)",
    para: null,
    nota: "1 caixa pra distribuir em potenciais clientes. Sobraram 5 com ele.",
    data: "2026-11-26",
  },
];
const SEED_KEY = "caixas:seed:v1";

/** Troca "Cliente N" pelo primeiro nome nos lançamentos que já foram gravados. */
const NOMES: Record<string, [string, string]> = {
  "joao-20261125-cli1": ["Cliente 1 · Caxias do Sul", "Elisete · Caxias do Sul"],
  "joao-20261125-cli3": ["Cliente 3 · Porto Alegre", "Bruna · Porto Alegre"],
};
const NOMES_KEY = "caixas:seed:v2";

/**
 * Correções em lançamentos que já entraram (id → campos certos). Cada versão
 * roda uma vez. 26/11: as 30 novas e as 15 pro Fernando foram do João, não do
 * Lorenzo.
 */
type Fix = Partial<Pick<RegistroCaixa, "pessoa" | "nota" | "qtd">>;
const CORRECOES: Record<string, Fix> = {
  "lorenzo-20261126-pegou30b": { pessoa: "João", nota: "João pegou mais 30 caixas." },
  "lorenzo-20261126-nando15": {
    pessoa: "João",
    nota: "João deixou 15 das 30 novas na casa do Nando.",
  },
};

/** Lançamentos que não aconteceram: saem da lista (uma vez só). 26/11: as 4
 * do Lorenzo pro Nando não foram; quem levou foi o João, dentro das 15. */
const REMOVER = ["lorenzo-20261126-nando4"];
const REMOVER_KEY = "caixas:fix:v2";

async function remover() {
  if (await kvGet(REMOVER_KEY)) return;
  const atual = await listarCaixas();
  const novos = atual.filter((r) => !REMOVER.includes(r.id));
  if (novos.length !== atual.length) await gravar(novos);
  await kvSet(REMOVER_KEY, "1");
}

/** 26/11: o João deixou 16 (não 15) na casa do Nando. */
const CORRECOES_V3: Record<string, Fix> = {
  "lorenzo-20261126-nando15": {
    qtd: 16,
    nota: "João deixou 16 das 30 novas na casa do Nando.",
  },
};

async function corrigir() {
  await remover();
  await aplicar("caixas:fix:v1", CORRECOES);
  await aplicar("caixas:fix:v3", CORRECOES_V3);
}

async function aplicar(key: string, mapa: Record<string, Fix>) {
  if (await kvGet(key)) return;
  const atual = await listarCaixas();
  let mudou = false;
  const novos = atual.map((r) => {
    const fix = mapa[r.id];
    if (!fix) return r;
    mudou = true;
    return { ...r, ...fix };
  });
  if (mudou) await gravar(novos);
  await kvSet(key, "1");
}

export async function garantirIniciais() {
  await semear();
  await corrigir();
  if (await kvGet(NOMES_KEY)) return;
  const atual = await listarCaixas();
  let mudou = false;
  const novos = atual.map((r) => {
    const t = NOMES[r.id];
    if (t && r.destino === t[0]) {
      mudou = true;
      return { ...r, destino: t[1] };
    }
    return r;
  });
  if (mudou) await gravar(novos);
  await kvSet(NOMES_KEY, "1");
}

const SEEDED_KEY = "caixas:seed:ids";

async function semear() {
  // Ids que já entraram alguma vez (os 4 primeiros vieram pela versão antiga).
  const raw = await kvGet(SEEDED_KEY);
  const feitos = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  if (!raw && (await kvGet(SEED_KEY))) INICIAIS.slice(0, 4).forEach((r) => feitos.add(r.id));
  const faltam = INICIAIS.filter((r) => !feitos.has(r.id));
  if (!faltam.length) return;
  const atual = await listarCaixas();
  const ids = new Set(atual.map((r) => r.id));
  const criadoEm = new Date().toISOString();
  const novos = faltam.filter((r) => !ids.has(r.id)).map((r) => ({ ...r, criadoEm }));
  if (novos.length) await gravar([...atual, ...novos]);
  faltam.forEach((r) => feitos.add(r.id));
  await kvSet(SEEDED_KEY, JSON.stringify([...feitos]));
}
