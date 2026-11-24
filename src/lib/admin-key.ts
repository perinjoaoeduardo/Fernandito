/**
 * Senha do admin (`BLING_ADMIN_KEY`) de uma chamada às rotas internas
 * (/api/loja/*, /api/leads, cron manual): no cabeçalho `X-Admin-Key` (o jeito
 * seguro: não fica no histórico do navegador nem em log de URL) ou, como
 * sempre foi, no `?key=` do link.
 */
export function adminKeyOf(request: Request): string | null {
  return request.headers.get("x-admin-key")?.trim() || new URL(request.url).searchParams.get("key");
}
