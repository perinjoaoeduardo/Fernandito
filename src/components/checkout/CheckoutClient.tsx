"use client";

import { useStock } from "@/components/cart/useStock";
import { clsx } from "clsx";
import NextLink from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";
import { maskCEP, maskCPF, maskPhone, onlyDigits } from "@/lib/br";
import { formatBRL } from "@/lib/money";
import { addressSchema, customerSchema, fieldErrors, NOTE_MAX, orderSchema } from "@/lib/order";
import { formatDays, getShippingOptions, type ShippingOption } from "@/lib/shipping";
import { SHOP_HREF, STORE } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { useCart } from "@/components/cart/CartProvider";
import { Field } from "@/components/checkout/Field";
import { PixPayment } from "@/components/checkout/PixPayment";
import type { PublicOrder } from "@/lib/store/orders";
import { Price } from "@/components/ui/Price";
import { splitName } from "@/lib/catalog";

/**
 * Checkout em 4 etapas, uma de cada vez, numa tela dividida: à esquerda, em
 * verde (cor principal), título, progresso horizontal (verde-claro) e o
 * resumo — com o que já foi preenchido e "Editar"; à direita, num painel
 * bege (contraste), a etapa atual com uma pergunta ("Quem tá levando?") e o
 * conteúdo deslizando pro lado ao avançar/voltar. Etapas: contato → entrega
 * (CEP via ViaCEP) → frete → idade e pagamento. No celular empilha: título,
 * progresso, total (abre o resumo) e o painel. "Pagar com Pix" valida o pedido inteiro (zod), manda pro
 * servidor (/api/checkout/pix — que recalcula tudo e gera o Pix no Mercado
 * Pago) e abre a tela do Pix em /pedido/[id].
 */

const STEPS = ["Contato", "Entrega", "Frete", "Pagamento"] as const;

/** Título e linha de apoio de cada etapa — conversa, não formulário. */
const STEP_COPY = [
  { title: "Quem tá levando?", hint: "Pra gente saber pra quem mandar e emitir a nota." },
  { title: "Pra onde vai o tordilho?", hint: "" },
  { title: "Como ele chega?", hint: "" },
  { title: "Paga com Pix", hint: "" },
] as const;

type Contact = { name: string; email: string; phone: string; cpf: string };
type AddressForm = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  uf: string;
};

const EMPTY_CONTACT: Contact = { name: "", email: "", phone: "", cpf: "" };
const EMPTY_ADDRESS: AddressForm = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  uf: "",
};

