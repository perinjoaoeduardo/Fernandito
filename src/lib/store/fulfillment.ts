import "server-only";
import { LOCAL_DELIVERY } from "@/lib/shipping";
import { getProduct } from "@/lib/catalog";
import { bling } from "@/lib/bling/client";
import {
  addToCart,
  findShipmentByTag,
  generateLabel,
  getShipment,
  labelPrintUrl,
  payWithBalance,
} from "@/lib/melhor-envio-label";
import {
  IS_PRODUCTION,
  kvGet,
  kvReleaseLock,
  kvSAdd,
  kvSMembers,
  kvSRem,
  kvSet,
  kvSetNX,
} from "@/lib/store/kv";
import { getOrder, raiseAlert, type StoredOrder } from "@/lib/store/orders";
import { sendOrderShipped } from "@/lib/email";

/**
 * Depois do pago, tudo automático (sem mão):
 *
 *   pedido no Bling → NOTA FISCAL gerada e enviada à Sefaz → autorizada
 *   → ETIQUETA no Melhor Envio (carrinho com a chave da nota e a tag do
 *     pedido → paga com o SALDO → gerada) → código de RASTREIO
 *   → postado → entregue (aviso do Melhor Envio ou consulta).
 *
 * Porto Alegre (entrega própria): nota → "saiu pra entrega"; entregue
 * quando o pedido vira "Atendido" no Bling.
 *
 * Cada passo é seguro de repetir: antes de agir, confere o estado real
 * (nota que já existe, envio do Melhor Envio que já tem a tag do pedido,
 * envio que já foi pago/gerado). O estado fica em `fulfill:<id>`, separado
 * do pedido. Quem empurra: o próprio pagamento, as requisições do site
 * (`housekeeping`), o cron diário, o aviso do Melhor Envio e o painel.
 * Erro → fica parado nesse passo, com o motivo no painel, e tenta de novo.
 *
 * Desligar: `FULFILL_NFE=0` (nota) e/ou `FULFILL_LABEL=0` (etiqueta).
 * Preview só roda com `BLING_SYNC_PREVIEW=1` (nunca nota de verdade sem querer).
 */

export type FulfillStage =
  | "invoice" // gerando/enviando a nota
  | "label" // comprando a etiqueta
  | "ready" // etiqueta pronta (com rastreio), falta postar
  | "posted"
  | "delivered"
  | "local" // POA: saiu pra entrega própria
  | "local-delivered";

export type Fulfillment = {
  stage: FulfillStage;
  invoice: {
    id: number | null;
    number: string | null;
    key: string | null;
    status: number | null;
    sentAt: string | null;
    danfeUrl: string | null;
  };
  label: {
    meId: string | null;
    status: string | null;
    tracking: string | null;
    trackingUrl: string | null;
    printUrl: string | null;
    savedInBling: boolean;
  };
  error: string | null;
  updatedAt: string;
};

const QUEUE = "fulfill:queue";
const key = (id: string) => `fulfill:${id}`;
const ENABLED = IS_PRODUCTION || process.env.BLING_SYNC_PREVIEW === "1";
const AUTO_NFE = process.env.FULFILL_NFE !== "0";
const AUTO_LABEL = process.env.FULFILL_LABEL !== "0";

// Situações da NF-e no Bling.
const NFE_OK = [5, 6, 7]; // autorizada / emitida DANFE / registrada
const NFE_WAIT = [3, 8, 10]; // aguardando recibo / protocolo / consulta
const NFE_FAIL: Record<number, string> = {
  2: "cancelada",
  4: "rejeitada pela Sefaz",
  9: "denegada",
  11: "bloqueada",
};

