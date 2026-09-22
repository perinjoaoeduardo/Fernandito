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

- **`NEXT_PUBLIC_WHATSAPP_NUMBER`** — ativa o botão "Fale no WhatsApp". Sem
  ela definida, o botão fica visível mas desabilitado. Para ativar em
  produção: Vercel → projeto → **Settings → Environment Variables**, com o
  número no formato internacional (código do país + DDD + número, só
  dígitos, ex: `5551999999999`) — sem espaços ou símbolos.

## Deploy

O deploy é feito via [Vercel](https://vercel.com), conectado a este repositório:

- Push na branch padrão do repositório (`claude/fernandito-repo-vercel-38jtie`
  — este repo nunca teve `main`) → deploy de produção
- Push em outras branches / Pull Requests → preview deploy

Confira em **Settings → Git → Production Branch** na Vercel que esse é o
branch configurado — se estiver como `main`, nenhum deploy novo vai disparar.
