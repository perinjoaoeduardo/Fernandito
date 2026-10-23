"use client";

import { clsx } from "clsx";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";
import type { OrderStatus, PublicOrder } from "@/lib/store/orders";
import { Button } from "@/components/ui/Button";
import { OrderReceipt } from "@/components/checkout/OrderReceipt";
import { SuccessCheck } from "@/components/checkout/SuccessCheck";
import { curtainNavigate } from "@/lib/page-transition";
import { Price } from "@/components/ui/Price";
import { whatsappHref } from "@/components/ui/WhatsAppButton";
import { STORE } from "@/content/site";

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
  embedded = false,
}: {
  order: PublicOrder;
  simulated: boolean;
  canSimulate: boolean;
  /** Dentro do checkout (último passo): sem título nem resumo, que o
   * checkout já mostra, e sem a moldura própria do cartão. */
  embedded?: boolean;
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

  // Polling do status (pausa com a aba escondida). No Pix manual também:
  // quando a Fernandito confirmar no painel, a tela vira "confirmado".
  useEffect(() => {
    if (status !== "pending" && status !== "manual") return;
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
    // Pago: um instante de "deu certo" (o selo se desenha) e daí o pedido.
    if (status !== "paid") return;
    const id = window.setTimeout(
      () => curtainNavigate(() => router.replace(`/pedido/${order.id}/confirmado`)),
      prefersReducedMotion() ? 300 : 1700,
    );
    return () => window.clearTimeout(id);
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
  const manual = status === "manual";
  const expired =
    status === "expired" || status === "cancelled" || (status === "pending" && remaining === 0);
  const manualProof = whatsappHref(
    `Oi! Paguei o pedido #${order.id} (R$ ${(order.totalCents / 100).toFixed(2).replace(".", ",")}) na chave Pix. Segue o comprovante:`,
  );
  async function copyKey() {
    try {
      await navigator.clipboard.writeText(STORE.manualPix.key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // sem clipboard: a chave está visível pra copiar à mão
    }
  }

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

  // Entrada do Pix no checkout: o QR "carimba" (cresce com um giro leve),
  // as linhas da direita entram em cascata e a barra do tempo se enche.
  useEffect(() => {
    const root = rootRef.current;
    if (!embedded || !root || prefersReducedMotion()) return;
    const tl = gsap.timeline({ defaults: { ease: EASE.outStandard } });
    tl.fromTo(
      root.querySelectorAll("[data-pix-qr]"),
      { opacity: 0, scale: 0.82, rotate: -5 },
      { opacity: 1, scale: 1, rotate: 0, duration: 0.7, ease: "back.out(1.6)" },
      0.15,
    )
      .fromTo(
        root.querySelectorAll("[data-pix-row]"),
        { opacity: 0, x: 18 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.08 },
        0.25,
      )
      .fromTo(
        root.querySelectorAll("[data-pix-bar]"),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.9, transformOrigin: "left center" },
        0.45,
      );
    return () => {
      tl.kill();
    };
  }, [embedded]);

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
      className={clsx(
        "grid grid-cols-[minmax(0,1fr)] items-start",
        !embedded && "gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12",
      )}
    >
      <div className={clsx("flex flex-col", embedded ? "gap-0" : "gap-8")}>
        <div data-enter className={embedded ? "hidden" : undefined}>
          <p className="font-accent text-label tracking-[0.18em] uppercase opacity-70">
            {manual ? "Pix direto na conta" : expired ? "Pix expirado" : "Falta pouco"}
          </p>
          <h1 className="font-rampart mt-3 text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02]">
            {manual ? "Paga na nossa chave Pix" : expired ? "Esse Pix expirou" : "Paga com Pix"}
          </h1>
        </div>

        {status === "paid" ? (
          <div
            className={clsx(
              "text-fernandito-verde-escuro flex flex-col items-center gap-4 py-10 text-center font-sans",
              !embedded &&
                "bg-fernandito-off-white rounded-3xl px-7 shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
            )}
            role="status"
          >
            <SuccessCheck className="text-fernandito-verde-medio h-20 w-20" />
            <p className="font-rampart text-[1.9rem] leading-none">Pagamento recebido!</p>
            <p className="text-label opacity-70">Abrindo teu pedido…</p>
          </div>
        ) : manual ? (
          // Plano B (Mercado Pago fora): chave Pix da conta + comprovante no
          // WhatsApp. O pedido já está guardado e as unidades reservadas.
          <div
            data-enter
            className={clsx(
              "text-fernandito-verde-escuro flex flex-col items-start gap-5 font-sans",
              embedded
                ? ""
                : "bg-fernandito-off-white rounded-3xl p-7 shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-9",
            )}
          >
            <p className="text-body-lg max-w-xl">
              O Pix automático deu problema, mas teu pedido já está guardado. Paga{" "}
              <span className="font-bold">
                <Price cents={order.totalCents} />
              </span>{" "}
              na chave abaixo e manda o comprovante no WhatsApp. A gente confere e confirma.
            </p>
            <div className="border-fernandito-verde-escuro/15 w-full rounded-2xl border bg-white/60 p-4">
              <p className="text-label tracking-[0.1em] uppercase opacity-60">
                {STORE.manualPix.keyLabel} · {STORE.manualPix.holder}
              </p>
              <p className="font-accent mt-1 text-[1.15rem] break-all">{STORE.manualPix.key}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => void copyKey()}>
                {copied ? "Chave copiada!" : "Copiar chave"}
              </Button>
              {manualProof && (
                <Button
                  as="a"
                  href={manualProof}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                >
                  Mandar comprovante
                </Button>
              )}
            </div>
            <p className="text-label opacity-60">
              Pedido #{order.id} · esta tela atualiza sozinha quando a gente confirmar.
            </p>
          </div>
        ) : expired ? (
          <div
            data-enter
            className={clsx(
              "text-fernandito-verde-escuro flex flex-col items-start gap-5 font-sans",
              embedded
                ? ""
                : "bg-fernandito-off-white rounded-3xl p-7 shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-9",
            )}
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
        ) : embedded ? (
          // Dentro do checkout: um cartão só. Em cima, o status e o tempo;
          // no meio, o QR (computador) e o botão grande de copiar; embaixo,
          // como pagar em 3 passos curtos.
          <div
            data-enter
            className="text-fernandito-verde-escuro ring-fernandito-verde-escuro/10 overflow-hidden rounded-2xl bg-white/60 font-sans ring-1"
          >
            <div data-pix-row className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
              <span className="text-label bg-fernandito-verde-claro/15 text-fernandito-verde-medio inline-flex items-center gap-2 rounded-full px-3 py-1 font-bold whitespace-nowrap">
                <span className="bg-fernandito-verde-medio inline-block h-2 w-2 shrink-0 animate-pulse rounded-full" />
                Aguardando<span className="hidden sm:inline"> pagamento</span>
              </span>
              <span
                className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"
                aria-live="polite"
              >
                <span className="text-label whitespace-nowrap opacity-60">Expira em</span>
                <span className="font-rampart text-[1.35rem] leading-none tabular-nums">
                  {timeLeft}
                </span>
              </span>
            </div>
            <div className="bg-fernandito-verde-escuro/10 mx-5 h-1 overflow-hidden rounded-full">
              <div
                data-pix-bar
                className="bg-fernandito-verde-medio h-full rounded-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="grid gap-5 px-5 pt-6 pb-6 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:items-center sm:p-5">
              <div data-pix-qr className="hidden sm:block">
                {qr}
              </div>
              <div className="flex min-w-0 flex-col gap-3.5">
                <button
                  data-pix-row
                  type="button"
                  onClick={() => void copy()}
                  className={clsx(
                    "duration-base ease-out-standard flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[1rem] font-bold transition-colors active:scale-[0.98]",
                    copied
                      ? "bg-fernandito-verde-claro text-fernandito-off-white"
                      : "bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio",
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-5 w-5"
                  >
                    {copied ? (
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    ) : (
                      <>
                        <rect x="8" y="8" width="12" height="12" rx="2.5" />
                        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                      </>
                    )}
                  </svg>
                  {copied ? "Código copiado!" : "Copiar código Pix"}
                </button>
                {/* O código fica numa caixinha própria (dá pra selecionar à mão). */}
                <label
                  data-pix-row
                  htmlFor="pix-code"
                  className="border-fernandito-verde-escuro/15 flex h-11 min-w-0 items-center gap-2.5 rounded-xl border bg-white/70 px-3.5"
                >
                  <span className="shrink-0 font-sans text-[0.68rem] leading-none font-bold tracking-[0.1em] uppercase opacity-50">
                    Código
                  </span>
                  <input
                    id="pix-code"
                    readOnly
                    value={order.pix?.qrCode ?? ""}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 truncate bg-transparent font-mono text-[0.75rem] leading-none opacity-70 outline-none"
                  />
                </label>
                {/* Como pagar: 3 passos numa linha do tempo vertical. */}
                <ol data-pix-row className="mt-3 flex flex-col">
                  {[
                    { t: "Abre o app do teu banco", s: "Na área Pix" },
                    { t: "Pix copia e cola", s: "Cola o código (ou lê o QR)" },
                    { t: "Confirma o pagamento", s: "Esta tela muda sozinha" },
                  ].map((step, i, all) => (
                    <li key={step.t} className="relative flex gap-3.5 pb-5 last:pb-0">
                      {i < all.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="bg-fernandito-verde-escuro/15 absolute top-6 bottom-0 left-[0.6875rem] w-px"
                        />
                      )}
                      <span className="bg-fernandito-verde-escuro text-fernandito-off-white relative flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full text-[0.68rem] font-bold">
                        {i + 1}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5 pt-px">
                        <span className="text-label font-bold">{step.t}</span>
                        <span className="text-label opacity-60">{step.s}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <details className="group sm:hidden">
                  <summary className="text-label mt-3 flex cursor-pointer list-none items-center gap-2 underline underline-offset-4 opacity-70">
                    Pagar de outro celular? Mostrar QR code
                  </summary>
                  <div className="mt-4 flex justify-center">{qr}</div>
                </details>
              </div>
            </div>
            {(simulated || canSimulate) && (
              <div className="border-fernandito-verde-escuro/10 bg-fernandito-verde-escuro/[0.04] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-5 py-4">
                {simulated && (
                  <p className="text-label opacity-60">Modo teste: não pague este código</p>
                )}
                {canSimulate && (
                  <button
                    type="button"
                    onClick={() => void simulatePaid()}
                    disabled={busy}
                    className="text-label underline underline-offset-4 opacity-80 hover:opacity-100"
                  >
                    Simular pagamento
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            data-enter
            className={clsx(
              "text-fernandito-verde-escuro overflow-hidden font-sans",
              embedded
                ? "border-fernandito-verde-escuro/10 rounded-2xl border bg-white/50"
                : "bg-fernandito-off-white rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
            )}
          >
            {/* Topo: total + tempo restante. */}
            <div className="border-fernandito-verde-escuro/10 flex flex-wrap items-end justify-between gap-4 border-b px-6 pt-6 pb-5 sm:px-8">
              <div className={embedded ? "hidden" : undefined}>
                <p className="text-label tracking-[0.1em] uppercase opacity-60">Total</p>
                <p className="font-rampart mt-1.5 text-[2.5rem] leading-none tabular-nums">
                  <Price cents={order.totalCents} />
                </p>
              </div>
              <div
                className={embedded ? "flex w-full items-baseline justify-between" : "text-right"}
                aria-live="polite"
              >
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

            <div
              className={clsx(
                "grid gap-7 px-6 py-7 sm:px-8 md:items-center",
                embedded
                  ? "md:grid-cols-[10.5rem_minmax(0,1fr)] md:gap-6"
                  : "md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8",
              )}
            >
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
                <Button
                  variant="primary"
                  onClick={() => void copy()}
                  className="w-full !py-4 whitespace-nowrap"
                >
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
            {embedded ? (
              <p className="border-fernandito-verde-escuro/10 text-label border-t px-6 py-4 leading-snug opacity-75 sm:px-8">
                Abre o app do banco, lê o QR ou cola o código. Esta tela atualiza sozinha quando o
                pagamento cair.
              </p>
            ) : (
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
            )}

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
        {help &&
          !manual &&
          status !== "paid" &&
          (embedded ? (
            <p
              data-enter
              className="text-label border-fernandito-verde-escuro/10 mt-6 border-t pt-4 font-sans leading-relaxed opacity-75"
            >
              Já pagou e a tela não mudou? Não paga de novo.{" "}
              <a
                href={help}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline underline-offset-4 hover:opacity-100"
              >
                Fala com a gente no WhatsApp
              </a>
              .
            </p>
          ) : (
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
          ))}
      </div>

      {!embedded && (
        <div data-enter className="lg:sticky lg:top-32">
          <OrderReceipt order={order} />
        </div>
      )}
    </div>
  );
}

export default PixPayment;
