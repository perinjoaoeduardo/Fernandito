import "server-only";
import { getProduct } from "@/lib/catalog";
import { quoteMelhorEnvio } from "@/lib/melhor-envio";
import { onlyDigits } from "@/lib/br";
import type { Order } from "@/lib/order";
import { LOCAL_DELIVERY, isPortoAlegre, tableShipping, type ShippingOption } from "@/lib/shipping";
import { createPixPayment, getPayment } from "@/lib/mercadopago";
import { kvGet, kvSetNX } from "@/lib/store/kv";
import {
  getOrder,
  maskCpf,
  maskEmail,
  newOrderId,
  saveOrder,
  type StoredOrder,
  type StoredOrderItem,
} from "@/lib/store/orders";
import { onOrderPaid } from "@/lib/store/on-order-paid";
import { blingStock } from "@/lib/bling/orders";

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

// CEPs de Porto Alegre: 90000-000 a 91999-999. A entrega própria só vale
// com CEP de POA — não basta digitar "Porto Alegre" na cidade.
function isPoaCep(cep: string) {
  const n = Number(onlyDigits(cep));
  return n >= 90000000 && n <= 91999999;
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
    const quotes = await quoteMelhorEnvio(cep, shippingItems);
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
    mpPaymentId: null,
    pix: null,
    simulated: false,
    createdAt: now,
    paidAt: null,
    mpCheckedAt: null,
  };
  await saveOrder(order);

  try {
    const pix = await createPixPayment({
      orderId: id,
      amountCents: order.totalCents,
      email: order.customer.email,
      name: order.customer.name,
      cpf: order.customer.cpf,
      idempotencyKey: `pix-${id}`,
    });
    order.mpPaymentId = pix.id;
    order.simulated = pix.id.startsWith("sim-");
    order.pix = { qrCode: pix.qrCode, qrCodeBase64: pix.qrCodeBase64, expiresAt: pix.expiresAt };
    await saveOrder(order);
  } catch (error) {
    order.status = "cancelled";
    await saveOrder(order);
    console.error(`[pedido ${id}] falha ao gerar Pix:`, (error as Error).message);
    throw error;
  }

  console.info(
    `[pedido ${id}] criado · ${order.totalCents} centavos · ${order.shipping.id} · ` +
      `${maskEmail(order.customer.email)} · CPF ${maskCpf(order.customer.cpf)}` +
      (order.simulated ? " · PIX SIMULADO" : ` · mp ${order.mpPaymentId}`),
  );
  return order;
}

/**
 * Marca como pago (idempotente). Chamado pelo webhook e pela checagem de
 * status — os dois só chegam aqui depois de confirmar na API do Mercado
 * Pago (ou no "simular pagamento" de teste). `onOrderPaid` roda uma vez só.
 */
export async function markPaid(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) return null;
  if (order.status !== "paid") {
    order.status = "paid";
    order.paidAt = new Date().toISOString();
    await saveOrder(order);
    console.info(`[pedido ${order.id}] PAGO · ${order.totalCents} centavos`);
  }
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
  if (!order || order.mpPaymentId !== payment.id) return null;
  if (payment.status === "approved") {
    if (Math.round(payment.amount * 100) !== order.totalCents) {
      console.error(`[pedido ${order.id}] valor pago não confere (${payment.amount})`);
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
      console.error(`[pedido ${order.id}] erro ao conferir pagamento:`, (error as Error).message);
      if (!expired) return order;
    }
    order.mpCheckedAt = new Date().toISOString();
  }
  if (expired) {
    order.status = "expired";
    console.info(`[pedido ${order.id}] Pix expirou`);
  }
  await saveOrder(order);
  return order;
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
  };
  const priced = await priceOrder(input);
  return createPixOrder(
    { ...input, subtotalCents: priced.subtotalCents, totalCents: priced.totalCents },
    `renew-${order.id}`,
  );
}
