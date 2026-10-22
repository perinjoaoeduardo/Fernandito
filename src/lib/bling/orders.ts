import "server-only";
import { LOCAL_DELIVERY } from "@/lib/shipping";
import { IS_PRODUCTION, kvGet, kvSAdd, kvSMembers, kvSRem, kvSet, kvSetNX } from "@/lib/store/kv";
import { getOrder, saveOrder, type StoredOrder } from "@/lib/store/orders";
import { bling, BlingNotConnectedError, isBlingConnected } from "@/lib/bling/client";
import { queueFulfillment } from "@/lib/store/fulfillment";

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
 * Entra como "Em andamento" (já pago), na loja "Site Fernandito" e, em POA,
 * com a logística "Entrega própria POA". Contato ganha os campos
 * customizados "Aceita marketing" e "Confirmou 18+". A nota fiscal e o
 * envio continuam sendo feitos no Bling, como hoje.
 *
 * Falhou (Bling fora, token vencido…)? O pedido entra na fila `bling:retry`
 * e é reenviado a cada requisição relevante (no máximo 1x a cada 10 min,
 * `maybeRetryBling`) e pelo cron (/api/cron/bling). Nada se perde: o pedido
 * pago continua salvo no Redis.
 *
 * Preview/local: só envia com `BLING_SYNC_PREVIEW=1` (pra teste não virar
 * pedido de verdade no Bling sem querer). Pix simulado nunca vai.
 */

const RETRY_SET = "bling:retry";
const SYNC_ENABLED = IS_PRODUCTION || process.env.BLING_SYNC_PREVIEW === "1";
const FORMA_PAGAMENTO_ID = Number(process.env.BLING_FORMA_PAGAMENTO_ID) || 0;
// Loja/canal "Site Fernandito": o "código da loja (API)" dela no Bling.
const LOJA_ID = Number(process.env.BLING_LOJA_ID) || 0;
// Situação ao entrar: 15 = "Em andamento" (o pedido só é criado DEPOIS do
// Pix pago, então já está em preparação). Trocar com BLING_SITUACAO_ID
// (6 = Em aberto).
const SITUACAO_ID = Number(process.env.BLING_SITUACAO_ID) || 15;
// Natureza de operação da venda ao consumidor final (definida pela
// contadora: "Venda de produção a não contribuinte - Consumidor final",
// CFOP 5101 no RS e 6107 fora, CSOSN 102). Fixa com BLING_NATUREZA_ID;
// sem ela, o site procura pelo nome no Bling.
const NATUREZA_ID = Number(process.env.BLING_NATUREZA_ID) || 0;
const NATUREZA_NOME = /n[ãa]o contribuinte.*consumidor final/i;

type Page<T> = { data: T[] };
type Created = { data: { id: number; numero?: number } };

/** Data de hoje no fuso de Brasília (AAAA-MM-DD). */
function today() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const reais = (cents: number) => Math.round(cents) / 100;

// Campos customizados do contato (tipo "lógico"). Ids descobertos pelo nome
// no Bling (ou fixados pelas variáveis). Valor lógico: "1" marcado, "0" não.
const CAMPO_MARKETING = process.env.BLING_CAMPO_MARKETING_ID;
const CAMPO_MAIORIDADE = process.env.BLING_CAMPO_18_ID;
const LOGICO = (value: boolean) => (value ? "1" : "0");

type CampoCustom = { idCampoCustomizado: number; valor: string };

/** Ids dos campos "Aceita marketing" e "Confirmou 18+" (cache de 1 dia). */
async function contactFieldIds(): Promise<{ marketing?: number; maioridade?: number }> {
  if (CAMPO_MARKETING || CAMPO_MAIORIDADE)
    return {
      marketing: Number(CAMPO_MARKETING) || undefined,
      maioridade: Number(CAMPO_MAIORIDADE) || undefined,
    };
  const cached = await kvGet("bling:campos-contato");
  if (cached) return JSON.parse(cached) as { marketing?: number; maioridade?: number };
  const modules = await bling<Page<{ id: number; nome: string; modulo?: string }>>(
    "/campos-customizados/modulos",
  );
  const contatos = modules.data.find((m) => /contato/i.test(`${m.nome} ${m.modulo ?? ""}`));
  if (!contatos) return {};
  const fields = await bling<Page<{ id: number; nome: string }>>(
    `/campos-customizados/modulos/${contatos.id}`,
  );
  const norm = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const ids = {
    marketing: fields.data.find((f) => norm(f.nome).includes("marketing"))?.id,
    maioridade: fields.data.find((f) => /18/.test(f.nome))?.id,
  };
  await kvSet("bling:campos-contato", JSON.stringify(ids), 60 * 60 * 24);
  return ids;
}