function fresh(): Fulfillment {
  return {
    stage: "invoice",
    invoice: { id: null, number: null, key: null, status: null, sentAt: null, danfeUrl: null },
    label: {
      meId: null,
      status: null,
      tracking: null,
      trackingUrl: null,
      printUrl: null,
      savedInBling: false,
    },
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getFulfillment(orderId: string): Promise<Fulfillment | null> {
  const raw = await kvGet(key(orderId));
  return raw ? (JSON.parse(raw) as Fulfillment) : null;
}

async function save(orderId: string, f: Fulfillment) {
  f.updatedAt = new Date().toISOString();
  await kvSet(key(orderId), JSON.stringify(f), 60 * 60 * 24 * 400);
}

/** Sem novidade há mais de 2 min (vale conferir de novo). */
export function isStale(f: Fulfillment | null) {
  return !f || Date.now() - new Date(f.updatedAt).getTime() > 2 * 60 * 1000;
}

/** Entra na fila (chamado quando o pedido entra no Bling). */
export async function queueFulfillment(orderId: string) {
  await kvSAdd(QUEUE, orderId);
}

type BlingNfe = {
  id: number;
  numero?: string;
  situacao?: number;
  chaveAcesso?: string;
  linkDanfe?: string;
  linkPDF?: string;
};

async function stepInvoice(order: StoredOrder, f: Fulfillment) {
  const blingId = order.bling!.orderId!;
  if (!f.invoice.id) {
    // Já tem nota (alguém gerou à mão)? Usa ela.
    const sale = await bling<{ data: { notaFiscal?: { id?: number } } }>(
      `/pedidos/vendas/${blingId}`,
    );
    let nfeId = sale.data.notaFiscal?.id || null;
    if (!nfeId) {
      if (!AUTO_NFE) return false;
      const created = await bling<{ data?: { id?: number; idNotaFiscal?: number } }>(
        `/pedidos/vendas/${blingId}/gerar-nfe`,
        { method: "POST" },
      );
      nfeId = created?.data?.id ?? created?.data?.idNotaFiscal ?? null;
      if (!nfeId) {
        const again = await bling<{ data: { notaFiscal?: { id?: number } } }>(
          `/pedidos/vendas/${blingId}`,
        );
        nfeId = again.data.notaFiscal?.id || null;
      }
      if (!nfeId) throw new Error("Bling não devolveu a nota gerada");
      console.info(`[envio ${order.id}] nota gerada no Bling (${nfeId})`);
    }
    f.invoice.id = nfeId;
    await save(order.id, f);
  }

  const nfe = (await bling<{ data: BlingNfe }>(`/nfe/${f.invoice.id}`)).data;
  f.invoice.status = nfe.situacao ?? null;
  f.invoice.number = nfe.numero ?? null;
  f.invoice.danfeUrl = nfe.linkDanfe ?? nfe.linkPDF ?? null;
  const status = nfe.situacao ?? 1;

  if (NFE_OK.includes(status)) {
    f.invoice.key = nfe.chaveAcesso ?? null;
    if (!f.invoice.key) throw new Error("Nota autorizada mas sem chave de acesso");
    f.stage = order.shipping.id === LOCAL_DELIVERY.id ? "local" : "label";
    f.error = null;
    await save(order.id, f);
    console.info(`[envio ${order.id}] nota ${f.invoice.number} AUTORIZADA`);
    return true;
  }
  if (NFE_FAIL[status]) {
    const msg = `Nota ${NFE_FAIL[status]} — conferir no Bling (Notas fiscais)`;
    if (f.error !== msg) await raiseAlert(order.id, msg);
    f.error = msg;
    await save(order.id, f);
    return false;
  }
  if (status === 1 && !f.invoice.sentAt && AUTO_NFE) {
    // Pendente: envia pra Sefaz (e o Bling manda a nota por e-mail pro cliente).
    // Autoriza na Sefaz; o PDF/XML fica no Bling, sem mandar por e-mail
    // pro cliente (decidido em 19/10).
    await bling(`/nfe/${f.invoice.id}/enviar?enviarEmail=false`, { method: "POST" });
    f.invoice.sentAt = new Date().toISOString();
    console.info(`[envio ${order.id}] nota enviada à Sefaz`);
  }
  // Aguardando a Sefaz (ou pendente): confere de novo na próxima volta.
  void NFE_WAIT;
  await save(order.id, f);
  return false;
}

function boxOf(order: StoredOrder) {
  // Uma caixa por pedido: soma os pesos, maior medida de cada lado.
  let weightKg = 0;
  let widthCm = 0;
  let heightCm = 0;
  let lengthCm = 0;
  for (const item of order.items) {
    const s = getProduct(item.sku)?.shipping ?? {
      weightKg: 1.2,
      widthCm: 19,
      heightCm: 6.5,
      lengthCm: 19,
    };
    weightKg += s.weightKg * item.qty;
    widthCm = Math.max(widthCm, s.widthCm);
    lengthCm = Math.max(lengthCm, s.lengthCm);
    heightCm += s.heightCm * item.qty;
  }
  return { weightKg: Math.round(weightKg * 100) / 100, widthCm, heightCm, lengthCm };
}

async function stepLabel(order: StoredOrder, f: Fulfillment) {
  if (!AUTO_LABEL) return false;
  // 1. Envio dessa compra: o que já guardamos, ou um que já tenha a tag do
  //    pedido no Melhor Envio (nunca cria um segundo).
  if (!f.label.meId) {
    const existing = await findShipmentByTag(order.id);
    if (existing) {
      f.label.meId = existing.id;
    } else {
      f.label.meId = await addToCart({
        orderId: order.id,
        shippingId: order.shipping.id,
        invoiceKey: f.invoice.key!,
        to: {
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email,
          cpf: order.customer.cpf,
          street: order.address.street,
          number: order.address.number,
          complement: order.address.complement,
          district: order.address.neighborhood,
          city: order.address.city,
          uf: order.address.uf,
          cep: order.address.cep,
        },
        items: order.items.map((i) => ({ name: i.name, qty: i.qty, unitCents: i.unitPriceCents })),
        totalProductsCents: order.subtotalCents,
        box: boxOf(order),
      });
      console.info(`[envio ${order.id}] etiqueta no carrinho do Melhor Envio (${f.label.meId})`);
    }
    await save(order.id, f); // guarda ANTES de pagar
  }

  // 2. Paga e gera conforme o estado real lá (repetir não paga 2x).
  let shipment = await getShipment(f.label.meId);
  if (shipment.status === "pending") {
    try {
      await payWithBalance(f.label.meId);
    } catch (error) {
      const msg = (error as Error).message;
      const human = /saldo|balance|insufficient|insuficiente/i.test(msg)
        ? "Sem saldo no Melhor Envio — colocar saldo (a etiqueta sai sozinha depois)"
        : msg;
      if (f.error !== human) await raiseAlert(order.id, human);
      f.error = human;
      await save(order.id, f);
      return false;
    }
    console.info(`[envio ${order.id}] etiqueta PAGA com o saldo`);
    shipment = await getShipment(f.label.meId);
  }
  if (shipment.status === "released") {
    await generateLabel(f.label.meId);
    console.info(`[envio ${order.id}] etiqueta GERADA`);
    shipment = await getShipment(f.label.meId);
  }
  if (shipment.status === "canceled") {
    const msg = "Etiqueta cancelada no Melhor Envio — conferir";
    if (f.error !== msg) await raiseAlert(order.id, msg);
    f.error = msg;
    await save(order.id, f);
    return false;
  }

  f.label.status = shipment.status;
  f.label.tracking = shipment.tracking ?? shipment.selfTracking;
  f.label.trackingUrl = shipment.trackingUrl;
  if (!f.label.printUrl && ["generated", "posted"].includes(shipment.status))
    f.label.printUrl = await labelPrintUrl(f.label.meId).catch(() => null);
  if (["generated", "posted", "delivered"].includes(shipment.status)) {
    f.stage =
      shipment.status === "delivered"
        ? "delivered"
        : shipment.status === "posted"
          ? "posted"
          : "ready";
    f.error = null;
  }
  await save(order.id, f);
  if (f.label.tracking && !f.label.savedInBling) await saveTrackingInBling(order, f);
  await notifyPosted(order, f);
  return f.stage !== "label";
}

/** Grava o rastreio no pedido do Bling (no volume e nas observações internas). */
async function saveTrackingInBling(order: StoredOrder, f: Fulfillment) {
  try {
    const blingId = order.bling!.orderId!;
    const full = await bling<{
      data: Record<string, unknown> & {
        transporte?: { volumes?: { id?: number; servico?: string; codigoRastreamento?: string }[] };
        observacoesInternas?: string;
      };
    }>(`/pedidos/vendas/${blingId}`);
    const data = full.data;
    const volumes = data.transporte?.volumes?.length
      ? data.transporte.volumes.map((v, i) =>
          i === 0 ? { ...v, codigoRastreamento: f.label.tracking! } : v,
        )
      : [{ servico: "Jadlog", codigoRastreamento: f.label.tracking! }];
    await bling(`/pedidos/vendas/${blingId}`, {
      method: "PUT",
      body: {
        ...data,
        transporte: { ...data.transporte, volumes },
        observacoesInternas:
          `${data.observacoesInternas ?? ""} · Rastreio ${f.label.tracking} ${f.label.trackingUrl ?? ""}`.trim(),
      },
    });
    f.label.savedInBling = true;
    await save(order.id, f);
    console.info(`[envio ${order.id}] rastreio gravado no Bling`);
  } catch (error) {
    // Não trava nada: o rastreio já está no site, no painel e no Melhor Envio.
    console.error(`[envio ${order.id}] rastreio no Bling falhou:`, (error as Error).message);
  }
}

async function stepTrack(order: StoredOrder, f: Fulfillment) {
  if (!f.label.meId) return false;
  const shipment = await getShipment(f.label.meId);
  f.label.status = shipment.status;
  f.label.tracking = shipment.tracking ?? shipment.selfTracking ?? f.label.tracking;
  f.label.trackingUrl = shipment.trackingUrl ?? f.label.trackingUrl;
  if (shipment.status === "posted") f.stage = "posted";
  if (shipment.status === "delivered") f.stage = "delivered";
  await save(order.id, f);
  if (f.label.tracking && !f.label.savedInBling) await saveTrackingInBling(order, f);
  await notifyPosted(order, f);
  return true;
}

/** E-mail "Teu pedido foi postado", uma vez por pedido, quando a Jadlog pega
 * o pacote (ou já entregou) e o rastreio existe. Nunca trava o envio. */
async function notifyPosted(order: StoredOrder, f: Fulfillment) {
  if (order.simulated || !f.label.tracking) return;
  if (f.stage !== "posted" && f.stage !== "delivered") return;
  if (!(await kvSetNX(`email:posted:${order.id}`, "1", 60 * 60 * 24 * 400))) return;
  await sendOrderShipped(order, f.label.tracking, f.label.trackingUrl).catch(() => false);
}

async function stepLocal(order: StoredOrder, f: Fulfillment) {
  // Entregue = pedido "Atendido" (9) no Bling.
  const sale = await bling<{ data: { situacao?: { id?: number } } }>(
    `/pedidos/vendas/${order.bling!.orderId}`,
  );
  if (sale.data.situacao?.id === 9) {
    f.stage = "local-delivered";
    await save(order.id, f);
  }
  return true;
}

/**
 * Empurra o envio do pedido o máximo que der agora. Seguro de chamar várias
 * vezes e ao mesmo tempo (trava por pedido). Nunca lança.
 */
export async function advanceFulfillment(orderId: string): Promise<Fulfillment | null> {
  if (!ENABLED) return null;
  const owner = crypto.randomUUID();
  const lock = `fulfill-lock:${orderId}`;
  if (!(await kvSetNX(lock, owner, 90))) return getFulfillment(orderId);
  try {
    const order = await getOrder(orderId);
    if (!order || order.status !== "paid" || order.simulated || !order.bling?.orderId)
      return getFulfillment(orderId);
    const f = (await getFulfillment(orderId)) ?? fresh();
    try {
      if (f.stage === "invoice" && !(await stepInvoice(order, f))) return f;
      if (f.stage === "label" && !(await stepLabel(order, f))) return f;
      if (f.stage === "ready" || f.stage === "posted") await stepTrack(order, f);
      if (f.stage === "local") await stepLocal(order, f);
    } catch (error) {
      f.error = (error as Error).message;
      await save(orderId, f);
      console.error(`[envio ${orderId}] parou em "${f.stage}":`, f.error);
    }
    if (f.stage === "delivered" || f.stage === "local-delivered") await kvSRem(QUEUE, orderId);
    return f;
  } catch (error) {
    console.error(`[envio ${orderId}] erro:`, (error as Error).message);
    return getFulfillment(orderId);
  } finally {
    await kvReleaseLock(lock, owner).catch(() => {});
  }
}

/** Logo depois do pago: tenta até a nota sair e a etiqueta ficar pronta (~20 s). */
export async function fulfillNow(orderId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const f = await advanceFulfillment(orderId);
    if (
      !f ||
      ["ready", "posted", "delivered", "local", "local-delivered"].includes(f.stage) ||
      f.error
    )
      return f;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  return getFulfillment(orderId);
}

/** Todos da fila (cron, painel e de vez em quando nas requisições do site). */
export async function advanceAllFulfillments() {
  const ids = await kvSMembers(QUEUE);
  const results: { id: string; stage: string; error: string | null }[] = [];
  for (const id of ids) {
    const f = await advanceFulfillment(id);
    results.push({ id, stage: f?.stage ?? "-", error: f?.error ?? null });
  }
  return results;
}

let lastCheck = 0;
/** Oportunista: no máximo a cada 2 min no site inteiro. */
export async function maybeAdvanceFulfillments() {
  try {
    if (!ENABLED || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    if ((await kvSMembers(QUEUE)).length === 0) return;
    if (!(await kvSetNX("fulfill:tick", "1", 120))) return;
    await advanceAllFulfillments();
  } catch (error) {
    console.error("[envio] oportunista:", (error as Error).message);
  }
}
