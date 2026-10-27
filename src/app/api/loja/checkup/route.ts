import type { NextRequest } from "next/server";
import { bling, BLING_CONFIGURED, isBlingConnected } from "@/lib/bling/client";
import { FEATURED_PRODUCT, TEST_PRICE } from "@/lib/catalog";
import { isAdmin } from "@/lib/leads";
import {
  BASE as ME_BASE,
  meToken,
  meTokenStatus,
  isAllowedCarrier,
  REDIRECT_URI as ME_REDIRECT,
  USER_AGENT,
} from "@/lib/melhor-envio";
import { MP_API } from "@/lib/mercadopago";
import { HAS_REDIS, IS_PRODUCTION, kvDel, kvGet, kvSet } from "@/lib/store/kv";
import { STORE } from "@/content/site";
import { EMAIL_ENABLED, sendSampleEmails, sendTestEmail } from "@/lib/email";

/**
 * Check-up da loja, em português, pra abrir no navegador:
 * /api/loja/checkup?key=<BLING_ADMIN_KEY>. Testa DE VERDADE cada ligação
 * (banco, Bling, Mercado Pago, Melhor Envio) só com leituras — não cria,
 * não paga e não emite nada. Cada linha: ✅ ok, ⚠️ atenção, ❌ resolver, com o
 * que fazer.
 */

type Row = {
  area: string;
  item: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  fix?: string;
};

async function safe<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const env = (name: string) => Boolean(process.env[name]?.trim());

/** Cotação crua (sem filtro de transportadora), pro check-up mostrar o que
 * o Melhor Envio devolve de verdade: preço ou o erro de cada serviço. */