async function contactCustomFields(order: StoredOrder): Promise<CampoCustom[]> {
  const ids = await contactFieldIds();
  const fields: CampoCustom[] = [];
  if (ids.marketing)
    fields.push({ idCampoCustomizado: ids.marketing, valor: LOGICO(order.marketingOptIn) });
  if (ids.maioridade)
    fields.push({ idCampoCustomizado: ids.maioridade, valor: LOGICO(order.ageConfirmed) });
  if (!fields.length)
    console.warn("[bling] campos 'Aceita marketing'/'Confirmou 18+' não encontrados");
  return fields;
}

async function findOrCreateContact(order: StoredOrder) {
  const { customer, address } = order;
  const campos = await contactCustomFields(order).catch((error: Error) => {
    console.error("[bling] campos customizados:", error.message);
    return [] as CampoCustom[];
  });
  const found = await bling<Page<{ id: number }>>(
    `/contatos?numeroDocumento=${customer.cpf}&limite=1`,
  );
  if (found.data[0]) {
    const id = found.data[0].id;
    // Cliente que já existe: atualiza só os dois campos (a escolha de
    // marketing mais recente vale). Falhar aqui não trava o pedido.
    if (campos.length) {
      try {
        const full = await bling<{
          data: Record<string, unknown> & { camposCustomizados?: CampoCustom[] };
        }>(`/contatos/${id}`);
        const others = (full.data.camposCustomizados ?? []).filter(
          (c) => !campos.some((n) => n.idCampoCustomizado === c.idCampoCustomizado),
        );
        await bling(`/contatos/${id}`, {
          method: "PUT",
          body: { ...full.data, camposCustomizados: [...others, ...campos] },
        });
      } catch (error) {
        console.error(`[bling] não atualizou campos do contato ${id}:`, (error as Error).message);
      }
    }
    return id;
  }
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
      ...(campos.length ? { camposCustomizados: campos } : {}),
    },
  });
  return created.data.id;
}

// Logística "Entrega própria POA" (pedidos de Porto Alegre): o código do
// serviço vai em transporte.volumes[].servico. Descoberto pelo nome da
// logística no Bling (ou fixado em BLING_LOGISTICA_POA_SERVICO).
const LOGISTICA_POA_NOME = process.env.BLING_LOGISTICA_POA_NOME?.trim() || "Entrega própria POA";
const LOGISTICA_POA_SERVICO = process.env.BLING_LOGISTICA_POA_SERVICO?.trim();

