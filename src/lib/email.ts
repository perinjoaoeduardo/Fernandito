import "server-only";
import { formatBRL } from "@/lib/money";
import type { StoredOrder } from "@/lib/store/orders";

/**
 * E-mails do site (Resend, https://resend.com). Desligado até ter:
 * - `RESEND_API_KEY` (Resend → API Keys) e o domínio fernandito.com.br
 *   verificado lá (registros DNS que o Resend mostra);
 * - `EMAIL_FROM` (ex.: "Fernandito <contato@fernandito.com.br>");
 * - `EMAIL_EQUIPE` (quem recebe "compra nova" e os alertas; vírgula separa;
 *   sem ela, contato@fernandito.com.br).
 * Sem isso, nada é enviado e nada trava. Nunca lança.
 */

const KEY = process.env.RESEND_API_KEY?.trim() || "";
const FROM = process.env.EMAIL_FROM?.trim() || "Fernandito <contato@fernandito.com.br>";
const TEAM = (process.env.EMAIL_EQUIPE?.trim() || "contato@fernandito.com.br")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const API = process.env.RESEND_API_URL?.trim() || "https://api.resend.com";
const SITE = "https://fernandito.com.br";

export const EMAIL_ENABLED = Boolean(KEY);

async function send(to: string[], subject: string, html: string) {
  if (!KEY || !to.length) return false;
  try {
    const response = await fetch(`${API}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
    return true;
  } catch (error) {
    console.error(`[e-mail] "${subject}" não saiu:`, (error as Error).message);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#E6E6CB;font-family:Courier New,monospace;color:#243022">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 8px">Fernandito</p>
<h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.1;margin:0 0 16px">${title}</h1>
${body}
<p style="font-size:12px;opacity:.7;margin-top:32px">FERNANDITO BEBIDAS LTDA · CNPJ 69.252.946/0001-41 · Porto Alegre/RS<br>Beba com moderação. Venda proibida para menores de 18 anos.</p>
</div></body></html>`;
}

function itemsTable(order: StoredOrder) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.qty}× ${esc(i.name)}</td><td style="text-align:right">${formatBRL(i.unitPriceCents * i.qty)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
<tr><td style="padding:6px 0">Frete (${esc(order.shipping.service)})</td><td style="text-align:right">${formatBRL(order.shipping.priceCents)}</td></tr>
<tr><td style="padding:10px 0;border-top:1px solid #24302233"><b>Total</b></td><td style="text-align:right;border-top:1px solid #24302233"><b>${formatBRL(order.totalCents)}</b></td></tr></table>`;
}

/** Teste do check-up (`&email=1`): manda um e-mail pra equipe e devolve o
 * resultado do Resend, com o erro em texto se não sair. */
export async function sendTestEmail(): Promise<{ ok: boolean; detail: string }> {
  if (!KEY) return { ok: false, detail: "sem RESEND_API_KEY" };
  try {
    const response = await fetch(`${API}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: TEAM,
        subject: "Teste do site: e-mail funcionando",
        html: layout(
          "E-mail funcionando",
          `<p style="font-size:14px">Se chegou, os e-mails do site saem de ${esc(FROM)}.</p>`,
        ),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      return {
        ok: false,
        detail: `Resend ${response.status}: ${(await response.text()).slice(0, 160)}`,
      };
    return { ok: true, detail: `enviado de ${FROM} pra ${TEAM.join(", ")}` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

/** Pro cliente, quando o pagamento é confirmado. */
export function sendOrderConfirmed(order: StoredOrder) {
  const link = `${SITE}/pedido/${order.id}/confirmado`;
  const first = esc(order.customer.name.split(/\s+/)[0] ?? "");
  return send(
    [order.customer.email],
    `Pedido confirmado! #${order.id}`,
    layout(
      "Pedido confirmado! Toma Fernandito.",
      `<p style="font-size:15px;line-height:1.6">Valeu, ${first}! O pagamento chegou e o teu pedido <b>#${esc(order.id)}</b> já está na fila de envio.</p>
${itemsTable(order)}
<p style="margin:24px 0"><a href="${link}" style="background:#243022;color:#E6E6CB;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Acompanhar o pedido</a></p>
<p style="font-size:13px;line-height:1.6;opacity:.85">A nota fiscal chega por e-mail assim que for emitida, e o código de rastreio quando a etiqueta sair. Qualquer coisa, responde este e-mail ou chama no WhatsApp com o número do pedido.</p>`,
    ),
  );
}

/** Pra equipe, a cada compra paga. */
export function sendNewOrderToTeam(order: StoredOrder) {
  return send(
    TEAM,
    `Compra nova: ${formatBRL(order.totalCents)} · ${order.address.city}/${order.address.uf} · #${order.id}`,
    layout(
      "Compra nova",
      `<p style="font-size:14px;line-height:1.6"><b>${esc(order.customer.name)}</b> · ${esc(order.address.city)}/${esc(order.address.uf)}<br>${order.manualPix ? "Pix MANUAL (confirmado no painel)" : "Pix Mercado Pago"}</p>
${itemsTable(order)}
<p style="font-size:13px">A nota e a etiqueta seguem sozinhas. Painel: ${SITE}/api/loja/diagnostico</p>`,
    ),
  );
}

/** Pra equipe, quando algo precisa de olho humano. */
export function sendAlertToTeam(orderId: string, problem: string) {
  return send(
    TEAM,
    `⚠️ Loja: ${problem.slice(0, 80)}`,
    layout(
      "Precisa de atenção",
      `<p style="font-size:14px;line-height:1.6">Pedido <b>#${esc(orderId)}</b>: ${esc(problem)}</p><p style="font-size:13px">Painel: ${SITE}/api/loja/diagnostico</p>`,
    ),
  );
}