async function meQuote(cep: string) {
  const token = await meToken();
  if (!token) throw new Error("sem token");
  const s = FEATURED_PRODUCT.shipping;
  const started = Date.now();
  const response = await fetch(`${ME_BASE}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      from: { postal_code: process.env.MELHOR_ENVIO_CEP_ORIGEM?.trim() || "90430131" },
      to: { postal_code: cep },
      products: [
        {
          id: "1",
          width: s.widthCm,
          height: s.heightCm,
          length: s.lengthCm,
          weight: s.weightKg,
          insurance_value: FEATURED_PRODUCT.priceCents / 100,
          quantity: 1,
        },
      ],
      options: { receipt: false, own_hand: false },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const ms = Date.now() - started;
  if (!response.ok)
    throw new Error(
      `Melhor Envio respondeu ${response.status}: ${(await response.text()).slice(0, 160)}`,
    );
  const list = (await response.json()) as {
    name?: string;
    price?: string;
    custom_price?: string;
    error?: string;
    company?: { name?: string };
  }[];
  return { ms, list };
}

async function meGet(path: string) {
  const token = await meToken();
  if (!token) throw new Error("sem token");
  const response = await fetch(`${ME_BASE}/api/v2/me${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Melhor Envio respondeu ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function mpGet(path: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("sem token");
  const api = process.env.MERCADOPAGO_API_URL?.trim() || "https://api.mercadopago.com";
  const response = await fetch(`${api}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Mercado Pago respondeu ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request.nextUrl.searchParams.get("key")))
    return new Response("Não encontrado", { status: 404 });
  const rows: Row[] = [];
  const add = (r: Row) => rows.push(r);

  // ── Banco ────────────────────────────────────────────────────────────
  const db = await safe(async () => {
    await kvSet("checkup:ping", "ok", 60);
    const v = await kvGet("checkup:ping");
    await kvDel("checkup:ping");
    if (v !== "ok") throw new Error("gravou mas não leu de volta");
  });
  add({
    area: "Banco",
    item: "Redis (pedidos, estoque, filas)",
    status: HAS_REDIS && db.ok ? "ok" : "fail",
    detail: db.ok ? (HAS_REDIS ? "grava e lê" : "sem banco — só memória") : db.error,
    fix: "Vercel → Storage → Upstash ligado ao projeto (KV_REST_API_URL/TOKEN).",
  });

  // ── Bling ────────────────────────────────────────────────────────────
  const connected = BLING_CONFIGURED && (await isBlingConnected().catch(() => false));
  add({
    area: "Bling",
    item: "Conexão",
    status: connected ? "ok" : "fail",
    detail: connected
      ? "conectado"
      : BLING_CONFIGURED
        ? "app configurado, falta conectar"
        : "app não configurado",
    fix: "Abrir /api/bling/connect e autorizar.",
  });
  if (connected && FEATURED_PRODUCT) {
    const product = await safe(() =>
      bling<{ data: { id: number; preco?: number; codigo: string }[] }>(
        `/produtos?codigos[]=${encodeURIComponent(FEATURED_PRODUCT.sku)}`,
      ),
    );
    const p = product.ok ? product.value.data[0] : null;
    add({
      area: "Bling",
      item: `Produto ${FEATURED_PRODUCT.sku}`,
      status: !p
        ? "fail"
        : Math.round((p.preco ?? 0) * 100) === FEATURED_PRODUCT.priceCents
          ? "ok"
          : "warn",
      detail: !product.ok
        ? product.error
        : !p
          ? "não existe no Bling"
          : `preço no Bling R$ ${p.preco} · no site R$ ${FEATURED_PRODUCT.priceCents / 100}`,
      fix: "O SKU e o preço têm que ser iguais no site e no Bling.",
    });
    if (p) {
      const stock = await safe(() =>
        bling<{ data: { saldoVirtualTotal: number }[] }>(`/estoques/saldos?idsProdutos[]=${p.id}`),
      );
      const saldo = stock.ok ? (stock.value.data[0]?.saldoVirtualTotal ?? 0) : null;
      add({
        area: "Bling",
        item: "Estoque do kit",
        status: saldo === null ? "fail" : saldo >= (FEATURED_PRODUCT.stockCap ?? 0) ? "ok" : "warn",
        detail:
          saldo === null
            ? (stock as { error: string }).error
            : `Bling ${saldo} · teto do site ${FEATURED_PRODUCT.stockCap} (vende o menor)`,
        fix: "Lançar a entrada/balanço no Bling ou ajustar stockCap.",
      });
    }
    const nfe = await safe(() => bling(`/nfe?limite=1`));
    add({
      area: "Bling",
      item: "Permissão de notas fiscais (nota automática)",
      status: nfe.ok ? "ok" : "fail",
      detail: nfe.ok ? "o site consegue ler/emitir notas" : nfe.error,
      fix: "No app do Bling (Central de extensões → Área do integrador → app do site): marcar Notas Fiscais (NF-e) e reconectar em /api/bling/connect.",
    });
    // Nota autorizada pela Sefaz = certificado e série funcionando.
    const issued = await safe(() =>
      bling<{ data: { numero?: string }[] }>(`/nfe?tipo=1&situacao=5&limite=1`),
    );
    const lastNote = issued.ok ? issued.value.data[0] : undefined;
    add({
      area: "Bling",
      item: "Certificado digital A1 e série da NF-e",
      status: lastNote ? "ok" : "warn",
      detail: lastNote
        ? `já emitiu notas na Sefaz (última autorizada: nº ${lastNote.numero ?? "?"})`
        : "não dá pra conferir pela API — a conta ainda não emitiu nenhuma nota",
      fix: "Bling → Configurações → Notas fiscais: certificado A1 da empresa instalado e série/numeração em produção (a contadora sabe).",
    });
    add({
      area: "Bling",
      item: "Natureza, loja e Pix",
      status:
        env("BLING_NATUREZA_ID") && env("BLING_LOJA_ID") && env("BLING_FORMA_PAGAMENTO_ID")
          ? "ok"
          : "fail",
      detail: `natureza ${env("BLING_NATUREZA_ID") ? "ok" : "faltando"} · loja ${env("BLING_LOJA_ID") ? "ok" : "faltando"} · forma Pix ${env("BLING_FORMA_PAGAMENTO_ID") ? "ok" : "faltando"}`,
      fix: "Variáveis BLING_NATUREZA_ID, BLING_LOJA_ID e BLING_FORMA_PAGAMENTO_ID na Vercel.",
    });
  }

  // ── Mercado Pago ─────────────────────────────────────────────────────
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";
  const mode = mpToken.startsWith("APP_USR-")
    ? "produção"
    : mpToken.startsWith("TEST-")
      ? "teste"
      : "sem token";
  const mp = await safe(() => mpGet("/v1/payment_methods"));
  add({
    area: "Mercado Pago",
    item: "Credencial",
    status: !mp.ok ? "fail" : IS_PRODUCTION && mode !== "produção" ? "fail" : "ok",
    detail: mp.ok ? `token aceito (modo ${mode}) · API ${MP_API}` : `${mp.error} (modo ${mode})`,
    fix: "MERCADOPAGO_ACCESS_TOKEN de PRODUÇÃO (APP_USR-…) só no ambiente Production.",
  });
  add({
    area: "Mercado Pago",
    item: "Aviso de pagamento (webhook)",
    status: env("MERCADOPAGO_WEBHOOK_SECRET") ? "ok" : "warn",
    detail: env("MERCADOPAGO_WEBHOOK_SECRET")
      ? "assinatura configurada"
      : "sem assinatura — confirma pela tela e pela conferência (mais devagar)",
    fix: "Mercado Pago → app → Webhooks: URL /api/webhooks/mercadopago, evento Pagamentos/Orders; assinatura em MERCADOPAGO_WEBHOOK_SECRET.",
  });
  add({
    area: "Mercado Pago",
    item: "Plano B (Pix manual)",
    status: STORE.manualPix.key ? "ok" : "warn",
    detail: STORE.manualPix.key
      ? "chave configurada"
      : "sem chave — se o Mercado Pago cair, só aparece o erro",
    fix: "NEXT_PUBLIC_PIX_MANUAL_KEY na Vercel (+ redeploy).",
  });

  // ── Melhor Envio ─────────────────────────────────────────────────────
  const tokenInfo = await meTokenStatus();
  add({
    area: "Melhor Envio",
    item: "Token",
    status: tokenInfo.renovavel ? "ok" : tokenInfo.origem === "nenhum" ? "fail" : "warn",
    detail: `${tokenInfo.origem}${tokenInfo.venceEm ? ` · vence ${tokenInfo.venceEm.slice(0, 10)}` : ""}`,
    fix: `No app do Melhor Envio, "URL de redirecionamento" = ${ME_REDIRECT} . Depois abrir /api/melhorenvio/connect NESTE site e autorizar (salva e renova sozinho).`,
  });
  const meUser = await safe(() => meGet(""));
  add({
    area: "Melhor Envio",
    item: "Conta",
    status: meUser.ok ? "ok" : "fail",
    detail: meUser.ok
      ? `conectado como ${String(meUser.value.firstname ?? meUser.value.email ?? "conta")}`
      : meUser.error,
    fix: "Autorizar de novo em /api/melhorenvio/connect.",
  });
  const balance = await safe(() => meGet("/balance"));
  const saldo = balance.ok ? Number(balance.value.balance ?? 0) : null;
  add({
    area: "Melhor Envio",
    item: "Saldo pra etiquetas",
    status: saldo === null ? "fail" : saldo >= 30 ? "ok" : "warn",
    detail: !balance.ok ? balance.error : `R$ ${(saldo ?? 0).toFixed(2)}`,
    fix: "Colocar saldo no Melhor Envio (sem saldo a etiqueta espera e sai sozinha depois).",
  });
  const cart = await safe(() => meGet("/cart"));
  add({
    area: "Melhor Envio",
    item: "Permissão de compra de etiqueta",
    status: cart.ok ? "ok" : "fail",
    detail: cart.ok ? "o site consegue montar e comprar etiquetas" : cart.error,
    fix: "Autorizar de novo em /api/melhorenvio/connect (o app pede carrinho, compra, gerar e imprimir).",
  });
  // Cotação de verdade (CEP de teste ou ?cep=…): mostra cada serviço.
  const quoteCep = (request.nextUrl.searchParams.get("cep") ?? "96010000").replace(/\D/g, "");
  const quote = await safe(() => meQuote(quoteCep));
  const allowedOk = quote.ok
    ? quote.value.list.filter(
        (x) => isAllowedCarrier(x.company?.name) && !x.error && (x.custom_price ?? x.price),
      )
    : [];
  add({
    area: "Melhor Envio",
    item: `Cotação de frete (CEP ${quoteCep})`,
    status: !quote.ok
      ? "fail"
      : allowedOk.length
        ? quote.value.ms > 8000
          ? "warn"
          : "ok"
        : "fail",
    detail: !quote.ok
      ? quote.error
      : `${quote.value.ms} ms · ` +
        (quote.value.list
          .map(
            (x) =>
              `${x.company?.name ?? "?"} ${x.name ?? ""}: ${x.error ? `ERRO ${x.error}` : `R$ ${x.custom_price ?? x.price}`}`,
          )
          .join(" | ") || "nenhum serviço"),
    fix: "Nenhuma transportadora liberada (Jadlog, J&T, Loggi, LATAM) com preço: conferir no Melhor Envio se estão ativas e com o ponto de postagem (Pegaki). Outro CEP: &cep=…",
  });

  const meHook = await kvGet("me:webhook:last").catch(() => null);
  add({
    area: "Melhor Envio",
    item: "Aviso de postado/entregue (webhook)",
    status: !env("MELHOR_ENVIO_SECRET")
      ? "fail"
      : meHook
        ? meHook.includes("INVÁLIDA")
          ? "fail"
          : "ok"
        : "warn",
    detail: meHook
      ? `último aviso: ${meHook}`
      : "nenhum aviso recebido ainda (chega quando a 1ª etiqueta for comprada)",
    fix: "Área Dev → app Fernandito → Webhook: /api/melhorenvio/webhook.",
  });

  add({
    area: "Loja",
    item: "Preço de teste",
    status: TEST_PRICE ? "fail" : "ok",
    detail: TEST_PRICE
      ? `LIGADO: o kit está saindo por R$ ${(TEST_PRICE / 100).toFixed(2)}`
      : "desligado (preço normal)",
    fix: "Apagar NEXT_PUBLIC_PRECO_TESTE_CENTAVOS na Vercel e fazer redeploy.",
  });

  // Trava do preview: sem BLING_SYNC_PREVIEW=1, pedido pago não vai pro Bling.
  const syncOn = IS_PRODUCTION || process.env.BLING_SYNC_PREVIEW?.trim() === "1";
  add({
    area: "Bling",
    item: "Pedidos pagos vão pro Bling",
    status: syncOn ? "ok" : "fail",
    detail: syncOn
      ? IS_PRODUCTION
        ? "produção: sempre"
        : "preview: ligado (BLING_SYNC_PREVIEW=1) — nota e etiqueta de verdade"
      : "preview: DESLIGADO — pedido pago não vira pedido, nota nem etiqueta",
    fix: "Só pra ensaio: BLING_SYNC_PREVIEW=1 no Preview da Vercel + Redeploy.",
  });

  // ── E-mail ───────────────────────────────────────────────────────────
  // Só manda de verdade com `&email=1` (o resto do check-up só lê).
  // `&email=exemplos` manda os 4 e-mails (pedido de mentira) pro contato@.
  const emailParam = request.nextUrl.searchParams.get("email");
  const emailTest = !EMAIL_ENABLED
    ? null
    : emailParam === "1"
      ? await sendTestEmail()
      : emailParam === "exemplos"
        ? await sendSampleEmails()
        : null;
  add({
    area: "E-mail",
    item: "Resend (pedido confirmado, avisos)",
    status: !EMAIL_ENABLED ? "fail" : emailTest && !emailTest.ok ? "fail" : "ok",
    detail: !EMAIL_ENABLED
      ? "sem RESEND_API_KEY"
      : (emailTest?.detail ??
        'chave ok · só o "pedido confirmado" sai (cota 100/dia, 3.000/mês); &email=1 manda um teste'),
    fix: "RESEND_API_KEY na Vercel e o domínio fernandito.com.br verificado no Resend.",
  });

  // ── Rotinas ──────────────────────────────────────────────────────────
  add({
    area: "Rotinas",
    item: "Cron diário",
    status: env("CRON_SECRET") ? "ok" : "fail",
    detail: env("CRON_SECRET") ? "configurado" : "sem CRON_SECRET",
    fix: "Variável CRON_SECRET (16+ caracteres) na Vercel.",
  });
  add({
    area: "Rotinas",
    item: "Nota e etiqueta automáticas",
    status: process.env.FULFILL_NFE !== "0" && process.env.FULFILL_LABEL !== "0" ? "ok" : "warn",
    detail: `nota ${process.env.FULFILL_NFE !== "0" ? "ligada" : "DESLIGADA"} · etiqueta ${process.env.FULFILL_LABEL !== "0" ? "ligada" : "DESLIGADA"}`,
  });

  const icon = { ok: "✅", warn: "⚠️", fail: "❌" };
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const fails = rows.filter((r) => r.status === "fail").length;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Check-up da loja</title>
<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px;color:#243022;background:#e6e6cb}h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:20px;background:#f3f3e3;border-radius:12px;overflow:hidden}td{padding:10px 12px;border-bottom:1px solid #d6d6b8;vertical-align:top;font-size:14px}td.s{font-size:18px;width:28px}small{color:#55604f}</style></head><body>
<h1>Check-up da loja</h1><p>${IS_PRODUCTION ? "Site no ar (produção)" : "Preview / teste"} · ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · <b>${fails === 0 ? "nada pra resolver" : `${fails} pra resolver`}</b></p>
<table>${rows
    .map(
      (r) =>
        `<tr><td class="s">${icon[r.status]}</td><td><b>${esc(r.area)} · ${esc(r.item)}</b><br>${esc(r.detail)}${r.status !== "ok" && r.fix ? `<br><small>O que fazer: ${esc(r.fix)}</small>` : ""}</td></tr>`,
    )
    .join("")}</table>
<p><small>Só leitura: nada foi criado, pago ou emitido. Pedidos, filas e alertas: /api/loja/diagnostico.</small></p></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
