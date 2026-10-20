import "server-only";
import { BASE, meToken, USER_AGENT, ORIGIN_CEP, isAllowedCarrier } from "@/lib/melhor-envio";

/**
 * Compra automática da etiqueta no Melhor Envio (API v2), paga com o SALDO
 * da conta: carrinho → checkout (paga) → gerar → rastreio. Cada envio leva
 * a tag com o nº do pedido do site — é por ela que o site acha a etiqueta e
 * nunca compra duas vezes. Remetente: `SENDER` (dados da empresa).
 */

// Remetente (dados fiscais conferidos no Bling/LANCAMENTO.md).
const SENDER = {
  name: process.env.ME_FROM_NAME?.trim() || "FERNANDITO BEBIDAS LTDA",
  phone: process.env.ME_FROM_PHONE?.trim() || "51993383764",
  email: process.env.ME_FROM_EMAIL?.trim() || "contato@fernandito.com.br",
  company_document: process.env.ME_FROM_CNPJ?.trim() || "69252946000141",
  state_register: process.env.ME_FROM_IE?.trim() || "0964146258",
  address: process.env.ME_FROM_STREET?.trim() || "Rua Castro Alves",
  number: process.env.ME_FROM_NUMBER?.trim() || "433",
  complement: "",
  district: process.env.ME_FROM_DISTRICT?.trim() || "Rio Branco",
  city: process.env.ME_FROM_CITY?.trim() || "Porto Alegre",
  state_abbr: "RS",
  country_id: "BR",
  postal_code: ORIGIN_CEP,
};
// Agência de postagem (opcional; sem ela vale a do painel: ponto Pegaki).
const AGENCY = Number(process.env.ME_AGENCY_ID) || undefined;

export class MeError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

async function me<T>(path: string, body?: unknown): Promise<T> {
  const token = await meToken();
  if (!token) throw new MeError("Melhor Envio sem token (autorizar em /api/melhorenvio/connect)");
  const response = await fetch(`${BASE}/api/v2/me${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message =
      (data as { message?: string; error?: string } | null)?.message ??
      (data as { error?: string } | null)?.error ??
      text.slice(0, 200);
    throw new MeError(`Melhor Envio ${response.status} em ${path}: ${message}`, response.status);
  }
  return data as T;
}

export type MeShipment = {
  id: string;
  status: string;
  tracking: string | null;
  /** Código do Melhor Rastreio (sempre existe depois de gerar). */
  selfTracking: string | null;
  trackingUrl: string | null;
};

type MeOrder = {
  id: string;
  status: string;
  tracking?: string | null;
  self_tracking?: string | null;
  tags?: { tag: string }[];
  generated_at?: string | null;
};

function toShipment(o: MeOrder): MeShipment {
  const code = o.tracking || o.self_tracking || null;
  // Algumas transportadoras (ex.: J&T) ficam "released" depois de gerar; a
  // data de geração é o que prova que a etiqueta existe.
  const status = o.status === "released" && o.generated_at ? "generated" : o.status;
  return {
    id: o.id,
    status,
    tracking: o.tracking ?? null,
    selfTracking: o.self_tracking ?? null,
    trackingUrl: code ? `https://www.melhorrastreio.com.br/rastreio/${code}` : null,
  };
}

/** Envio já existente com a tag do pedido (carrinho, pago ou gerado), se houver. */
export async function findShipmentByTag(orderId: string): Promise<MeShipment | null> {
  // Sem resultado o Melhor Envio responde vazio (null), não uma lista.
  const page = await me<{ data?: MeOrder[] } | MeOrder[] | null>(
    `/orders/search?q=${encodeURIComponent(orderId)}`,
  );
  const list = Array.isArray(page) ? page : (page?.data ?? []);
  const found = list.find((o) => o.tags?.some((t) => t.tag === orderId) && o.status !== "canceled");
  return found ? toShipment(found) : null;
}

export async function getShipment(id: string): Promise<MeShipment> {
  return toShipment(await me<MeOrder>(`/orders/${encodeURIComponent(id)}`));
}

