import "server-only";
import { EMAIL_SEAL_PNG } from "@/lib/email-assets";
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
 *
 * Visual: cores da marca e o selo (moeda) embutido (cid:, sem depender do
 * site no ar). Texto o mais curto possível. Fontes próprias não funcionam em e-mail: título em Georgia,
 * texto em Courier (o mais perto de Rampart / Special Elite). Tudo em tabela
 * e estilo inline, que é o que os programas de e-mail entendem.
 */

const KEY = process.env.RESEND_API_KEY?.trim() || "";
const FROM = process.env.EMAIL_FROM?.trim() || "Fernandito <contato@fernandito.com.br>";
const TEAM = (process.env.EMAIL_EQUIPE?.trim() || "contato@fernandito.com.br")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const API = process.env.RESEND_API_URL?.trim() || "https://api.resend.com";
const SITE = "https://fernandito.com.br";
const INSTAGRAM = "https://www.instagram.com/toma.fernandito/";
const WHATSAPP = "https://wa.me/555193383764";

export const EMAIL_ENABLED = Boolean(KEY);

const C = {
  escuro: "#243022",
  medio: "#405139",
  claro: "#6C7D4F",
  bege: "#E6E6CB",
  linha: "#24302226",
};
const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "'Courier New',Courier,monospace";

type Inline = "selo";
const INLINE: Record<Inline, { filename: string; content: string }> = {
  selo: { filename: "fernandito.png", content: EMAIL_SEAL_PNG },
};

