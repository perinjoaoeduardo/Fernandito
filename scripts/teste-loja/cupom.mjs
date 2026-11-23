// Cupom de frete grátis (src/lib/cupom.ts): confere, zera o frete, recusa o
// falso. Rodar o servidor com CUPOM_FRETE_GRATIS=AMIGODOFERNANDITO (só no
// teste local). Mesmo servidor da bateria de cenários (LANCAMENTO.md →
// "Testar a loja"), com o pack de 6 (o kit de pré-venda esgotou).
import { randomUUID } from "node:crypto";
const B = "http://localhost:3160";
const SKU = "FERN-350-6",
  PRICE = 9499, // src/lib/catalog.ts
  SHIP = 2000; // frete de último recurso (tabela)
let ip = 1;
const H = () => ({ "content-type": "application/json", "x-real-ip": `10.2.0.${ip++}` });
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${name} ${extra}`);
};
const confere = (codigo) =>
  fetch(`${B}/api/cupom`, { method: "POST", headers: H(), body: JSON.stringify({ codigo }) });
async function pix(cupom, totalComFrete = !cupom) {
  const b = {
    items: [{ sku: SKU, qty: 1, unitPriceCents: PRICE }],
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
    shipping: {
      id: "tabela-sudeste",
      service: "x",
      carrier: "Envio padrão",
      priceCents: SHIP,
      days: { min: 1, max: 5 },
      source: "tabela",
    },
    subtotalCents: PRICE,
    totalCents: PRICE + (totalComFrete ? SHIP : 0),
    ageConfirmed: true,
    ageConfirmedAt: new Date().toISOString(),
    marketingOptIn: false,
    ...(cupom ? { cupom } : {}),
  };
  const r = await fetch(B + "/api/checkout/pix", {
    method: "POST",
    headers: { ...H(), "x-idempotency-key": randomUUID() },
    body: JSON.stringify(b),
  });
  return { code: r.status, data: await r.json() };
}

check("C1 cupom inexistente → 404", (await confere("NADA")).status === 404);
const ok = await confere(" amigodofernandito ");
check(
  "C2 cupom certo (minúscula, espaço) → vale",
  ok.status === 200 && (await ok.json()).codigo === "AMIGODOFERNANDITO",
);
const comCupom = await pix("AmigoDoFernandito");
check(
  "C3 Pix com cupom → frete 0 e total = só o pack",
  comCupom.code === 201 &&
    comCupom.data.order.shipping.priceCents === 0 &&
    comCupom.data.order.totalCents === PRICE,
  JSON.stringify(comCupom.data.order?.totalCents ?? comCupom.data),
);
const falso = await pix("CHUTE123");
check(
  "C4 Pix com cupom falso → recusado",
  falso.code === 409 && falso.data.code === "cupom",
  JSON.stringify(falso.data),
);
check("C5 cupom + total com frete → recusado", (await pix("AMIGODOFERNANDITO", true)).code === 400);
const sem = await pix("");
check(
  "C6 sem cupom → frete cobrado normal",
  sem.code === 201 && sem.data.order.totalCents === PRICE + SHIP,
  JSON.stringify(sem.data.order?.totalCents ?? sem.data),
);
const planilha = await fetch(`${B}/api/loja/pedidos?key=chave-admin-local-0123456789&todos=1`).then(
  (r) => r.text(),
);
check(
  "C7 planilha mostra o cupom e quanto o frete custaria",
  planilha.includes("AMIGODOFERNANDITO (frete grátis, custaria R$ 20,00)"),
);
console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
process.exit(results.every(Boolean) ? 0 : 1);
