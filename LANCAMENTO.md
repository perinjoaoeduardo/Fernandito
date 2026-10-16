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

## Como a compra funciona e o que acontece se algo falhar (revisado em 16/10)

Caminho normal: checkout → servidor recalcula preço e frete → pedido salvo
(Redis) → Pix no Mercado Pago → pessoa paga → **confirmação** → pedido
marcado PAGO → entra na fila do Bling → pedido de venda no Bling → NF e
etiqueta (feitas no Bling/Melhor Envio, à mão).

A confirmação do pagamento chega por **três caminhos independentes** (basta
um funcionar): (1) webhook do Mercado Pago; (2) a tela do Pix perguntando a
cada 4 s; (3) conferência em segundo plano dos "Pix abertos" (a cada ~5 min
quando o site tem movimento, e no cron diário), por 48 h.

| Se falhar…                                       | O que acontece                                                                                                                          | O que fazer                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Mercado Pago falha 1x ao gerar o Pix             | O site tenta de novo sozinho (mesma chave, nunca 2 Pix).                                                                                | Nada.                                                                         |
| Mercado Pago fora de vez                         | **Plano B:** pedido guardado como "Pix manual"; a tela mostra a chave Pix da conta e "Mandar comprovante" (WhatsApp com nº e valor).    | Conferir o dinheiro na conta e confirmar (ver "Pix manual" abaixo).           |
| Estoque chega no teto (150 kits)                 | Ninguém mais gera Pix; o site mostra "Esgotado" (botão, adesivo da lata, faixa do topo, checkout).                                      | Nada. Pra vender mais: subir `stockCap` em `src/lib/catalog.ts`.              |
| Duas pessoas na última unidade ao mesmo tempo    | Só uma consegue (reserva atômica no Redis). Pix vencido devolve a unidade.                                                              | Nada.                                                                         |
| CEP não encontrado / ViaCEP fora                 | Em 5 s libera pra preencher o endereço à mão.                                                                                           | Nada.                                                                         |
| Pessoa paga e fecha a tela                       | Webhook confirma; se não vier, a conferência em segundo plano confirma.                                                                 | Nada.                                                                         |
| Webhook não configurado / falhando               | A tela e a conferência confirmam do mesmo jeito (mais devagar).                                                                         | Configurar o webhook (seção Mercado Pago).                                    |
| Webhook falso (sem assinatura certa)             | Recusado (401). O site sempre confirma direto na API do Mercado Pago.                                                                   | Nada.                                                                         |
| Pix vence e o Mercado Pago estava fora           | Não marca "expirado" sem conseguir conferir; tenta de novo.                                                                             | Nada.                                                                         |
| Pagou no último segundo e a tela disse "vencido" | "Gerar novo Pix" confere antes e mostra PAGO (não cobra 2x). Gera alerta.                                                               | Conferir o alerta no painel.                                                  |
| Valor pago diferente do pedido                   | NÃO marca pago; gera alerta.                                                                                                            | Ver no Mercado Pago, devolver/ajustar à mão.                                  |
| Dois avisos ao mesmo tempo (webhook + tela)      | Marca de "pago" separada que nunca volta atrás; uma entrada só no Bling.                                                                | Nada.                                                                         |
| Bling fora / token vencido                       | Pedido pago fica na **fila do Bling** (com o erro) e é reenviado sozinho; o pedido entra na fila ANTES de tentar, então nunca se perde. | Ver `filaBling` no painel; reconectar em `/api/bling/connect` se for o token. |
| Melhor Envio fora / lento (12 s)                 | Último recurso: **R$ 20 fixo** em qualquer lugar (`FALLBACK_PRICE_CENTS`). Na hora de pagar: pede pra escolher o frete de novo.         | Renovar `MELHOR_ENVIO_TOKEN` se venceu (~30 dias).                            |
| Preço mexido no navegador                        | Recusado: o servidor recalcula tudo pelo catálogo.                                                                                      | Nada.                                                                         |
| Cliente com problema                             | As telas do Pix e de confirmação mostram o número do pedido e um WhatsApp com ele já escrito.                                           | Procurar o número no painel.                                                  |

**Planilha de pedidos (registro final, não depende do Bling):**
`https://fernandito.com.br/api/loja/pedidos?key=<BLING_ADMIN_KEY>` → baixa
um CSV (abre no Excel/Sheets) com todo pedido PAGO: nome, CPF, e-mail,
telefone, endereço, itens, frete, total, id do Mercado Pago e o número no
Bling — ou "NÃO ENTROU" se não entrou. Se o Bling falhar de vez, lança à
mão a partir daqui. `&todos=1` inclui Pix vencidos/cancelados.

**Estoque (trava do próprio site):** `stockCap` por produto em
`src/lib/catalog.ts` (kit: 150). Gerar o Pix reserva as unidades; Pix
vencido/cancelado devolve; pago fica. Vale o MENOR entre esse teto e o
saldo do Bling. O painel mostra `estoque` (teto e livres). Preview e
produção contam separado.

