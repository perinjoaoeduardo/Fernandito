// Bateria da cadeia depois do pago: Bling → nota → etiqueta (Melhor Envio) →
// rastreio → postado → entregue. Ver LANCAMENTO.md → "Testar a loja".
import { createHmac, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import http from "node:http";
// Serviço de e-mail de mentira (no lugar do Resend), porta 3996.
const mails = [];
http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    mails.push(JSON.parse(raw));
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"id":"x"}');
  })
  .listen(3996);
const B = "http://localhost:3160",
  MP = "http://localhost:3999",
  BL = "http://localhost:3998",
  ME = "http://localhost:3997";
const KEY = "chave-admin-local-0123456789",
  SECRET = "segredo-de-teste-local",
  ME_SECRET = "segredo-me-local";
let ip = 1;
const H = () => ({ "content-type": "application/json", "x-real-ip": `10.1.0.${ip++}` });
const ctl = (u, b = {}) =>
  fetch(u + "/_ctl", { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${name} ${extra}`);
};
const diag = (c) =>
  fetch(`${B}/api/loja/diagnostico?key=${KEY}${c ? "&conferir=1" : ""}`).then((r) => r.json());
const envio = async (id, c) => (await diag(c)).envios.find((e) => e.id === id);

async function buy({
  local = false,
  ship = { id: "me-3", priceCents: 2590, source: "melhor-envio" },
  note,
} = {}) {
  const b = {
    items: [{ sku: "FERN-KIT-PRE", qty: 1, unitPriceCents: 8990 }],
    customer: {
      name: "Bruna Lima",
      email: "b@example.com",
      phone: "51999990000",
      cpf: "52998224725",
    },
    address: local
      ? {
          cep: "90430131",
          street: "Rua X",
          number: "10",
          complement: "",
          neighborhood: "Rio Branco",
          city: "Porto Alegre",
          uf: "RS",
        }
      : {
          cep: "01001000",
          street: "Praça da Sé",
          number: "1",
          complement: "",
          neighborhood: "Sé",
          city: "São Paulo",
          uf: "SP",
        },
    shipping: local
      ? {
          id: "local-poa",
          service: "x",
          carrier: "y",
          priceCents: 500,
          days: { min: 1, max: 2 },
          source: "local",
        }
      : { service: "x", carrier: "Jadlog", days: { min: 1, max: 5 }, ...ship },
    subtotalCents: 8990,
    totalCents: 0,
    ageConfirmed: true,
    ageConfirmedAt: new Date().toISOString(),
    marketingOptIn: false,
    ...(note ? { note } : {}),
  };
  b.totalCents = 8990 + b.shipping.priceCents;
  const r = await fetch(B + "/api/checkout/pix", {
    method: "POST",
    headers: { ...H(), "x-idempotency-key": randomUUID() },
    body: JSON.stringify(b),
  });
  const j = await r.json();
  if (r.status !== 201) throw new Error(JSON.stringify(j));
  const id = j.order.id;
  const pay = (await ctl(MP)).pays.find((p) => p.ext === id);
  await ctl(MP, { set: { id: pay.id, status: "approved" } });
  const ts = String(Date.now()),
    rid = randomUUID();
  const v1 = createHmac("sha256", SECRET)
    .update(`id:${String(pay.id).toLowerCase()};request-id:${rid};ts:${ts};`)
    .digest("hex");
  await fetch(
    `${B}/api/webhooks/mercadopago?data.id=${pay.id}&type=${String(pay.id).startsWith("ORD") ? "order" : "payment"}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": `ts=${ts},v1=${v1}`,
        "x-request-id": rid,
      },
      body: "{}",
    },
  );
  return id;
}
async function until(id, stages, ms = 30000) {
  const t = Date.now();
  let e;
  while (Date.now() - t < ms) {
    e = await envio(id);
    if (e && (stages.includes(e.etapa) || e.erro)) return e;
    await sleep(1000);
  }
  return e;
}
function meWebhook(body, bad = false) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", bad ? "errado" : ME_SECRET)
    .update(raw)
    .digest("base64");
  return fetch(`${B}/api/melhorenvio/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-me-signature": sig },
    body: raw,
  });
}

// C1 caminho normal (fora de POA, frete do Melhor Envio), com recado
const RECADO = "É presente pro Nando!\nEscreve: feliz aniversário <3";
const c1 = await buy({ note: RECADO });
{
  const e = await until(c1, ["ready"]);
  check("C1 pago → nota emitida e AUTORIZADA sozinha", Boolean(e?.nota), JSON.stringify(e));
  check(
    "C1 → etiqueta comprada com o saldo e gerada, com rastreio",
    e?.etapa === "ready" && /^JAD/.test(e?.rastreio ?? ""),
    JSON.stringify(e),
  );
  check("C1 → PDF da etiqueta no painel", Boolean(e?.etiquetaPdf));
  const me = await ctl(ME);
  check(
    "C1 → uma compra só (carrinho 1, pagamento 1, geração 1)",
    me.calls.cart === 1 && me.calls.checkout === 1 && me.calls.generate === 1,
    JSON.stringify(me.calls),
  );
  const bl = await ctl(BL);
  const sale = bl.sales.find((s) => s.numeroLoja === c1);
  check(
    "C1 → recado nas observações internas do Bling (não nas da nota)",
    sale?.observacoesInternas?.includes(RECADO) && !sale?.observacoes?.includes("Nando"),
    JSON.stringify({ i: sale?.observacoesInternas, o: sale?.observacoes }),
  );
  const csv = await (await fetch(`${B}/api/loja/pedidos?key=${KEY}`)).text();
  check("C1 → recado na planilha", csv.includes("É presente pro Nando!"));
  check(
    "C1 → rastreio gravado no pedido do Bling",
    sale?.transporte?.volumes?.[0]?.codigoRastreamento === e?.rastreio,
    JSON.stringify(sale?.transporte?.volumes),
  );
  check(
    "C1 → nota enviada à Sefaz uma vez",
    bl.nfes.find((n) => n.id === sale.notaFiscal.id)?.sent === 1,
  );
  const html = await fetch(`${B}/pedido/${c1}/confirmado`).then((r) => r.text());
  check(
    "C1 → página do pedido mostra nota e rastreio",
    html.includes("Rastreio JAD") && html.includes("Etiqueta pronta") && html.includes("Nota nº"),
  );
  const ship = (await ctl(ME)).orders.find((o) => o.tags.some((t) => t.tag === c1));
  check("C1 → etiqueta com a chave da nota e o serviço escolhido (Jadlog 3)", ship?.service === 3);
}
// C2 repetir tudo não compra de novo (nem se o site "esquecer" o envio)
{
  await diag(true);
  await diag(true);
  const me = await ctl(ME);
  check(
    "C2 conferir 2x de novo → nenhuma compra a mais",
    me.calls.cart === 1 && me.calls.checkout === 1,
    JSON.stringify(me.calls),
  );
}
// C3 aviso do Melhor Envio: postado → entregue
{
  const ship = (await ctl(ME)).orders.find((o) => o.tags.some((t) => t.tag === c1));
  const bad = await meWebhook(
    { event: "order.posted", data: { id: ship.id, tags: [{ tag: c1 }] } },
    true,
  );
  check("C3 aviso falso do Melhor Envio → recusado (401)", bad.status === 401);
  await ctl(ME, { set: { id: ship.id, status: "posted" } });
  await meWebhook({ event: "order.posted", data: { id: ship.id, tags: [{ tag: c1 }] } });
  await sleep(1500);
  check("C3 aviso 'postado' → página mostra postado", (await envio(c1))?.etapa === "posted");
  await ctl(ME, { set: { id: ship.id, status: "delivered" } });
  await meWebhook({ event: "order.delivered", data: { id: ship.id, tags: [{ tag: c1 }] } });
  await sleep(1500);
  const d = await diag();
  check("C3 aviso 'entregue' → entregue e sai da fila", !d.envios.some((e) => e.id === c1));
  const html = await fetch(`${B}/pedido/${c1}/confirmado`).then((r) => r.text());
  check(
    "C3 página mostra 'Entregue' concluído",
    html.includes('Entregue<span class="sr-only"> (feito)'),
  );
}
// C4 sem saldo no Melhor Envio
{
  await ctl(ME, { flags: { noBalance: true } });
  const id = await buy();
  const e = await until(id, ["ready"]);
  check("C4 sem saldo → para com o motivo claro", /saldo/i.test(e?.erro ?? ""), JSON.stringify(e));
  check(
    "C4 → alerta no painel",
    (await diag()).alertas.some((a) => a.orderId === id && /saldo/i.test(a.problem)),
  );
  await ctl(ME, { flags: { noBalance: false } });
  await diag(true);
  const e2 = await envio(id);
  const me = await ctl(ME);
  check(
    "C4 colocou saldo → etiqueta sai sozinha, sem carrinho duplicado",
    e2?.etapa === "ready" && me.orders.filter((o) => o.tags.some((t) => t.tag === id)).length === 1,
    JSON.stringify(e2),
  );
}
// C5 nota rejeitada
{
  await ctl(BL, { flags: { nfeReject: true } });
  const id = await buy();
  const e = await until(id, ["ready"]);
  check(
    "C5 nota rejeitada → para, com alerta, e NÃO compra etiqueta",
    /rejeitada/.test(e?.erro ?? "") &&
      !(await ctl(ME)).orders.some((o) => o.tags.some((t) => t.tag === id)),
    JSON.stringify(e),
  );
  await ctl(BL, { flags: { nfeReject: false } });
}
// C6 Sefaz demorando
{
  await ctl(BL, { flags: { nfeStuck: true } });
  const id = await buy();
  await sleep(6000);
  const e = await envio(id);
  check(
    "C6 Sefaz demorando → espera sem erro",
    e?.etapa === "invoice" && !e?.erro,
    JSON.stringify(e),
  );
  await ctl(BL, { flags: { nfeStuck: false } });
  await diag(true);
  check("C6 Sefaz respondeu → segue sozinho até a etiqueta", (await envio(id))?.etapa === "ready");
}
// C7 Porto Alegre (entrega própria)
{
  const before = (await ctl(ME)).calls.cart;
  const id = await buy({ local: true });
  const e = await until(id, ["local"]);
  check(
    "C7 POA → nota emitida e 'saiu pra entrega', sem etiqueta",
    e?.etapa === "local" && (await ctl(ME)).calls.cart === before,
    JSON.stringify(e),
  );
  // Mesmo com o pedido "Atendido" no Bling, só vira entregue quando marcam.
  const sale = (await ctl(BL)).sales.find((s) => s.numeroLoja === id);
  await ctl(BL, { atender: sale.id });
  await diag(true);
  check(
    "C7 'Atendido' no Bling sozinho NÃO conta como entregue",
    (await diag()).envios.some((x) => x.id === id && x.etapa === "local"),
  );
  await fetch(`${B}/api/loja/confirmar?key=${KEY}&pedido=${id}&acao=entregue`);
  check(
    "C7 marcou entregue (painel/link) → sai da fila",
    !(await diag()).envios.some((x) => x.id === id),
  );
}
// C8 frete da tabela (Melhor Envio estava fora na compra)
{
  const id = await buy({ ship: { id: "tabela-sudeste", priceCents: 2000, source: "tabela" } });
  const e = await until(id, ["ready"]);
  const ship = (await ctl(ME)).orders.find((o) => o.tags.some((t) => t.tag === id));
  check(
    "C8 frete de último recurso → compra a Jadlog mais barata na hora",
    e?.etapa === "ready" && ship?.service === 3,
    JSON.stringify(e),
  );
}
// C10 o site perde a memória do envio (ex.: caiu no meio) → acha pela tag, não compra de novo
{
  const id = (await diag()).envios.find((e) => e.etapa === "ready")?.id;
  const before = (await ctl(ME)).calls;
  execSync(`redis-cli -p ${process.env.REDIS_PORT ?? 6390} del fulfill:${id}`);
  await diag(true);
  const after = (await ctl(ME)).calls;
  const e = await envio(id);
  check(
    "C10 perdeu o estado → reencontra a etiqueta pela tag, sem pagar de novo",
    e?.etapa === "ready" && after.cart === before.cart && after.checkout === before.checkout,
    `${JSON.stringify(before)}→${JSON.stringify(after)} ${JSON.stringify(e)}`,
  );
}
// C11 token do Melhor Envio perto de vencer → renova sozinho e passa a usar o novo
{
  execSync(
    `redis-cli -p ${process.env.REDIS_PORT ?? 6390} set me:tokens '${JSON.stringify({ accessToken: "velho", refreshToken: "r1", expiresAt: Date.now() + 86400000 })}'`,
  );
  await fetch(`${B}/api/frete`, {
    method: "POST",
    headers: H(),
    body: JSON.stringify({
      cep: "01001-000",
      items: [
        { qty: 1, weightKg: 1.3, widthCm: 19, heightCm: 6.5, lengthCm: 19, priceCents: 8990 },
      ],
    }),
  });
  const saved = JSON.parse(
    execSync(`redis-cli -p ${process.env.REDIS_PORT ?? 6390} get me:tokens`).toString(),
  );
  const me = await ctl(ME);
  check(
    "C11 token perto de vencer → renovado sozinho e já usado",
    saved.accessToken.startsWith("novo-") &&
      saved.expiresAt > Date.now() + 20 * 86400000 &&
      me.calls.lastAuth === `Bearer ${saved.accessToken}`,
    JSON.stringify({ saved: saved.accessToken, auth: me.calls.lastAuth }),
  );
}
// C12 e-mails: cliente e equipe na compra; alerta pra equipe
{
  const toClient = mails.filter(
    (m) =>
      m.to.includes("b@example.com") && m.subject.includes(c1) && /confirmado/i.test(m.subject),
  );
  const posted = mails.filter(
    (m) => m.to.includes("b@example.com") && m.subject.includes(c1) && /postado/i.test(m.subject),
  );
  const toTeam = mails.filter(
    (m) => m.to.includes("equipe@fernandito.test") && m.subject.includes(c1),
  );
  check(
    "C12 cliente recebe 'Pedido confirmado' com o link do pedido (1 vez)",
    toClient.length === 1 && toClient[0].html.includes(`/pedido/${c1}/confirmado`),
    `${toClient.length}`,
  );
  check(
    "C12 cliente recebe 'Teu pedido foi postado' com o rastreio (1 vez)",
    posted.length === 1 && /JAD\d+/.test(posted[0].html),
    `${posted.length}`,
  );
  check("C12 equipe recebe 'Compra nova' (1 vez)", toTeam.length === 1);
  check(
    "C12 equipe recebe e-mail de alerta (ex.: sem saldo)",
    mails.some((m) => m.to.includes("equipe@fernandito.test") && /saldo/i.test(m.subject)),
  );
}
// C9 planilha mostra nota e rastreio
{
  const csv = await fetch(`${B}/api/loja/pedidos?key=${KEY}`).then((r) => r.text());
  check("C9 planilha tem nota, etapa e rastreio", csv.includes(`"${c1}"`) && /JAD\d+/.test(csv));
}

console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
process.exit(0);
