import "server-only";
import { LOCAL_DELIVERY } from "@/lib/shipping";
import { IS_PRODUCTION, kvGet, kvSAdd, kvSMembers, kvSRem, kvSet } from "@/lib/store/kv";
import { getOrder, saveOrder, type StoredOrder } from "@/lib/store/orders";
import { bling, BlingNotConnectedError, isBlingConnected } from "@/lib/bling/client";

/**
 * Pedido pago → pedido de venda no Bling (Prompt Loja #3).
 *
 * 1. Contato: procura pelo CPF; não achou → cria (nome, e-mail, celular,
 *    endereço).
 * 2. Itens pelo SKU (código igual no site e no Bling).
 * 3. Pedido de venda com `numeroLoja` = id do pedido do site (é por ele que
 *    não duplica: antes de criar, procura se já existe), frete, endereço de
 *    entrega (etiqueta) e uma parcela paga no Pix.
 *
 * O pedido "Em aberto" no Bling já reserva o estoque (saldo virtual). A nota
 * fiscal e o envio continuam sendo feitos no Bling, como hoje.
 *
 * Falhou (Bling fora, token vencido…)? O pedido entra na fila `bling:retry`
 * e o cron diário (/api/cron/bling) tenta de novo. Nada se perde: o pedido
 * pago continua salvo no Redis.
 *
 * Preview/local: só envia com `BLING_SYNC_PREVIEW=1` (pra teste não virar
 * pedido de verdade no Bling sem querer). Pix simulado nunca vai.
 */

const RETRY_SET = "bling:retry";
const SYNC_ENABLED = IS_PRODUCTION || process.env.BLING_SYNC_PREVIEW === "1";
const FORMA_PAGAMENTO_ID = Number(process.env.BLING_FORMA_PAGAMENTO_ID) || 0;
const LOJA_ID = Number(process.env.BLING_LOJA_ID) || 0;

type Page<T> = { data: T[] };
type Created = { data: { id: number; numero?: number } };

/** Data de hoje no fuso de Brasília (AAAA-MM-DD). */
function today() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const reais = (cents: number) => Math.round(cents) / 100;

async function findOrCreateContact(order: StoredOrder) {
  const { customer, address } = order;
  const found = await bling<Page<{ id: number }>>(
    `/contatos?numeroDocumento=${customer.cpf}&limite=1`,
  );
  if (found.data[0]) return found.data[0].id;
  const endereco = {
    endereco: address.street,
    numero: address.number,
    complemento: address.complement,
    bairro: address.neighborhood,
    cep: address.cep,
    municipio: address.city,
    uf: address.uf,
  };
  const created = await bling<Created>("/contatos", {
    method: "POST",
    body: {
      nome: customer.name,
      tipo: "F",
      situacao: "A",
      numeroDocumento: customer.cpf,
      email: customer.email,
      emailNotaFiscal: customer.email,
      celular: customer.phone,
      indicadorIe: "9",
      endereco: { geral: endereco },
    },
  });
  return created.data.id;
}

/** id do produto no Bling pelo SKU. */
async function productIds(skus: string[]) {
  const query = skus.map((sku) => `codigos[]=${encodeURIComponent(sku)}`).join("&");
  const page = await bling<Page<{ id: number; codigo: string }>>(`/produtos?${query}`);
  const ids = new Map(page.data.map((p) => [p.codigo, p.id]));
  for (const sku of skus) if (!ids.has(sku)) throw new Error(`SKU ${sku} não existe no Bling`);
  return ids;
}

/** Forma de pagamento "Pix" do Bling (variável ou a primeira do tipo Pix). */
async function pixPaymentMethodId() {
  if (FORMA_PAGAMENTO_ID) return FORMA_PAGAMENTO_ID;
  const cached = await kvGet("bling:forma-pix");
  if (cached) return Number(cached);
  const page = await bling<Page<{ id: number; descricao: string; tipoPagamento: number }>>(
    "/formas-pagamentos?limite=100",
  );
  // 17 = "Pagamento Instantâneo (PIX)" na tabela de tipos da NF-e.
  const pix =
    page.data.find((f) => f.tipoPagamento === 17) ??
    page.data.find((f) => /pix/i.test(f.descricao));
  if (!pix)
    throw new Error(
      "Nenhuma forma de pagamento Pix no Bling (criar ou definir BLING_FORMA_PAGAMENTO_ID)",
    );
  await kvSet("bling:forma-pix", String(pix.id), 60 * 60 * 24);
  return pix.id;
}

