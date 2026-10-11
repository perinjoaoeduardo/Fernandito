import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Marked, type Tokens } from "marked";

/**
 * Textos legais (Termos e Política de Privacidade) — editados em Markdown em
 * `content/legal/*.md`, fora do código. O frontmatter define título,
 * descrição, versão e data:
 *
 *   ---
 *   title: Termos de Uso e Condições de Venda
 *   description: ...
 *   version: "1.0"
 *   updatedAt: "11/10/2026"
 *   ---
 *
 * Renderizado no servidor (build estático). Trechos entre [colchetes] — o
 * que falta preencher — ficam destacados em amarelo FORA de produção.
 */

export type LegalSlug = "termos" | "privacidade";

export type LegalDoc = {
  title: string;
  description: string;
  version: string;
  updatedAt: string;
  html: string;
  toc: { id: string; text: string }[];
};

const HIGHLIGHT_TODO = process.env.VERCEL_ENV !== "production";

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseFrontmatter(raw: string) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {} as Record<string, string>, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { data, body: match[2] };
}

/** `[algo]` (fora de links) → <mark> amarelo, só em preview/dev. */
export function highlightTodo(html: string) {
  if (!HIGHLIGHT_TODO) return html;
  return html.replace(/\[([^\]<>]{1,80})\]/g, '<mark class="legal-todo">[$1]</mark>');
}

export async function getLegalDoc(slug: LegalSlug): Promise<LegalDoc> {
  const raw = await readFile(path.join(process.cwd(), "content/legal", `${slug}.md`), "utf8");
  const { data, body } = parseFrontmatter(raw.replace(/\r\n/g, "\n"));

  const toc: LegalDoc["toc"] = [];
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        // Prefixo: id que começa com número não serve de seletor CSS.
        const id = `secao-${slugify(token.text)}`;
        if (token.depth === 2) toc.push({ id, text: token.text });
        return `<h${token.depth} id="${id}">${inner}</h${token.depth}>\n`;
      },
      table(token: Tokens.Table) {
        const head = token.header
          .map((cell) => `<th scope="col">${this.parser.parseInline(cell.tokens)}</th>`)
          .join("");
        const rows = token.rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join("")}</tr>`,
          )
          .join("");
        return `<div class="legal-table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  const html = await marked.parse(body);

  return {
    title: data.title ?? slug,
    description: data.description ?? "",
    version: data.version ?? "1.0",
    updatedAt: data.updatedAt ?? "",
    html: highlightTodo(html),
    toc,
  };
}

/** Versões vigentes (gravadas no pedido como "aceitou os termos vX"). */
export async function getLegalVersions() {
  const [termos, privacidade] = await Promise.all([
    getLegalDoc("termos"),
    getLegalDoc("privacidade"),
  ]);
  return { termsVersion: termos.version, privacyVersion: privacidade.version };
}
