"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";
import type { OrderStatus, PublicOrder } from "@/lib/store/orders";
import { Button } from "@/components/ui/Button";
import { OrderReceipt } from "@/components/checkout/OrderReceipt";
import { Price } from "@/components/ui/Price";
import { whatsappHref } from "@/components/ui/WhatsAppButton";

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
  "Abre o app do banco",
  "Lê o QR ou cola o código",
  "Confirma: a tela atualiza sozinha",
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

  const help = whatsappHref(
    `Oi! Paguei o Pix do pedido #${order.id} e a tela não confirmou. Pode conferir?`,
  );

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
  const timeLeft = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const qr = (
    <div className="border-fernandito-verde-escuro/10 flex aspect-square w-full max-w-[15rem] items-center justify-center rounded-2xl border bg-white p-3 shadow-[inset_0_0_0_6px_rgba(255,255,255,1)]">
      {order.pix?.qrCodeBase64 ? (
        <Image
          src={`data:image/png;base64,${order.pix.qrCodeBase64}`}
          alt="QR code do Pix"
          width={220}
          height={220}
          unoptimized
          className="h-full w-full [image-rendering:pixelated]"
        />
      ) : (
        <span className="text-label px-4 text-center uppercase opacity-50">QR code de teste</span>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12"
    >
      <div className="flex flex-col gap-8">
        <div data-enter>
          <p className="font-accent text-label tracking-[0.18em] uppercase opacity-70">
            {expired ? "Pix expirado" : "Falta pouco"}
          </p>
          <h1 className="font-rampart mt-3 text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02]">
            {expired ? "Esse Pix expirou" : "Paga com Pix"}
          </h1>
        </div>

        {expired ? (
          <div
            data-enter
            className="bg-fernandito-off-white text-fernandito-verde-escuro flex flex-col items-start gap-5 rounded-3xl p-7 font-sans shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-9"
          >
            <p className="text-body-lg max-w-xl">
              O código vale por 30 minutos. Nada foi cobrado: gera um novo Pix pro mesmo pedido.
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
          <div
            data-enter
            className="bg-fernandito-off-white text-fernandito-verde-escuro overflow-hidden rounded-3xl font-sans shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          >
            {/* Topo: total + tempo restante. */}
            <div className="border-fernandito-verde-escuro/10 flex flex-wrap items-end justify-between gap-4 border-b px-6 pt-6 pb-5 sm:px-8">
              <div>
                <p className="text-label tracking-[0.1em] uppercase opacity-60">Total</p>
                <p className="font-rampart mt-1.5 text-[2.5rem] leading-none tabular-nums">
                  <Price cents={order.totalCents} />
                </p>
              </div>
              <div className="text-right" aria-live="polite">
                <p className="text-label tracking-[0.1em] uppercase opacity-60">Expira em</p>
                <p className="font-rampart mt-1.5 text-[1.75rem] leading-none tabular-nums">
                  {timeLeft}
                </p>
              </div>
              <div className="bg-fernandito-verde-escuro/10 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="bg-fernandito-verde-medio h-full rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            <div className="grid gap-7 px-6 py-7 sm:px-8 md:grid-cols-[13rem_minmax(0,1fr)] md:items-center md:gap-8">
              {/* QR: no computador sempre; no celular, sob demanda (quem
                  está no celular copia o código). */}
              <div className="hidden md:block">{qr}</div>

              <div className="flex min-w-0 flex-col gap-3">
                <label
                  htmlFor="pix-code"
                  className="text-label tracking-[0.1em] uppercase opacity-60"
                >
                  Pix copia e cola
                </label>
                <textarea
                  id="pix-code"
                  readOnly
                  rows={3}
                  value={order.pix?.qrCode ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  className="border-fernandito-verde-escuro/15 w-full resize-none rounded-xl border bg-white/70 px-4 py-3 font-mono text-[0.75rem] leading-snug break-all"
                />
                <Button variant="primary" onClick={() => void copy()} className="w-full !py-4">
                  {copied ? "Código copiado ✓" : "Copiar código Pix"}
                </Button>
                <p className="text-label mt-1 flex items-center gap-2 tracking-[0.08em] uppercase opacity-70">
                  <span className="bg-fernandito-verde-medio inline-block h-2 w-2 animate-pulse rounded-full" />
                  Aguardando pagamento
                </p>
                <details className="group mt-1 md:hidden">
                  <summary className="text-label flex cursor-pointer list-none items-center gap-2 tracking-[0.1em] uppercase underline underline-offset-4 opacity-70">
                    Mostrar QR code
                  </summary>
                  <div className="mt-4 flex justify-center">{qr}</div>
                </details>
              </div>
            </div>

            {/* Como pagar: três passos curtos. */}
            <ol className="border-fernandito-verde-escuro/10 grid gap-3 border-t px-6 py-5 sm:px-8 md:grid-cols-3 md:gap-4">
              {PIX_STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="bg-fernandito-verde-escuro text-fernandito-off-white flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8rem] leading-none font-bold">
                    {i + 1}
                  </span>
                  <span className="text-label leading-snug tracking-[0.04em]">{step}</span>
                </li>
              ))}
            </ol>

            {(simulated || canSimulate) && (
              <div className="border-fernandito-verde-escuro/10 bg-fernandito-verde-escuro/[0.04] flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
                {simulated && (
                  <p className="text-label tracking-[0.06em] uppercase opacity-70">
                    Modo teste: não pague este código
                  </p>
                )}
                {canSimulate && (
                  <button
                    type="button"
                    onClick={() => void simulatePaid()}
                    disabled={busy}
                    className="text-label border-fernandito-verde-escuro/40 rounded-full border border-dashed px-4 py-2 tracking-[0.06em] uppercase opacity-80 transition-opacity hover:opacity-100"
                  >
                    Simular pagamento
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {/* Saída pra qualquer problema: com o número do pedido, quem
            atende acha no painel da loja na hora. */}
        {help && (
          <p data-enter className="text-body mt-5 font-sans opacity-80">
            Pagou e a tela não mudou? Não paga de novo:{" "}
            <a
              href={help}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:opacity-100"
            >
              chama a gente no WhatsApp
            </a>{" "}
            com o pedido <span className="font-bold">#{order.id}</span>.
          </p>
        )}
      </div>

      <div data-enter className="lg:sticky lg:top-32">
        <OrderReceipt order={order} />
      </div>
    </div>
  );
}

export default PixPayment;
