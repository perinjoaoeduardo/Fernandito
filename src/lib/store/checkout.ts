import "server-only";
import { getProduct } from "@/lib/catalog";
import { quoteMelhorEnvio } from "@/lib/melhor-envio";
import { onlyDigits } from "@/lib/br";
import type { Order } from "@/lib/order";
import {
  LOCAL_DELIVERY,
  isPoaCep,
  isPortoAlegre,
  tableShipping,
  type ShippingOption,
} from "@/lib/shipping";
import { createPixPayment, getPayment } from "@/lib/mercadopago";
import { kvDel, kvGet, kvSAdd, kvSMembers, kvSRem, kvSetNX } from "@/lib/store/kv";
import {
  getOrder,
  maskCpf,
  maskEmail,
  newOrderId,
  raiseAlert,
  saveOrder,
  setPaidMarker,
  type StoredOrder,
  type StoredOrderItem,
} from "@/lib/store/orders";
import { onOrderPaid } from "@/lib/store/on-order-paid";
import { blingStock, maybeRetryBling, queueForBling } from "@/lib/bling/orders";
import { getLegalVersions } from "@/lib/legal";
import { STORE } from "@/content/site";
import { after } from "next/server";
import { sendNewOrderToTeam, sendOrderConfirmed } from "@/lib/email";
import { maybeAdvanceFulfillments } from "@/lib/store/fulfillment";
import { OutOfStockError, releaseStock, reserveStock } from "@/lib/store/stock";

/** Erro "esperado" do checkout: vira resposta HTTP com mensagem pro cliente. */
export class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "invalid",
  ) {
    super(message);
  }
}

/**
 * Recalcula TUDO no servidor a partir do catálogo e do frete — o que veio
 * do navegador só diz o que a pessoa escolheu (SKUs, quantidades, id do
 * frete), nunca quanto custa.
 */
