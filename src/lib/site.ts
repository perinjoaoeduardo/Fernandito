/**
 * Dados do site usados por metadata, robots, sitemap e JSON-LD.
 *
 * Mora aqui (e não no `layout.tsx`) de propósito: `robots.ts` e `sitemap.ts`
 * importando do layout fariam o módulo do layout ser avaliado fora do grafo
 * de componentes, onde o transform do `next/font` não roda — e o build
 * quebra em `localFont(...).variable`.
 */

// Em preview da Vercel, `NEXT_PUBLIC_SITE_URL` sobrescreve pra evitar
// canonical apontando pro domínio final a partir de um deploy de teste.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://fernandito.com.br";

export const SITE_TITLE = "Fernandito — Fernet com cola. Direto da lata.";

export const SITE_DESCRIPTION =
  "Fernet com cola pronto pra beber, numa lata de 350ml. Sem coqueteleira, sem gelo, sem enrolação: o ritual do fernet feito no Rio Grande do Sul, do jeito que a vida pede.";
