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
- [x] API nova (Orders) pronta e testada (17/10), atrás da variável
      `MERCADOPAGO_API=orders`. Hoje vale a atual (Payments). Plano: fazer o
      teste de R$ 1 com a atual; depois um segundo teste de R$ 1 com
      `MERCADOPAGO_API=orders` (Production + Redeploy) e, se ok, deixar a nova
      ligada de vez. Pedidos antigos continuam conferidos pela API que os criou.

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

- [x] E-mails prontos (17/10): "Pedido confirmado" pro cliente (com o link
      do pedido), "Compra nova" e alertas pra equipe. **Pra ligar:** criar conta
      no Resend (resend.com), verificar o domínio fernandito.com.br (registros DNS
      que ele mostra), e na Vercel: `RESEND_API_KEY`, `EMAIL_FROM` (ex.
      `Fernandito <pedidos@fernandito.com.br>`) e `EMAIL_EQUIPE` (e-mails do time,
      separados por vírgula).

## Press kits (brindes) — decidido em 17/10

- ~50 press kits, **separados dos kits de venda** (não saem do teto do site).
  Cadastrar como produto próprio no Bling ("Press kit") pra não baixar o
  estoque do kit de venda.
- Nota de bonificação ("Saída em bonificação – Brinde", natureza 15111699949) pra cada um: precisa de nome, CPF e endereço completo. Os
  enviados por transportadora precisam de nota pra viajar; os entregues em
  mãos também terão endereço (alguns poucos sem endereço: tudo bem).
- Lançamento em lote pelo conector do Bling (Claude): mandar a lista (nome,
  CPF, endereço com CEP, contato, o que ganhou, motivo). Faz 1, confere no
  Bling, depois o resto. Código BRINDE-001… pra não duplicar.
- [x] Produto "Press kit Fernandito (brinde)" criado no Bling (`FERN-PRESSKIT`,
      mesmos dados fiscais do kit, estoque separado — 17/10). Falta lançar o
      estoque dos press kits e os brindes.
- [ ] Contadora: imposto na saída de brinde (Simples/ICMS-RS) e se emite nota de todos.

## Check final no dia do lançamento (anotado em 19/10)

Hoje as conexões apontam pro site de teste (`fernandito-git-teste-meusprojetospessoais.vercel.app`,
endereço fixo da branch). Quando o site novo for pro `fernandito.com.br`:

- [ ] Bling, app do site → "Link de redirecionamento" = `https://fernandito.com.br/api/bling/callback`
      (hoje: preview `rjg6j7bsd`). Reconectar em `/api/bling/connect?key=…` só se pedir.
- [ ] Melhor Envio, app → "URL de redirecionamento" = `https://fernandito.com.br/api/melhorenvio/callback`
      (hoje: `fernandito-git-teste…`). Reconectar em `/api/melhorenvio/connect`.
- [ ] Melhor Envio, app → Webhook = `https://fernandito.com.br/api/melhorenvio/webhook` (não dá no preview:
      a Vercel bloqueia visita de fora).
- [ ] Mercado Pago: token de produção (só Production) + webhook `https://fernandito.com.br/api/webhooks/mercadopago`.
- [ ] `/api/loja/checkup?key=…` no `fernandito.com.br`: tudo ✅ (o A1 só fica verde depois da 1ª nota).
- [ ] Teste de R$ 1 (roteiro abaixo).

Já feito em 19/10: Bling com todos os escopos disponíveis (sem Contratos) e NF ✅; Melhor Envio com
token que renova sozinho, saldo R$ 50 e compra de etiqueta ✅; agência Jadlog Ferragens Pesce (Floresta);
Pix manual com a chave aleatória da empresa.

## Antes de abrir a venda

- [x] Total de kits: **200** (`stockCap` no catálogo e balanço de 200 no Bling, 17/10). Confirmar com a contagem real.
- [x] Preço do kit: **R$ 89,90** no site e no Bling (17/10).

## Depois do pago: nota, etiqueta e rastreio AUTOMÁTICOS (17/10)

Fluxo (sem mão): Pix pago → pedido no Bling → **nota gerada e enviada à
Sefaz** (o Bling manda o e-mail da nota pro cliente) → autorizada →
**etiqueta no Melhor Envio** (com a chave da nota e o nº do pedido como tag)
→ **paga com o saldo** → gerada → **rastreio** gravado no site, no painel e
no pedido do Bling → aviso do Melhor Envio: postado → entregue. POA (entrega
própria): nota → "saiu pra entrega" → entregue quando o pedido virar
"Atendido" no Bling. O cliente acompanha em `/pedido/<nº>/confirmado`
(linha do tempo, atualiza sozinha). O e-mail do Melhor Rastreio continua.