export function CheckoutClient({ canSimulate = false }: { canSimulate?: boolean }) {
  const cart = useCart();
  const [step, setStep] = useState(0);
  // Direção da última troca de etapa (1 = avançando, -1 = voltando): o
  // conteúdo desliza pro lado certo.
  const [direction, setDirection] = useState(1);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [shippingFallback, setShippingFallback] = useState(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [ageConfirmedAt, setAgeConfirmedAt] = useState<string | null>(null);
  // Sem opção de novidades por e-mail no checkout (tirada em 20/10).
  const marketingOptIn = false;
  // Recado opcional (presente, cartinha, pedido especial).
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  // Tentou seguir sem marcar o 18+: o cartão avisa em vermelho.
  const [ageError, setAgeError] = useState(false);
  // Pix gerado no passo do frete: o último passo já abre com o QR.
  const [pixOrder, setPixOrder] = useState<PublicOrder | null>(null);
  // Pix gerado: o carrinho do menu some (mudar a quantidade agora não muda
  // o Pix e confundiria). Volta ao sair do checkout.
  useEffect(() => {
    if (!pixOrder) return;
    document.documentElement.dataset.pixOpen = "";
    return () => {
      delete document.documentElement.dataset.pixOpen;
    };
  }, [pixOrder]);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Esgotou enquanto a pessoa preenchia: avisa antes de ela chegar no Pix.
  const { soldOut } = useStock();
  // Uma chave por tentativa: clique duplo/reenvio → o mesmo pedido e Pix.
  const idempotencyKey = useRef<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const shipping = options?.find((option) => option.id === shippingId) ?? null;
  const totalCents = cart.subtotalCents + (shipping?.priceCents ?? 0);

  // Itens pra cotação de frete (peso/dimensões por produto). Mudou o
  // carrinho depois de cotar → cota de novo.
  const shippingItems = useMemo(
    () =>
      cart.lines.map((line) => ({
        qty: line.qty,
        priceCents: line.product.priceCents,
        ...line.product.shipping,
      })),
    [cart.lines],
  );
  const cartKey = cart.lines.map((l) => `${l.sku}:${l.qty}`).join("|");
  const quotedKey = useRef<string | null>(null);

  async function quote() {
    setShippingLoading(true);
    const result = await getShippingOptions(
      { cep: address.cep, city: address.city, uf: address.uf },
      shippingItems,
    );
    quotedKey.current = cartKey;
    setOptions(result.options);
    setShippingFallback(result.fallback);
    setShippingId(result.options[0]?.id ?? null);
    setShippingLoading(false);
  }

  useEffect(() => {
    if (step >= 2 && options && quotedKey.current !== cartKey && cart.lines.length > 0) {
      void quote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  // ── Etapa B: CEP → ViaCEP ────────────────────────────────────────────────
  async function lookupCep(rawCep: string) {
    const cep = onlyDigits(rawCep);
    if (cep.length !== 8) return;
    setCepStatus("loading");
    try {
      // ViaCEP lento/fora: em 5 s desiste e a pessoa preenche à mão.
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (!response.ok || data.erro) throw new Error("CEP não encontrado");
      setAddress((current) => ({
        ...current,
        street: data.logradouro || current.street,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        uf: data.uf || current.uf,
      }));
      setCepStatus("found");
      setErrors((current) => ({ ...current, "address.cep": "" }));
      requestAnimationFrame(() => numberRef.current?.focus());
    } catch {
      setCepStatus("error");
    }
  }

  // ── Navegação entre etapas ───────────────────────────────────────────────
  function goTo(next: number) {
    setDirection(next >= step ? 1 : -1);
    setStep(next);
    // No celular o painel fica embaixo do resumo: volta pro topo dele.
    requestAnimationFrame(() => {
      const panel = document.getElementById("etapa");
      if (!panel) return;
      const top = panel.getBoundingClientRect().top;
      // Celular: o começo da etapa nova sempre à vista (perto do topo).
      const mobile = window.innerWidth < 1024;
      if (top < 0 || (mobile && top > window.innerHeight * 0.4))
        panel.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function submitContact() {
    const parsed = customerSchema.safeParse(contact);
    if (!parsed.success) {
      setErrors(prefix("customer", fieldErrors(parsed.error)));
      return;
    }
    setErrors({});
    goTo(1);
  }

  async function submitAddress() {
    const parsed = addressSchema.safeParse(address);
    if (!parsed.success) {
      setErrors(prefix("address", fieldErrors(parsed.error)));
      return;
    }
    setErrors({});
    goTo(2);
    await quote();
  }

  function submitShipping() {
    if (!shipping) return;
    if (!ageConfirmedAt) {
      setAgeError(true);
      return;
    }
    void pay();
  }

  async function pay() {
    if (!shipping || paying) return;
    if (!ageConfirmedAt) {
      setAgeError(true);
      goTo(2);
      return;
    }
    const candidate = {
      items: cart.lines.map((line) => ({
        sku: line.sku,
        qty: line.qty,
        unitPriceCents: line.product.priceCents,
      })),
      customer: contact,
      address,
      shipping,
      subtotalCents: cart.subtotalCents,
      totalCents,
      ageConfirmed: true as const,
      ageConfirmedAt,
      marketingOptIn,
      note,
    };
    const parsed = orderSchema.safeParse(candidate);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      // Volta pra primeira etapa com problema.
      const firstKey = Object.keys(errs)[0] ?? "";
      goTo(
        firstKey.startsWith("customer")
          ? 0
          : firstKey.startsWith("address")
            ? 1
            : firstKey === "note"
              ? 0
              : 2,
      );
      return;
    }
    setPaying(true);
    setPayError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/checkout/pix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify(parsed.data),
      });
      const data = (await response.json().catch(() => ({}))) as {
        order?: { id: string } & Partial<PublicOrder>;
        error?: string;
        code?: string;
      };
      if (!response.ok || !data.order) {
        // Pedido mudou (frete/preço): nova tentativa = nova chave.
        idempotencyKey.current = null;
        if (data.code === "shipping") {
          setOptions(null);
          goTo(1);
        }
        throw new Error(data.error ?? "Não deu pra gerar o Pix. Tenta de novo.");
      }
      setPixOrder(data.order as PublicOrder);
      setPaying(false);
      goTo(3);
      // Recarregou a página? Cai na tela do Pix desse pedido, não num checkout vazio.
      window.history.replaceState(null, "", `/pedido/${data.order.id}`);
    } catch (error) {
      setPayError((error as Error).message);
      setPaying(false);
    }
  }

  // Entrada da tela: coluna verde e painel bege sobem em cascata (mesma voz
  // do resto do site: `DURATION.enter` + `EASE.outStandard`).
  const ready = cart.ready && cart.lines.length > 0;
  useEffect(() => {
    const root = topRef.current;
    if (!ready || !root || prefersReducedMotion()) return;
    const items = gsap.utils.toArray<HTMLElement>("[data-enter]", root);
    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: DURATION.enter,
        ease: EASE.outStandard,
        stagger: 0.09,
        delay: 0.1,
        clearProps: "opacity,transform",
      },
    );
    return () => {
      tween.kill();
      gsap.set(items, { clearProps: "opacity,transform" });
    };
  }, [ready]);

  // ── Telas especiais ──────────────────────────────────────────────────────
  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- raster pequeno de tamanho fixo */}
        <img
          src="/logo/fernandito-selo.webp"
          alt=""
          width={640}
          height={653}
          decoding="async"
          className="cart-empty-horse h-auto w-28 drop-shadow-[0_14px_24px_rgba(20,28,18,0.35)]"
        />
        <h1 className="font-rampart mt-2 text-[clamp(2rem,5vw,3.25rem)] leading-[1.05]">
          O tordilho tá sem carga
        </h1>
        <p className="text-body-lg font-sans opacity-80">
          Que tal levar umas latas de fernet y cola?
        </p>
        <Button
          as="a"
          href={SHOP_HREF}
          variant="primary"
          className="!bg-fernandito-off-white !text-fernandito-verde-escuro hover:!bg-fernandito-verde-claro hover:!text-fernandito-off-white mt-2"
        >
          Ver o kit
        </Button>
      </div>
    );
  }

  // O que já foi preenchido (aparece na coluna verde, com "Editar").
  const recap = [
    { label: "Contato", value: `${contact.name} · ${contact.email}` },
    {
      label: "Entrega",
      value: `${address.street}, ${address.number}${address.complement ? ` — ${address.complement}` : ""} · ${address.city}/${address.uf}`,
    },
    {
      label: "Frete",
      value: shipping
        ? `${shipping.source === "local" ? "Entrega em mãos" : shipping.carrier} · ${formatDays(shipping.days)}`
        : "",
    },
  ].slice(0, step);

  return (
    <div
      ref={topRef}
      className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-x-12 lg:gap-y-8"
    >
      {/* Computador: formulário à esquerda (com o título em cima, numa linha) e
          resumo à direita, como nos checkouts de sempre. Celular: título,
          etapas, total e formulário, nessa ordem. */}
      <div data-enter className="lg:col-start-1 lg:row-start-1">
        <NextLink
          href={SHOP_HREF}
          scroll={false}
          className="text-label duration-base ease-out-standard hover:text-fernandito-verde-claro inline-flex items-center gap-2 font-sans font-bold tracking-[0.1em] uppercase opacity-90 transition-[color,opacity] hover:opacity-100"
        >
          <span aria-hidden="true">←</span> Voltar ao kit
        </NextLink>
        <h1 className="font-rampart mt-3 text-[clamp(1.6rem,8vw,3.5rem)] leading-[1] whitespace-nowrap lg:text-[clamp(2.25rem,3.2vw,3rem)]">
          Finalizar compra
        </h1>
        {/* No computador as etapas vão pra dentro do cartão do formulário. */}
        <div className="mt-7 lg:hidden">
          <Progress step={step} onGo={(i) => !pixOrder && i < step && goTo(i)} />
        </div>
      </div>

      {/* Celular: o resumo só aparece no pagamento (aberto, com o pedido e
          os dados); antes, o formulário fica sozinho na tela. */}
      <div className={clsx("min-w-0 lg:col-start-2 lg:row-start-2", step < 3 && "hidden lg:block")}>
        <SummaryCard
          expanded={step === 3}
          locked={Boolean(pixOrder)}
          shipping={shipping}
          totalCents={totalCents}
          recap={recap}
          onEdit={(i) => !pixOrder && goTo(i)}
        />
      </div>

      {/* ── Painel bege: uma etapa por vez ──────────────────────────────── */}
      <section
        id="etapa"
        data-enter
        aria-labelledby="etapa-titulo"
        className="bg-fernandito-off-white text-fernandito-verde-escuro scroll-mt-28 overflow-hidden rounded-[2rem] shadow-[0_30px_70px_rgba(20,28,18,0.35)] lg:col-start-1 lg:row-start-2"
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            // Troca de etapa sutil: desliza pouco e desfoca de leve.
            initial={reduceMotion ? false : { opacity: 0, x: 20 * direction, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={
              reduceMotion ? undefined : { opacity: 0, x: -14 * direction, filter: "blur(4px)" }
            }
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="p-6 sm:p-8 lg:px-9 lg:py-7"
          >
            {/* As etapas já aparecem logo acima (celular) ou no cartão (computador). */}
            <div className="hidden lg:block">
              <Progress step={step} onGo={(i) => !pixOrder && i < step && goTo(i)} tone="light" />
            </div>
            <h2
              id="etapa-titulo"
              className="font-rampart text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.02] text-balance lg:mt-6 lg:text-[clamp(1.6rem,2.2vw,2rem)]"
            >
              {STEP_COPY[step].title}
            </h2>
            {STEP_COPY[step].hint && (
              <p className="text-body mt-2 max-w-md font-sans opacity-70 lg:mt-1.5 lg:text-[0.95rem]">
                {STEP_COPY[step].hint}
              </p>
            )}

            <div className="mt-6">
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:gap-x-4 lg:gap-y-3.5">
                  <Field
                    id="nome"
                    label="Nome completo"
                    autoComplete="name"
                    placeholder="Como tá no documento"
                    className="sm:col-span-2"
                    value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    error={errors["customer.name"]}
                  />
                  <Field
                    id="email"
                    type="email"
                    label="E-mail"
                    autoComplete="email"
                    placeholder="tu@email.com"
                    inputMode="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    error={errors["customer.email"]}
                  />
                  <Field
                    id="telefone"
                    type="tel"
                    label="WhatsApp"
                    autoComplete="tel-national"
                    inputMode="tel"
                    placeholder="(51) 99999-9999"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: maskPhone(e.target.value) })}
                    error={errors["customer.phone"]}
                  />
                  <Field
                    id="cpf"
                    label="CPF"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    className="sm:col-span-2"
                    value={contact.cpf}
                    onChange={(e) => setContact({ ...contact, cpf: maskCPF(e.target.value) })}
                    error={errors["customer.cpf"]}
                    aside="Só pra nota fiscal"
                  />
                  {/* Recado opcional, discreto: só vira campo se clicar. */}
                  <div className="sm:col-span-2">
                    {noteOpen || note ? (
                      <NoteCard value={note} onChange={setNote} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNoteOpen(true)}
                        className="text-label duration-base ease-out-standard hover:text-fernandito-verde-medio font-sans underline underline-offset-4 opacity-70 transition-[color,opacity] hover:opacity-100"
                      >
                        + Deixar um recado (é presente?)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid grid-cols-6 gap-x-3 gap-y-4 sm:gap-4 lg:gap-x-4 lg:gap-y-3.5">
                  <Field
                    id="cep"
                    label="CEP"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    className="col-span-3 sm:col-span-2"
                    value={address.cep}
                    onChange={(e) => {
                      const cep = maskCEP(e.target.value);
                      setAddress({ ...address, cep });
                      setOptions(null);
                      if (onlyDigits(cep).length === 8) void lookupCep(cep);
                      else setCepStatus("idle");
                    }}
                    error={
                      errors["address.cep"] ||
                      (cepStatus === "error"
                        ? "CEP não encontrado — preenche o endereço à mão"
                        : undefined)
                    }
                    hint={
                      cepStatus === "loading"
                        ? "Buscando endereço…"
                        : cepStatus === "found"
                          ? "Achamos ✓"
                          : undefined
                    }
                  />
                  <Field
                    id="rua"
                    label="Rua"
                    autoComplete="address-line1"
                    className="col-span-6 sm:col-span-4"
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    error={errors["address.street"]}
                  />
                  <Field
                    ref={numberRef}
                    id="numero"
                    label="Número"
                    inputMode="numeric"
                    className="col-span-2 sm:col-span-2"
                    value={address.number}
                    onChange={(e) => setAddress({ ...address, number: e.target.value })}
                    error={errors["address.number"]}
                  />
                  <Field
                    id="complemento"
                    label="Complemento (opcional)"
                    autoComplete="address-line2"
                    className="col-span-4 sm:col-span-4"
                    value={address.complement}
                    onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                    error={errors["address.complement"]}
                  />
                  <Field
                    id="bairro"
                    label="Bairro"
                    className="col-span-6 sm:col-span-2"
                    value={address.neighborhood}
                    onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                    error={errors["address.neighborhood"]}
                  />
                  <Field
                    id="cidade"
                    label="Cidade"
                    autoComplete="address-level2"
                    className="col-span-4 sm:col-span-3"
                    value={address.city}
                    onChange={(e) => {
                      setAddress({ ...address, city: e.target.value });
                      setOptions(null);
                    }}
                    error={errors["address.city"]}
                  />
                  <Field
                    id="uf"
                    label="UF"
                    autoComplete="address-level1"
                    maxLength={2}
                    className="col-span-2 sm:col-span-1"
                    value={address.uf}
                    onChange={(e) => {
                      setAddress({
                        ...address,
                        uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
                      });
                      setOptions(null);
                    }}
                    error={errors["address.uf"]}
                  />
                </div>
              )}

              {step === 2 &&
                (shippingLoading || !options ? (
                  <div className="flex flex-col gap-3" aria-live="polite">
                    <span className="sr-only">Calculando frete…</span>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="bg-fernandito-verde-escuro/[0.06] h-[4.5rem] animate-pulse rounded-2xl"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                ) : (
                  <fieldset className="grid gap-3 font-sans">
                    <legend className="sr-only">Escolha o frete</legend>
                    {shippingFallback && (
                      <p className="text-label mb-1 tracking-[0.04em] uppercase opacity-70">
                        Não deu pra cotar agora — usando o frete padrão da tua região.
                      </p>
                    )}
                    {options.map((option, i) => {
                      const selected = option.id === shippingId;
                      const local = option.source === "local";
                      // Selos só fazem sentido comparando: com uma opção, nenhum.
                      const compare = options.length > 1 && !local;
                      const fastest =
                        compare &&
                        i !== 0 &&
                        option.days.max ===
                          Math.min(
                            ...options.filter((o) => o.source !== "local").map((o) => o.days.max),
                          ) &&
                        options[0].days.max !== option.days.max;
                      const badges = (
                        <>
                          {compare && i === 0 && (
                            <span className="bg-fernandito-verde-claro text-fernandito-off-white rounded-full px-2 py-0.5 font-sans text-[0.62rem] font-bold tracking-[0.08em] uppercase">
                              Mais barato
                            </span>
                          )}
                          {fastest && (
                            <span className="bg-fernandito-verde-escuro text-fernandito-off-white rounded-full px-2 py-0.5 font-sans text-[0.62rem] font-bold tracking-[0.08em] uppercase">
                              Mais rápido
                            </span>
                          )}
                        </>
                      );
                      return (
                        <label
                          key={option.id}
                          className={clsx(
                            "duration-base ease-out-standard relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-4 transition-[background-color,border-color,transform] hover:-translate-y-0.5",
                            selected
                              ? "border-fernandito-verde-claro bg-fernandito-verde-claro/15"
                              : "border-fernandito-verde-escuro/12 hover:border-fernandito-verde-claro/60 bg-white/40",
                          )}
                        >
                          <input
                            type="radio"
                            name="frete"
                            value={option.id}
                            checked={selected}
                            onChange={() => setShippingId(option.id)}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={clsx(
                              "duration-base ease-out-standard peer-focus-visible:outline-fernandito-verde-medio flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                              selected
                                ? "border-fernandito-verde-claro bg-fernandito-verde-claro"
                                : "border-fernandito-verde-escuro/30",
                            )}
                          >
                            <span
                              className={clsx(
                                "bg-fernandito-off-white duration-base ease-out-standard h-2.5 w-2.5 rounded-full transition-transform",
                                selected ? "scale-100" : "scale-0",
                              )}
                            />
                          </span>
                          {/* Celular: nome e preço na mesma linha, selo e prazo
                              embaixo (o cartão fica baixo). Computador: preço à
                              direita, selo do lado do nome. */}
                          <span className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-0.5">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-body flex flex-wrap items-center gap-2 font-bold">
                                {local ? "Entrega em mãos · Porto Alegre" : option.carrier}
                                <span className="hidden sm:contents">{badges}</span>
                              </span>
                              <span className="font-rampart text-[1.2rem] leading-none tabular-nums sm:hidden">
                                <Price cents={option.priceCents} />
                              </span>
                            </span>
                            <span className="text-label flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="contents sm:hidden">{badges}</span>
                              <span className="opacity-65">
                                <span className="hidden sm:inline">
                                  {local ? "A gente leva" : option.service} ·{" "}
                                </span>
                                {local && <span className="sm:hidden">A gente leva · </span>}
                                {formatDays(option.days)}
                              </span>
                            </span>
                          </span>
                          <span className="font-rampart hidden text-[1.3rem] leading-none tabular-nums sm:block">
                            <Price cents={option.priceCents} />
                          </span>
                        </label>
                      );
                    })}
                    <div className="border-fernandito-verde-escuro/10 mt-3 flex flex-col gap-3 border-t pt-5">
                      <ConfirmRow
                        checked={ageConfirmedAt !== null}
                        onChange={(checked) => {
                          setAgeConfirmedAt(checked ? new Date().toISOString() : null);
                          if (checked) setAgeError(false);
                        }}
                        title="Tenho 18 anos ou mais"
                        hint={
                          ageError
                            ? "Marca aqui pra seguir: venda só pra maiores de 18."
                            : "Venda proibida para menores de 18 anos."
                        }
                        error={ageError}
                        required
                      />
                    </div>
                  </fieldset>
                ))}

              {step === 3 && pixOrder && (
                <PixPayment
                  order={pixOrder}
                  simulated={Boolean(pixOrder.pix && !pixOrder.pix.qrCodeBase64)}
                  canSimulate={canSimulate}
                  embedded
                />
              )}
            </div>

            {/* Ações (no Pix não tem: o próprio Pix é o fim). */}
            {step < 3 && (
              <div className="mt-9 flex items-center gap-3 sm:justify-between lg:mt-7">
                {step > 0 && step < 3 ? (
                  <button
                    type="button"
                    onClick={() => goTo(step - 1)}
                    aria-label="Voltar"
                    // Celular: botão redondo ao lado do principal; computador: texto.
                    className="text-label border-fernandito-verde-escuro/20 hover:text-fernandito-verde-medio duration-base ease-out-standard flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full border font-sans tracking-[0.12em] uppercase transition-[color,opacity,border-color] sm:h-11 sm:w-auto sm:border-0 sm:opacity-70 sm:hover:opacity-100"
                  >
                    <span aria-hidden="true" className="text-[1.1rem] sm:text-[inherit]">
                      ←
                    </span>
                    <span className="hidden sm:ml-2 sm:inline">Voltar</span>
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                {step === 0 && <NextButton onClick={submitContact}>Continuar</NextButton>}
                {step === 1 && (
                  <NextButton onClick={() => void submitAddress()}>Ver opções de frete</NextButton>
                )}
                {step === 2 && (
                  <NextButton
                    onClick={submitShipping}
                    disabled={!shipping || shippingLoading || paying || soldOut}
                  >
                    {soldOut ? (
                      STORE.soldOut
                    ) : paying ? (
                      "Gerando Pix…"
                    ) : (
                      <>
                        <span className="sm:hidden">Ir pro pagamento</span>
                        <span className="hidden sm:inline">Confirmar e ir pro pagamento</span>
                      </>
                    )}
                  </NextButton>
                )}
              </div>
            )}
            {soldOut && (
              <p role="alert" className="text-body mt-4 font-sans">
                {STORE.soldOutText}
              </p>
            )}
            {step === 2 && (
              <>
                {payError && (
                  <p role="alert" className="text-body mt-4 font-sans text-red-700">
                    {payError}
                  </p>
                )}
                <p className="text-label mt-5 font-sans tracking-[0.04em] opacity-60 sm:text-right">
                  Ao confirmar, tu aceita os{" "}
                  <NextLink
                    href="/termos"
                    className="underline underline-offset-4"
                    target="_blank"
                    rel="noopener"
                  >
                    Termos
                  </NextLink>{" "}
                  e a{" "}
                  <NextLink
                    href="/privacidade"
                    className="underline underline-offset-4"
                    target="_blank"
                    rel="noopener"
                  >
                    Privacidade
                  </NextLink>
                  .
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

/**
 * Recado opcional: um campo como os outros do checkout (mesmo rótulo, mesma
 * caixa), baixo, que cresce conforme a pessoa escreve. O contador só aparece
 * quando começa a digitar.
 */
function NoteCard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5 font-sans lg:gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="recado" className="text-label font-bold tracking-[0.08em] uppercase">
          Recado
        </label>
        <span
          aria-live="polite"
          className={clsx(
            "text-label tabular-nums",
            value.length > NOTE_MAX - 30 ? "text-red-800" : "opacity-55",
          )}
        >
          {value ? `${value.length}/${NOTE_MAX}` : "Opcional"}
        </span>
      </div>
      <textarea
        id="recado"
        rows={2}
        maxLength={NOTE_MAX}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="É presente? Diz pra quem é e o que escrever no cartão."
        className="text-body duration-base ease-out-standard border-fernandito-verde-escuro/25 focus:border-fernandito-verde-medio field-sizing-content max-h-40 min-h-[3.25rem] w-full resize-none rounded-xl border bg-white/70 px-4 py-2.5 shadow-[inset_0_1px_2px_rgba(36,48,34,0.06)] transition-[background-color,border-color,box-shadow] outline-none placeholder:opacity-40 focus:bg-white focus:shadow-[0_0_0_4px_rgba(64,81,57,0.18)]"
      />
    </div>
  );
}

/** Linha de confirmação: cartão clicável com caixa de seleção própria. */
function ConfirmRow({
  checked,
  onChange,
  title,
  hint,
  required,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint: string;
  required?: boolean;
  error?: boolean;
}) {
  return (
    <label
      className={clsx(
        "duration-base ease-out-standard flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3.5 transition-[background-color,border-color]",
        checked
          ? "border-fernandito-verde-claro bg-fernandito-verde-claro/15"
          : error
            ? "border-red-700/60 bg-red-50/60"
            : "border-fernandito-verde-escuro/12 hover:border-fernandito-verde-claro/60 bg-white/40",
      )}
    >
      <input
        type="checkbox"
        aria-invalid={error || undefined}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={clsx(
          "duration-base ease-out-standard peer-focus-visible:outline-fernandito-verde-medio flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-[0.8rem] leading-none transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          checked
            ? "bg-fernandito-verde-claro border-fernandito-verde-claro text-fernandito-off-white"
            : "border-fernandito-verde-escuro/30",
        )}
      >
        {checked ? "✓" : ""}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body leading-snug font-bold">{title}</span>
        <span
          className={clsx("text-label mt-0.5 leading-snug", error ? "text-red-800" : "opacity-65")}
        >
          {hint}
        </span>
      </span>
    </label>
  );
}

function prefix(group: string, errors: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [`${group}.${key}`, value]),
  );
}

