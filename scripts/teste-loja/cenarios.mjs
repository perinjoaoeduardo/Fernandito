// Bateria de cenários da compra (ver LANCAMENTO.md → "Testar a loja").
import { createHmac, randomUUID } from "node:crypto";
const B = "http://localhost:3160",
  MP = "http://localhost:3999",
  KEY = "chave-admin-local-0123456789",
  SECRET = "segredo-de-teste-local";
let ip = 1;
const H = () => ({ "content-type": "application/json", "x-real-ip": `10.0.0.${ip++}` });
const ctl = (b) =>
  fetch(MP + "/_ctl", { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name} ${extra}`);
};
const body = () => ({
  items: [{ sku: "FERN-KIT-PRE", qty: 1, unitPriceCents: 10000 }],
  customer: {
    name: "Teste Silva",
    email: "teste@example.com",
    phone: "51999999999",
    cpf: "52998224725",
  },
  address: {
    cep: "01001000",
    street: "Rua A",
    number: "1",
    complement: "",
    neighborhood: "Centro",
    city: "São Paulo",
    uf: "SP",
  },
  shipping: null,
  subtotalCents: 10000,
  totalCents: 0,
  ageConfirmed: true,
  ageConfirmedAt: new Date().toISOString(),
  marketingOptIn: false,
});
// discover table shipping for SP via server error-free path: build it like the site does
async function order(opts = {}) {
  const b = body();
  b.shipping = opts.shipping ?? {
    id: "tabela-sudeste",
    service: "x",
    carrier: "Envio padrão",
    priceCents: opts.ship ?? 0,
    days: { min: 1, max: 5 },
    source: "tabela",
  };
  b.totalCents = b.subtotalCents + b.shipping.priceCents;
  const r = await fetch(B + "/api/checkout/pix", {
    method: "POST",
    headers: { ...H(), "x-idempotency-key": opts.key ?? randomUUID() },
    body: JSON.stringify(b),
  });
  return { code: r.status, data: await r.json() };
}
const status = (id) =>
  fetch(`${B}/api/orders/${id}/status`, { headers: H() }).then((r) => r.json());
const diag = (conf) =>
  fetch(`${B}/api/loja/diagnostico?key=${KEY}${conf ? "&conferir=1" : ""}`).then((r) => r.json());
const payIdOf = async (orderId) => (await ctl({})).pays.find((p) => p.ext === orderId)?.id;
function webhook(dataId, { bad = false } = {}) {
  const ts = String(Date.now()),
    rid = randomUUID();
  const v1 = createHmac("sha256", bad ? "errada" : SECRET)
    .update(`id:${dataId};request-id:${rid};ts:${ts};`)
    .digest("hex");
  return fetch(`${B}/api/webhooks/mercadopago?data.id=${dataId}&type=payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": rid,
    },
    body: JSON.stringify({ type: "payment", data: { id: dataId } }),
  });
}

const SHIP = 2000; // frete de último recurso (tabela)
const mk = (o = {}) => order({ ship: SHIP, ...o });
const approve = async (orderId, extra = {}) =>
  ctl({ set: { id: await payIdOf(orderId), status: "approved", ...extra } });

