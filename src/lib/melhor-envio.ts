import "server-only";
import type { ShippingItem, ShippingOption } from "@/lib/shipping";

/**
 * Cotação de frete no Melhor Envio — SÓ NO SERVIDOR (o token não pode ir
 * pro navegador). Chamada pela rota `/api/frete`.
 *
 * HOJE: retorno MOCKADO (opções fictícias), porque ainda não temos o token.
 * Quando tiver:
 *   1. Criar `MELHOR_ENVIO_TOKEN` (e `MELHOR_ENVIO_CEP_ORIGEM`) na Vercel.
 *   2. Trocar o corpo de `quoteMelhorEnvio` pela chamada real:
 *      POST https://www.melhorenvio.com.br/api/v2/me/shipment/calculate
 *      (sandbox: https://sandbox.melhorenvio.com.br/...)
 *      headers: Authorization: Bearer <token>, Accept/Content-Type JSON,
 *               User-Agent: "Fernandito (email de contato)"
 *      body: { from: { postal_code }, to: { postal_code },
 *              products: [{ id, width, height, length, weight,
 *                           insurance_value, quantity }] }
 *   3. Mapear cada serviço da resposta (sem `error`) pra `ShippingOption`:
 *      id ← `me-${id}`, service ← name, carrier ← company.name,
 *      priceCents ← round(price * 100), days ← delivery_range.
 */

export const ORIGIN_CEP = process.env.MELHOR_ENVIO_CEP_ORIGEM?.trim() || "90430131";

export async function quoteMelhorEnvio(
  destinationCep: string,
  items: ShippingItem[],
): Promise<ShippingOption[]> {
  const weight = items.reduce((sum, item) => sum + item.weightKg * item.qty, 0);
  // MOCK: valores fictícios, crescem um pouco com o peso e com a distância
  // "aproximada" pelo primeiro dígito do CEP (só pra variar na tela).
  const distance = Math.min(
    3,
    Math.round(Math.abs(Number(destinationCep[0] ?? 9) - Number(ORIGIN_CEP[0])) / 3),
  );
  const base = 1800 + distance * 450 + Math.round(weight * 300);
  return [
    {
      id: "me-mock-pac",
      service: "PAC",
      carrier: "Correios",
      priceCents: base,
      days: { min: 5 + distance, max: 8 + distance },
      source: "melhor-envio",
    },
    {
      id: "me-mock-sedex",
      service: "SEDEX",
      carrier: "Correios",
      priceCents: Math.round(base * 1.7),
      days: { min: 2 + Math.ceil(distance / 2), max: 4 + Math.ceil(distance / 2) },
      source: "melhor-envio",
    },
    {
      id: "me-mock-jadlog",
      service: ".Package",
      carrier: "Jadlog",
      priceCents: Math.round(base * 1.2),
      days: { min: 4 + distance, max: 6 + distance },
      source: "melhor-envio",
    },
  ];
}
