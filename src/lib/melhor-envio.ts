import "server-only";
import type { ShippingItem, ShippingOption } from "@/lib/shipping";

/**
 * Melhor Envio — SÓ NO SERVIDOR (token e secret não podem ir pro navegador).
 *
 * Variáveis na Vercel:
 *   MELHOR_ENVIO_CLIENT_ID   ID do app (Integrações → Área Dev.)
 *   MELHOR_ENVIO_SECRET      Secret do app
 *   MELHOR_ENVIO_TOKEN       Token de acesso. Pra gerar: abrir
 *                            /api/melhorenvio/connect, autorizar e colar aqui
 *                            o token que a página mostrar.
 *   MELHOR_ENVIO_CEP_ORIGEM  (opcional) CEP de origem; padrão Castro Alves.
 *
 * Sem MELHOR_ENVIO_TOKEN a cotação lança erro e o checkout cai na tabela fixa
 * por região (ver shipping.ts) — a venda nunca trava por causa do frete.
 */

export const ME_BASE_URL = "https://melhorenvio.com.br";
export const ME_USER_AGENT = "Fernandito (toma.fernandito@gmail.com)";
/** Permissões pedidas na autorização. Só cotação por enquanto. */
export const ME_SCOPES = ["shipping-calculate"];

/** Transportadoras que aparecem no checkout (nome da empresa no Melhor Envio).
 * Só Jadlog: postagem num ponto só (Gráfica Uirapuru, Av. Protásio Alves). */
export const ALLOWED_CARRIERS = ["Jadlog"];

export const ORIGIN_CEP = process.env.MELHOR_ENVIO_CEP_ORIGEM?.trim() || "90430131";

type MeService = {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_range?: { min: number; max: number };
  custom_delivery_range?: { min: number; max: number };
  company?: { name?: string };
  error?: string;
};

export async function quoteMelhorEnvio(
  destinationCep: string,
  items: ShippingItem[],
): Promise<ShippingOption[]> {
  const token = process.env.MELHOR_ENVIO_TOKEN?.trim();
  if (!token) throw new Error("MELHOR_ENVIO_TOKEN não configurado");

  const response = await fetch(`${ME_BASE_URL}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": ME_USER_AGENT,
    },
    body: JSON.stringify({
      from: { postal_code: ORIGIN_CEP },
      to: { postal_code: destinationCep },
      products: items.map((item, index) => ({
        id: String(index + 1),
        width: item.widthCm,
        height: item.heightCm,
        length: item.lengthCm,
        weight: item.weightKg,
        insurance_value: item.priceCents / 100,
        quantity: item.qty,
      })),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Melhor Envio ${response.status}`);

  const services = (await response.json()) as MeService[];
  return services
    .filter((service) => !service.error && (service.custom_price ?? service.price))
    .filter((service) =>
      ALLOWED_CARRIERS.some(
        (carrier) => carrier.toLowerCase() === service.company?.name?.trim().toLowerCase(),
      ),
    )
    .map((service) => {
      const range = service.custom_delivery_range ?? service.delivery_range ?? { min: 0, max: 0 };
      return {
        id: `me-${service.id}`,
        service: service.name,
        carrier: service.company?.name ?? "Transportadora",
        priceCents: Math.round(Number(service.custom_price ?? service.price) * 100),
        days: { min: range.min, max: range.max },
        source: "melhor-envio" as const,
      };
    })
    .filter((option) => Number.isFinite(option.priceCents) && option.priceCents > 0)
    .sort((a, b) => a.priceCents - b.priceCents);
}

/** URL de callback — tem que ser IGUAL à cadastrada no app do Melhor Envio. */
export const REDIRECT_URI =
  process.env.MELHOR_ENVIO_REDIRECT_URI?.trim() ||
  "https://fernandito.com.br/api/melhorenvio/callback";

/** Troca o `code` da autorização pelo token de acesso. */
export async function exchangeCode(code: string) {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID?.trim();
  const secret = process.env.MELHOR_ENVIO_SECRET?.trim();
  if (!clientId || !secret) throw new Error("Client ID/Secret não configurados");

  const response = await fetch(`${ME_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": ME_USER_AGENT,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: secret,
      redirect_uri: REDIRECT_URI,
      code,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Melhor Envio ${response.status}: ${await response.text()}`);
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}