**Pix manual (plano B):** preencher a chave Pix da conta em
`STORE.manualPix.key` (`src/content/site.ts`) ou na variável
`NEXT_PUBLIC_PIX_MANUAL_KEY` da Vercel (+ redeploy). Sem chave, o plano B
fica desligado (só aparece o erro e o WhatsApp). Pedido manual aparece em
`pixManual` no painel e na planilha como "PIX MANUAL". Depois de ver o
dinheiro NA CONTA (não só o print):
`/api/loja/confirmar?key=<BLING_ADMIN_KEY>&pedido=<nº>&acao=pago` → vira
pago e vai pro Bling. Não pagou: `&acao=cancelar` (devolve o estoque).

- [ ] Chave Pix da conta pro plano B.

**Painel da loja:** `https://fernandito.com.br/api/loja/diagnostico?key=<BLING_ADMIN_KEY>`
— mostra `configuracao` (tudo tem que estar `true`/"produção" no dia),
`pixAbertos`, `filaBling` (pagos que ainda não estão no Bling, com o erro) e
`alertas`. Com `&conferir=1` confere tudo na hora antes de mostrar.
Rotina sugerida: abrir o painel 1x por dia. `filaBling` e `alertas` vazios = tudo certo.

**Banco (Redis/Upstash):** cada compra usa ~100–300 comandos (um Pix
abandonado aberto 30 min, até ~1.300). Conferir no painel do Upstash o
limite do plano antes de anunciar forte.

### Testar a loja (bateria de cenários)

37 cenários (pagamento normal, webhook falso, tela fechada, webhooks
repetidos, valor errado, Mercado Pago fora, clique duplo, Pix vencido,
"pagou no último segundo", Melhor Envio fora, preço adulterado, painel sem
chave, planilha, Pix manual, estoque esgotando, 6 pessoas na última leva).
Em 16/10: 37/37 em 4 rodadas com banco na memória e 2 com Redis de verdade
(contador terminou em exatamente 150), e o checkout inteiro no navegador
(computador e celular): preencher → frete → Pix → confirmado sozinho. Pra rodar de novo (local):

```bash
npm run build
node scripts/teste-loja/mercadopago-falso.mjs &
MERCADOPAGO_API_URL=http://localhost:3999 MERCADOPAGO_ACCESS_TOKEN=TEST-falso \
  MERCADOPAGO_WEBHOOK_SECRET=segredo-de-teste-local BLING_SYNC_PREVIEW=1 \
  BLING_ADMIN_KEY=chave-admin-local-0123456789 npx next start -p 3160 &
node scripts/teste-loja/cenarios.mjs
```

Isso testa o NOSSO sistema com um Mercado Pago de mentira. O teste de R$ 1
(abaixo) continua obrigatório: é o único que prova o banco de verdade, o
Bling de verdade e a etiqueta.

- [ ] E-mails pro cliente ("Pix gerado", "pedido confirmado") — ainda não
      existem; hoje o cliente só tem as telas do site.

## Teste completo de R$ 1 (antes de abrir pro público)

- [ ] Produto de teste de R$ 1, frete grátis, visível só no teste.
- [ ] Pix pago de verdade pelo app do banco → confirmação automática.
- [ ] Pedido chega no Bling (loja "Site Fernandito", natureza "Venda de
      produção a não contribuinte - Consumidor final", peso, volumes,
      transportadora, data prevista).
- [ ] Nota fiscal emitida no Bling e etiqueta do Melhor Envio gerada.
- [ ] Painel da loja: o pedido some de `pixAbertos`, não aparece em
      `filaBling` (já entrou no Bling) e `alertas` está vazio.
- [ ] Repetir fechando a tela logo depois de pagar (confirma sem a tela).
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

## Bling (configurado em 14/10, conferido em 16/10)

Conferido direto na conta (só leitura, 16/10): empresa FERNANDITO BEBIDAS
LTDA; produtos `FERN-KIT-PRE` (kit, R$ 100, estoque 150) e `FERN-350-6`
(pack, R$ 100, estoque 166) ativos e com o mesmo SKU/preço do site;
situação 15 "Em andamento" existe; logística "Entrega própria POA" ativa;
depósito "Geral" padrão; nenhum pedido de venda ainda. **Falta provar só a
criação do pedido** — acontece no teste de R$ 1; depois dele, conferir o
pedido no Bling campo a campo (cliente, CPF, itens, frete, total, natureza,
loja, parcela Pix, observação com o nº do site).

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
- [x] Razão social no rodapé (FERNANDITO BEBIDAS LTDA, conferida no Bling em 16/10).
- [ ] Endereço completo da empresa no rodapé (`FOOTER.company`).
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
