import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { IS_PRODUCTION } from "@/lib/store/kv";

/**
 * Mercado Pago (Pix) pela API REST — SÓ NO SERVIDOR.
 *
 * - `MERCADOPAGO_ACCESS_TOKEN`: credencial da aplicação. Modo teste = a de
 *   teste (`TEST-…`); produção = a de produção (`APP_USR-…`). Trocar de modo
 *   é só trocar a variável.
 * - `MERCADOPAGO_WEBHOOK_SECRET`: "assinatura secreta" do webhook (painel
 *   do Mercado Pago → Suas integrações → Webhooks).
 *
 * Sem token e FORA de produção: Pix SIMULADO (código fictício, sem QR) pra
 * conseguir ver as telas. Em produção sem token → erro.
 */

// `MERCADOPAGO_API_URL` só pra teste local (API falsa); em produção, vazio.
const API = process.env.MERCADOPAGO_API_URL?.trim() || "https://api.mercadopago.com";
const TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || "";
const WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || "";

export const PIX_EXPIRATION_MINUTES = 30;

/**
 * Qual API do Mercado Pago gera o Pix: `payments` (a atual, /v1/payments) ou
 * `orders` (a nova, /v1/orders — o Mercado Pago vai desligar a de payments).
 * Trocar = mudar `MERCADOPAGO_API=orders` na Vercel (+ redeploy). As duas
 * convivem: pedidos antigos continuam sendo conferidos pela API que os criou
 * (id `ORD…` = orders; número = payments).
 */
export const MP_API = process.env.MERCADOPAGO_API?.trim() === "orders" ? "orders" : "payments";

/** Sem token fora de produção → simula. */
export const MP_SIMULATED = !TOKEN && !IS_PRODUCTION;

/**
 * Pode "simular pagamento" (botão de teste na tela do Pix)? Só fora de
 * produção e só com Pix simulado ou credencial de TESTE — nunca com
 * credencial de produção, nem no site no ar.
 */
export const CAN_SIMULATE_PAYMENT = !IS_PRODUCTION && (MP_SIMULATED || TOKEN.startsWith("TEST-"));

export class PaymentUnavailableError extends Error {
  constructor() {
    super("Mercado Pago não configurado (MERCADOPAGO_ACCESS_TOKEN)");
  }
}

export type PixPayment = {
  id: string;
  status: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
};

/** Data no formato que o Mercado Pago pede, no fuso de Brasília. */
function toMpDate(date: Date) {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().replace("Z", "-03:00");
}

export async function createPixPayment(input: {
  orderId: string;
  amountCents: number;
  email: string;
  name: string;
  cpf: string;
  idempotencyKey: string;
}): Promise<PixPayment> {
  const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000);

  if (!TOKEN) {
    if (!MP_SIMULATED) throw new PaymentUnavailableError();
    return {
      id: `sim-${input.orderId}`,
      status: "pending",
      qrCode: `00020126SIMULADO-FERNANDITO-${input.orderId}-NAO-PAGUE-ESTE-CODIGO`,
      qrCodeBase64: "",
      expiresAt: expiresAt.toISOString(),
    };
  }

  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  if (MP_API === "orders") return createPixOrder(input, expiresAt, firstName, rest.join(" "));
  const response = await fetch(`${API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      // Mesma chave = mesmo pagamento: um reenvio nunca cobra duas vezes.
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: input.amountCents / 100,
      description: `Fernandito — pedido #${input.orderId}`,
      payment_method_id: "pix",
      external_reference: input.orderId,
      date_of_expiration: toMpDate(expiresAt),
      payer: {
        email: input.email,
        first_name: firstName,
        last_name: rest.join(" "),
        identification: { type: "CPF", number: input.cpf },
      },
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as MpPaymentResponse | null;
  if (!response.ok || !data?.id) {
    throw new Error(`Mercado Pago ${response.status}: ${data?.message ?? "sem detalhes"}`);
  }
  const tx = data.point_of_interaction?.transaction_data;
  return {
    id: String(data.id),
    status: data.status ?? "pending",
    qrCode: tx?.qr_code ?? "",
    qrCodeBase64: tx?.qr_code_base64 ?? "",
    expiresAt: data.date_of_expiration
      ? new Date(data.date_of_expiration).toISOString()
      : expiresAt.toISOString(),
  };
}