/** Progresso horizontal: trilho com preenchimento verde-claro e os nomes
 * das etapas. Etapas já feitas são clicáveis (voltam pra elas). */
function Progress({
  step,
  onGo,
  tone = "dark",
}: {
  step: number;
  onGo: (index: number) => void;
  /** "dark" = sobre o verde (coluna, celular); "light" = dentro do cartão bege. */
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  if (light) {
    // Cartão bege (computador): trilho segmentado, compacto. Atual = pílula
    // branca em destaque; feito = ✓ verde (clica pra voltar); a fazer = apagado.
    return (
      <nav data-enter aria-label="Etapas da compra" className="font-sans">
        <ol className="bg-fernandito-verde-escuro/[0.06] ring-fernandito-verde-escuro/[0.06] grid grid-cols-4 gap-1 rounded-full p-1 ring-1">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => onGo(i)}
                  disabled={!done}
                  aria-current={current ? "step" : undefined}
                  aria-label={`${i + 1}. ${label}${done ? " (feito, voltar)" : ""}`}
                  className={clsx(
                    "duration-base ease-out-standard flex h-9 w-full items-center justify-center gap-2 rounded-full px-2 transition-[background-color,box-shadow,color]",
                    current &&
                      "text-fernandito-verde-escuro bg-white shadow-[0_2px_8px_rgba(36,48,34,0.12)]",
                    done && "text-fernandito-verde-medio cursor-pointer hover:bg-white/60",
                    !done && !current && "text-fernandito-verde-escuro/40 cursor-default",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.68rem] font-bold tabular-nums",
                      current && "bg-fernandito-verde-escuro text-fernandito-off-white",
                      done && "bg-fernandito-verde-claro text-fernandito-off-white",
                      !done && !current && "ring-fernandito-verde-escuro/25 ring-1",
                    )}
                  >
                    {done ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="h-3 w-3"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={clsx(
                      "text-label tracking-[0.06em] uppercase",
                      current && "font-bold",
                    )}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }
  return (
    <nav data-enter aria-label="Etapas da compra" className="font-sans">
      {/* Bolinhas numeradas ligadas por uma linha: feito (✓), atual (cheia),
          a fazer (contorno). Clica pra voltar numa etapa já feita. */}
      <ol className="grid grid-cols-4">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="relative flex flex-col items-center">
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    "absolute top-4 left-1/2 h-0.5 w-full -translate-y-1/2",
                    done
                      ? light
                        ? "bg-fernandito-verde-medio"
                        : "bg-fernandito-verde-claro"
                      : light
                        ? "bg-fernandito-verde-escuro/15"
                        : "bg-fernandito-off-white/20",
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => onGo(i)}
                disabled={!done}
                aria-current={current ? "step" : undefined}
                aria-label={`${i + 1}. ${label}${done ? " (feito, voltar)" : ""}`}
                className={clsx(
                  "group relative z-10 flex flex-col items-center gap-2",
                  done ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={clsx(
                    "duration-base ease-out-standard flex h-8 w-8 items-center justify-center rounded-full text-[0.8rem] font-bold tabular-nums transition-[background-color,color,box-shadow,transform]",
                    current &&
                      (light
                        ? "bg-fernandito-verde-escuro text-fernandito-off-white shadow-[0_0_0_4px_rgba(36,48,34,0.12)]"
                        : "bg-fernandito-off-white text-fernandito-verde-escuro shadow-[0_0_0_4px_rgba(230,230,203,0.18)]"),
                    done &&
                      (light
                        ? "bg-fernandito-verde-medio text-fernandito-off-white group-hover:scale-105"
                        : "bg-fernandito-verde-claro text-fernandito-off-white group-hover:scale-105"),
                    !done &&
                      !current &&
                      (light
                        ? "border-fernandito-verde-escuro/25 bg-fernandito-off-white text-fernandito-verde-escuro/45 border-2"
                        : "border-fernandito-off-white/30 bg-fernandito-verde-medio text-fernandito-off-white/55 border-2"),
                  )}
                >
                  {done ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={clsx(
                    "text-label tracking-[0.08em] uppercase",
                    current && "font-bold",
                    done && "opacity-85 group-hover:opacity-100",
                    !done && !current && "opacity-45",
                  )}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function NextButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="primary"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className="!bg-fernandito-verde-escuro hover:!bg-fernandito-verde-medio h-[3.25rem] w-full min-w-0 flex-1 !px-4 !py-0 text-[0.95rem] disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:w-auto sm:min-w-[14rem] sm:flex-none sm:!px-6 sm:!py-3.5 sm:text-[length:inherit] lg:!py-3"
    >
      <span className="flex items-center justify-center gap-2 whitespace-nowrap">
        {children}
        <span aria-hidden="true">→</span>
      </span>
    </Button>
  );
}

/** Resumo na coluna verde: itens, o que já foi preenchido (com Editar) e
 * os totais. No celular os itens e totais recolhem atrás de "Ver resumo". */
function SummaryCard({
  shipping,
  totalCents,
  recap,
  onEdit,
  expanded = false,
  locked = false,
}: {
  shipping: ShippingOption | null;
  totalCents: number;
  recap: { label: string; value: string }[];
  onEdit: (index: number) => void;
  /** Celular, no pagamento: tudo aberto, como no computador. */
  expanded?: boolean;
  /** Pix já gerado: nada mais é editável. */
  locked?: boolean;
}) {
  const cart = useCart();
  const [toggled, setOpen] = useState(false);
  const open = toggled || expanded;
  const reduceMotion = useReducedMotion();
  const details = (
    <>
      <ul className="flex flex-col gap-4">
        {cart.lines.map((line) => {
          const { main, sub } = splitName(line.product.name);
          // O que vem dentro ("2 latas · 1 copo · 5 adesivos") diz mais que o
          // "Pré-lançamento" do nome.
          const contents = line.product.contents
            ?.map((c) => `${c.qty} ${c.label.split(" ")[0]}`)
            .join(" · ");
          return (
            <li key={line.sku} className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="bg-fernandito-verde-escuro relative h-16 w-14 overflow-hidden rounded-xl">
                  <PhotoSlot
                    image={line.product.images[0]}
                    sizes="56px"
                    placeholderClassName="bg-fernandito-verde-escuro"
                  />
                </div>
                <span className="bg-fernandito-verde-claro text-fernandito-off-white ring-fernandito-verde-medio absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.7rem] leading-none font-bold tabular-nums ring-2">
                  {line.qty}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-rampart text-[1.1rem] leading-tight">{main}</p>
                {(contents || sub) && (
                  <p className="text-label mt-1 tracking-[0.04em] opacity-70">{contents || sub}</p>
                )}
              </div>
              {/* Um item só: o preço já aparece no subtotal logo abaixo. */}
              {cart.lines.length > 1 && (
                <p className="text-body whitespace-nowrap tabular-nums">
                  {formatBRL(line.lineTotalCents)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <dl className="border-fernandito-off-white/15 mt-5 flex flex-col gap-2 border-t pt-5">
        <div className="flex justify-between gap-4">
          <dt className="opacity-75">Subtotal</dt>
          <dd className="tabular-nums">{formatBRL(cart.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="opacity-75">Frete</dt>
          <dd className="text-right tabular-nums">
            {shipping ? (
              formatBRL(shipping.priceCents)
            ) : (
              <span aria-label="a calcular" className="opacity-60">
                —
              </span>
            )}
          </dd>
        </div>
      </dl>
      {/* No computador o total fecha a conta, embaixo (no celular ele já
          está no topo, junto do "Ver resumo"). */}
      <div
        className={clsx(
          "border-fernandito-off-white/15 mt-5 items-end justify-between gap-4 border-t pt-5",
          expanded ? "flex" : "hidden lg:flex",
        )}
      >
        <p className="text-label tracking-[0.12em] uppercase opacity-80">Total</p>
        <p className="font-rampart text-[2.25rem] leading-none tabular-nums">
          <Price cents={totalCents} />
        </p>
      </div>
      <p
        className={clsx(
          "text-label mt-4 items-center gap-2 opacity-60",
          expanded ? "flex" : "hidden lg:flex",
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
          className="h-3.5 w-3.5 shrink-0"
        >
          <rect x="4" y="10.5" width="16" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
        Pix seguro pelo Mercado Pago
      </p>
    </>
  );

  return (
    <section
      data-enter
      aria-label="Resumo do pedido"
      className="bg-fernandito-verde-escuro ring-fernandito-off-white/10 rounded-3xl p-5 font-sans shadow-[0_24px_60px_rgba(20,28,18,0.35)] ring-1 sm:p-6"
    >
      {/* Computador: cabeçalho "Seu pedido" + editar carrinho à parte. */}
      <div
        className={clsx(
          "mb-6 items-center justify-between gap-4",
          expanded ? "flex" : "hidden lg:flex",
        )}
      >
        <p className="font-rampart text-[1.35rem] leading-none">Seu pedido</p>
        {!locked && (
          <button
            type="button"
            onClick={cart.open}
            className="border-fernandito-off-white/30 hover:bg-fernandito-off-white hover:text-fernandito-verde-escuro duration-base ease-out-standard inline-flex h-9 items-center gap-2 rounded-full border px-4 font-sans text-[0.8rem] font-bold tracking-[0.02em] transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Editar carrinho
          </button>
        )}
      </div>

      {/* Celular: total sempre à vista; é o botão que abre o resto. */}
      <div
        className={clsx("flex items-end justify-between gap-4 lg:hidden", expanded && "!hidden")}
      >
        <div>
          <p className="text-label tracking-[0.12em] uppercase opacity-70">Total</p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-label mt-1 flex items-center gap-1.5 tracking-[0.08em] uppercase underline underline-offset-4 opacity-80 lg:hidden"
          >
            {open ? "Esconder resumo" : "Ver resumo"}
          </button>
        </div>
        <p className="font-rampart text-[2.25rem] leading-none tabular-nums">
          <Price cents={totalCents} />
        </p>
      </div>

      <div className={expanded ? "block" : "hidden lg:block"}>{details}</div>
      <AnimatePresence initial={false}>
        {toggled && !expanded && (
          <motion.div
            className="overflow-hidden lg:hidden"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: DURATION.slow, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pt-6">{details}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {recap.length > 0 && (
        // No celular o que já foi preenchido só aparece no "Ver resumo":
        // aberto o tempo todo, empurrava o formulário pra fora da tela.
        <ul
          className={clsx(
            "border-fernandito-off-white/15 mt-5 flex-col gap-3 border-t pt-5",
            open ? "flex" : "hidden lg:flex",
          )}
        >
          {recap.map((item, i) => (
            <li key={item.label} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-label text-fernandito-verde-claro tracking-[0.1em] uppercase brightness-150">
                  {item.label}
                </p>
                <p className="text-body mt-0.5 break-words opacity-85">{item.value}</p>
              </div>
              {!locked && (
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  className="text-label duration-base ease-out-standard shrink-0 tracking-[0.08em] uppercase underline underline-offset-4 opacity-60 transition-opacity hover:opacity-100"
                >
                  Editar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default CheckoutClient;
