import "server-only";
import type { StoredOrder } from "@/lib/store/orders";
import { after } from "next/server";
import { syncOrderToBling } from "@/lib/bling/orders";
import { fulfillNow } from "@/lib/store/fulfillment";

/**
 * Roda UMA vez quando o pedido é pago (webhook ou checagem de status):
 * cria o pedido de venda no Bling (src/lib/bling/orders.ts). Se o Bling
 * falhar, o pedido vai pra fila e o cron diário tenta de novo.
 */
export async function onOrderPaid(order: StoredOrder): Promise<void> {
  const synced = await syncOrderToBling(order.id);
  if (!synced?.bling?.orderId) return; // fila do Bling reenvia e segue daí
  // Nota + etiqueta logo em seguida, depois da resposta (não segura a tela).
  const run = () => fulfillNow(order.id).then(() => undefined);
  try {
    after(run);
  } catch {
    void run();
  }
}