// S1 normal + webhook
{
  const r = await mk();
  const id = r.data.order?.id;
  check("S1 cria pedido + Pix", r.code === 201 && r.data.order.status === "pending");
  const pid = await payIdOf(id);
  await approve(id);
  const w = await webhook(pid);
  check("S1 webhook válido aceito", w.status === 200);
  const s = await status(id);
  check("S1 pedido vira PAGO", s.status === "paid", JSON.stringify(s));
  const d = await diag();
  check(
    "S1 pago entra na fila do Bling (Bling desligado aqui)",
    d.filaBling.some((o) => o.id === id && o.status === "paid"),
    JSON.stringify(d.filaBling.find((o) => o.id === id)),
  );
  check("S1 sai da lista de Pix abertos", !d.pixAbertos.some((o) => o.id === id));
}
// S2 bad signature
{
  const r = await mk();
  const id = r.data.order.id;
  const pid = await payIdOf(id);
  await approve(id);
  const w = await webhook(pid, { bad: true });
  check("S2 webhook com assinatura falsa recusado (401)", w.status === 401);
  const d = await diag();
  check(
    "S2 continua aberto (não confia no webhook falso)",
    d.pixAbertos.some((o) => o.id === id && o.status === "pending"),
  );
}
// S3 closed tab — no polling, no webhook → background check
{
  const r = await mk();
  const id = r.data.order.id;
  await approve(id);
  const d = await diag(true);
  const o = (await diag()).filaBling.find((x) => x.id === id);
  check(
    "S3 pessoa fechou a tela e sem webhook → conferência acha o pagamento",
    o?.status === "paid",
    JSON.stringify(d.conferencia?.pix),
  );
}
// S4/S12 race: webhook duplicado + polling ao mesmo tempo
{
  const r = await mk();
  const id = r.data.order.id;
  const pid = await payIdOf(id);
  await approve(id);
  await Promise.all(
    [...Array(5)].map(() => webhook(pid)).concat([...Array(10)].map(() => status(id))),
  );
  await Promise.all([...Array(5)].map(() => status(id)));
  const s = await status(id);
  const d = await diag();
  check("S4 webhooks repetidos + polling junto → continua PAGO", s.status === "paid");
  check("S4 uma entrada só na fila", d.filaBling.filter((o) => o.id === id).length === 1);
}
// S5 amount mismatch
{
  const r = await mk();
  const id = r.data.order.id;
  const pid = await payIdOf(id);
  await approve(id, { amount: 1 });
  await webhook(pid);
  const s = await status(id);
  const d = await diag();
  check("S5 valor pago diferente → NÃO marca pago", s.status === "pending");
  check(
    "S5 gera alerta",
    d.alertas.some((a) => a.orderId === id),
    JSON.stringify(d.alertas.find((a) => a.orderId === id)),
  );
}
// S6 MP falha uma vez → o site tenta de novo sozinho
{
  await ctl({ flags: { failCreate: 1 } });
  const a = await mk();
  check(
    "S6 Mercado Pago falha 1x → segunda tentativa automática gera o Pix",
    a.code === 201 && a.data.order.status === "pending",
    JSON.stringify(a.data).slice(0, 80),
  );
}
// S7 idempotência
{
  const key = randomUUID();
  const [a, b] = await Promise.all([mk({ key }), mk({ key })]);
  const c = await mk({ key });
  const ids = [a, b, c].map((x) => x.data.order?.id).filter(Boolean);
  const pays = (await ctl({})).pays.filter((p) => ids.includes(p.ext));
  check(
    "S7 clique duplo → um pedido e um Pix só",
    new Set(ids).size === 1 && pays.length === 1,
    `${[a.code, b.code, c.code]} ids=${ids}`,
  );
}
// S8 expira com MP fora → não marca expirado; depois confirma
{
  await ctl({ flags: { expireSeconds: 3 } });
  const r = await mk();
  await ctl({ flags: { expireSeconds: null } });
  const id = r.data.order.id;
  await ctl({ flags: { failGet: true } });
  await sleep(4000);
  const s1 = await status(id);
  check(
    "S8 venceu mas MP fora → fica 'conferindo', não 'expirado'",
    s1.status === "pending",
    JSON.stringify(s1),
  );
  await ctl({ flags: { failGet: false } });
  await approve(id);
  const s2 = await status(id);
  check("S8 MP volta e estava pago → PAGO", s2.status === "paid", JSON.stringify(s2));
}
// S9 expira normal → novo Pix
{
  await ctl({ flags: { expireSeconds: 2 } });
  const r = await mk();
  await ctl({ flags: { expireSeconds: null } });
  const id = r.data.order.id;
  await sleep(3000);
  const s = await status(id);
  check("S9 Pix vence → expirado", s.status === "expired", JSON.stringify(s));
  const n = await fetch(`${B}/api/orders/${id}/renew`, { method: "POST", headers: H() });
  const nd = await n.json();
  check(
    "S9 gerar novo Pix → pedido novo",
    n.status === 201 && nd.id && nd.id !== id,
    JSON.stringify(nd),
  );
}
// S10 expirado na tela mas pago no fim → renovar NÃO cobra de novo
{
  await ctl({ flags: { expireSeconds: 2 } });
  const r = await mk();
  await ctl({ flags: { expireSeconds: null } });
  const id = r.data.order.id;
  await sleep(3000);
  await status(id);
  await approve(id);
  const before = (await ctl({})).pays.length;
  const n = await fetch(`${B}/api/orders/${id}/renew`, { method: "POST", headers: H() });
  const nd = await n.json();
  const after = (await ctl({})).pays.length;
  check(
    "S10 pagou no último segundo → 'novo Pix' devolve PAGO, sem cobrar 2x",
    nd.status === "paid" && before === after,
    JSON.stringify(nd),
  );
  const d = await diag();
  check(
    "S10 alerta pra conferir",
    d.alertas.some((a) => a.orderId === id),
  );
}
// S11 Melhor Envio fora na hora de pagar
{
  const r = await order({
    shipping: {
      id: "me-1",
      service: "PAC",
      carrier: "Jadlog",
      priceCents: 3000,
      days: { min: 1, max: 5 },
      source: "melhor-envio",
    },
  });
  check(
    "S11 Melhor Envio fora → pede pra escolher o frete de novo (não trava)",
    r.code === 409 && r.data.code === "shipping",
    JSON.stringify(r.data),
  );
}
// S12 preço adulterado no navegador
{
  const b = body();
  b.items[0].unitPriceCents = 1;
  b.subtotalCents = 1;
  b.shipping = {
    id: "tabela-sudeste",
    service: "x",
    carrier: "y",
    priceCents: SHIP,
    days: { min: 1, max: 5 },
    source: "tabela",
  };
  b.totalCents = 1 + SHIP;
  const r = await fetch(B + "/api/checkout/pix", {
    method: "POST",
    headers: { ...H(), "x-idempotency-key": randomUUID() },
    body: JSON.stringify(b),
  });
  check("S12 preço adulterado no navegador → recusado", r.status === 409);
}
// S13 diag sem chave
{
  const r = await fetch(`${B}/api/loja/diagnostico?key=errada`);
  check("S13 painel sem a chave → 404", r.status === 404);
}