/** Serviço liberado mais barato pro CEP (quando o pedido foi pela tabela fixa). */
async function cheapestService(input: LabelInput): Promise<number> {
  const services = await me<
    {
      id: number;
      error?: string;
      price?: string;
      custom_price?: string;
      company?: { name?: string };
    }[]
  >("/shipment/calculate", {
    from: { postal_code: ORIGIN_CEP },
    to: { postal_code: input.to.cep },
    products: [packageOf(input)],
    options: { receipt: false, own_hand: false },
  });
  const ok = services
    .filter((s) => !s.error && (s.custom_price ?? s.price))
    .filter((s) => isAllowedCarrier(s.company?.name))
    .sort((a, b) => Number(a.custom_price ?? a.price) - Number(b.custom_price ?? b.price));
  if (!ok[0]) throw new MeError("Nenhuma transportadora liberada atende esse CEP");
  return ok[0].id;
}

export type LabelInput = {
  orderId: string;
  /** "me-<id>" quando a pessoa escolheu um serviço do Melhor Envio. */
  shippingId: string;
  invoiceKey: string;
  to: {
    name: string;
    phone: string;
    email: string;
    cpf: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    uf: string;
    cep: string;
  };
  items: { name: string; qty: number; unitCents: number }[];
  totalProductsCents: number;
  /** Caixa (soma do pedido). */
  box: { weightKg: number; widthCm: number; heightCm: number; lengthCm: number };
};

function packageOf(input: LabelInput) {
  return {
    id: "1",
    width: input.box.widthCm,
    height: input.box.heightCm,
    length: input.box.lengthCm,
    weight: input.box.weightKg,
    insurance_value: input.totalProductsCents / 100,
    quantity: 1,
  };
}

/** Põe no carrinho (com a nota e a tag do pedido). Devolve o id do envio. */
export async function addToCart(input: LabelInput): Promise<string> {
  const chosen = /^me-(\d+)$/.exec(input.shippingId)?.[1];
  const service = chosen ? Number(chosen) : await cheapestService(input);
  const created = await me<{ id: string }>("/cart", {
    service,
    ...(AGENCY ? { agency: AGENCY } : {}),
    from: SENDER,
    to: {
      name: input.to.name,
      phone: input.to.phone,
      email: input.to.email,
      document: input.to.cpf,
      address: input.to.street,
      number: input.to.number,
      complement: input.to.complement,
      district: input.to.district,
      city: input.to.city,
      state_abbr: input.to.uf,
      country_id: "BR",
      postal_code: input.to.cep,
    },
    products: input.items.map((i) => ({
      name: i.name,
      quantity: i.qty,
      unitary_value: i.unitCents / 100,
    })),
    volumes: [
      {
        height: input.box.heightCm,
        width: input.box.widthCm,
        length: input.box.lengthCm,
        weight: input.box.weightKg,
      },
    ],
    options: {
      insurance_value: input.totalProductsCents / 100,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: false,
      invoice: { key: input.invoiceKey },
      platform: "Site Fernandito",
      tags: [{ tag: input.orderId, url: `https://fernandito.com.br/pedido/${input.orderId}` }],
    },
  });
  if (!created?.id) throw new MeError("Melhor Envio não devolveu o id do carrinho");
  return created.id;
}

/** Paga com o saldo da conta (falta saldo → erro do Melhor Envio). */
export async function payWithBalance(id: string) {
  await me("/shipment/checkout", { orders: [id] });
}

/** Gera a etiqueta (sai o código de rastreio). */
export async function generateLabel(id: string) {
  // Responde 200 mesmo quando não gera: { "<id>": { status: false, message } }.
  const result = await me<Record<string, { status?: boolean; message?: string }> | null>(
    "/shipment/generate",
    { orders: [id] },
  );
  const item = result?.[id];
  if (item && item.status === false) {
    if (/j[aá] est[aá] gerad/i.test(item.message ?? "")) return "already";
    throw new MeError(`Melhor Envio não gerou a etiqueta: ${item.message ?? "sem motivo"}`);
  }
  return "generated";
}

/** Link do PDF da etiqueta, pra imprimir e colar na caixa. */
export async function labelPrintUrl(id: string): Promise<string | null> {
  const data = await me<{ url?: string }>("/shipment/print", { mode: "private", orders: [id] });
  return data?.url ?? null;
}