async function post(body: Record<string, unknown>) {
  const response = await fetch(`${API}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

/** Manda com as imagens embutidas; se o Resend recusar os anexos, manda de
 * novo sem eles (o e-mail sai sem as imagens, mas sai). */
async function deliver(to: string[], subject: string, html: string) {
  const used = (Object.keys(INLINE) as Inline[]).filter((k) => html.includes(`cid:${k}`));
  const base = { from: FROM, to, subject, html };
  if (!used.length) return post(base);
  try {
    await post({
      ...base,
      attachments: used.map((k) => ({ ...INLINE[k], content_id: k })),
    });
  } catch (error) {
    if (!/Resend 4\d\d/.test((error as Error).message)) throw error;
    await post(base);
  }
}

async function send(to: string[], subject: string, html: string) {
  if (!KEY || !to.length) return false;
  try {
    await deliver(to, subject, html);
    return true;
  } catch (error) {
    console.error(`[e-mail] "${subject}" não saiu:`, (error as Error).message);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Botão (link com cara de botão). `ghost`: contorno, pro segundo botão. */
function button(href: string, label: string, ghost = false) {
  const style = ghost
    ? `border:2px solid ${C.escuro};color:${C.escuro};background:transparent`
    : `border:2px solid ${C.escuro};color:${C.bege};background:${C.escuro}`;
  return `<a href="${href}" style="display:inline-block;margin:0 8px 10px 0;${style};padding:12px 22px;border-radius:999px;font-family:${MONO};font-size:15px;font-weight:bold;text-decoration:none">${label}</a>`;
}

const STEPS = ["Pago", "Nota", "Etiqueta", "Postado", "Entregue"];

/** Linha do tempo do pedido (igual à página do pedido): `done` passos feitos. */
function timeline(done: number) {
  const cells = STEPS.map((label, i) => {
    const on = i < done;
    const dot = on
      ? `background:${C.escuro};border:2px solid ${C.escuro};color:${C.bege}`
      : `background:transparent;border:2px solid ${C.claro};color:${C.claro}`;
    return `<td align="center" style="width:20%;padding:0 2px">
<div style="width:26px;height:26px;line-height:26px;border-radius:50%;${dot};font-family:${MONO};font-size:13px;font-weight:bold;margin:0 auto">${on ? "✓" : i + 1}</div>
<div style="font-family:${MONO};font-size:11px;letter-spacing:.04em;margin-top:6px;color:${on ? C.escuro : C.claro}">${label}</div></td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr>${cells}</tr></table>`;
}

type LayoutOptions = { preheader?: string };

/** Moldura: faixa verde com o logo, (foto), título, conteúdo e rodapé da marca. */
function layout(title: string, body: string, { preheader = "" }: LayoutOptions = {}) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><style>a[x-apple-data-detectors],u + #body a{color:inherit!important;text-decoration:none!important}</style><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bege}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bege}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.bege}">
<tr><td align="left" style="background:${C.escuro};border-radius:20px 20px 0 0;padding:22px 26px">
<a href="${SITE}" style="text-decoration:none"><img src="cid:selo" width="96" height="97" alt="FERNANDITO" style="display:block;width:96px;height:97px;border:0;color:${C.bege};font-family:${SERIF};font-size:22px;font-weight:bold;letter-spacing:.12em"></a>
</td></tr>
<tr><td style="background:#F1F1DC;padding:30px 26px 10px;border-left:1px solid ${C.linha};border-right:1px solid ${C.linha}">
<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:27px;line-height:1.15;color:${C.escuro};text-transform:uppercase;letter-spacing:.03em">${title}</h1>
<div style="font-family:${MONO};color:${C.escuro}">${body}</div>
</td></tr>
<tr><td style="background:${C.medio};border-radius:0 0 20px 20px;padding:22px 26px;font-family:${MONO};color:${C.bege}">
<p style="margin:0 0 10px;font-family:${SERIF};font-size:16px;font-style:italic">Feito com brio. Porto Alegre, RS.</p>
<p style="margin:0 0 14px;font-size:13px"><a href="${INSTAGRAM}" style="color:${C.bege}">Instagram</a> &nbsp;·&nbsp; <a href="${WHATSAPP}" style="color:${C.bege}">WhatsApp</a> &nbsp;·&nbsp; <a href="${SITE}" style="color:${C.bege}">fernandito.com.br</a></p>
<p style="margin:0;font-size:11px;line-height:1.6;opacity:.8;color:${C.bege}">FERNANDITO BEBIDAS LTDA · CNPJ 69.252.946/0001&#8203;-41 · Rua&#8203; Castro&#8203; Alves, 433, Rio&#8203; Branco, Porto&#8203; Alegre/RS<br>Beba com moderação. Venda proibida para menores de 18 anos.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string, size = 15) =>
  `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.65">${html}</p>`;

function itemsTable(order: StoredOrder) {
  const row = (left: string, right: string, extra = "") =>
    `<tr><td style="padding:9px 0;font-size:14px;${extra}">${left}</td><td align="right" style="padding:9px 0;font-size:14px;white-space:nowrap;${extra}">${right}</td></tr>`;
  const rows = order.items
    .map((i) => row(`${i.qty}× ${esc(i.name)}`, formatBRL(i.unitPriceCents * i.qty)))
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;border-top:1px solid ${C.linha}">${rows}
${row(`Frete (${esc(order.shipping.service)})`, formatBRL(order.shipping.priceCents))}
${row("<b>Total</b>", `<b>${formatBRL(order.totalCents)}</b>`, `border-top:2px solid ${C.escuro};font-size:16px`)}</table>`;
}

/** Teste do check-up (`&email=1`): manda um e-mail pra equipe e devolve o
 * resultado do Resend, com o erro em texto se não sair. */
export async function sendTestEmail(): Promise<{ ok: boolean; detail: string }> {
  if (!KEY) return { ok: false, detail: "sem RESEND_API_KEY" };
  try {
    await deliver(
      TEAM,
      "Teste do site: e-mail funcionando",
      layout("E-mail funcionando", p(`Se chegou, os e-mails do site saem de ${esc(FROM)}.`, 14)),
    );
    return { ok: true, detail: `enviado de ${FROM} pra ${TEAM.join(", ")}` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message.slice(0, 200) };
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
      "Pedido confirmado.",
      `${p(`Valeu, ${first}! O pagamento chegou e o pedido <b>#${esc(order.id)}</b> já está na fila de envio.`)}
${timeline(1)}
${itemsTable(order)}
<p style="margin:0 0 18px">${button(link, "Acompanhar o pedido")}</p>`,
      { preheader: `Pedido #${order.id} pago.` },
    ),
  );
}