async function createSalesOrder(order: StoredOrder) {
  // Já existe (reenvio, webhook repetido)? Usa o que está lá.
  const existing = await bling<Page<{ id: number; numero: number }>>(
    `/pedidos/vendas?numerosLojas[]=${encodeURIComponent(order.id)}`,
  );
  if (existing.data[0]) return existing.data[0];

  const [contactId, ids, formaPagamento] = await Promise.all([
    findOrCreateContact(order),
    productIds(order.items.map((i) => i.sku)),
    pixPaymentMethodId(),
  ]);
  const { address, shipping } = order;
  const date = today();
  const local = shipping.id === LOCAL_DELIVERY.id;

  const created = await bling<Created>("/pedidos/vendas", {
    method: "POST",
    body: {
      numeroLoja: order.id,
      data: date,
      dataSaida: date,
      dataPrevista: date,
      contato: { id: contactId },
      ...(LOJA_ID ? { loja: { id: LOJA_ID } } : {}),
      itens: order.items.map((item) => ({
        produto: { id: ids.get(item.sku) },
        codigo: item.sku,
        descricao: item.name,
        unidade: "UN",
        quantidade: item.qty,
        valor: reais(item.unitPriceCents),
      })),
      transporte: {
        // 3 = transporte próprio (entrega POA); 0 = frete por conta do remetente.
        fretePorConta: local ? "3" : "0",
        frete: reais(shipping.priceCents),
        prazoEntrega: shipping.days.max,
        etiqueta: {
          nome: order.customer.name,
          endereco: address.street,
          numero: address.number,
          complemento: address.complement,
          bairro: address.neighborhood,
          municipio: address.city,
          uf: address.uf,
          cep: address.cep,
        },
      },
      parcelas: [
        {
          dataVencimento: date,
          valor: reais(order.totalCents),
          formaPagamento: { id: formaPagamento },
          observacoes: `Pix Mercado Pago ${order.mpPaymentId ?? ""}`.trim(),
        },
      ],
      observacoes: `Pedido do site fernandito.com.br #${order.id}. Entrega: ${shipping.service} (${shipping.carrier}).`,
      observacoesInternas:
        `Site #${order.id} · Pix MP ${order.mpPaymentId ?? "-"} · pago em ${order.paidAt ?? "-"} · ` +
        `frete ${shipping.id} (${shipping.source}) · maioridade declarada em ${order.ageConfirmedAt}` +
        (order.marketingOptIn ? " · aceitou receber novidades" : "") +
        (IS_PRODUCTION ? "" : " · PEDIDO DE TESTE (preview)"),
    },
  });
  return { id: created.data.id, numero: created.data.numero ?? null };
}

/**
 * Envia o pedido pago pro Bling. Nunca lança: erro vira `order.bling.error`
 * + fila de reenvio.
 */
export async function syncOrderToBling(orderId: string) {
  const order = await getOrder(orderId);
  if (!order || order.status !== "paid" || order.bling?.orderId) return order;
  if (order.simulated || !SYNC_ENABLED) {
    console.info(
      `[bling] pedido ${order.id} não enviado (${order.simulated ? "Pix simulado" : "preview"})`,
    );
    return order;
  }
  try {
    if (!(await isBlingConnected())) throw new BlingNotConnectedError();
    const result = await createSalesOrder(order);
    order.bling = {
      orderId: result.id,
      number: result.numero ?? null,
      syncedAt: new Date().toISOString(),
      error: null,
    };
    await saveOrder(order);
    await kvSRem(RETRY_SET, order.id);
    console.info(
      `[bling] pedido ${order.id} → venda Bling ${result.id} (nº ${result.numero ?? "?"})`,
    );
  } catch (error) {
    const message = (error as Error).message;
    order.bling = { orderId: null, number: null, syncedAt: null, error: message };
    await saveOrder(order);
    await kvSAdd(RETRY_SET, order.id);
    console.error(`[bling] pedido ${order.id} falhou, vai pra fila:`, message);
  }
  return order;
}

/** Cron: reenvia o que ficou na fila. */
export async function retryPendingBlingOrders() {
  const ids = await kvSMembers(RETRY_SET);
  const results: { id: string; ok: boolean; error?: string | null }[] = [];
  for (const id of ids) {
    const order = await syncOrderToBling(id);
    if (!order) await kvSRem(RETRY_SET, id);
    results.push({ id, ok: Boolean(order?.bling?.orderId), error: order?.bling?.error });
  }
  return results;
}

/**
 * Estoque antes de gerar o Pix: saldo virtual (físico menos o reservado em
 * pedidos abertos) do Bling. Bling desconectado → não bloqueia a venda
 * (`null`), só registra no log.
 */
export async function blingStock(skus: string[]): Promise<Map<string, number> | null> {
  try {
    if (!(await isBlingConnected())) return null;
    const ids = await productIds(skus);
    const query = [...ids.values()].map((id) => `idsProdutos[]=${id}`).join("&");
    const page = await bling<Page<{ produto: { id: number }; saldoVirtualTotal: number }>>(
      `/estoques/saldos?${query}`,
    );
    const byId = new Map(page.data.map((row) => [row.produto.id, row.saldoVirtualTotal]));
    return new Map(skus.map((sku) => [sku, byId.get(ids.get(sku)!) ?? 0]));
  } catch (error) {
    console.error("[bling] não deu pra conferir estoque:", (error as Error).message);
    return null;
  }
}
