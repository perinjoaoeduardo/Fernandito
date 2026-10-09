/**
 * Dados do site usados por metadata, robots, sitemap e JSON-LD.
 *
 * Mora aqui (e não no `layout.tsx`) de propósito: `robots.ts` e `sitemap.ts`
 * importando do layout fariam o módulo do layout ser avaliado fora do grafo
 * de componentes, onde o transform do `next/font` não roda — e o build
 * quebra em `localFont(...).variable`.
 */

// Domínio oficial, fixo: canonical, Open Graph, robots, sitemap e JSON-LD
// sempre apontam pra cá — nunca pro *.vercel.app, nem em deploy de preview.
export const SITE_URL = "https://fernandito.com.br";

export const SITE_TITLE = "Fernandito — Fernet com cola em lata | Porto Alegre, RS";

export const SITE_DESCRIPTION =
  "Fernandito em lata: o fernet com cola pronto pra beber, em lata de 350ml, feito no Rio Grande do Sul. Abriu, tomou.";

/** Código de verificação do Google Search Console (meta tag). Vazio = não
 * emite a tag. Ver README. */
export const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
