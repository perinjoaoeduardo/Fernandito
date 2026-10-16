import type { NextRequest } from "next/server";
import { BLING_CONFIGURED, isBlingConnected } from "@/lib/bling/client";
import { retryPendingBlingOrders } from "@/lib/bling/orders";
import { isAdmin } from "@/lib/leads";
import { MP_SIMULATED } from "@/lib/mercadopago";
import { reconcileOpenOrders } from "@/lib/store/checkout";
import { HAS_REDIS, IS_PRODUCTION, kvSMembers } from "@/lib/store/kv";
import { getOrder } from "@/lib/store/orders";

/**
 * Painel da loja: /api/loja/diagnostico?key=<BLING_ADMIN_KEY>. Sem a chave
 * certa → 404. Mostra, num lugar só, o que precisa estar ligado e onde cada
 * pedido parou:
 * - `configuracao`: cada peça (banco, Mercado Pago, webhook, Bling, Melhor
 *   Envio, cron) — tudo tem que estar `true` em produção;
 * - `pixAbertos`: Pix gerados ainda sem pagamento confirmado;
 * - `filaBling`: pedidos PAGOS que ainda não entraram no Bling (com o erro);
 * - `alertas`: o que precisa de olho humano (ver LANCAMENTO.md → "Se der
 *   problema").
 * Com `&conferir=1`, antes de mostrar, confere os Pix abertos no Mercado
 * Pago e reenvia a fila do Bling (as duas coisas são seguras de repetir).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isAdmin(params.get("key"))) return new Response("Não encontrado", { status: 404 });

  const env = (name: string) => Boolean(process.env[name]?.trim());
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";

  let conferencia: unknown = null;
  if (params.get("conferir") === "1") {
    conferencia = {
      pix: await reconcileOpenOrders().catch((e: Error) => `falhou: ${e.message}`),
      bling: await retryPendingBlingOrders().catch((e: Error) => `falhou: ${e.message}`),
    };
  }

  const resumo = async (id: string) => {
    const order = await getOrder(id);
    if (!order) return { id, status: "não encontrado" };
    return {
      id,
      status: order.status,
      totalReais: order.totalCents / 100,
      criadoEm: order.createdAt,
      pagoEm: order.paidAt,
      mercadoPago: order.mpPaymentId,
      bling: order.bling?.orderId ?? null,
      erroBling: order.bling?.error ?? null,
    };
  };
  const [abertos, fila, alertas] = await Promise.all([
    kvSMembers("orders:open"),
    kvSMembers("bling:retry"),
    kvSMembers("loja:alertas"),
  ]);

  return Response.json(
    {
      ambiente: IS_PRODUCTION ? "produção" : "preview",
      configuracao: {
        bancoDeDados: HAS_REDIS,
        mercadoPagoToken: Boolean(token),
        mercadoPagoModo: token.startsWith("APP_USR-")
          ? "produção"
          : token.startsWith("TEST-")
            ? "teste"
            : MP_SIMULATED
              ? "simulado (sem token)"
              : "sem token",
        webhookAssinatura: env("MERCADOPAGO_WEBHOOK_SECRET"),
        blingApp: BLING_CONFIGURED,
        blingConectado: await isBlingConnected().catch(() => false),
        blingNatureza: env("BLING_NATUREZA_ID"),
        blingLoja: env("BLING_LOJA_ID"),
        blingFormaPix: env("BLING_FORMA_PAGAMENTO_ID"),
        melhorEnvioToken: env("MELHOR_ENVIO_TOKEN"),
        cronSecret: env("CRON_SECRET"),
      },
      conferencia,
      pixAbertos: await Promise.all(abertos.map(resumo)),
      filaBling: await Promise.all(fila.map(resumo)),
      alertas: alertas.map((a) => JSON.parse(a) as unknown),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
