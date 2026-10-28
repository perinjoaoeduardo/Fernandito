import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/leads";
import { quoteMelhorEnvio } from "@/lib/melhor-envio";
import {
  addToCart,
  findShipmentByTag,
  generateLabel,
  getShipment,
  labelPrintUrl,
  payWithBalance,
} from "@/lib/melhor-envio-label";

/**
 * Etiqueta avulsa no Melhor Envio (fora de um pedido do site: bonificação,
 * remessa, reposição). Só pro admin (`key` = senha), em dois passos:
 *
 *  1) cotar (de graça):
 *     /api/loja/etiqueta-avulsa?key=…&acao=cotar&cep=88063000&caixa=40x27x8&kg=2&valor=179.80
 *     → lista as transportadoras liberadas com preço e prazo.
 *  2) comprar (GASTA o saldo do Melhor Envio):
 *     … &acao=comprar&servico=me-3 &nome=…&fone=…&rua=…&numero=…&bairro=…&cidade=…&uf=…
 *       &nf=<chave de 44 dígitos> [&compl=…&cpf=…&email=…&item=…&qtd=…&ref=…]
 *     → põe no carrinho com a nota, paga, gera a etiqueta e devolve o link do
 *       PDF e o rastreio. A `ref` (padrão: final da chave da nota) é a tag do
 *       envio: abrir o link de novo NÃO compra outra etiqueta.
 *
 * Caixa em cm (comprimento x largura x altura), peso em kg, valor declarado em reais.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  if (!isAdmin(p.get("key"))) return new Response("Não encontrado", { status: 404 });

  const text = (name: string, max = 120) => (p.get(name) ?? "").trim().slice(0, max);
  const digits = (name: string) => text(name, 60).replace(/\D/g, "");
  const fail = (erro: string, status = 400) => Response.json({ erro }, { status });

  const cep = digits("cep");
  if (cep.length !== 8) return fail("cep: 8 dígitos");
  const [length, width, height] = text("caixa", 20)
    .split(/x/i)
    .map((n) => Number(n.replace(",", ".")));
  const kg = Number(text("kg", 10).replace(",", "."));
  const valor = Number(text("valor", 12).replace(",", "."));
  const sizeOk = [length, width, height].every((n) => Number.isFinite(n) && n >= 1 && n <= 100);
  if (!sizeOk) return fail("caixa: compr x larg x alt em cm, ex.: 40x27x8");
  if (!(kg > 0 && kg <= 30)) return fail("kg: de 0,1 a 30");
  if (!(valor > 0 && valor <= 5000)) return fail("valor: valor declarado em reais, ex.: 179.80");
  const box = { weightKg: kg, widthCm: width, heightCm: height, lengthCm: length };

  const acao = p.get("acao") ?? "cotar";
  if (acao === "cotar") {
    try {
      const options = await quoteMelhorEnvio(cep, [
        { qty: 1, priceCents: Math.round(valor * 100), ...box },
      ]);
      return Response.json({
        ok: true,
        cep,
        caixa: `${length}x${width}x${height}`,
        kg,
        valor,
        opcoes: options.map((o) => ({
          servico: o.id,
          transportadora: `${o.carrier} ${o.service}`,
          preco: (o.priceCents / 100).toFixed(2),
          prazo: `${o.days.min}-${o.days.max} dias úteis`,
        })),
      });
    } catch (error) {
      return fail((error as Error).message, 502);
    }
  }
  if (acao !== "comprar") return fail("acao: cotar ou comprar");

  const servico = text("servico", 20);
  if (!/^me-\d+$/.test(servico)) return fail("servico: use o código da cotação (ex.: me-3)");
  const nf = digits("nf");
  if (nf.length !== 44) return fail("nf: chave de acesso com 44 dígitos");
  const nome = text("nome", 80);
  const rua = text("rua");
  const numero = text("numero", 20);
  const bairro = text("bairro", 60);
  const cidade = text("cidade", 60);
  const uf = text("uf", 2).toUpperCase();
  const fone = digits("fone");
  if (!nome || !rua || !numero || !bairro || !cidade || !/^[A-Z]{2}$/.test(uf) || fone.length < 10)
    return fail("faltou: nome, fone (com DDD), rua, numero, bairro, cidade, uf");

  const ref = text("ref", 40).replace(/[^\w-]/g, "") || `avulso-${nf.slice(-8)}`;
  const qty = Math.min(50, Math.max(1, Math.round(Number(p.get("qtd") ?? 1)) || 1));
  const input = {
    orderId: ref,
    shippingId: servico,
    invoiceKey: nf,
    to: {
      name: nome,
      phone: fone,
      email: text("email", 80),
      cpf: digits("cpf"),
      street: rua,
      number: numero,
      complement: text("compl", 40),
      district: bairro,
      city: cidade,
      uf,
      cep,
    },
    items: [
      {
        name: text("item", 80) || "Press kit Fernandito (brinde)",
        qty,
        unitCents: Math.round((valor * 100) / qty),
      },
    ],
    totalProductsCents: Math.round(valor * 100),
    box,
  };

  try {
    // Já existe com essa tag? Continua dele em vez de comprar outro.
    const existing = await findShipmentByTag(ref);
    const id = existing?.id ?? (await addToCart(input));
    const already =
      existing && ["generated", "released", "posted", "delivered"].includes(existing.status);
    if (!already) {
      await payWithBalance(id).catch((error: Error) => {
        // Já pago antes: segue. Outro erro (saldo): para aqui.
        if (!/pago|paid|j[aá] /i.test(error.message)) throw error;
      });
      await generateLabel(id);
    }
    const shipment = await getShipment(id);
    const pdf = await labelPrintUrl(id);
    return Response.json({
      ok: true,
      ref,
      envio: id,
      status: shipment.status,
      rastreio: shipment.tracking ?? shipment.selfTracking,
      rastreioUrl: shipment.trackingUrl,
      etiquetaPdf: pdf,
      jaExistia: Boolean(already),
    });
  } catch (error) {
    return fail(
      `parou: ${(error as Error).message} (abra de novo o mesmo link pra continuar sem pagar em dobro)`,
      502,
    );
  }
}
