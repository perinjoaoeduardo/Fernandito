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

## Outros

- [ ] Trocar a `BLING_ADMIN_KEY` (as senhas usadas até agora passaram pelo
      chat).
- [ ] Termos de uso e Política de privacidade revisados pelo advogado.
- [ ] Fotos reais do kit (fotos 2–4 ainda são placeholders).
