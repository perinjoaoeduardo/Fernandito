// Teste da aba "Emitir nota" do painel (Bling e Melhor Envio de mentira).
// Precisa: bling-falso.mjs (3998), melhorenvio-falso.mjs (3997), Redis e o
// site em 3160 com BLING_API_URL / MELHOR_ENVIO_API_URL apontando pra eles.
// Sem ANTHROPIC_API_KEY: testa o caminho "preencher à mão" (a IA avisa).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const B = "http://localhost:3160";
const KEY = "chave-admin-local-0123456789";
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${name} ${extra}`);
};
const shot = process.argv[2];

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

// IA sem chave → mensagem clara.
await page.fill("textarea >> nth=0", "Venda 2 six packs pro Bar Teste");
await page.click("text=Preencher com IA");
await page.waitForSelector("p[role=alert]");
check(
  "N1 sem chave da IA → avisa pra preencher à mão",
  (await page.textContent("p[role=alert]")).includes("ANTHROPIC_API_KEY"),
);

// Preenche à mão: empresa do RS com IE, 2 six packs a R$ 83,16, envio.
const campo = (label) =>
  page.locator("label", { hasText: label }).locator("input, select").first();
await campo("Entrega").selectOption("envio");
await campo("Saiu das caixas de").selectOption("Lorenzo");
await campo("CNPJ").fill("11222333000181");
await campo("Inscrição estadual").fill("0960000001");
await campo("Razão social").fill("BAR TESTE LTDA");
await campo("E-mail").fill("bar@teste.com");
await campo("Rua").fill("Rua Teste");
await campo("Número").fill("100");
await campo("Bairro").fill("Centro");
await campo("Cidade").fill("Porto Alegre");
await campo("CEP").fill("90010000");
await page.fill('input[aria-label="Quantidade"]', "2");
await page.fill('input[aria-label="Preço por unidade"]', "83,16");
await page.click("button:has-text('Conferir')");
await page.waitForSelector("text=Natureza:");
const plano = await page.textContent("text=Natureza: >> xpath=..");
check("N2 empresa RS com IE → natureza com ST (5401)", plano.includes("5401"), plano);

await page.click("text=3. Preparar nota (rascunho)");
await page.waitForSelector("text=Rascunho da nota", { timeout: 20000 });
const total = await page.textContent("text=Total da nota (Bling) >> xpath=..");
check("N3 rascunho com total ≈ combinado (R$ 166,32)", /166,3\d/.test(total), total);

await page.click("text=4. Emitir na Sefaz");
await page.waitForSelector("text=emitida ✓", { timeout: 30000 });
check("N4 nota emitida", true);
check("N5 etiqueta comprada", (await page.locator("a:has-text('Etiqueta')").count()) === 1);
if (shot) await page.screenshot({ path: shot, fullPage: true });

// Fora do RS: bloqueia.
await page.click("text=Nova nota");
await campo("CNPJ").fill("11444777000161");
await campo("Inscrição estadual").fill("12345678");
await campo("Razão social").fill("EMPRESA RJ LTDA");
await campo("Rua").fill("Rua X");
await campo("Número").fill("1");
await campo("Bairro").fill("Centro");
await campo("Cidade").fill("Rio de Janeiro");
await campo("UF").fill("RJ");
await campo("CEP").fill("20010000");
await page.fill('input[aria-label="Quantidade"]', "1");
await page.fill('input[aria-label="Preço por unidade"]', "83");
await page.click("button:has-text('Conferir')");
await page.waitForSelector("text=Natureza:");
check(
  "N6 empresa fora do RS → bloqueia",
  (await page.locator("text=fora do RS").count()) > 0 &&
    (await page.locator("button:has-text('3. Preparar nota')").isDisabled()),
);
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
process.exit(results.every(Boolean) ? 0 : 1);
