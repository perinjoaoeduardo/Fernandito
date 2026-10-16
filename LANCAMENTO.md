# Checklist do lançamento da loja

O que precisa ser feito/conferido no dia em que a loja for pro ar
(fernandito.com.br). Nada disso deve ser feito no ambiente de teste.

## Mercado Pago

- [ ] Ativar as credenciais de produção: painel do Mercado Pago →
      aplicação "Site Fernandito" → Credenciais de produção → Ativar
      (ramo de atividade, site `https://fernandito.com.br`, termos).
- [ ] Vercel → Environment Variables → `MERCADOPAGO_ACCESS_TOKEN` com o
      token de produção (`APP_USR-…`), **só no ambiente Production**.
- [ ] Webhook: painel do Mercado Pago → aplicação → Webhooks → URL
      `https://fernandito.com.br/api/webhooks/mercadopago`, evento
      "Pagamentos". Copiar a assinatura secreta para
      `MERCADOPAGO_WEBHOOK_SECRET` (Production).
- [ ] Trocar o código da API de Payments (`/v1/payments`) para a API de
      Orders antes do Mercado Pago desligar a atual
      (`src/lib/mercadopago.ts`).

## Teste completo de R$ 1 (antes de abrir pro público)

- [ ] Produto de teste de R$ 1, frete grátis, visível só no teste.
- [ ] Pix pago de verdade pelo app do banco → confirmação automática.
- [ ] Pedido chega no Bling (loja "Site Fernandito", natureza "Venda de
      produção a não contribuinte - Consumidor final", peso, volumes,
      transportadora, data prevista).
- [ ] Nota fiscal emitida no Bling e etiqueta do Melhor Envio gerada.
- [ ] Depois: devolver o R$ 1 no Mercado Pago, cancelar a NF-e no Bling
      (até 24h) e voltar as credenciais de teste no Preview.

## Frete (Melhor Envio + Jadlog) — decidido em 14/10

Como ficou:

- Frete fora de POA: cotação real no Melhor Envio (conta própria da
  Fernandito). Etiqueta comprada no painel do Melhor Envio, com a chave da
  NF emitida no Bling. **Bling Envios não é usado** (tem carteira separada).
- Só **Jadlog** aparece no checkout (`ALLOWED_CARRIERS` em
  `src/lib/melhor-envio.ts`), pra postar num ponto só: Ferragens Pesce –
  Loja Floresta, Av. Cristóvão Colombo 1792 (trocar em Melhor Envio →
  Integrações → Catálogo → Configurar). Só Jadlog também na conta.
- POA: entrega própria, valor fixo. Se a cotação falhar: tabela por região.
- Rastreio pro cliente: e-mail automático do Melhor Rastreio (ligado em
  Melhor Envio → Configurações). WhatsApp descartado por ora.
- Token: app "Fernandito" na Área Dev (Client ID 31382). Gerar/renovar em
  `https://fernandito.com.br/api/melhorenvio/connect` → colar o token em
  `MELHOR_ENVIO_TOKEN` (Production e Preview) → Redeploy. **Vence em ~30 dias.**
- Dados fiscais no Melhor Envio: CNPJ 69.252.946/0001-41, IE 096/4146258,
  CNAE 4723-7/00. Simples Nacional.

Pendente:

- [x] Jadlog aceita bebida alcoólica em lata (confirmado em 14/10).
- [ ] Renovação automática do token (guardar o refresh token no Redis e
      renovar antes de vencer) — hoje é manual a cada ~30 dias.
- [ ] Webhook do Melhor Envio (`/api/melhorenvio/webhook`, ainda não existe):
      gravar o rastreio no pedido do Bling. Só cadastrar quando a rota existir.
- [ ] E-mails: "pedido confirmado" pro cliente e "compra nova" pra equipe.
- [x] Tributação/CEST: a contadora já configurou.

## Bling (configurado em 14/10)

- Vercel (Production e Preview): `BLING_NATUREZA_ID=15111699956` (Venda de
  produção a não contribuinte – Consumidor final), `BLING_LOJA_ID=206326864`
  (loja Site Fernandito), `BLING_FORMA_PAGAMENTO_ID=11331737` (Pix).
- Natureza de brinde ("Saída em bonificação – Brinde"): 15111699949 — usada
  só em pedidos de brinde criados à mão (ou pelo Claude), nunca pelo site.
- O app do Bling não tem escopo de Naturezas de Operação; por isso o id fixo.
- Conferir tudo em `/api/bling/diagnostico?key=<BLING_ADMIN_KEY>` (só leitura).
- Mercado Pago no Preview: token removido (o modo teste dava "500
  internal_error" no Pix) → Pix simulado, que nunca vai pro Bling.

## O que entra no lançamento (decidir no teste)

No `teste` o site completo está ligado (`PRELAUNCH.enabled: false`) com o
compra em /comprar. Cada seção liga/desliga em `SECTIONS`
(`src/content/site.ts`), na ordem em que aparecem: O que é, Galeria,
Manifesto, Contato, Episódios, Ficha técnica (kit e Social desligados). Desligada, a seção some da
página, do menu e do rodapé. A faixa "Estamos chegando" é `ANNOUNCEMENT`.

- [ ] Decidir seção por seção o que vai pro ar.

Arquitetura (15/10): Início (uma página com tudo da marca + chamada do kit)
· Comprar (/comprar) · Contato (motivos; evento e revenda com perguntas
curtas → lead + WhatsApp).
Leads: planilha em `/api/leads?key=<BLING_ADMIN_KEY>`. Ver "Arquitetura e
navegação" no DESIGN_SYSTEM.md.

- [ ] Episódios: pra cada um, título, link do post no Instagram, capa e
      uma prévia de 5–10 s em mp4 sem som (`EPISODIOS`).
- [ ] Arte da lata no "O que é" (hoje é um espaço reservado).
- [ ] Razão social e endereço completo da empresa no rodapé (`FOOTER.company`).
- [ ] Página de Trocas e devoluções (com o advogado).
- [ ] Preço/produto do lançamento (kit atual × pack de 6) — em aberto.
- [ ] Torneira em eventos — em aberto (a porta de evento não promete torneira).

## Deploy (atenção)

- O Vercel publica **produção** a partir do branch
  `claude/fernandito-repo-vercel-38jtie`, não do `main`. Hoje produção ainda
  está na versão antiga (loja escondida). O trabalho atual está no `teste`;
  no lançamento, é o `teste` que vai pra produção.
- Branches `teste-loja` e `melhor-envio-cotacao` foram testes e podem ser
  apagados no GitHub.

## Outros

- [ ] Trocar a `BLING_ADMIN_KEY` (as senhas usadas até agora passaram pelo
      chat).
- [ ] Termos de uso e Política de privacidade revisados pelo advogado.
- [ ] Fotos reais do kit (fotos 2–4 ainda são placeholders).
