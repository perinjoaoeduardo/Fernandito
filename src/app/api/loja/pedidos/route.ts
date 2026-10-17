import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/leads";
import { ALL_SET } from "@/lib/store/checkout";
import { kvSMembers } from "@/lib/store/kv";
import { getOrder, type StoredOrder } from "@/lib/store/orders";
import { getFulfillment } from "@/lib/store/fulfillment";

/**
 * Planilha de pedidos — o registro final, que NÃO depende do Bling:
 * /api/loja/pedidos?key=<BLING_ADMIN_KEY> → CSV (abre no Excel/Sheets) com
 * todos os pedidos PAGOS e tudo que a pessoa preencheu. Se o Bling falhar,
 * dá pra lançar à mão a partir daqui. `&todos=1` inclui os não pagos
 * (Pix vencido, cancelado). Sai do mesmo banco dos pedidos (Redis), onde
 * cada pedido fica guardado por 1 ano.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!isAdmin(params.get("key"))) return new Response("Não encontrado", { status: 404 });
  const all = params.get("todos") === "1";

  const ids = await kvSMembers(ALL_SET);
  const orders = (await Promise.all(ids.map(getOrder)))
    .filter(
      (o): o is StoredOrder =>
        Boolean(o) && (all || o!.status === "paid" || o!.status === "manual"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const br = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
  const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const header = [
    "pedido",
    "situação",
    "criado em",
    "pago em",
    "nome",
    "CPF",
    "e-mail",
    "telefone",
    "CEP",
    "rua",
    "número",
    "complemento",
    "bairro",
    "cidade",
    "UF",
    "itens",
    "frete",
    "frete (R$)",
    "total (R$)",
    "Mercado Pago",
    "Bling (nº)",
    "erro no Bling",
    "nota fiscal",
    "etapa do envio",
    "rastreio",
    "etiqueta (PDF)",
    "aceita novidades",
    "declarou 18+ em",
  ];
  const STATUS = {
    paid: "PAGO",
    pending: "aguardando Pix",
    expired: "Pix vencido",
    cancelled: "cancelado",
    manual: "PIX MANUAL — conferir comprovante",
  };
  const shipping = new Map(
    await Promise.all(orders.map(async (o) => [o.id, await getFulfillment(o.id)] as const)),
  );
  const rows = orders.map((o) =>
    [
      o.id,
      STATUS[o.status] ?? o.status,
      br(o.createdAt),
      br(o.paidAt),
      o.customer.name,
      o.customer.cpf,
      o.customer.email,
      o.customer.phone,
      o.address.cep,
      o.address.street,
      o.address.number,
      o.address.complement,
      o.address.neighborhood,
      o.address.city,
      o.address.uf,
      o.items
        .map((i) => `${i.qty}x ${i.name} (${i.sku}) R$ ${money(i.unitPriceCents)}`)
        .join(" + "),
      `${o.shipping.service} (${o.shipping.carrier})`,
      money(o.shipping.priceCents),
      money(o.totalCents),
      o.mpPaymentId ?? "",
      o.bling?.number ?? o.bling?.orderId ?? (o.status === "paid" ? "NÃO ENTROU" : ""),
      o.bling?.error ?? "",
      shipping.get(o.id)?.invoice.number ?? "",
      shipping.get(o.id)?.error
        ? `PARADO: ${shipping.get(o.id)?.error}`
        : (shipping.get(o.id)?.stage ?? ""),
      shipping.get(o.id)?.label.tracking ?? "",
      shipping.get(o.id)?.label.printUrl ?? "",
      o.marketingOptIn ? "sim" : "não",
      br(o.ageConfirmedAt),
    ]
      .map(cell)
      .join(";"),
  );
  // BOM: o Excel abre com acento certo.
  const csv = "﻿" + [header.map(cell).join(";"), ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pedidos-fernandito.csv"',
      "Cache-Control": "no-store",
    },
  });
}