// S14 planilha de pedidos (registro que não depende do Bling)
{
  const r = await mk();
  const id = r.data.order.id;
  const pid = await payIdOf(id);
  await approve(id);
  await webhook(pid);
  const csv = await fetch(`${B}/api/loja/pedidos?key=${KEY}`).then((x) => x.text());
  const line = csv.split("\n").find((l) => l.startsWith(`"${id}"`)) ?? "";
  check(
    "S14 pedido pago aparece na planilha com nome, CPF e endereço",
    line.includes("PAGO") &&
      line.includes("Teste Silva") &&
      line.includes("52998224725") &&
      line.includes("Rua A"),
    line.slice(0, 120),
  );
  check("S14 planilha mostra que não entrou no Bling", line.includes("NÃO ENTROU"));
  const noKey = await fetch(`${B}/api/loja/pedidos?key=errada`);
  check("S14 planilha sem a chave → 404", noKey.status === 404);
}

// S15 Mercado Pago fora de vez → plano B (Pix na chave da conta)
{
  await ctl({ flags: { failCreate: 2 } });
  const a = await mk();
  const id = a.data.order?.id;
  check(
    "S15 Mercado Pago fora → pedido guardado como Pix MANUAL",
    a.code === 201 && a.data.order.status === "manual",
    JSON.stringify(a.data).slice(0, 100),
  );
  const d = await diag();
  check(
    "S15 aparece no painel em pixManual",
    d.pixManual.some((o) => o.id === id),
  );
  const csv = await fetch(`${B}/api/loja/pedidos?key=${KEY}`).then((x) => x.text());
  check("S15 aparece na planilha como PIX MANUAL", csv.includes(`"${id}";"PIX MANUAL`));
  const c = await fetch(`${B}/api/loja/confirmar?key=${KEY}&pedido=${id}&acao=pago`).then((x) =>
    x.json(),
  );
  const s1 = await status(id);
  const d2 = await diag();
  check(
    "S15 confirmar no painel → PAGO e vai pra fila do Bling",
    c.ok && s1.status === "paid" && d2.filaBling.some((o) => o.id === id),
    JSON.stringify(c),
  );
  const again = await fetch(`${B}/api/loja/confirmar?key=${KEY}&pedido=${id}&acao=pago`);
  check("S15 confirmar 2x não faz nada de novo", again.status === 409);
}
// S16 Pix manual cancelado devolve o estoque
{
  await ctl({ flags: { failCreate: 2 } });
  const a = await mk();
  const id = a.data.order.id;
  const before = (await diag()).estoque["FERN-KIT-PRE"].livres;
  await fetch(`${B}/api/loja/confirmar?key=${KEY}&pedido=${id}&acao=cancelar`);
  const after = (await diag()).estoque["FERN-KIT-PRE"].livres;
  check("S16 cancelar Pix manual devolve a unidade", after === before + 1, `${before}→${after}`);
}
// S17 trava de estoque (teto do site): esgota, recusa, devolve quando o Pix vence
{
  const stockNow = async () => (await diag()).estoque["FERN-KIT-PRE"].livres;
  let left = await stockNow();
  let lastId = null;
  let guard = 0;
  while (left > 0 && guard++ < 200) {
    const qty = Math.min(5, left);
    if (left - qty === 0) await ctl({ flags: { expireSeconds: 3 } });
    const b = body();
    b.items[0].qty = qty;
    b.subtotalCents = 10000 * qty;
    b.shipping = {
      id: "tabela-sudeste",
      service: "x",
      carrier: "y",
      priceCents: SHIP,
      days: { min: 1, max: 5 },
      source: "tabela",
    };
    b.totalCents = b.subtotalCents + SHIP;
    const r = await fetch(B + "/api/checkout/pix", {
      method: "POST",
      headers: { ...H(), "x-idempotency-key": randomUUID() },
      body: JSON.stringify(b),
    });
    const j = await r.json();
    if (r.status !== 201) {
      console.log("parou:", r.status, j);
      break;
    }
    lastId = j.order.id;
    left = await stockNow();
  }
  await ctl({ flags: { expireSeconds: null } });
  check("S17 chega a 0 livres sem passar do teto", left === 0, `livres=${left}`);
  const over = await mk();
  check(
    "S17 depois de esgotar → recusa com 'esgotou'",
    over.code === 409 && over.data.code === "stock",
    JSON.stringify(over.data),
  );
  const est = await fetch(`${B}/api/estoque`).then((x) => x.json());
  check(
    "S17 /api/estoque avisa esgotado",
    est.soldOut === true || est.remaining === 0,
    JSON.stringify(est),
  );
  // duas pessoas ao mesmo tempo na última unidade
  await sleep(3500);
  await status(lastId);
  const freed = await stockNow();
  check("S17 Pix vencido devolve as unidades", freed > 0, `livres=${freed}`);
  const racers = await Promise.all(
    [...Array(6)].map(() => {
      const b = body();
      b.items[0].qty = freed;
      b.subtotalCents = 10000 * freed;
      b.shipping = {
        id: "tabela-sudeste",
        service: "x",
        carrier: "y",
        priceCents: SHIP,
        days: { min: 1, max: 5 },
        source: "tabela",
      };
      b.totalCents = b.subtotalCents + SHIP;
      return fetch(B + "/api/checkout/pix", {
        method: "POST",
        headers: { ...H(), "x-idempotency-key": randomUUID() },
        body: JSON.stringify(b),
      }).then((r) => r.status);
    }),
  );
  check(
    "S17 6 pessoas na última leva ao mesmo tempo → só 1 consegue",
    racers.filter((c) => c === 201).length === 1 && (await stockNow()) === 0,
    JSON.stringify(racers),
  );
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} ok`);
