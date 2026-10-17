// Mercado Pago de mentira pra testar a loja localmente (porta 3999).
// POST /_ctl muda o comportamento: falhar criação/consulta, aprovar, mudar valor.
import http from "node:http";
const pays = new Map();
let next = 1000;
const flags = { failCreate: 0, failGet: false, expireSeconds: null, createDelayMs: 0 };
const send = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    if (req.url === "/_ctl") {
      Object.assign(flags, body.flags ?? {});
      if (body.set) Object.assign(pays.get(String(body.set.id)), body.set);
      return send(res, 200, { flags, pays: [...pays.values()] });
    }
    if (req.method === "POST" && req.url === "/v1/payments") {
      if (flags.failCreate > 0) {
        flags.failCreate--;
        return send(res, 500, { message: "internal_error" });
      }
      const idem = req.headers["x-idempotency-key"];
      const existing = [...pays.values()].find((p) => p.idem === idem);
      if (existing) return send(res, 201, existing.resp);
      const id = next++;
      const exp =
        flags.expireSeconds != null
          ? new Date(Date.now() + flags.expireSeconds * 1000).toISOString()
          : body.date_of_expiration;
      const resp = {
        id,
        status: "pending",
        transaction_amount: body.transaction_amount,
        external_reference: body.external_reference,
        date_of_expiration: exp,
        point_of_interaction: {
          transaction_data: { qr_code: "000201FAKE" + id, qr_code_base64: "" },
        },
      };
      pays.set(String(id), {
        id,
        idem,
        status: "pending",
        amount: body.transaction_amount,
        ext: body.external_reference,
        resp,
      });
      return send(res, 201, resp);
    }
    if (req.method === "GET" && req.url === "/v1/payment_methods")
      return send(res, 200, [{ id: "pix" }]);
    // API nova (Orders)
    if (req.method === "POST" && req.url === "/v1/orders") {
      if (flags.failCreate > 0) {
        flags.failCreate--;
        return send(res, 500, { message: "internal_error" });
      }
      const idem = req.headers["x-idempotency-key"];
      const existing = [...pays.values()].find((p) => p.idem === idem);
      if (existing) return send(res, 201, existing.resp);
      const id = "ORD01FAKE" + next++;
      const amount = body.transactions.payments[0].amount;
      const resp = {
        id,
        status: "action_required",
        external_reference: body.external_reference,
        total_amount: amount,
        transactions: {
          payments: [
            {
              id: "PAY" + id,
              amount,
              status: "action_required",
              date_of_expiration:
                flags.expireSeconds != null
                  ? new Date(Date.now() + flags.expireSeconds * 1000).toISOString()
                  : undefined,
              payment_method: {
                id: "pix",
                type: "bank_transfer",
                qr_code: "000201FAKE" + id,
                qr_code_base64: "",
              },
            },
          ],
        },
      };
      pays.set(id, {
        id,
        idem,
        status: "pending",
        amount: Number(amount),
        ext: body.external_reference,
        resp,
        kind: "order",
      });
      return send(res, 201, resp);
    }
    const mo = req.url.match(/^\/v1\/orders\/(ORD\w+)/);
    if (req.method === "GET" && mo) {
      if (flags.failGet) return send(res, 500, { message: "down" });
      const p = pays.get(mo[1]);
      if (!p) return send(res, 404, {});
      const paid = p.status === "approved";
      return send(res, 200, {
        id: p.id,
        status: paid ? "processed" : "action_required",
        status_detail: paid ? "accredited" : "waiting_transfer",
        external_reference: p.ext,
        total_amount: String(p.resp.total_amount),
        total_paid_amount: paid ? String(p.amount) : "0.00",
      });
    }
    const m = req.url.match(/^\/v1\/payments\/(\d+)/);
    if (req.method === "GET" && m) {
      if (flags.failGet) return send(res, 500, { message: "down" });
      const p = pays.get(m[1]);
      if (!p) return send(res, 404, {});
      return send(res, 200, {
        id: p.id,
        status: p.status,
        transaction_amount: p.amount,
        external_reference: p.ext,
      });
    }
    send(res, 404, {});
  })
  .listen(3999, () => console.log("fake MP on 3999"));
