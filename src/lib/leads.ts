import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { BLING_ADMIN_KEY } from "@/lib/bling/client";
import { kvGet, kvSAdd, kvSet, kvSMembers } from "@/lib/store/kv";

/**
 * Leads da página Contato (todo motivo: dúvida, pedido, evento, revenda,
 * parceria): cada envio fica guardado no Redis (`lead:<id>`, conjunto `leads`) antes de
 * a pessoa cair no WhatsApp — assim nada se perde se ela desistir de mandar
 * a mensagem. Exportar: `/api/leads?key=<BLING_ADMIN_KEY>` (planilha CSV).
 */

export const leadSchema = z.object({
  form: z.enum(["duvida", "pedido", "evento", "negocio", "parceria"]),
  fields: z
    .record(z.string().max(40), z.string().trim().max(120))
    .refine((f) => Object.keys(f).length <= 8, "Campos demais"),
});

export type Lead = z.infer<typeof leadSchema> & { id: string; createdAt: string };

const SET = "leads";

export async function saveLead(input: z.infer<typeof leadSchema>) {
  const lead: Lead = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  await kvSet(`lead:${lead.id}`, JSON.stringify(lead));
  await kvSAdd(SET, lead.id);
  return lead;
}

export async function listLeads(): Promise<Lead[]> {
  const ids = await kvSMembers(SET);
  const leads = await Promise.all(ids.map((id) => kvGet(`lead:${id}`)));
  return leads
    .filter((raw): raw is string => Boolean(raw))
    .map((raw) => JSON.parse(raw) as Lead)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Senha de admin (a mesma do Bling) — comparação em tempo constante. */
export function isAdmin(key: string | null) {
  if (!key || BLING_ADMIN_KEY.length < 16 || key.length !== BLING_ADMIN_KEY.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(BLING_ADMIN_KEY));
}

/** Planilha: data, tipo e uma coluna por campo. */
export function leadsCsv(leads: Lead[]) {
  const columns = [...new Set(leads.flatMap((l) => Object.keys(l.fields)))];
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    ["recebido em", "motivo", ...columns].map(cell).join(";"),
    ...leads.map((l) =>
      [
        new Date(l.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        l.form,
        ...columns.map((c) => l.fields[c] ?? ""),
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  // BOM: o Excel abre com acento certo.
  return "﻿" + rows.join("\n");
}
