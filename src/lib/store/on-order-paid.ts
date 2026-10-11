import "server-only";
import type { StoredOrder } from "@/lib/store/orders";
import { syncOrderToBling } from "@/lib/bling/orders";

/**
 * Roda UMA vez quando o pedido é pago (webhook ou checagem de status):
 * cria o pedido de venda no Bling (src/lib/bling/orders.ts). Se o Bling
 * falhar, o pedido vai pra fila e o cron diário tenta de novo.
 */
export async function onOrderPaid(order: StoredOrder): Promise<void> {
  await syncOrderToBling(order.id);
}
