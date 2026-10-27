import "server-only";
import { bling, isBlingConnected } from "@/lib/bling/client";
import { ALL_SET } from "@/lib/store/checkout";
import { kvGet, kvSet, kvSMembers } from "@/lib/store/kv";

/**
 * Vendas fora do site (venda manual e bonificação/brinde), lidas das notas
 * fiscais de saída do Bling — tudo que sai tem nota, então a nota é a fonte.
 * Fica fora quem veio do site (o `numeroPedidoLoja` é um pedido nosso).
 *
 * Guardado no Redis (`bling:manual`): a lista é refeita a cada conferência
 * (nota cancelada some), e o detalhe de cada nota é buscado uma vez só
 * (de novo só enquanto ela não estiver autorizada).
 */

export type ManualSale = {
  id: number;
  numero: string;
  data: string; // "AAAA-MM-DD HH:MM:SS" (Brasília)
  situacao: number;
  tipo: "venda" | "bonificacao";
  natureza: string;
  cliente: string;
  cidade: string;
  uf: string;
  itens: { codigo: string; descricao: string; quantidade: number; valor: number }[];
  totalCents: number;
  danfeUrl: string | null;
};

type Store = {
  syncedAt: string;
  sales: ManualSale[];
  /** Notas de pedido do site: já aparecem pelo pedido, não busca de novo. */
  ignored?: number[];
  error: string | null;
};

const KEY = "bling:manual";
const DAYS = 180;
const FRESH_MS = 10 * 60 * 1000;
// O Bling limita ~3 req/s: no máximo 25 notas novas por conferência, com
// pausa entre uma e outra (o resto fica pra próxima, 10 min depois).
const MAX_NEW = 25;
const PAUSE_MS = 400;
// Autorizada / emitida DANFE / registrada: não muda mais (só se cancelar).
const FINAL = [5, 6, 7];
// CFOP de remessa em bonificação, doação ou brinde (dentro e fora do estado).
const BONUS_CFOP = /^[56]91[01]$/;
const BONUS_NAME = /bonifica|brinde|doa[cç]|amostra/i;
const SITE_LOJA = Number(process.env.BLING_LOJA_ID) || null;

type Page<T> = { data: T[] };
type NfeListItem = { id: number; situacao: number; numero?: string };
type NfeDetail = {
  id: number;
  numero?: string;
  dataEmissao?: string;
  situacao?: number;
  numeroPedidoLoja?: string;
  loja?: { id?: number };
  naturezaOperacao?: { id?: number };
  contato?: { nome?: string; endereco?: { municipio?: string; uf?: string } };
  itens?: {
    codigo?: string;
    descricao?: string;
    quantidade?: number;
    valor?: number;
    cfop?: string;
  }[];
  valorNota?: number;
  linkDanfe?: string;
  linkPDF?: string;
};

export async function getManualSales(): Promise<Store | null> {
  const raw = await kvGet(KEY);
  return raw ? (JSON.parse(raw) as Store) : null;
}

/** Mais velho que 10 min (ou nunca conferido) → vale conferir de novo. */
export function manualSalesStale(store: Store | null) {
  return !store || Date.now() - new Date(store.syncedAt).getTime() > FRESH_MS;
}

async function natureNames(): Promise<Map<number, string>> {
  const page = await bling<Page<{ id: number; descricao: string }>>(
    "/naturezas-operacoes?limite=100",
  );
  return new Map(page.data.map((n) => [n.id, n.descricao]));
}

function since() {
  const d = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  return `${d.toISOString().slice(0, 10)} 00:00:00`;
}

/** Confere as notas de saída no Bling e atualiza a lista. Nunca lança. */
export async function syncManualSales(): Promise<Store | null> {
  const previous = await getManualSales();
  const sales: ManualSale[] = [];
  const ignored = new Set(previous?.ignored ?? []);
  try {
    if (!(await isBlingConnected())) return previous;
    const known = new Map((previous?.sales ?? []).map((s) => [s.id, s]));
    const siteOrders = new Set(await kvSMembers(ALL_SET));

    const list: NfeListItem[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await bling<Page<NfeListItem>>(
        `/nfe?tipo=1&limite=100&pagina=${page}&dataEmissaoInicial=${encodeURIComponent(since())}`,
      );
      list.push(...res.data);
      if (res.data.length < 100) break;
    }

    let names: Map<number, string> | null = null;
    let fetched = 0;
    let more = false;
    for (const item of list) {
      if (ignored.has(item.id)) continue;
      const cached = known.get(item.id);
      if (cached && FINAL.includes(cached.situacao) && cached.situacao === item.situacao) {
        sales.push(cached);
        continue;
      }
      if (fetched >= MAX_NEW) {
        more = true;
        continue;
      }
      if (fetched++ > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
      const nfe = (await bling<{ data: NfeDetail }>(`/nfe/${item.id}`)).data;
      // Nota de pedido do site: já aparece no painel pelo próprio pedido.
      if (
        nfe.numeroPedidoLoja &&
        (siteOrders.has(nfe.numeroPedidoLoja) || (SITE_LOJA && nfe.loja?.id === SITE_LOJA))
      ) {
        ignored.add(item.id);
        continue;
      }
      names ??= await natureNames().catch(() => new Map<number, string>());
      const natureza = names.get(nfe.naturezaOperacao?.id ?? 0) ?? "";
      const itens = (nfe.itens ?? []).map((i) => ({
        codigo: i.codigo ?? "",
        descricao: i.descricao ?? "",
        quantidade: Number(i.quantidade ?? 0),
        valor: Number(i.valor ?? 0),
      }));
      const bonus =
        BONUS_NAME.test(natureza) || (nfe.itens ?? []).some((i) => BONUS_CFOP.test(i.cfop ?? ""));
      sales.push({
        id: nfe.id,
        numero: nfe.numero ?? item.numero ?? "",
        data: nfe.dataEmissao ?? "",
        situacao: nfe.situacao ?? item.situacao,
        tipo: bonus ? "bonificacao" : "venda",
        natureza,
        cliente: nfe.contato?.nome ?? "",
        cidade: nfe.contato?.endereco?.municipio ?? "",
        uf: nfe.contato?.endereco?.uf ?? "",
        itens,
        totalCents: Math.round(Number(nfe.valorNota ?? 0) * 100),
        danfeUrl: nfe.linkDanfe ?? nfe.linkPDF ?? null,
      });
    }

    sales.sort((a, b) => b.data.localeCompare(a.data));
    const store: Store = {
      syncedAt: new Date().toISOString(),
      sales,
      ignored: [...ignored],
      error: null,
    };
    // Sobrou nota por buscar: confere de novo logo na próxima visita.
    if (more) store.syncedAt = new Date(Date.now() - FRESH_MS).toISOString();
    await kvSet(KEY, JSON.stringify(store));
    return store;
  } catch (error) {
    const message = (error as Error).message;
    console.error("[bling] vendas manuais:", message);
    const store: Store = {
      syncedAt: new Date().toISOString(),
      // Guarda o que já foi lido até o erro (não perde o progresso).
      sales: sales.length ? sales : (previous?.sales ?? []),
      ignored: [...ignored],
      error: message,
    };
    await kvSet(KEY, JSON.stringify(store)).catch(() => {});
    return store;
  }
}
