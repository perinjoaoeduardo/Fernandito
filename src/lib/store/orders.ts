import "server-only";
import { randomBytes } from "node:crypto";
import type { Address, Customer } from "@/lib/order";
import type { ShippingOption } from "@/lib/shipping";
import { kvGet, kvSet } from "@/lib/store/kv";

/**
 * Pedido salvo no servidor (Redis, chave `order:<id>`). Nasce "pending"
 * antes do Pix ser gerado; o webhook (ou a checagem do status) passa pra
 * "paid". Dinheiro em centavos.
 */

export type OrderStatus = "pending" | "paid" | "expired" | "cancelled";

export type StoredOrderItem = {
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
};

export type StoredOrder = {
  id: string;
  status: OrderStatus;
  items: StoredOrderItem[];
  customer: Customer;
  address: Address;
  shipping: ShippingOption;
  subtotalCents: number;
  totalCents: number;
  ageConfirmed: true;
  ageConfirmedAt: string;
  marketingOptIn: boolean;
  mpPaymentId: string | null;
  pix: {
    qrCode: string;
    /** PNG em base64 (sem o prefixo data:). Vazio no modo simulado. */
    qrCodeBase64: string;
    expiresAt: string;
  } | null;
  /** `true` = Pix simulado (sem Mercado Pago, só fora de produção). */
  simulated: boolean;
  createdAt: string;
  paidAt: string | null;
  /** Última vez que o status foi conferido direto no Mercado Pago. */
  mpCheckedAt: string | null;
  /** Pedido de venda criado no Bling depois de pago (Prompt Loja #3). */
  bling?: {
    orderId: number | null;
    number: number | null;
    syncedAt: string | null;
    /** Último erro ao enviar (fica na fila e tenta de novo). */
    error: string | null;
  };
};

// Pedido fica guardado 1 ano (o pago vai pro Bling no Prompt #3).
const ORDER_TTL = 60 * 60 * 24 * 365;

/** Id curto e impossível de adivinhar (a página do pedido abre só com ele). */
export function newOrderId() {
  return randomBytes(9).toString("base64url");
}

export async function getOrder(id: string): Promise<StoredOrder | null> {
  if (!/^[\w-]{6,40}$/.test(id)) return null;
  const raw = await kvGet(`order:${id}`);
  return raw ? (JSON.parse(raw) as StoredOrder) : null;
}

export async function saveOrder(order: StoredOrder) {
  await kvSet(`order:${order.id}`, JSON.stringify(order), ORDER_TTL);
}

/** Só o que a tela do pedido precisa — sem CPF, e-mail ou telefone. */
export function publicOrder(order: StoredOrder) {
  return {
    id: order.id,
    status: order.status,
    items: order.items,
    shipping: order.shipping,
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    firstName: order.customer.name.split(/\s+/)[0] ?? "",
    address: {
      street: order.address.street,
      number: order.address.number,
      complement: order.address.complement,
      neighborhood: order.address.neighborhood,
      city: order.address.city,
      uf: order.address.uf,
    },
    pix: order.pix,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}

export type PublicOrder = ReturnType<typeof publicOrder>;

/** Pra log: CPF só com os 2 últimos dígitos, e-mail com o começo escondido. */
export function maskCpf(cpf: string) {
  return `***.***.***-${cpf.slice(-2)}`;
}
export function maskEmail(email: string) {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}