async function poaLogisticsService(): Promise<string | null> {
  if (LOGISTICA_POA_SERVICO) return LOGISTICA_POA_SERVICO;
  const cached = await kvGet("bling:logistica-poa");
  if (cached) return cached;
  const list = await bling<Page<{ id: number; descricao: string }>>("/logisticas?situacao=H");
  const logistica = list.data.find((l) => l.descricao.trim() === LOGISTICA_POA_NOME);
  if (!logistica) return null;
  const detail = await bling<{
    data: { servicos?: { id: number; codigo?: string; descricao?: string }[] };
  }>(`/logisticas/${logistica.id}`);
  const servico = detail.data.servicos?.[0];
  const code = servico?.codigo || servico?.descricao || null;
  if (code) await kvSet("bling:logistica-poa", code, 60 * 60 * 24);
  return code;
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

/**
 * Natureza "Venda de produção a não contribuinte - Consumidor final"
 * (variável ou procurada pelo nome; cache de 1 dia). Não achou → null e o
 * pedido vai sem natureza, aí o Bling usa a padrão de venda — que hoje é
 * essa mesma.
 */
async function salesNatureId(): Promise<number | null> {
  if (NATUREZA_ID) return NATUREZA_ID;
  const cached = await kvGet("bling:natureza-venda");
  if (cached) return Number(cached);
  try {
    const page = await bling<Page<{ id: number; descricao: string; situacao?: number }>>(
      "/naturezas-operacoes?limite=100",
    );
    const found = page.data.find((n) => NATUREZA_NOME.test(n.descricao) && n.situacao !== 0);
    if (!found) return null;
    await kvSet("bling:natureza-venda", String(found.id), 60 * 60 * 24);
    return found.id;
  } catch (error) {
    console.error("[bling] natureza de operação:", (error as Error).message);
    return null;
  }
}

async function createSalesOrder(order: StoredOrder) {
  // Já existe (reenvio, webhook repetido)? Usa o que está lá.
  const existing = await bling<Page<{ id: number; numero: number }>>(
    `/pedidos/vendas?numerosLojas[]=${encodeURIComponent(order.id)}`,
  );
  if (existing.data[0]) return existing.data[0];

  const local = order.shipping.id === LOCAL_DELIVERY.id;
  const [contactId, ids, formaPagamento, servicoPoa, natureza] = await Promise.all([
    findOrCreateContact(order),
    productIds(order.items.map((i) => i.sku)),
    pixPaymentMethodId(),
    local
      ? poaLogisticsService().catch((error: Error) => {
          console.error("[bling] logística POA:", error.message);
          return null;
        })
      : null,
    salesNatureId(),
  ]);
  const { address, shipping } = order;
  const date = today();

  const created = await bling<Created>("/pedidos/vendas", {
    method: "POST",
    body: {
      numeroLoja: order.id,
      data: date,
      dataSaida: date,
      dataPrevista: date,
      contato: { id: contactId },
      situacao: { id: SITUACAO_ID },
      ...(LOJA_ID ? { loja: { id: LOJA_ID } } : {}),
      ...(natureza ? { naturezaOperacao: { id: natureza } } : {}),
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
        ...(servicoPoa ? { volumes: [{ servico: servicoPoa }] } : {}),
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
          observacoes: order.manualPix
            ? "Pix MANUAL direto na conta (Mercado Pago fora)"
            : `Pix Mercado Pago ${order.mpPaymentId ?? ""}`.trim(),
        },
      ],
      observacoes: `Pedido do site fernandito.com.br #${order.id}. Entrega: ${shipping.service} (${shipping.carrier}).`,
      // Recado da pessoa nas observações INTERNAS: as "observações" comuns
      // podem ir pra nota fiscal, e um recado de presente não deve aparecer lá.
      observacoesInternas:
        (order.note ? `RECADO DO CLIENTE: ${order.note}\n\n` : "") +
        `Site #${order.id} · ${order.manualPix ? "Pix MANUAL na conta" : `Pix MP ${order.mpPaymentId ?? "-"}`} · pago em ${order.paidAt ?? "-"} · ` +
        `frete ${shipping.id} (${shipping.source}) · maioridade declarada em ${order.ageConfirmedAt}` +
        (order.termsVersion
          ? ` · aceitou Termos v${order.termsVersion} e Privacidade v${order.privacyVersion}`
          : "") +
        (order.marketingOptIn ? " · aceitou receber novidades" : "") +
        (IS_PRODUCTION ? "" : " · PEDIDO DE TESTE (preview)"),
    },
  });
  return { id: created.data.id, numero: created.data.numero ?? null };
}

/**
 * Põe o pedido na fila do Bling ANTES de tentar enviar: se a função cair no
 * meio (tempo esgotado, Bling travado), ele continua na fila e o reenvio
 * pega. Só sai da fila quando o Bling confirmar.
 */
export async function queueForBling(orderId: string) {
  await kvSAdd(RETRY_SET, orderId);
}

/**
 * Envia o pedido pago pro Bling. Nunca lança: erro vira `order.bling.error`
 * + fila de reenvio.
 */
export async function syncOrderToBling(orderId: string) {
  const order = await getOrder(orderId);
  if (!order || order.status !== "paid" || order.bling?.orderId) {
    // Já está no Bling (ou nem existe): nada a fazer, sai da fila.
    if (!order || order.bling?.orderId) await kvSRem(RETRY_SET, orderId);
    return order;
  }
  if (order.simulated || !SYNC_ENABLED) {
    await kvSRem(RETRY_SET, order.id);
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
    // Próximo passo, automático: nota fiscal → etiqueta → rastreio.
    await queueFulfillment(order.id);
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

/**
 * Reenvio "a cada requisição relevante" (status do Pix, checkout, webhook):
 * no máximo 1x a cada 10 min no site inteiro (trava no Redis). Roda depois
 * da resposta (`after`), sem atrasar ninguém. Funciona em qualquer plano da
 * Vercel — o cron é só a rede de segurança.
 */
// Freio por instância: não pergunta pro Redis a cada polling (economiza
// comandos do banco); no máximo 1x por minuto em cada instância.
let lastRetryCheck = 0;

export async function maybeRetryBling() {
  try {
    if (!SYNC_ENABLED) return;
    if (Date.now() - lastRetryCheck < 60_000) return;
    lastRetryCheck = Date.now();
    // Fila vazia → nem gasta a vez (o próximo pedido que falhar não espera 10 min).
    if ((await kvSMembers(RETRY_SET)).length === 0) return;
    if (!(await kvSetNX("bling:retry-tick", "1", 10 * 60))) return;
    await retryPendingBlingOrders();
  } catch (error) {
    console.error("[bling] reenvio oportunista:", (error as Error).message);
  }
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