/** Pro cliente, uma vez, quando o pacote é postado (com o rastreio). */
export function sendOrderShipped(order: StoredOrder, tracking: string, trackingUrl: string | null) {
  const link = `${SITE}/pedido/${order.id}/confirmado`;
  const first = esc(order.customer.name.split(/\s+/)[0] ?? "");
  return send(
    [order.customer.email],
    `Teu pedido foi postado! #${order.id}`,
    layout(
      "Teu pedido foi postado.",
      `${p(`${first}, o teu Fernandito está a caminho de ${esc(order.address.city)}/${esc(order.address.uf)}.`)}
${timeline(4)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="border:2px dashed ${C.claro};border-radius:14px;padding:14px 16px">
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.medio}">Código de rastreio</div>
<div style="font-size:20px;font-weight:bold;letter-spacing:.06em;margin-top:4px">${esc(tracking)}</div></td></tr></table>
<p style="margin:0 0 18px">${trackingUrl ? button(trackingUrl, "Rastrear o pacote") : ""}${button(link, "Ver o pedido", Boolean(trackingUrl))}</p>`,
      { preheader: `Rastreio: ${tracking}` },
    ),
  );
}

/** Exemplos dos e-mails (check-up `&email=exemplos`), todos pro contato@,
 * com um pedido de mentira, pra conferir o visual. */
export async function sendSampleEmails() {
  const to = TEAM[0];
  if (!KEY || !to) return { ok: false, detail: "sem RESEND_API_KEY" };
  const order = {
    id: "EXEMPLO123",
    customer: { name: "Ana Souza", email: to },
    address: { city: "Pelotas", uf: "RS" },
    items: [{ name: "Kit Fernandito (pré-venda)", qty: 1, unitPriceCents: 8990 }],
    shipping: { service: "Jadlog .Package", priceCents: 2590 },
    totalCents: 11580,
    manualPix: null,
  } as unknown as StoredOrder;
  const results = await Promise.all([
    sendOrderConfirmed(order),
    sendOrderShipped(order, "JD123456789BR", "https://www.jadlog.com.br/"),
    sendNewOrderToTeam(order),
    sendAlertToTeam(order.id, "exemplo de alerta (sem saldo pra etiqueta)"),
  ]);
  const sent = results.filter(Boolean).length;
  return { ok: sent === 4, detail: `${sent} de 4 exemplos enviados pra ${to}` };
}

/** Pra equipe, a cada compra paga. */
export function sendNewOrderToTeam(order: StoredOrder) {
  return send(
    TEAM,
    `Compra nova: ${formatBRL(order.totalCents)} · ${order.address.city}/${order.address.uf} · #${order.id}`,
    layout(
      "Compra nova",
      `${p(`<b>${esc(order.customer.name)}</b> · ${esc(order.address.city)}/${esc(order.address.uf)}<br>${order.manualPix ? "Pix manual" : "Pix"}`, 14)}
${itemsTable(order)}
${p(`<a href="${SITE}/api/loja/diagnostico" style="color:${C.escuro}">Abrir o painel</a>`, 13)}`,
      { preheader: `${formatBRL(order.totalCents)} · #${order.id}` },
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
      `${p(`Pedido <b>#${esc(orderId)}</b>: ${esc(problem)}`, 14)}
${p(`<a href="${SITE}/api/loja/diagnostico" style="color:${C.escuro}">Abrir o painel</a>`, 13)}`,
      { preheader: problem.slice(0, 90) },
    ),
  );
}
