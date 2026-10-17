// Bling de mentira pra testar a loja localmente (porta 3998).
// POST /_ctl muda o comportamento: rejeitar nota, travar nota em "aguardando".
import http from "node:http";
const flags = { nfeReject: false, nfeStuck: false };
const sales = new Map();
const nfes = new Map();
let nextId = 5000;
const send = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, "http://x");
    const p = url.pathname.replace(/^\/Api\/v3/, "");
    if (p === "/_ctl") {
      Object.assign(flags, body.flags ?? {});
      if (body.atender) sales.get(String(body.atender)).situacao = { id: 9 };
      return send(res, 200, { flags, sales: [...sales.values()], nfes: [...nfes.values()] });
    }
    if (p === "/contatos" && req.method === "GET") return send(res, 200, { data: [] });
    if (p === "/contatos" && req.method === "POST")
      return send(res, 201, { data: { id: nextId++ } });
    if (p.startsWith("/campos-customizados")) return send(res, 200, { data: [] });
    if (p === "/produtos")
      return send(res, 200, {
        data: url.searchParams.getAll("codigos[]").map((c, i) => ({ id: 100 + i, codigo: c })),
      });
    if (p === "/estoques/saldos")
      return send(res, 200, {
        data: url.searchParams
          .getAll("idsProdutos[]")
          .map((id) => ({ produto: { id: Number(id) }, saldoVirtualTotal: 9999 })),
      });
    if (p === "/pedidos/vendas" && req.method === "GET") {
      const n = url.searchParams.get("numerosLojas[]");
      return send(res, 200, { data: [...sales.values()].filter((s) => s.numeroLoja === n) });
    }
    if (p === "/pedidos/vendas" && req.method === "POST") {
      const id = nextId++;
      sales.set(String(id), { ...body, id, numero: id - 4000, situacao: { id: 15 } });
      return send(res, 201, { data: { id, numero: id - 4000 } });
    }
    let m;
    if ((m = p.match(/^\/pedidos\/vendas\/(\d+)\/gerar-nfe$/))) {
      const s = sales.get(m[1]);
      if (s.notaFiscal) return send(res, 400, { error: { description: "já tem nota" } });
      const id = nextId++;
      nfes.set(String(id), { id, numero: String(id - 4900), situacao: 1, chaveAcesso: null });
      s.notaFiscal = { id };
      return send(res, 200, { data: { id } });
    }
    if ((m = p.match(/^\/pedidos\/vendas\/(\d+)$/))) {
      const s = sales.get(m[1]);
      if (!s) return send(res, 404, {});
      if (req.method === "PUT") {
        Object.assign(s, body, { id: s.id });
        s.puts = (s.puts ?? 0) + 1;
        return send(res, 200, { data: { id: s.id } });
      }
      return send(res, 200, { data: s });
    }
    if ((m = p.match(/^\/nfe\/(\d+)\/enviar$/))) {
      const n = nfes.get(m[1]);
      n.sent = (n.sent ?? 0) + 1;
      n.situacao = flags.nfeReject ? 4 : flags.nfeStuck ? 3 : 5;
      if (n.situacao === 5) n.chaveAcesso = "4326" + String(n.id).padStart(40, "0");
      return send(res, 200, { data: {} });
    }
    if ((m = p.match(/^\/nfe\/(\d+)$/))) {
      const n = nfes.get(m[1]);
      if (n.situacao === 3 && !flags.nfeStuck) {
        n.situacao = 5;
        n.chaveAcesso = "4326" + String(n.id).padStart(40, "0");
      }
      return send(res, 200, { data: n });
    }
    send(res, 404, { error: { description: "rota falsa não existe: " + p } });
  })
  .listen(3998, () => console.log("Bling falso na 3998"));
