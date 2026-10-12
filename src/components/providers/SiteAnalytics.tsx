"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// O id do pedido na URL (/pedido/<id>) é a "senha" da página do pedido:
// quem tem o link vê nome e endereço de entrega. Não manda isso pro
// Analytics — registra só o formato da rota.
function redact(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: event.url.replace(/\/pedido\/[^/?#]+/, "/pedido/[id]") };
}

/** Vercel Analytics: visitantes e visualizações, sem cookies. */
export function SiteAnalytics() {
  return <Analytics beforeSend={redact} />;
}