type MpPaymentResponse = {
  id?: number | string;
  status?: string;
  transaction_amount?: number;
  external_reference?: string;
  date_of_expiration?: string;
  message?: string;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
};

// ── API nova: Orders ───────────────────────────────────────────────────────
type MpOrderResponse = {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  total_paid_amount?: string;
  message?: string;
  transactions?: {
    payments?: {
      id?: string;
      status?: string;
      amount?: string;
      paid_amount?: string;
      date_of_expiration?: string;
      payment_method?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
    }[];
  };
};

async function createPixOrder(
  input: Parameters<typeof createPixPayment>[0],
  expiresAt: Date,
  firstName: string,
  lastName: string,
): Promise<PixPayment> {
  const amount = (input.amountCents / 100).toFixed(2);
  const response = await fetch(`${API}/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      external_reference: input.orderId,
      description: `Fernandito — pedido #${input.orderId}`,
      total_amount: amount,
      payer: {
        email: input.email,
        first_name: firstName,
        last_name: lastName,
        identification: { type: "CPF", number: input.cpf },
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: { id: "pix", type: "bank_transfer" },
            expiration_time: `PT${PIX_EXPIRATION_MINUTES}M`,
          },
        ],
      },
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as MpOrderResponse | null;
  if (!response.ok || !data?.id)
    throw new Error(`Mercado Pago ${response.status}: ${data?.message ?? "sem detalhes"}`);
  const payment = data.transactions?.payments?.[0];
  return {
    id: data.id,
    status: data.status ?? "action_required",
    qrCode: payment?.payment_method?.qr_code ?? "",
    qrCodeBase64: payment?.payment_method?.qr_code_base64 ?? "",
    expiresAt: payment?.date_of_expiration
      ? new Date(payment.date_of_expiration).toISOString()
      : expiresAt.toISOString(),
  };
}

async function getOrderPayment(orderId: string) {
  const response = await fetch(`${API}/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Mercado Pago ${response.status} ao buscar a order`);
  const data = (await response.json()) as MpOrderResponse;
  // "processed" = pago e creditado. O resto (action_required, expired,
  // canceled…) não conta como pago.
  const paid = data.status === "processed";
  const payment = data.transactions?.payments?.[0];
  return {
    id: String(data.id),
    status: paid ? "approved" : (data.status ?? ""),
    amount: Number(data.total_paid_amount ?? payment?.paid_amount ?? data.total_amount ?? 0),
    externalReference: data.external_reference ?? "",
  };
}

/** Busca o pagamento direto na API (a fonte da verdade, não o webhook). */
export async function getPayment(paymentId: string) {
  if (!TOKEN) return null;
  // Id da API nova ("ORD…"; o aviso pode chegar em minúsculas).
  if (/^ord/i.test(paymentId)) return getOrderPayment(paymentId.toUpperCase());
  const response = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Mercado Pago ${response.status} ao buscar pagamento`);
  const data = (await response.json()) as MpPaymentResponse;
  return {
    id: String(data.id),
    status: data.status ?? "",
    amount: data.transaction_amount ?? 0,
    externalReference: data.external_reference ?? "",
  };
}

/**
 * Valida o `x-signature` do webhook (documentação do Mercado Pago):
 * manifest = `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (partes
 * ausentes saem), HMAC-SHA256 com a assinatura secreta, comparado ao `v1`.
 */
export function verifyWebhookSignature(input: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}) {
  if (!WEBHOOK_SECRET || !input.signature) return false;
  const parts = Object.fromEntries(
    input.signature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const id =
    input.dataId && /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (input.requestId) manifest += `request-id:${input.requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", WEBHOOK_SECRET).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
