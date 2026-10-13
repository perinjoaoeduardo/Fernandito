"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";
import type { OrderStatus, PublicOrder } from "@/lib/store/orders";
import { Button } from "@/components/ui/Button";
import { OrderReceipt } from "@/components/checkout/OrderReceipt";
import { Price } from "@/components/ui/Price";

/**
 * Tela do Pix: QR code, "copiar código", valor, contador de expiração e
 * resumo. Pergunta o status a cada ~4s; pago → /pedido/[id]/confirmado,
 * expirado → botão pra gerar outro Pix. Mobile first: no celular o código
 * "copia e cola" vem antes do QR (quem está no celular não lê QR da própria
 * tela).
 */

const POLL_MS = 4000;
const PIX_TOTAL_MS = 30 * 60 * 1000;
const PIX_STEPS = [
  "Abra o app do banco e escolha Pix",
  "Leia o QR code ou cole o código",
  "Confirme: esta tela atualiza sozinha",
];

export function PixPayment({
  order,
  simulated,
  canSimulate,
}: {
  order: PublicOrder;
  simulated: boolean;
  canSimulate: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expiresAt = order.pix ? new Date(order.pix.expiresAt).getTime() : 0;
  const remaining = Math.max(0, expiresAt - now);

  // Relógio do contador.
  useEffect(() => {
    if (status !== "pending") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Polling do status (pausa com a aba escondida).
  useEffect(() => {
    if (status !== "pending") return;
    let stopped = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/orders/${order.id}/status`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { status: OrderStatus };
        if (!stopped) setStatus(data.status);
      } catch {
        // Rede caiu: tenta no próximo ciclo.
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [status, order.id]);

  useEffect(() => {
    if (status === "paid") router.replace(`/pedido/${order.id}/confirmado`);
  }, [status, order.id, router]);

  async function copy() {
    if (!order.pix) return;
    try {
      await navigator.clipboard.writeText(order.pix.qrCode);
    } catch {
      // Sem permissão de clipboard: seleciona o texto pra copiar à mão.
      const field = document.getElementById("pix-code") as HTMLTextAreaElement | null;
      field?.select();
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function renew() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/renew`, { method: "POST" });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Erro ao gerar novo Pix");
      router.push(`/pedido/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function simulatePaid() {
    setBusy(true);
    const response = await fetch(`/api/orders/${order.id}/simulate-paid`, { method: "POST" });
    if (response.ok) setStatus("paid");
    else setBusy(false);
  }

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const expired =
    status === "expired" || status === "cancelled" || (status === "pending" && remaining === 0);

  // Entrada em cascata (mesma voz do resto do site).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const items = gsap.utils.toArray<HTMLElement>("[data-enter]", root);
    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: DURATION.enter,
        ease: EASE.outStandard,
        stagger: 0.1,
        delay: 0.1,
        clearProps: "opacity,transform",
      },
    );
    return () => {
      tween.kill();
      gsap.set(items, { clearProps: "opacity,transform" });
    };
  }, []);

  const progress = Math.min(1, remaining / PIX_TOTAL_MS);

  return (
    <div
      ref={rootRef}
      className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14"
    >
      <div className="flex flex-col gap-8">
        <div data-enter>
          <p className="font-accent text-label tracking-[0.16em] uppercase opacity-70">
            {expired ? "Pix expirado" : status === "paid" ? "Pago" : "Falta pouco"}
          </p>
          <h1 className="font-rampart mt-3 text-[clamp(2rem,5vw,3.5rem)] leading-[1.05]">
            {expired ? "Esse Pix expirou" : "Paga com Pix"}
          </h1>
        </div>

        {simulated && (
          <p
            data-enter
            className="text-label border-fernandito-off-white/40 rounded-2xl border border-dashed px-4 py-3 font-sans tracking-[0.04em] uppercase opacity-90"
          >
            Modo teste: Pix simulado. Não pague este código.
          </p>
        )}

        {expired ? (
          <div
            data-enter
            className="bg-fernandito-off-white text-fernandito-verde-escuro flex flex-col items-start gap-4 rounded-3xl p-6 font-sans shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-8"
          >
            <p className="text-body-lg max-w-xl">
              O código vale por 30 minutos e esse tempo passou. Nada foi cobrado. Gera um novo Pix
              com o mesmo pedido.
            </p>
            <Button variant="primary" onClick={() => void renew()} disabled={busy}>
              {busy ? "Gerando…" : "Gerar novo Pix"}
            </Button>
            {error && (
              <p role="alert" className="text-body text-red-700">
                {error}
              </p>
            )}
          </div>
        ) : (
          <>
            <div
              data-enter
              className="bg-fernandito-off-white text-fernandito-verde-escuro flex flex-col gap-6 rounded-3xl p-6 font-sans shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-8"
            >
              <div className="flex items-end justify-between gap-4">
                <span className="text-label tracking-[0.08em] uppercase opacity-70">Total</span>
                <span className="font-rampart text-[2.25rem] leading-none tabular-nums">
                  <Price cents={order.totalCents} />
                </span>
              </div>

              <div className="flex flex-col gap-6 md:flex-row-reverse md:items-start md:gap-8">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <label
                    htmlFor="pix-code"
                    className="text-label tracking-[0.08em] uppercase opacity-70"
                  >
                    Código Pix (copia e cola)
                  </label>
                  <textarea
                    id="pix-code"
                    readOnly
                    rows={3}
                    value={order.pix?.qrCode ?? ""}
                    onFocus={(e) => e.currentTarget.select()}
                    className="border-fernandito-verde-escuro/20 w-full resize-none rounded-2xl border bg-white/70 px-4 py-3 font-mono text-[0.8rem] leading-snug break-all"
                  />
                  <Button variant="primary" onClick={() => void copy()} className="w-full !py-3.5">
                    {copied ? "Código copiado ✓" : "Copiar código Pix"}
                  </Button>
                </div>

                <div className="border-fernandito-verde-escuro/15 flex h-52 w-52 shrink-0 items-center justify-center self-center rounded-2xl border bg-white p-3">
                  {order.pix?.qrCodeBase64 ? (
                    <Image
                      src={`data:image/png;base64,${order.pix.qrCodeBase64}`}
                      alt="QR code do Pix"
                      width={200}
                      height={200}
                      unoptimized
                      className="h-full w-full [image-rendering:pixelated]"
                    />
                  ) : (
                    <span className="text-label px-4 text-center uppercase opacity-60">
                      QR code de teste
                    </span>
                  )}
                </div>
              </div>

              {/* Tempo restante: barra que vai esvaziando. */}
              <div aria-live="polite">
                <div className="text-label flex items-center justify-between tracking-[0.06em] uppercase">
                  <span className="flex items-center gap-2 opacity-70">
                    <span className="bg-fernandito-verde-medio inline-block h-2 w-2 animate-pulse rounded-full" />
                    Aguardando pagamento
                  </span>
                  <span className="tabular-nums">
                    Expira em {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                  </span>
                </div>
                <div className="bg-fernandito-verde-escuro/10 mt-2 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-fernandito-verde-medio h-full rounded-full transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>

              {canSimulate && (
                <button
                  type="button"
                  onClick={() => void simulatePaid()}
                  disabled={busy}
                  className="text-label border-fernandito-verde-escuro/40 self-start rounded-full border border-dashed px-4 py-2 uppercase opacity-70 transition-opacity hover:opacity-100"
                >
                  Simular pagamento (só no teste)
                </button>
              )}
            </div>

            <ol data-enter className="grid gap-3 font-sans sm:grid-cols-3">
              {PIX_STEPS.map((step, i) => (
                <li
                  key={step}
                  className="border-fernandito-off-white/20 flex items-center gap-3 rounded-2xl border px-4 py-3"
                >
                  <span className="bg-fernandito-off-white text-fernandito-verde-escuro font-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8rem]">
                    {i + 1}
                  </span>
                  <span className="text-label leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div data-enter>
        <OrderReceipt order={order} />
      </div>
    </div>
  );
}

export default PixPayment;
