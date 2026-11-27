// Bateria da aba "Emitir nota" do painel (Bling e Melhor Envio de mentira).
// Precisa: bling-falso.mjs (3998), melhorenvio-falso.mjs (3997), Redis limpo e
// o site em 3160 com BLING_API_URL / MELHOR_ENVIO_API_URL apontando pra eles
// (ver LANCAMENTO.md). Sem ANTHROPIC_API_KEY: testa o "preencher à mão".
// Todos os dados de cliente aqui são INVENTADOS (repositório público).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const B = "http://localhost:3160";
const BL = "http://localhost:3998";
const ME = "http://localhost:3997";
const KEY = "chave-admin-local-0123456789";
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${name} ${ok ? "" : extra}`);
};
const ctl = (u, flags) =>
  fetch(u + "/_ctl", { method: "POST", body: JSON.stringify({ flags }) }).then((r) => r.json());

// CNPJ válido inventado a partir de 12 dígitos.
function cnpj(base12) {
  const d = base12.split("").map(Number);
  const dv = (n) => {
    const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = p.reduce((a, w, i) => a + w * d[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  d.push(dv(12));
  d.push(dv(13));
  return d.join("");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
page.on("dialog", (d) => d.accept());
await page.goto(`${B}/painel`);
await page.fill('input[name="senha"]', KEY);
await page.click('button[type="submit"]');
await page.waitForURL("**/painel**");
await page.waitForTimeout(1500);
await page.goto(`${B}/painel?aba=notas`);
await page.waitForSelector("text=1. Cole o texto");

const campo = (label) => page.locator("label", { hasText: label }).locator("input, select").first();
const limpar = async () => {
  await page.click("text=Limpar tudo");
  await page.waitForTimeout(200);
};
async function preencher(o) {
  await limpar();
  if (o.tipo) await campo("O que é").selectOption(o.tipo);
  if (o.entrega) await campo("Entrega").selectOption(o.entrega);
  if (o.embalagem) await campo("Como vão as caixas").selectOption(o.embalagem);
  if (o.pilhas) await campo("Quantas pilhas").fill(String(o.pilhas));
  await campo("Cliente").selectOption(o.pessoa ?? "PJ");
  await campo(o.pessoa === "PF" ? "CPF" : "CNPJ").fill(o.doc);
  if (o.ie !== undefined) await campo("Inscrição estadual").fill(o.ie);
  await campo(o.pessoa === "PF" ? "Nome completo" : "Razão social").fill(o.nome ?? "EMPRESA TESTE LTDA");
  await campo("Rua").fill("Rua Teste");
  await campo("Número").fill("100");
  await campo("Bairro").fill("Centro");
  await campo("Cidade").fill(o.cidade ?? "Porto Alegre");
  await campo("UF").fill(o.uf ?? "RS");
  await campo("CEP").fill(o.cep ?? "90010000");
  if (o.sku) await page.locator("select").filter({ hasText: "Six pack (6 latas)" }).first().selectOption(o.sku);
  await page.fill('input[aria-label="Quantidade"]', String(o.qtd ?? 1));
  if (o.preco !== undefined && (o.tipo ?? "venda") === "venda")
    await page.fill('input[aria-label="Preço por unidade"]', String(o.preco));
}
async function conferir() {
  await page.click("button:has-text('Conferir')");
  await page.waitForSelector("text=Natureza:", { timeout: 20000 });
  return page.textContent("text=Natureza: >> xpath=../..");
}
const travado = async () => (await page.locator("text=Travado. Corrija").count()) > 0;
const podePreparar = async () =>
  !(await page.locator("button:has-text('3. Preparar nota')").isDisabled());
async function prepararEEmitir() {
  await page.click("text=3. Preparar nota (rascunho)");
  await page.waitForSelector("text=/Rascunho da nota|Travado|com problema/", { timeout: 30000 });
  if ((await page.locator("text=4. Emitir na Sefaz").count()) === 0) return "travou";
  await page.click("text=4. Emitir na Sefaz");
  await page.waitForSelector("text=/emitida ✓|com problema|Aguarde/", { timeout: 40000 });
  return (await page.locator("text=emitida ✓").count()) ? "emitida" : "erro";
}
const texto = async () => page.textContent("main");

// N1 IA sem chave → avisa pra preencher à mão.
await page.fill("textarea >> nth=0", "Venda 2 six packs pro Bar Teste");
await page.click("text=Preencher com IA");
await page.waitForSelector("p[role=alert]");
check("N1 sem chave da IA → preencher à mão", (await page.textContent("p[role=alert]")).includes("à mão"));

// N2 CNPJ inválido.
await preencher({ doc: "11222333000100", ie: "0960000001", preco: 83.16 });
await conferir();
check("N2 CNPJ inválido → trava", (await travado()) && (await texto()).includes("CNPJ inválido"));

// N3 empresa sem IE.
await preencher({ doc: cnpj("112223330001"), ie: "", preco: 83.16 });
await conferir();
check("N3 empresa sem IE → trava", (await texto()).includes("sem inscrição estadual"));

// N4 preço por lata colocado no six pack.
await preencher({ doc: cnpj("112223330001"), ie: "0960000001", preco: 13.86 });
await conferir();
check("N4 preço de lata no six pack → trava (fora do normal)", (await texto()).includes("fora do normal"));

// N5 CEP de outro estado.
await preencher({ doc: cnpj("112223330001"), ie: "0960000001", preco: 83.16, cep: "01001000" });
await conferir();
check("N5 CEP de SP com UF RS → trava", (await texto()).includes("CEP não é do estado"));

// N6 venda pra empresa de SP (natureza não cadastrada).
await preencher({ doc: cnpj("114447770001"), ie: "123456789", preco: 83.16, uf: "SP", cidade: "São Paulo", cep: "01001000" });
await conferir();
check("N6 venda empresa SP → trava (estado não cadastrado)", (await texto()).includes("não está cadastrada"));

// N7 brinde pra SP → trava; pra SC → libera.
await preencher({ tipo: "bonificacao", pessoa: "PF", doc: "52998224725", nome: "Cliente Teste", uf: "SP", cidade: "São Paulo", cep: "01001000" });
await conferir();
check("N7 brinde pra SP → trava", (await texto()).includes("ainda não emitimos bonificação"));

// N8 venda empresa RS, envio empilhado (6 packs em 2 pilhas) → emite com etiqueta.
await preencher({
  doc: cnpj("223334440001"),
  ie: "0960000002",
  preco: 83.16,
  qtd: 6,
  entrega: "envio",
  embalagem: "empilhado",
  pilhas: 2,
});
const p8 = await conferir();
check("N8a empilhado 2×3 → caixa 24 × 27.6 × 49.2 cm, 15 kg", p8.includes("24 × 27.6 × 49.2") && p8.includes("15 kg"), p8);
check("N8b natureza ST 5401", p8.includes("5401"));
check("N8c abre a janela do Melhor Envio com as opções", (await page.locator("[role=dialog] li button").count()) > 0);
check("N8d sem escolher o frete, não prepara", !(await page.locator("button:has-text('3. Preparar nota')").isDisabled()) === false);
await page.click("[role=dialog] li button >> nth=0");
await page.click("text=Usar este frete");
check("N8e emitida", (await prepararEEmitir()) === "emitida");
check("N8f etiqueta comprada", (await page.locator("a:has-text('Etiqueta')").count()) > 0);
const meState = await ctl(ME, {});
const ultimo = meState.orders[meState.orders.length - 1];
check(
  "N8g etiqueta = 1 volume com as medidas do empilhado",
  ultimo?.volumes?.length === 1 && ultimo.volumes[0].height === 49.2 && ultimo.volumes[0].width === 27.6,
  JSON.stringify(ultimo?.volumes),
);

// N9 mesmo cliente de novo → pede "é outra nota mesmo".
await preencher({ doc: cnpj("223334440001"), ie: "0960000002", preco: 83.16, qtd: 2 });
await conferir();
const pedeConfirma = (await page.locator("text=É outra nota mesmo").count()) > 0;
const bloqueadoSem = !(await podePreparar());
await page.locator("label", { hasText: "É outra nota mesmo" }).locator("input").check();
check("N9 nota repetida → pede confirmação", pedeConfirma && bloqueadoSem && (await podePreparar()));

// N10 cliente já no Bling com IE diferente → trava.
await preencher({ doc: cnpj("223334440001"), ie: "0969999999", preco: 83.16 });
await conferir();
check("N10 IE diferente do cadastro no Bling → trava", (await texto()).includes("já está no Bling com IE"));

// N11 sem saldo no Melhor Envio → trava antes de criar nota.
await ctl(ME, { noBalance: true });
await preencher({ doc: cnpj("334445550001"), ie: "0960000003", preco: 83.16, entrega: "envio" });
await conferir();
check("N11 sem saldo no Melhor Envio → trava", (await texto()).includes("Saldo do Melhor Envio"));
await ctl(ME, { noBalance: false });

// N12 estoque insuficiente → trava.
await ctl(BL, { saldoLata: 3 });
await preencher({ doc: cnpj("334445550001"), ie: "0960000003", preco: 83.16 });
await conferir();
check("N12 estoque insuficiente → trava", (await texto()).includes("Estoque do Bling tem 3 latas"));
await ctl(BL, { saldoLata: 9999 });

// N13 total do rascunho não bate (ST diferente) → trava e apaga o rascunho.
await ctl(BL, { stRatio: 1.3 });
await preencher({ doc: cnpj("445556660001"), ie: "0960000004", preco: 83.16, qtd: 2 });
await conferir();
check("N13 total da nota ≠ combinado → trava", (await prepararEEmitir()) === "travou" && (await texto()).includes("não bate"));
await ctl(BL, { stRatio: 1.18672 });

// N14 brinde 2 Pack pra pessoa física, em mãos → 5910, valor de tabela.
await preencher({ tipo: "bonificacao", pessoa: "PF", doc: "52998224725", nome: "Cliente Teste", sku: "FERN-350-2" });
const p14 = await conferir();
check("N14a brinde → bonificação 5910", p14.includes("5910"));
check("N14b brinde emitido", (await prepararEEmitir()) === "emitida");

// N15 venda empresa RJ → 6101 com a observação da lei.
await preencher({ doc: cnpj("556667770001"), ie: "12345678", preco: 83.16, uf: "RJ", cidade: "Rio de Janeiro", cep: "20010000" });
const p15 = await conferir();
check("N15a empresa RJ → 6101", p15.includes("6101"));
check("N15b emitida", (await prepararEEmitir()) === "emitida");
const bl = await ctl(BL, {});
check(
  "N15c observação da Lei RJ na nota",
  bl.sales.some((s) => (s.observacoes ?? "").includes("10.688/2025")),
);

// N16 Sefaz rejeita → erro com "chama o João" e sem botão de emitir de novo.
await ctl(BL, { nfeReject: true });
await preencher({ pessoa: "PF", doc: "52998224725", nome: "Cliente Teste", preco: 94.99 });
await conferir();
check("N16 Sefaz rejeita → erro claro", (await prepararEEmitir()) === "erro" && (await texto()).includes("chama o João"));
await ctl(BL, { nfeReject: false });

// N17 barril por envio → trava.
await preencher({ pessoa: "PF", doc: "52998224725", nome: "Cliente Teste", sku: "FERN-BARRIL-L", qtd: 20, preco: 24.5, entrega: "envio" });
await conferir();
check("N17 barril por envio → trava", (await texto()).includes("só entrega em mãos"));

await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
process.exit(results.every(Boolean) ? 0 : 1);
