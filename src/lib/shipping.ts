/**
 * Frete do checkout.
 *
 * - Porto Alegre/RS: entrega própria, valor FIXO (`LOCAL_DELIVERY`).
 * - Demais CEPs: cotação real no Melhor Envio (por CEP de destino, peso e
 *   dimensões dos produtos) — ver `src/lib/melhor-envio.ts` e a rota
 *   `/api/frete`. HOJE A COTAÇÃO É MOCKADA (sem token ainda).
 * - Se a cotação falhar, cai na tabela fixa por região (`REGION_TABLE`),
 *   pra não travar a venda.
 *
 * TODOS OS VALORES ABAIXO SÃO PLACEHOLDER — editar à vontade (centavos:
 * R$ 15,00 = 1500).
 */

export type ShippingSource = "local" | "melhor-envio" | "tabela";

export type ShippingOption = {
  /** Identificador estável da opção (vai pro pedido). */
  id: string;
  /** Nome do serviço: "PAC", "SEDEX", "Entrega própria"... */
  service: string;
  /** Quem entrega: "Correios", "Jadlog", "Fernandito"... */
  carrier: string;
  priceCents: number;
  /** Prazo em dias úteis depois da postagem. */
  days: { min: number; max: number };
  source: ShippingSource;
};

export type ShippingItem = {
  qty: number;
  weightKg: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  /** Valor declarado (seguro), em centavos. */
  priceCents: number;
};

// ── Porto Alegre: entrega própria, valor fixo ──────────────────────────────
export const LOCAL_DELIVERY: ShippingOption = {
  id: "local-poa",
  service: "Entrega própria em Porto Alegre",
  carrier: "Fernandito",
  priceCents: 500, // R$ 5,00 — valor simbólico (definido pela Fernandito)
  days: { min: 1, max: 2 },
  source: "local",
};

/** CEPs de Porto Alegre: 90000-000 a 91999-999. A entrega própria só vale
 * com cidade E CEP de POA (mesma regra no navegador e no servidor — senão a
 * pessoa ficava presa em "o frete mudou"). */
export function isPoaCep(cep: string) {
  const n = Number(cep.replace(/\D/g, ""));
  return n >= 90000000 && n <= 91999999;
}

export function isPortoAlegre(city: string, uf: string) {
  const normalized = city.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return uf.toUpperCase() === "RS" && normalized === "porto alegre";
}

// ── Fallback: tabela fixa por região (se a cotação falhar) ────────────────
type Region = "rs" | "sul" | "sudeste" | "demais";

/** Frete fixo de último recurso (centavos). */
export const FALLBACK_PRICE_CENTS = 2000;

const REGION_TABLE: Record<
  Region,
  { label: string; priceCents: number; days: { min: number; max: number } }
> = {
  // Último recurso (Melhor Envio fora): R$ 20 em qualquer lugar — uma
  // média; se num envio sair mais caro, a Fernandito absorve.
  rs: { label: "Envio RS", priceCents: FALLBACK_PRICE_CENTS, days: { min: 2, max: 5 } },
  sul: { label: "Envio Sul", priceCents: FALLBACK_PRICE_CENTS, days: { min: 3, max: 7 } },
  sudeste: { label: "Envio Sudeste", priceCents: FALLBACK_PRICE_CENTS, days: { min: 4, max: 9 } },
  demais: { label: "Envio Brasil", priceCents: FALLBACK_PRICE_CENTS, days: { min: 6, max: 14 } },
};

function regionOf(uf: string): Region {
  const u = uf.toUpperCase();
  if (u === "RS") return "rs";
  if (u === "SC" || u === "PR") return "sul";
  if (["SP", "RJ", "MG", "ES"].includes(u)) return "sudeste";
  return "demais";
}

/** Opção da tabela fixa pra UF (fora de Porto Alegre). */
export function tableShipping(uf: string): ShippingOption {
  const region = regionOf(uf);
  const row = REGION_TABLE[region];
  return {
    id: `tabela-${region}`,
    service: row.label,
    carrier: "Envio padrão",
    priceCents: row.priceCents,
    days: row.days,
    source: "tabela",
  };
}

/**
 * Opções de frete pro endereço (roda no navegador). Porto Alegre → entrega
 * própria. Fora dela → cotação via `/api/frete` (Melhor Envio); se der
 * erro ou vier vazia, a tabela fixa da região.
 */
export async function getShippingOptions(
  address: { cep: string; city: string; uf: string },
  items: ShippingItem[],
): Promise<{ options: ShippingOption[]; fallback: boolean }> {
  if (isPortoAlegre(address.city, address.uf) && isPoaCep(address.cep))
    return { options: [LOCAL_DELIVERY], fallback: false };
  try {
    // Sem resposta em 12 s → tabela. A tela nunca fica presa no "calculando".
    const response = await fetch("/api/frete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cep: address.cep, items }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`cotação ${response.status}`);
    const data = (await response.json()) as { options?: ShippingOption[] };
    if (!data.options?.length) throw new Error("cotação vazia");
    return { options: data.options, fallback: false };
  } catch {
    return { options: [tableShipping(address.uf)], fallback: true };
  }
}

export function formatDays({ min, max }: { min: number; max: number }) {
  const unit = max === 1 ? "dia útil" : "dias úteis";
  return min === max ? `${max} ${unit}` : `${min} a ${max} ${unit}`;
}
