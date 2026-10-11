import "server-only";
import type { StoredOrder } from "@/lib/store/orders";

/**
 * Roda UMA vez quando o pedido é pago (webhook ou checagem de status).
 *
 * TODO (Prompt Loja #3): criar o pedido de venda no Bling a partir do
 * `order` (SKUs iguais aos do Bling, cliente com CPF, endereço, frete).
 */
export async function onOrderPaid(order: StoredOrder): Promise<void> {
  void order;
}
