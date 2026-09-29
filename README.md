# Fernandito

Landing page de lançamento da marca Fernandito — bebida pronta-para-beber, fernet + cola.

Projeto [Next.js](https://nextjs.org) inicializado com [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) (App Router, TypeScript, Tailwind CSS).

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha o que for necessário. Veja
`.env.example` para a lista completa; a mais importante hoje:

- **`NEXT_PUBLIC_WHATSAPP_NUMBER`** — opcional. O número do botão "Fale no
  WhatsApp" já está em `src/content/site.ts` (`LINKS.whatsappNumber`); esta
  variável, se preenchida, tem prioridade sobre ele (útil pra testar outro
  número sem mexer no código). Formato: código do país + DDD + número, só
  dígitos (ex: `555193383764`). Na Vercel: projeto → **Settings →
  Environment Variables**, e um redeploy depois.

## Deploy

O deploy é feito via [Vercel](https://vercel.com), conectado a este repositório:

- Push na branch padrão do repositório (`claude/fernandito-repo-vercel-38jtie`
  — este repo nunca teve `main`) → deploy de produção
- Push em outras branches / Pull Requests → preview deploy

Confira em **Settings → Git → Production Branch** na Vercel que esse é o
branch configurado — se estiver como `main`, nenhum deploy novo vai disparar.
