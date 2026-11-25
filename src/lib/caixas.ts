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
  vendeu: { label: "Entregou venda", sinal: -1 },
  brinde: { label: "Deu de brinde / bonificação", sinal: -1 },
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
  recebeu: number;
  passou: number;
};

export function resumoCaixas(registros: RegistroCaixa[]): ResumoPessoa[] {
  const m = new Map<Pessoa, ResumoPessoa>(
    PESSOAS.map((p) => [
      p,
      { pessoa: p, saldo: 0, pegou: 0, vendeu: 0, brinde: 0, recebeu: 0, passou: 0 },
    ]),
  );
  for (const r of registros) {
    for (const e of efeitos(r)) m.get(e.pessoa)!.saldo += e.delta;
    const me = m.get(r.pessoa)!;
    if (r.tipo === "pegou") me.pegou += r.qtd;
    if (r.tipo === "vendeu") me.vendeu += r.qtd;
    if (r.tipo === "brinde") me.brinde += r.qtd;
    if (r.tipo === "passou") {
      me.passou += r.qtd;
      if (r.para) m.get(r.para)!.recebeu += r.qtd;
    }
  }
  return [...m.values()];
}
