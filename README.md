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

- **`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`** — opcional, vazia por enquanto.
  Código de verificação do Google Search Console (método "Tag HTML": o
  valor do `content` da meta tag, só o código). Preenchida, o site passa a
  emitir `<meta name="google-site-verification" ...>`. Na Vercel: projeto →
  **Settings → Environment Variables** (Production) e um redeploy.

- **Loja escondida por padrão:** `STORE.enabled` em `src/content/site.ts` liga/desliga tudo da venda do kit (seção, botões, carrinho, /comprar, /checkout).
- **`MERCADOPAGO_ACCESS_TOKEN`** / **`MERCADOPAGO_WEBHOOK_SECRET`** — Pix
  (Mercado Pago). Só servidor. Teste = credencial `TEST-…`; produção =
  `APP_USR-…` (trocar de modo é só trocar a variável). Webhook a cadastrar
  no painel do Mercado Pago (evento "Pagamentos"):
  `https://fernandito.com.br/api/webhooks/mercadopago`.
- **`KV_REST_API_URL`** + **`KV_REST_API_TOKEN`** — banco de pedidos
  (Upstash Redis por HTTPS: sempre criptografado, sem limite de conexões).
  Criadas sozinhas ao conectar **Upstash** (Storage/Marketplace) ao projeto
  na Vercel; qualquer prefixo `<PREFIXO>_REST_API_URL/TOKEN` também vale.
  Reserva: `KV_REDIS_URL` (Redis por TCP). O REST tem preferência.
- **Bling** — `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_ADMIN_KEY`
  (+ opcionais `BLING_FORMA_PAGAMENTO_ID`, `BLING_LOJA_ID`,
  `BLING_SYNC_PREVIEW`) e `CRON_SECRET`. Conectar uma vez em
  `https://fernandito.com.br/api/bling/connect?key=<BLING_ADMIN_KEY>`.
  Detalhes em `src/lib/bling/client.ts`.
- Sem essas variáveis, FORA de produção (local/preview) a loja roda em modo
  simulado (pedidos em memória, Pix fictício, botão "Simular pagamento");
  em produção, sem elas, o pagamento responde "indisponível".
- **ANTES DE VENDER DE VERDADE:** (1) usar o Upstash (REST/HTTPS), não o
  Redis por TCP: o Redis gratuito da Vercel é `redis://` (SEM criptografia),
  RAM-only (sem persistência) e limitado a 30 conexões simultâneas — ruim
  pra função serverless; (2) conferir no painel do Upstash que o plano
  escolhido guarda os dados em disco (persistência) e o limite de comandos
  por mês (grátis: 500 mil; cada consulta de status gasta ~2).
- **`MELHOR_ENVIO_TOKEN`** / **`MELHOR_ENVIO_CEP_ORIGEM`** (90430-131) —
  cotação real do frete fora de POA (`src/lib/melhor-envio.ts`). Sem token:
  simulado fora de produção; em produção cai na tabela por região.
- **Textos legais:** `content/legal/termos.md` e `content/legal/privacidade.md`
  (Markdown). Pra publicar nova versão, mudar `version` e `updatedAt` no
  topo do arquivo — o pedido grava a versão aceita.

O domínio usado em canonical, Open Graph, `robots.txt`, `sitemap.xml` e
JSON-LD é fixo em `src/lib/site.ts` (`https://fernandito.com.br`).

## Deploy

O deploy é feito via [Vercel](https://vercel.com), conectado a este repositório:

- Push na branch padrão do repositório (`claude/fernandito-repo-vercel-38jtie`
  — este repo nunca teve `main`) → deploy de produção
- Push em outras branches / Pull Requests → preview deploy

Confira em **Settings → Git → Production Branch** na Vercel que esse é o
branch configurado — se estiver como `main`, nenhum deploy novo vai disparar.