Travas: só pedido pago e com nota autorizada compra etiqueta; antes de
comprar, procura no Melhor Envio um envio com a tag do pedido (nunca paga
2x, mesmo se o site perder o estado); nota rejeitada/denegada → para e
alerta; sem saldo → para, alerta, e sai sozinha quando tiver saldo.
Desligar: `FULFILL_NFE=0` (nota) e/ou `FULFILL_LABEL=0` (etiqueta) na Vercel.
Painel: `envios` (etapa, nº da nota, rastreio, **PDF da etiqueta pra
imprimir**, erro). Planilha também mostra.

Testado com Bling e Melhor Envio falsos: 24 cenários (normal, repetir,
postado/entregue, aviso falso, sem saldo, nota rejeitada, Sefaz demorando,
POA, frete de último recurso, perdeu o estado), 24/24 em 3 rodadas.

**Pra funcionar de verdade (fazer antes do teste de R$ 1):**

- [ ] **Autorizar o Melhor Envio de novo** (permissões de compra): abrir
      `https://fernandito.com.br/api/melhorenvio/connect` → autorizar. Pronto —
      o site salva e renova sozinho (não precisa colar nada na Vercel).
- [ ] **Aviso do Melhor Envio:** Área Dev → app "Fernandito" → Webhook:
      `https://fernandito.com.br/api/melhorenvio/webhook`.
- [ ] **Certificado digital A1** da empresa instalado no Bling
      (Configurações → Certificado digital) e série da NF-e configurada. A
      conta **nunca emitiu nota** (conferido em 17/10) — sem o A1 nenhuma nota sai.
- [ ] **Bling: permissão de Notas Fiscais** no app do Bling (Central de
      extensões → app → escopos: NF-e leitura e escrita). Se mudar, reconectar em
      `/api/bling/connect`.
- [ ] **Saldo** no Melhor Envio.
- [ ] Contadora ok com a nota sair sozinha (natureza já é a dela).
- [ ] No teste de R$ 1: conferir no painel `envios` a nota autorizada, a
      etiqueta paga (débito no saldo), o rastreio no pedido do Bling e na
      página do pedido; imprimir o PDF da etiqueta. Depois cancelar a etiqueta no
      Melhor Envio (devolve o saldo) e a NF-e no Bling (até 24h).

## Teste completo de R$ 1 — roteiro (antes de abrir pro público)

**Antes (uma vez):** abrir o check-up
`https://fernandito.com.br/api/loja/checkup?key=<BLING_ADMIN_KEY>` — tudo
✅ (os ⚠️ de certificado e webhook do Melhor Envio são conferidos à mão).

1. **Ligar o preço de teste:** Vercel → Environment Variables (Production)
   → `NEXT_PUBLIC_PRECO_TESTE_CENTAVOS` = `100` → Redeploy. O check-up passa a
   mostrar ❌ "Preço de teste LIGADO" (é de propósito).
2. **Comprar** no site no ar, com um CPF e endereço **reais** de alguém do
   time **fora de POA** (pra testar etiqueta). Frete: o mais barato.
3. **Pagar o Pix** pelo app do banco. A tela tem que ir sozinha pra
   "Pedido confirmado" e chegar o e-mail de confirmação.
4. **Conferir no painel** (`/api/loja/diagnostico?key=…`), em até ~1 min:
   - `pixAbertos` sem o pedido; `filaBling` vazio; `alertas` vazio;
   - `envios` com o pedido: etapa `ready`, **nº da nota**, **rastreio** e
     **PDF da etiqueta**.
5. **Conferir no Bling:** pedido de venda (loja Site Fernandito, natureza
   da contadora, Pix, frete, rastreio no volume) e a **NF-e autorizada**.
6. **Conferir no Melhor Envio:** etiqueta paga (débito no saldo), com a tag
   do pedido. Abrir o PDF.
7. **Página do pedido** (link do e-mail): linha do tempo com nota e rastreio.
8. **Repetir** fechando a tela logo depois de pagar (tem que confirmar igual).
9. **Desfazer:** cancelar a etiqueta no Melhor Envio (devolve o saldo),
   cancelar a NF-e no Bling (até 24h), devolver o R$ 1 no Mercado Pago.
10. **Desligar o preço de teste** (apagar a variável → Redeploy) e ver o
    check-up voltar a ✅.
11. (Opcional, mesma coisa) Repetir com `MERCADOPAGO_API=orders`; se ok,
    deixar ligado (API nova).

Eu (Claude) acompanho cada passo pelo conector do Bling.

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
- [x] Renovação automática do token (17/10): a autorização em
      `/api/melhorenvio/connect` salva o token no Redis e o site renova sozinho
      7 dias antes de vencer (e no cron diário). Não precisa mais colar na Vercel.
      Painel mostra de onde vem o token e quando vence.
- [x] Webhook do Melhor Envio (`/api/melhorenvio/webhook`) — existe (17/10); cadastrar no app.
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
- [x] Razão social, CNPJ e endereço no rodapé (exigência do Decreto 7.962/2013).
- [x] Página de Trocas e devoluções (`/trocas`, 17/10) — rascunho; advogado revisa.
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
