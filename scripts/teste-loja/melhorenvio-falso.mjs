// Melhor Envio de mentira pra testar a loja localmente (porta 3997).
// POST /_ctl: sem saldo, mudar status (posted/delivered).
import http from "node:http";
const flags = { noBalance: false };
const orders = new Map();
let n = 1;
const calls = { cart: 0, checkout: 0, generate: 0 };
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
    const p = url.pathname.replace(/^\/api\/v2\/me/, "");
    if (p === "/_ctl") {
      Object.assign(flags, body.flags ?? {});
      if (body.set) Object.assign(orders.get(body.set.id), body.set);
      return send(res, 200, { flags, calls, orders: [...orders.values()] });
    }
    if (p === "/shipment/calculate")
      return send(res, 200, [
        { id: 3, name: ".Package", price: "25.90", company: { name: "Jadlog" } },
      ]);
    if (p === "/orders/search") {
      const q = url.searchParams.get("q");
      return send(
        res,
        200,
        [...orders.values()].filter((o) => o.tags.some((t) => t.tag === q)),
      );
    }
    if (p === "/cart") {
      calls.cart++;
      if (!body.options?.invoice?.key)
        return send(res, 422, { message: "invoice key obrigatória" });
      const id = `me-${n++}`;
      orders.set(id, {
        id,
        status: "pending",
        tracking: null,
        self_tracking: null,
        tags: body.options.tags,
        service: body.service,
        to: body.to,
      });
      return send(res, 201, { id });
    }
    if (p === "/shipment/checkout") {
      calls.checkout++;
      if (flags.noBalance) return send(res, 422, { message: "Saldo insuficiente para a compra" });
      for (const id of body.orders)
        if (orders.get(id).status === "pending") orders.get(id).status = "released";
        else return send(res, 422, { message: "já pago" });
      return send(res, 200, { purchase: { status: "paid" } });
    }
    if (p === "/shipment/generate") {
      calls.generate++;
      for (const id of body.orders) {
        const o = orders.get(id);
        o.status = "generated";
        o.self_tracking = "ME" + id.replace(/\D/g, "").padStart(9, "0");
        o.tracking = "JAD" + id.replace(/\D/g, "").padStart(9, "0");
      }
      return send(res, 200, {});
    }
    if (p === "/shipment/print")
      return send(res, 200, { url: "https://melhorenvio.example/etiqueta.pdf" });
    const m = p.match(/^\/orders\/(.+)$/);
    if (m) {
      const o = orders.get(m[1]);
      return o ? send(res, 200, o) : send(res, 404, { message: "não existe" });
    }
    send(res, 404, { message: "rota falsa não existe: " + p });
  })
  .listen(3997, () => console.log("Melhor Envio falso na 3997"));
