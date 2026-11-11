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
  items = [{ sku: "FERN-KIT-PRE", qty: 1, unitPriceCents: 8990 }],
} = {}) {
  const sub = items.reduce((n, i) => n + i.qty * i.unitPriceCents, 0);
  const b = {
    items,
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
          priceCents: 499,
          days: { min: 1, max: 2 },
          source: "local",
        }
      : { service: "x", carrier: "Jadlog", days: { min: 1, max: 5 }, ...ship },
    subtotalCents: sub,
    totalCents: 0,
    ageConfirmed: true,
    ageConfirmedAt: new Date().toISOString(),
    marketingOptIn: false,
    ...(note ? { note } : {}),
  };
  b.totalCents = sub + b.shipping.priceCents;
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
  check(
    "C1 → etiqueta com a chave da nota e o serviço escolhido (Jadlog 3)",
    ship?.service?.id === 3,
  );
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
// C3b situação parada em "released" no Melhor Envio, mas com data de postagem
// e de entrega: vale a data (algumas transportadoras não andam a situação).
// Sem aviso: quem confere é a rodada da fila (conferir=1).
{
  const id = await buy();
  await until(id, ["ready", "local"]);
  const ship = (await ctl(ME)).orders.find((o) => o.tags.some((t) => t.tag === id));
  await ctl(ME, { set: { id: ship.id, status: "released", posted_at: "2026-11-05 10:00:00" } });
  await diag(true);
  check("C3b só a data de postagem → 'A caminho'", (await envio(id))?.etapa === "posted");
  await ctl(ME, { set: { id: ship.id, delivered_at: "2026-11-06 15:00:00" } });
  await diag(true);
  const d = await diag();
  check("C3b só a data de entrega → entregue e sai da fila", !d.envios.some((e) => e.id === id));
}
// C3c a ficha do envio segue "released" sem data, mas o rastreio ao vivo
// (transportadora) já tem a coleta/postagem → "A caminho".
{
  const id = await buy();
  await until(id, ["ready", "local"]);
  const ship = (await ctl(ME)).orders.find((o) => o.tags.some((t) => t.tag === id));
  await ctl(ME, {
    set: { id: ship.id, live: { status: "posted", posted_at: "2026-11-06 09:00:00" } },
  });
  await diag(true);
  check("C3c rastreio ao vivo com postagem → 'A caminho'", (await envio(id))?.etapa === "posted");
}
// C3d situação "received" (recebido no ponto de coleta, como a Loggi
// responde) → "A caminho".
{
  const id = await buy();
  await until(id, ["ready", "local"]);
  const ship = (await ctl(ME)).orders.find((o) => o.tags.some((t) => t.tag === id));
  await ctl(ME, { set: { id: ship.id, status: "received" } });
  await diag(true);
  check("C3d 'received' no Melhor Envio → 'A caminho'", (await envio(id))?.etapa === "posted");
}
// C3e erro velho gravado (ex.: tempo esgotado numa conferência antiga) some
// quando a conferência seguinte dá certo (pedido já postado).
{
  const id = await buy();
  await until(id, ["ready", "local"]);
  const ship = (await ctl(ME)).orders.find((o) => o.tags.some((t) => t.tag === id));
  await ctl(ME, { set: { id: ship.id, status: "posted" } });
  await diag(true);
  const port = process.env.REDIS_PORT ?? 6390;
  const raw = execSync(`redis-cli -p ${port} get fulfill:${id}`).toString().trim();
  const f = JSON.parse(raw);
  f.error = "The operation was aborted due to timeout";
  execSync(`redis-cli -p ${port} set fulfill:${id} '${JSON.stringify(f)}'`);
  check("C3e erro velho gravado aparece", (await envio(id))?.erro?.includes("aborted") === true);
  await diag(true);
  const after = await envio(id);
  check(
    "C3e conferiu ok → erro velho some",
    !after?.erro && after?.etapa === "posted",
    JSON.stringify(after?.erro),
  );
}
// C3f Mercado Pago recusa o e-mail do cliente ("payer.email must be a valid
// email") → o Pix sai mesmo assim (tenta de novo com o e-mail da Fernandito).
{
  await ctl(MP, { flags: { rejectEmail: true } });
  const ok = await buy().then(
    (id) => Boolean(id),
    () => false,
  );
  await ctl(MP, { flags: { rejectEmail: false } });
  check("C3f MP recusa o e-mail → Pix sai com o e-mail de reserva", ok);
}
// C3g envio fora do site (bonificação) comprado pelo link avulso entra na
// MESMA tabela e no MESMO número "Imprimir e postar" dos pedidos do site.
// Lido num navegador de verdade (o painel chega em partes, por streaming).
{
  const { createRequire } = await import("node:module");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const exp = String(Date.now() + 3600e3);
  const value = `${exp}.${createHmac("sha256", KEY).update(`painel-v2.${exp}`).digest("hex")}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "fernandito_painel", value, url: `${B}/painel` }]);
  const page = await ctx.newPage();
  const painel = async (q = "") => {
    await page.goto(`${B}/painel${q}`, { waitUntil: "networkidle" });
    return (await page.locator("main").innerText()).replace(/\s+/g, " ");
  };
  const imprimir = (t) => Number(t.match(/Imprimir e postar (\d+)/)?.[1] ?? -1);
  const antes = imprimir(await painel());
  const q = new URLSearchParams({
    key: KEY,
    acao: "comprar",
    servico: "me-3",
    nome: "Teste Bonificacao",
    rua: "Rua A",
    numero: "1",
    bairro: "Centro",
    cidade: "Campinas",
    uf: "SP",
    cep: "13025070",
    caixa: "24x14x16.5",
    kg: "2.5",
    valor: "94.99",
    item: "Six pack (bonificação)",
    nf: "43261169252946000141550010000009991456706230",
    ref: "bonif-teste",
  });
  const r = await fetch(`${B}/api/loja/etiqueta-avulsa?${q}`).then((x) => x.json());
  check("C3g etiqueta avulsa comprada", r.ok === true, JSON.stringify(r).slice(0, 120));
  const depois = imprimir(await painel());
  check(
    "C3g bonificação soma no 'Imprimir e postar' do topo",
    depois >= antes + 1,
    `${antes} → ${depois}`,
  );
  const filtro = await painel("?ver=imprimir");
  check(
    "C3g aparece no filtro Imprimir, com a tag Fora do site",
    filtro.includes("Teste Bonificacao") && filtro.includes("Fora do site · Bonificação"),
  );
  // C3h busca: filtra, apaga e volta; depois de um link que tira a busca
  // (período), a caixa limpa e buscar o mesmo nome de novo funciona.
  {
    const total = (t) => Number(t.match(/Pedidos · (\d+)/)?.[1] ?? -1);
    const lido = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const box = page.getByLabel("Buscar pedidos");
    await page.goto(`${B}/painel?ordem=cliente&dir=asc`, { waitUntil: "load" });
    await page
      .getByText(/Pedidos · \d+/)
      .first()
      .waitFor();
    await page.waitForTimeout(1500);
    const tudo = total(await lido());
    await box.fill("Teste Bonificacao");
    await page.waitForURL(/q=Teste/);
    await page.waitForTimeout(800);
    const um = total(await lido());
    check(
      "C3h busca filtra e mantém a ordem",
      um >= 1 && um < tudo && /ordem=cliente/.test(page.url()),
      `${tudo} → ${um} ${page.url()}`,
    );
    await box.fill("");
    await page.waitForURL((u) => !u.search.includes("q="));
    await page.waitForTimeout(800);
    check("C3h apagar a busca volta a lista toda", total(await lido()) === tudo);
    await box.fill("Teste Bonificacao");
    await page.waitForURL(/q=Teste/);
    await page.locator('main a[href="/painel?aba=pedidos&periodo=30"]').first().click();
    await page.waitForURL((u) => !u.search.includes("q="));
    await page.waitForTimeout(800);
    const caixa = await box.inputValue();
    await box.fill("Teste Bonificacao");
    await page.waitForURL(/q=Teste/, { timeout: 5000 }).catch(() => {});
    check(
      "C3h link sem busca limpa a caixa e buscar de novo funciona",
      caixa === "" && /q=Teste/.test(page.url()),
      `caixa=${caixa} ${page.url()}`,
    );
  }
  // C3j "Imprimir todas": um PDF só com as etiquetas do filtro Imprimir.
  {
    const t = await painel("?ver=imprimir");
    const n = Number(t.match(/Pedidos · (\d+)/)?.[1] ?? 0);
    const botao = page.getByRole("link", { name: /Imprimir todas \((\d+)\)/ });
    const label = (await botao.textContent().catch(() => "")) ?? "";
    const m = Number(label.match(/\((\d+)\)/)?.[1] ?? -1);
    const hrefPdf = (await botao.getAttribute("href").catch(() => "")) ?? "";
    const r = await fetch(B + hrefPdf, {
      headers: { cookie: `fernandito_painel=${value}` },
      redirect: "manual",
    });
    check(
      "C3j 'Imprimir todas' conta as etiquetas prontas e abre o PDF do Melhor Envio",
      m === n && m > 1 && r.status === 307 && /etiqueta\.pdf/.test(r.headers.get("location") ?? ""),
      `${label} lista=${n} → ${r.status} ${r.headers.get("location")}`,
    );
    const semLogin = await fetch(B + hrefPdf, { redirect: "manual" });
    check("C3j sem estar no painel, o link das etiquetas não abre", semLogin.status === 404);
  }
  await browser.close();
  const again = await fetch(`${B}/api/loja/etiqueta-avulsa?${q}`).then((x) => x.json());
  check("C3g abrir o link de novo não compra outra", again.jaExistia === true);
}
// C3i transportadora recusou (ex.: LATAM devolveu): "Etiqueta nova" no painel
// compra outra etiqueta, mesma nota, por OUTRA transportadora; volta pra Imprimir.
{
  await ctl(ME, { flags: { variasOpcoes: true } });
  // Cotação guardada (sem a LATAM) sai do cache pra valer a nova.
  execSync(`redis-cli -p 6390 --scan --pattern 'frete:*' | xargs -r redis-cli -p 6390 del`);
  const id = await buy({
    ship: { id: "me-12", priceCents: 3870, source: "melhor-envio", carrier: "LATAM Cargo" },
  });
  const e = await until(id, ["ready"]);
  const doPedido = () =>
    ctl(ME).then((x) => x.orders.filter((o) => o.tags.some((t) => t.tag === id)));
  const [antiga] = await doPedido();
  check(
    "C3i etiqueta saiu pela LATAM",
    e?.etapa === "ready" && antiga?.service?.company?.name === "LATAM Cargo",
    JSON.stringify(antiga?.service),
  );
  // O Melhor Envio estorna e cancela a etiqueta antiga.
  await ctl(ME, { set: { id: antiga.id, status: "canceled" } });
  const visto = await envio(id, true);
  check(
    "C3i etiqueta cancelada aparece com aviso pra fazer etiqueta nova",
    /Etiqueta cancelada/.test(visto?.erro ?? ""),
    JSON.stringify(visto),
  );
  const { createRequire } = await import("node:module");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const exp = String(Date.now() + 3600e3);
  const value = `${exp}.${createHmac("sha256", KEY).update(`painel-v2.${exp}`).digest("hex")}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addCookies([{ name: "fernandito_painel", value, url: `${B}/painel` }]);
  const page = await ctx.newPage();
  await page.goto(`${B}/painel?q=${id}`, { waitUntil: "load" });
  const row = page.locator("tr", { hasText: `#${id}` }).first();
  await row.getByRole("button", { name: "Etiqueta nova" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel(/Confirmo/).check();
  await modal.getByRole("button", { name: "Comprar etiqueta nova" }).click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  await browser.close();
  const todas = await doPedido();
  const nova = todas.find((o) => o.id !== antiga.id);
  const depois = await envio(id);
  check(
    "C3i etiqueta nova comprada por outra transportadora (não LATAM)",
    Boolean(nova) && !/latam/i.test(nova.service?.company?.name ?? "") && todas.length === 2,
    JSON.stringify(todas.map((o) => [o.id, o.status, o.service?.company?.name])),
  );
  check(
    "C3i pedido volta pra Imprimir com a etiqueta nova",
    depois?.etapa === "ready" && !depois?.erro,
    JSON.stringify(depois),
  );
  check(
    "C3i painel mostra 'Etiqueta nova pela J&T Express · a da LATAM Cargo foi cancelada'",
    texto.includes("Etiqueta nova pela J&T Express · a da LATAM Cargo foi cancelada"),
  );
  check(
    "C3i painel mostra a transportadora nova no lugar da LATAM",
    /J&T Express · pago|J&T Express/.test(texto),
  );
  await ctl(ME, { flags: { variasOpcoes: false } });
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
// C15 o Bling recusa o celular do cliente → o pedido entra mesmo assim (telefone fixo)
{
  await ctl(BL, { flags: { celularReject: true } });
  const id = await buy({ note: "teste celular" });
  const e = await until(id, ["ready", "local"]);
  const bl = await ctl(BL);
  const contato = bl.contacts.at(-1);
  await ctl(BL, { flags: { celularReject: false } });
  check(
    "C15 Bling recusa o celular → pedido entra mesmo assim (telefone vai como fixo)",
    Boolean(e) && !e.erro && Boolean(contato?.telefone) && !contato?.celular,
    JSON.stringify({
      e,
      contato: contato && { telefone: contato.telefone, celular: contato.celular },
    }),
  );
}
// C16 a nota vai por e-mail pelo Bling e o cliente baixa o PDF na página do pedido
{
  const id = await buy({ note: "teste nota" });
  await until(id, ["ready", "local"]);
  const bl = await ctl(BL);
  const sale = bl.sales.find((x) => (x.numeroLoja ?? x.observacoes ?? "").includes(id));
  const nfe = bl.nfes.find((n) => n.id === sale?.notaFiscal?.id);
  check(
    "C16 nota enviada à Sefaz com e-mail do Bling ligado",
    nfe?.enviarEmail === "true",
    JSON.stringify(nfe),
  );
  const r = await fetch(`${B}/pedido/${id}/nota`, { redirect: "manual" });
  check(
    "C16 /pedido/<id>/nota manda pro PDF novo da nota",
    r.status === 302 && /bling\.example\/nfe-\d+\.pdf/.test(r.headers.get("location") ?? ""),
    `${r.status} ${r.headers.get("location")}`,
  );
  const page = await (await fetch(`${B}/pedido/${id}/confirmado`)).text();
  check("C16 página do pedido tem 'Baixar nota (PDF)'", page.includes("Baixar nota (PDF)"));
  const bad = await fetch(`${B}/pedido/naoexiste1/nota`, { redirect: "manual" });
  check("C16 pedido que não existe → 404", bad.status === 404, String(bad.status));
}
// C17 six pack. Em "Em breve" (comingSoon) o checkout recusa. Aberto: entra
// no Bling, a baixa sai das latas (6 por pack), no máximo 6 por pedido e o
// teto do site (37) não passa.
{
  const err = await buy({ items: [{ sku: "FERN-350-6", qty: 2, unitPriceCents: 9499 }] }).then(
    (id) => ({ id }),
    (e) => ({ err: String(e.message) }),
  );
  if (err.err?.includes("ainda não está à venda")) {
    check("C17 six pack em breve → checkout recusa", true);
  } else if (err.err) {
    check("C17 six pack aberto → compra", false, err.err);
  } else {
    const id = err.id;
    const e = await until(id, ["ready", "local"]);
    const { baixas } = await fetch(`${BL}/_baixas`).then((r) => r.json());
    const mine = baixas.filter((x) => String(x.observacoes ?? "").includes(id));
    check("C17 six pack pago → nota/etiqueta sem erro", Boolean(e) && !e.erro, JSON.stringify(e));
    check(
      "C17 baixa do six pack sai das latas (2 packs = 12 latas)",
      mine.length === 1 && mine[0].quantidade === 12,
      JSON.stringify(mine),
    );
    const seven = await buy({ items: [{ sku: "FERN-350-6", qty: 7, unitPriceCents: 9499 }] }).then(
      () => "",
      (x) => String(x.message),
    );
    check("C17 7 packs num pedido → recusa (máx. 6)", /Máximo de 6/.test(seven), seven);
    // Já foram 2; mais 35 (5×6 + 5) chega nos 37 do teto.
    for (const q of [6, 6, 6, 6, 6, 5])
      await buy({ items: [{ sku: "FERN-350-6", qty: q, unitPriceCents: 9499 }] });
    const over = await buy({ items: [{ sku: "FERN-350-6", qty: 1, unitPriceCents: 9499 }] }).then(
      () => "",
      (x) => String(x.message),
    );
    check("C17 depois de 37 packs → 'esgotou'", /esgotou/.test(over), over);
  }
}
// C13 notas feitas à mão no Bling (venda manual e bonificação) entram no painel;
// as notas dos pedidos do site não entram de novo.
{
  const base = {
    dataEmissao: "2026-10-22 10:00:00",
    contato: { nome: "Bar do Zé", endereco: { municipio: "Porto Alegre", uf: "RS" } },
    linkDanfe: "https://bling.example/danfe",
  };
  await ctl(BL, {
    notaManual: {
      ...base,
      naturezaOperacao: { id: 1 },
      itens: [
        { codigo: "FERN-350", descricao: "Lata", quantidade: 12, valor: 14.99, cfop: "5101" },
      ],
      valorNota: 179.88,
    },
  });
  await ctl(BL, {
    notaManual: {
      ...base,
      naturezaOperacao: { id: 7 },
      itens: [
        { codigo: "FERN-KIT-PRE", descricao: "Kit", quantidade: 1, valor: 89.9, cfop: "5910" },
      ],
      valorNota: 89.9,
      // Nota em nome de um, entrega pra outro: o painel mostra quem recebe.
      transporte: { etiqueta: { nome: "Rodrigo Rech", municipio: "Florianópolis", uf: "SC" } },
    },
  });
  const cron = await (await fetch(`${B}/api/cron/bling?key=${KEY}`)).json();
  check(
    "C13 venda manual + bonificação lidas do Bling (só as 2)",
    cron.foraDoSite === 2,
    JSON.stringify(cron),
  );
  const store = JSON.parse(
    execSync(`redis-cli -p ${process.env.REDIS_PORT ?? 6390} get bling:manual`).toString(),
  );
  const brinde = store.sales.find((x) => x.cliente === "Rodrigo Rech");
  check(
    "C13 nota em nome de um e entrega pra outro → painel mostra quem recebe",
    brinde?.nfPara === "Bar do Zé" && brinde?.cidade === "Florianópolis" && brinde?.uf === "SC",
    JSON.stringify(brinde),
  );
}
// C8 frete da tabela (Melhor Envio estava fora na compra)
{
  const id = await buy({ ship: { id: "tabela-sudeste", priceCents: 2000, source: "tabela" } });
  const e = await until(id, ["ready"]);
  const ship = (await ctl(ME)).orders.find((o) => o.tags.some((t) => t.tag === id));
  check(
    "C8 frete de último recurso → compra a Jadlog mais barata na hora",
    e?.etapa === "ready" && ship?.service?.id === 3,
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
// C12 e-mails: só o "pedido confirmado" pro cliente
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
  // Cota do Resend (100/dia, 3.000/mês): só o "pedido confirmado" sai.
  check(
    "C12 NÃO manda 'postado' (só o de pedido confirmado)",
    posted.length === 0,
    `${posted.length}`,
  );
  check(
    "C12 NÃO manda e-mail pra equipe (compra nova nem alerta)",
    toTeam.length === 0,
    `${toTeam.length}`,
  );
  check(
    "C12 todo e-mail enviado é o 'Pedido confirmado' pro cliente",
    mails.every((m) => /confirmado/i.test(m.subject) && m.to.includes("b@example.com")),
    mails.map((m) => m.subject).join(" | "),
  );
}
// C9 planilha mostra nota e rastreio
{
  const csv = await fetch(`${B}/api/loja/pedidos?key=${KEY}`).then((r) => r.text());
  check("C9 planilha tem nota, etapa e rastreio", csv.includes(`"${c1}"`) && /JAD\d+/.test(csv));
}

// SALVAR_EMAIL=arquivo.html → guarda o e-mail de pedido confirmado pra olhar.
if (process.env.SALVAR_EMAIL) {
  const { writeFileSync } = await import("node:fs");
  const m = mails.find((x) => /confirmado/i.test(x.subject));
  if (m) writeFileSync(process.env.SALVAR_EMAIL, m.html);
}
console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
process.exit(0);
