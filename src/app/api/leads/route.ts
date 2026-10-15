import { leadSchema, leadsCsv, listLeads, isAdmin, saveLead } from "@/lib/leads";
import { clientIp, json } from "@/lib/store/http";
import { rateLimit } from "@/lib/store/kv";

// Lead das portas (evento/negócio). O navegador manda com sendBeacon, logo
// antes de abrir o WhatsApp.
export async function POST(request: Request) {
  try {
    if (!(await rateLimit("lead", clientIp(request), 10, 60 * 10)))
      return json({ error: "Muitas tentativas" }, 429);
    const parsed = leadSchema.safeParse(JSON.parse(await request.text()));
    if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
    await saveLead(parsed.data);
    return json({ ok: true });
  } catch (error) {
    console.error("[leads]", (error as Error)?.message ?? error);
    return json({ error: "Não deu pra salvar" }, 500);
  }
}

// Exportar os leads: /api/leads?key=<BLING_ADMIN_KEY> → planilha CSV.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!isAdmin(key)) return json({ error: "Não autorizado" }, 401);
  const csv = leadsCsv(await listLeads());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads-fernandito.csv"',
      "Cache-Control": "no-store",
    },
  });
}
