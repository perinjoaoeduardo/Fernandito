import "server-only";
import { z } from "zod";
import { kvGet, kvSet } from "@/lib/store/kv";

/**
 * Ideias (brainstorming): um mural de post-its separados por tipo. Cada ideia
 * tem data e texto. Lança pelo painel (aba Ideias) ou o Claude acrescenta em
 * `INICIAIS` (entram sozinhas uma vez quando a aba abre).
 */

export const CATEGORIAS = {
  video: { label: "Vídeos e conteúdo", cor: "#fff3a3" },
  produto: { label: "Produto e merch", cor: "#ffd6e0" },
  marketing: { label: "Marketing e ações", cor: "#cfe8ff" },
  fazer: { label: "A fazer", cor: "#d6f5d6" },
  outras: { label: "Outras", cor: "#ffe0b8" },
} as const;
export type Categoria = keyof typeof CATEGORIAS;

export const ideiaSchema = z.object({
  id: z.string().min(1).max(60),
  categoria: z.enum(Object.keys(CATEGORIAS) as [Categoria, ...Categoria[]]),
  texto: z.string().trim().min(1).max(1000),
  /** Dia da ideia (AAAA-MM-DD). */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  criadoEm: z.string(),
});
export type Ideia = z.infer<typeof ideiaSchema>;

const KEY = "ideias:mural";

export async function listarIdeias(): Promise<Ideia[]> {
  const raw = await kvGet(KEY);
  if (!raw) return [];
  const parsed = z.array(ideiaSchema).safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : [];
}

async function gravar(ideias: Ideia[]) {
  // Cópia do anterior por 30 dias (desfazer um apagão sem querer).
  const before = await kvGet(KEY);
  if (before) await kvSet(`${KEY}:bak:${Date.now()}`, before, 60 * 60 * 24 * 30).catch(() => {});
  await kvSet(KEY, JSON.stringify(ideias));
}

export async function adicionarIdeia(i: Ideia) {
  const atual = await listarIdeias();
  await gravar([...atual, ideiaSchema.parse(i)]);
}

export async function apagarIdeia(id: string) {
  const atual = await listarIdeias();
  await gravar(atual.filter((i) => i.id !== id));
}

/**
 * Ideias mandadas no chat, gravadas sozinhas quando a aba abre. Cada uma entra
 * uma vez só (apagou, não volta). Pra lançar mais: acrescentar com id novo.
 */
const INICIAIS: Omit<Ideia, "criadoEm">[] = [
  {
    id: "20261126-video-3meses",
    categoria: "video",
    data: "2026-11-26",
    texto:
      "“3 meses de Fernandito”: a gente reunido, câmera ligada, contando os maiores desafios, os momentos mais difíceis e os mais legais, e as histórias engraçadas desses 3 meses.",
  },
  {
    id: "20261126-video-petshop",
    categoria: "video",
    data: "2026-11-26",
    texto:
      "Bastidores do envio: as caixas são deixadas numa pet shop pra postar. É engraçado e vale mostrar o processo pro público.",
  },
  {
    id: "20261126-video-compra",
    categoria: "video",
    data: "2026-11-26",
    texto: "A experiência de comprar um Fernandito: do site até a caixa chegar e abrir a lata.",
  },
  {
    id: "20261126-video-curtos",
    categoria: "video",
    data: "2026-11-26",
    texto:
      "Vídeos curtos pro Instagram: servindo no copo, brindando, besteirinhas do dia a dia com o Fernandito.",
  },
  {
    id: "20261126-produto-vela",
    categoria: "produto",
    data: "2026-11-26",
    texto: "Vela do Fernandito pra veleiro (uma vela de barco de verdade, com a marca).",
  },
  {
    id: "20261126-produto-lavajato",
    categoria: "produto",
    data: "2026-11-26",
    texto: "Lava-jato do Fernandito.",
  },
  {
    id: "20261126-produto-fosforo",
    categoria: "produto",
    data: "2026-11-26",
    texto: "Caixinha de fósforo do Fernandito.",
  },
  {
    id: "20261126-fazer-garfo",
    categoria: "fazer",
    data: "2026-11-26",
    texto: "Marcar com a Garfo uma sessão de fotos do produto.",
  },
];
const SEEDED_KEY = "ideias:seed:ids";

export async function garantirIdeiasIniciais() {
  const raw = await kvGet(SEEDED_KEY);
  const feitos = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  const faltam = INICIAIS.filter((i) => !feitos.has(i.id));
  if (!faltam.length) return;
  const atual = await listarIdeias();
  const ids = new Set(atual.map((i) => i.id));
  const criadoEm = new Date().toISOString();
  const novas = faltam.filter((i) => !ids.has(i.id)).map((i) => ({ ...i, criadoEm }));
  if (novas.length) await gravar([...atual, ...novas]);
  faltam.forEach((i) => feitos.add(i.id));
  await kvSet(SEEDED_KEY, JSON.stringify([...feitos]));
}