export async function priceOrder(input: Order) {
  const items: StoredOrderItem[] = input.items.map((item) => {
    const product = getProduct(item.sku);
    if (!product)
      throw new CheckoutError("Um produto do carrinho não está mais à venda.", 409, "product");
    if (item.qty > product.maxQty)
      throw new CheckoutError(`Máximo de ${product.maxQty} unidades por pedido.`, 400, "qty");
    return {
      sku: product.sku,
      name: product.name,
      qty: item.qty,
      unitPriceCents: product.priceCents,
    };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.qty, 0);

  const { cep, city, uf } = input.address;
  const wanted = input.shipping.id;
  let shipping: ShippingOption | undefined;
  if (wanted === LOCAL_DELIVERY.id) {
    if (isPortoAlegre(city, uf) && isPoaCep(cep)) shipping = LOCAL_DELIVERY;
  } else if (wanted.startsWith("tabela-")) {
    const table = tableShipping(uf);
    if (table.id === wanted) shipping = table;
  } else {
    const shippingItems = items.map((item) => {
      const product = getProduct(item.sku)!;
      return { qty: item.qty, priceCents: product.priceCents, ...product.shipping };
    });
    // Melhor Envio fora do ar na hora de pagar: em vez de travar a compra,
    // pede pra escolher o frete de novo (a tela cai na tabela fixa).
    const quotes = await quoteMelhorEnvio(cep, shippingItems).catch((error: Error) => {
      console.error("[frete] Melhor Envio falhou ao fechar o pedido:", error.message);
      return [] as ShippingOption[];
    });
    shipping = quotes.find((option) => option.id === wanted);
  }
  if (!shipping)
    throw new CheckoutError("O frete mudou. Escolhe o frete de novo.", 409, "shipping");

  return { items, subtotalCents, shipping, totalCents: subtotalCents + shipping.priceCents };
}

/**
 * Cria o pedido ("pending") e o Pix dele. Mesma `idempotencyKey` (reenvio,
 * clique duplo) → devolve o MESMO pedido, sem gerar outro Pix.
 */
export async function createPixOrder(input: Order, idempotencyKey: string): Promise<StoredOrder> {
  const priced = await priceOrder(input);
  // O total mostrado na tela tem que ser o cobrado. Mudou? Pede pra revisar.
  if (priced.totalCents !== input.totalCents)
    throw new CheckoutError(
      "Os valores mudaram. Confere o resumo e tenta de novo.",
      409,
      "price_changed",
    );

  // Estoque no Bling (saldo virtual). Bling desconectado → não bloqueia.
  const stock = await blingStock(priced.items.map((item) => item.sku));
  for (const item of priced.items) {
    const available = stock?.get(item.sku);
    if (available !== undefined && item.qty > available)
      throw new CheckoutError(
        available > 0
          ? `Só temos ${available} unidade${available === 1 ? "" : "s"} de ${item.name} agora.`
          : `${item.name} esgotou.`,
        409,
        "stock",
      );
  }

  const id = newOrderId();
  const idemKey = `idem:${idempotencyKey}`;
  if (!(await kvSetNX(idemKey, id, 60 * 60))) {
    const existingId = await kvGet(idemKey);
    const existing = existingId ? await getOrder(existingId) : null;
    if (existing?.pix) return existing;
    throw new CheckoutError(
      "Teu Pix ainda está sendo gerado. Tenta de novo em instantes.",
      409,
      "busy",
    );
  }

  // Trava do próprio site (teto do catálogo, ex.: 150 kits): reserva as
  // unidades agora; o Pix vencer devolve. Não passa do teto nunca.
  try {
    await reserveStock(id, priced.items);
  } catch (error) {
    await kvDel(idemKey).catch(() => {});
    if (error instanceof OutOfStockError) {
      const name = priced.items.find((i) => i.sku === error.sku)?.name ?? "O kit";
      throw new CheckoutError(
        error.remaining > 0
          ? `Só temos ${error.remaining} unidade${error.remaining === 1 ? "" : "s"} de ${name} agora.`
          : `${name} esgotou.`,
        409,
        "stock",
      );
    }
    throw error;
  }

  const now = new Date().toISOString();
  const order: StoredOrder = {
    id,
    status: "pending",
    items: priced.items,
    customer: input.customer,
    address: input.address,
    shipping: priced.shipping,
    subtotalCents: priced.subtotalCents,
    totalCents: priced.totalCents,
    ageConfirmed: true,
    ageConfirmedAt: input.ageConfirmedAt,
    marketingOptIn: input.marketingOptIn,
    ...(input.note ? { note: input.note } : {}),
    // Versões dos Termos/Privacidade vigentes quando a pessoa aceitou.
    ...(await getLegalVersions()),
    mpPaymentId: null,
    pix: null,
    simulated: false,
    createdAt: now,
    paidAt: null,
    mpCheckedAt: null,
  };
  await saveOrder(order);
  // Índice de todos os pedidos: é dele que sai a planilha de pedidos
  // (/api/loja/pedidos), o registro que não depende do Bling.
  await kvSAdd(ALL_SET, id);

  try {
    const request = {
      orderId: id,
      amountCents: order.totalCents,
      email: order.customer.email,
      name: order.customer.name,
      cpf: order.customer.cpf,
      // Mesma chave nas duas tentativas: o Mercado Pago nunca cria 2 Pix.
      idempotencyKey: `pix-${id}`,
    };
    // Uma segunda tentativa automática antes de desistir (falha passageira).
    const pix = await createPixPayment(request).catch(async (first: Error) => {
      console.warn(`[pedido ${id}] Pix falhou, tentando de novo:`, first.message);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return createPixPayment(request);
    });
    order.mpPaymentId = pix.id;
    order.simulated = pix.id.startsWith("sim-");
    order.pix = { qrCode: pix.qrCode, qrCodeBase64: pix.qrCodeBase64, expiresAt: pix.expiresAt };
    await saveOrder(order);
  } catch (error) {
    // Plano B: Mercado Pago fora → Pix direto na chave da conta. O pedido
    // fica "manual" (com as unidades reservadas) até a Fernandito conferir
    // o comprovante e confirmar no painel.
    if (STORE.manualPix.key) {
      order.status = "manual";
      order.manualPix = true;
      await saveOrder(order);
      await kvSAdd(MANUAL_SET, id);
      await raiseAlert(
        id,
        `Mercado Pago fora (${(error as Error).message}) — pedido virou Pix MANUAL, conferir o comprovante`,
      );
      return order;
    }
    order.status = "cancelled";
    await saveOrder(order);
    // Solta a chave: a pessoa tenta de novo e gera um Pix novo (senão ficava
    // 1h em "teu Pix ainda está sendo gerado").
    await kvDel(idemKey).catch(() => {});
    await releaseStock(id).catch(() => {});
    console.error(`[pedido ${id}] falha ao gerar Pix:`, (error as Error).message);
    throw error;
  }
  // Pix de verdade: entra na lista de "abertos", conferida em segundo plano
  // no Mercado Pago até pagar ou vencer — mesmo que a pessoa feche a tela e
  // o webhook não chegue.
  if (!order.simulated) await kvSAdd(OPEN_SET, id);

  console.info(
    `[pedido ${id}] criado · ${order.totalCents} centavos · ${order.shipping.id} · ` +
      `${maskEmail(order.customer.email)} · CPF ${maskCpf(order.customer.cpf)}` +
      (order.simulated ? " · PIX SIMULADO" : ` · mp ${order.mpPaymentId}`),
  );
  return order;
}

// Pedidos com Pix gerado e ainda sem confirmação de pagamento.
const OPEN_SET = "orders:open";
// Todos os pedidos já criados (pra planilha).
export const ALL_SET = "orders:all";
// Pedidos no plano B (Pix na chave da conta), esperando confirmação manual.
export const MANUAL_SET = "orders:manual";

/**
 * Marca como pago (idempotente). Chamado pelo webhook, pela checagem de
 * status e pela conferência em segundo plano — todos só chegam aqui depois
 * de confirmar na API do Mercado Pago (ou no "simular pagamento" de teste).
 *
 * Ordem importa (cada passo sobrevive à função cair no meio):
 * 1. marca `paid:<id>` (fonte da verdade, nunca volta atrás);
 * 2. põe na fila do Bling;
 * 3. regrava o pedido e tira da lista de abertos;
 * 4. tenta mandar pro Bling agora (falhou → a fila reenvia).
 */
export async function markPaid(orderId: string) {
  const before = await getOrder(orderId);
  if (!before) return null;
  const paidAt = before.paidAt ?? new Date().toISOString();
  const first = await setPaidMarker(orderId, paidAt);
  if (
    first &&
    before.status !== "paid" &&
    before.status !== "pending" &&
    before.status !== "manual"
  )
    await raiseAlert(
      orderId,
      `pago com o pedido em "${before.status}" — conferir se a pessoa não pagou também um Pix novo`,
    );
  if (!before.simulated) await queueForBling(orderId);
  // Unidades continuam reservadas (se o Pix já tinha vencido e devolvido,
  // reserva de novo — o dinheiro entrou, então passa do teto e avisa).
  await reserveStock(orderId, before.items, true).catch((error: Error) =>
    console.error(`[pedido ${orderId}] estoque ao pagar:`, error.message),
  );

  const order = (await getOrder(orderId)) ?? before;
  if (first) {
    await saveOrder(order);
    console.info(`[pedido ${order.id}] PAGO · ${order.totalCents} centavos`);
  }
  // E-mails (uma vez por pedido; sem Resend configurado, não faz nada).
  if (!order.simulated && (await kvSetNX(`email:paid:${order.id}`, "1", 60 * 60 * 24 * 400))) {
    const mails = () =>
      Promise.all([sendOrderConfirmed(order), sendNewOrderToTeam(order)]).then(() => undefined);
    try {
      after(mails);
    } catch {
      void mails();
    }
  }
  await kvSRem(OPEN_SET, orderId);
  await kvSRem(MANUAL_SET, orderId);
  if (await kvSetNX(`paid-hook:${order.id}`, "1", 60 * 60 * 24 * 365)) {
    try {
      await onOrderPaid(order);
    } catch (error) {
      console.error(`[pedido ${order.id}] onOrderPaid falhou:`, (error as Error).message);
    }
  }
  return order;
}

/** Confere um pagamento na API e, se aprovado e batendo com o pedido, marca pago. */
export async function syncPayment(paymentId: string) {
  const payment = await getPayment(paymentId);
  if (!payment) return null;
  const order = await getOrder(payment.externalReference);
  if (!order || order.mpPaymentId !== payment.id) {
    if (payment.status === "approved")
      await raiseAlert(
        payment.externalReference || "?",
        `pagamento ${payment.id} aprovado mas não bate com nenhum pedido do site`,
      );
    return null;
  }
  if (payment.status === "approved") {
    if (Math.round(payment.amount * 100) !== order.totalCents) {
      await raiseAlert(
        order.id,
        `valor pago (R$ ${payment.amount}) diferente do pedido (${order.totalCents} centavos) — não marcado como pago`,
      );
      return order;
    }
    return markPaid(order.id);
  }
  return order;
}

// Conferir no Mercado Pago no máximo a cada 8s por pedido (a tela pergunta
// a cada ~4s). Garante a confirmação mesmo se o webhook não chegar (ex.:
// preview protegido por login da Vercel).
const MP_CHECK_INTERVAL_MS = 8000;

/** Status atual do pedido, conferindo no Mercado Pago quando faz sentido. */
export async function refreshOrder(order: StoredOrder): Promise<StoredOrder> {
  if (order.status !== "pending" || !order.pix) return order;
  const expired = Date.now() > new Date(order.pix.expiresAt).getTime();
  const due =
    !order.mpCheckedAt || Date.now() - new Date(order.mpCheckedAt).getTime() > MP_CHECK_INTERVAL_MS;

  if (!order.simulated && order.mpPaymentId && (due || expired)) {
    try {
      const updated = await syncPayment(order.mpPaymentId);
      if (updated?.status === "paid") return updated;
    } catch (error) {
      // Não conseguiu conferir: NÃO marca como expirado (pode ter pago no
      // último minuto). A próxima consulta tenta de novo.
      console.error(`[pedido ${order.id}] erro ao conferir pagamento:`, (error as Error).message);
      return order;
    }
    order.mpCheckedAt = new Date().toISOString();
  } else if (!expired) {
    // Nada mudou: não regrava (economiza o banco a cada polling).
    return order;
  }
  if (expired) {
    order.status = "expired";
    console.info(`[pedido ${order.id}] Pix expirou`);
  }
  if (expired && !(await getOrder(order.id).then((o) => o?.status === "paid"))) {
    await saveOrder(order);
    await releaseStock(order.id);
    return (await getOrder(order.id)) ?? order;
  }
  // Regrava sem desfazer um pagamento que chegou no meio tempo (getOrder
  // respeita a marca `paid:`, e quem lê depois vê pago).
  await saveOrder(order);
  return (await getOrder(order.id)) ?? order;
}

// Quanto tempo um Pix aberto continua sendo conferido depois de criado.
// O Pix vence em 30 min; a folga cobre confirmação atrasada do banco.
const OPEN_WATCH_MS = 48 * 60 * 60 * 1000;

/**
 * Conferência em segundo plano: pra cada Pix aberto, pergunta direto pro
 * Mercado Pago se foi pago. É a rede de segurança se a pessoa fechou a tela
 * e o webhook não chegou. Pago → segue o fluxo normal (Bling). Sai da lista
 * quando pagar, ou 48h depois de criado.
 */
export async function reconcileOpenOrders() {
  const ids = await kvSMembers(OPEN_SET);
  const results: { id: string; status: string }[] = [];
  for (const id of ids) {
    try {
      const order = await getOrder(id);
      if (!order || order.status === "paid" || !order.mpPaymentId || order.simulated) {
        await kvSRem(OPEN_SET, id);
        results.push({ id, status: order?.status ?? "sumiu" });
        continue;
      }
      const synced = (await syncPayment(order.mpPaymentId)) ?? order;
      const old = Date.now() - new Date(order.createdAt).getTime() > OPEN_WATCH_MS;
      // Pix vencido (+5 min de folga) e ninguém com a tela aberta: devolve o
      // kit pro estoque já. Continua sendo conferido até as 48h; se pagar
      // atrasado, o pagamento reserva de novo (markPaid).
      const pixGone =
        order.pix && Date.now() > new Date(order.pix.expiresAt).getTime() + 5 * 60 * 1000;
      if (synced.status === "pending" && pixGone) {
        await saveOrder({ ...synced, status: "expired" });
        await releaseStock(id);
      }
      if (synced.status !== "paid" && old) {
        await kvSRem(OPEN_SET, id);
        if (synced.status === "pending") await saveOrder({ ...synced, status: "expired" });
        await releaseStock(id);
      }
      results.push({ id, status: synced.status });
    } catch (error) {
      console.error(`[conferência] pedido ${id}:`, (error as Error).message);
      results.push({ id, status: "erro ao conferir" });
    }
  }
  return results;
}

let lastReconcileCheck = 0;

/** Conferência oportunista: no máximo a cada 5 min no site inteiro. */
export async function maybeReconcileOrders() {
  try {
    if (Date.now() - lastReconcileCheck < 60_000) return;
    lastReconcileCheck = Date.now();
    if ((await kvSMembers(OPEN_SET)).length === 0) return;
    if (!(await kvSetNX("orders:reconcile-tick", "1", 5 * 60))) return;
    await reconcileOpenOrders();
  } catch (error) {
    console.error("[conferência] oportunista:", (error as Error).message);
  }
}

/** Tudo que roda em segundo plano depois de uma resposta (`after`). */
export async function housekeeping() {
  await maybeReconcileOrders();
  await maybeRetryBling();
  await maybeAdvanceFulfillments();
}

/** Pix expirado → novo pedido com os mesmos dados (preços recalculados). */
export async function renewOrder(order: StoredOrder) {
  const input: Order = {
    items: order.items.map(({ sku, qty, unitPriceCents }) => ({ sku, qty, unitPriceCents })),
    customer: order.customer,
    address: order.address,
    shipping: order.shipping,
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    ageConfirmed: true,
    ageConfirmedAt: order.ageConfirmedAt,
    marketingOptIn: order.marketingOptIn,
    note: order.note ?? "",
  };
  const priced = await priceOrder(input);
  return createPixOrder(
    { ...input, subtotalCents: priced.subtotalCents, totalCents: priced.totalCents },
    `renew-${order.id}`,
  );
}
