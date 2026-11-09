import "server-only";
import { trackShipment } from "@/lib/melhor-envio-label";
import { kvGet, kvMGet, kvSAdd, kvSet, kvSMembers } from "@/lib/store/kv";
import type { StoredOrder } from "@/lib/store/orders";
import type { Fulfillment } from "@/lib/store/fulfillment";

/**
 * Envios FORA do site (bonificação, venda manual): a etiqueta é comprada pelo
 * link `/api/loja/etiqueta-avulsa` e o envio fica registrado aqui pra aparecer
 * em Pedidos (com a etiqueta de origem), entrar nos números do topo
 * (Imprimir / A caminho / Entregue) e ser acompanhado sozinho. O Bling segue
 * sendo o registro fiscal (pedido e nota); aqui é só a parte do envio.
 */

export type Avulso = {
  /** A mesma `ref` usada na compra da etiqueta (ex.: bonif-marcio). */
  id: string;
  tipo: "bonificacao" | "manual";
  nome: string;
  cidade: string;
  uf: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  fone: string;
  item: string;
  qtd: number;
  /** Valor da nota em centavos (bonificação: valor de tabela, não é receita). */
  valorCents: number;
  transportadora: string;
  nf: { chave: string; numero: string | null };
  meId: string;
  stage: "ready" | "posted" | "delivered";
  status: string | null;
  tracking: string | null;
  trackingUrl: string | null;
  printUrl: string | null;
  postedAt: string | null;
  postedByHand: string | null;
  checkedAt: string | null;
  error: string | null;
  createdAt: string;
};

const key = (id: string) => `avulso:${id}`;
const SET = "avulsos:all";
const TTL = 60 * 60 * 24 * 400;

export async function saveAvulso(a: Avulso) {
  await kvSet(key(a.id), JSON.stringify(a), TTL);
  await kvSAdd(SET, a.id);
}

export async function listAvulsos(): Promise<Avulso[]> {
  const ids = await kvSMembers(SET);
  if (!ids.length) return [];
  const raw = await kvMGet(...ids.map(key));
  return raw
    .map((r) => (r ? (JSON.parse(r) as Avulso) : null))
    .filter((a): a is Avulso => a !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAvulso(id: string): Promise<Avulso | null> {
  const raw = await kvGet(key(id));
  return raw ? (JSON.parse(raw) as Avulso) : null;
}

/** "Já postei" no painel (antes do Melhor Envio confirmar a postagem). */
export async function markAvulsoPosted(id: string) {
  const a = await getAvulso(id);
  if (!a || a.stage !== "ready") return null;
  a.stage = "posted";
  a.postedByHand = new Date().toISOString();
  await saveAvulso(a);
  return a;
}

/** Confere o rastreio no Melhor Envio (mesma regra dos pedidos do site). */
export async function advanceAvulsos() {
  for (const a of await listAvulsos()) {
    if (a.stage === "delivered") continue;
    try {
      const s = await trackShipment(a.meId);
      a.status = s.status;
      a.tracking = s.tracking ?? s.selfTracking ?? a.tracking;
      a.trackingUrl = s.trackingUrl ?? a.trackingUrl;
      a.postedAt = s.postedAt ?? a.postedAt;
      a.checkedAt = new Date().toISOString();
      a.error = null;
      if (s.status === "posted") a.stage = "posted";
      if (s.status === "delivered") a.stage = "delivered";
      await saveAvulso(a);
    } catch (error) {
      a.error = (error as Error).message;
      await saveAvulso(a);
    }
  }
}

/**
 * O envio como `StoredOrder` + `Fulfillment`, pra a lista de Pedidos mostrar
 * e contar igual aos do site. `origem` separa de venda do site (não entra em
 * faturado, vendas nem ticket médio).
 */
export function avulsoAsRow(a: Avulso): { order: StoredOrder; f: Fulfillment } {
  const order = {
    id: a.id,
    status: "paid",
    items: [{ sku: "", name: a.item, qty: a.qtd, unitPriceCents: 0 }],
    customer: { name: a.nome, email: "", phone: a.fone, cpf: "" },
    address: {
      cep: a.cep,
      street: a.rua,
      number: a.numero,
      complement: a.complemento,
      neighborhood: a.bairro,
      city: a.cidade,
      uf: a.uf,
    },
    shipping: { carrier: a.transportadora, priceCents: 0 },
    subtotalCents: 0,
    totalCents: 0,
    paidAt: a.createdAt,
    createdAt: a.createdAt,
    simulated: false,
    origem: a.tipo,
  } as unknown as StoredOrder;
  const f = {
    stage: a.stage,
    invoice: {
      id: null,
      number: a.nf.numero,
      key: a.nf.chave,
      status: 5,
      sentAt: null,
      danfeUrl: null,
    },
    label: {
      meId: a.meId,
      status: a.status,
      tracking: a.tracking,
      trackingUrl: a.trackingUrl,
      printUrl: a.printUrl,
      savedInBling: true,
      postedByHand: a.postedByHand ?? undefined,
      postedAt: a.postedAt,
      checkedAt: a.checkedAt ?? undefined,
    },
    error: a.error,
    updatedAt: a.checkedAt ?? a.createdAt,
  } as Fulfillment;
  return { order, f };
}
