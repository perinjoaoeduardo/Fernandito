"use client";

import { useStock } from "@/components/cart/useStock";
import { clsx } from "clsx";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { gsap, DURATION, EASE, prefersReducedMotion } from "@/lib/gsap";
import { maskCEP, maskCPF, maskPhone, onlyDigits } from "@/lib/br";
import { formatBRL } from "@/lib/money";
import { addressSchema, customerSchema, fieldErrors, orderSchema } from "@/lib/order";
import { formatDays, getShippingOptions, type ShippingOption } from "@/lib/shipping";
import { SHOP_HREF, STORE } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { useCart } from "@/components/cart/CartProvider";
import { Field } from "@/components/checkout/Field";
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
  { title: "Pra onde vai o tordilho?", hint: "Coloca o CEP que a gente completa o resto." },
  { title: "Como ele chega?", hint: "Escolhe o frete que mais combina contigo." },
  { title: "Tudo pronto?", hint: "Só confirmar e pagar com Pix. Leva um minuto." },
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

export function CheckoutClient() {
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
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Esgotou enquanto a pessoa preenchia: avisa antes de ela chegar no Pix.
  const { soldOut } = useStock();
  // Uma chave por tentativa: clique duplo/reenvio → o mesmo pedido e Pix.
  const idempotencyKey = useRef<string | null>(null);
  const router = useRouter();
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
      if (panel && panel.getBoundingClientRect().top < 0)
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
    goTo(3);
  }

  async function pay() {
    if (!shipping || !ageConfirmedAt || paying) return;
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
    };
    const parsed = orderSchema.safeParse(candidate);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      // Volta pra primeira etapa com problema.
      const firstKey = Object.keys(errs)[0] ?? "";
      goTo(firstKey.startsWith("customer") ? 0 : firstKey.startsWith("address") ? 1 : 2);
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
        order?: { id: string };
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
      router.push(`/pedido/${data.order.id}`);
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
      value: shipping ? `${shipping.carrier} · ${formatDays(shipping.days)}` : "",
    },
  ].slice(0, step);

  return (
    <div
      ref={topRef}
      className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14"
    >
      {/* ── Coluna verde: título, progresso, resumo ─────────────────────── */}
      <div className="flex min-w-0 flex-col gap-7 lg:sticky lg:top-[calc(7rem+var(--announcement-h))]">
        <div data-enter>
          <NextLink
            href={SHOP_HREF}
            scroll={false}
            className="text-label duration-base ease-out-standard inline-flex items-center gap-2 font-sans tracking-[0.1em] uppercase opacity-70 transition-opacity hover:opacity-100"
          >
            <span aria-hidden="true">←</span> Voltar ao kit
          </NextLink>
          <h1 className="font-rampart mt-3 text-[clamp(2.25rem,4.4vw,3.5rem)] leading-[1]">
            Finalizar compra
          </h1>
        </div>

        <Progress step={step} onGo={(i) => i < step && goTo(i)} />

        <SummaryCard shipping={shipping} totalCents={totalCents} recap={recap} onEdit={goTo} />
      </div>

      {/* ── Painel bege: uma etapa por vez ──────────────────────────────── */}
      <section
        id="etapa"
        data-enter
        aria-labelledby="etapa-titulo"
        className="bg-fernandito-off-white text-fernandito-verde-escuro scroll-mt-28 overflow-hidden rounded-[2rem] shadow-[0_30px_70px_rgba(20,28,18,0.35)]"
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={reduceMotion ? false : { opacity: 0, x: 48 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -48 * direction }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="p-6 sm:p-10"
          >
            <p className="text-label text-fernandito-verde-medio font-sans tracking-[0.18em] uppercase">
              Passo {step + 1} de {STEPS.length}
            </p>
            <h2
              id="etapa-titulo"
              className="font-rampart mt-3 text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.02] text-balance"
            >
              {STEP_COPY[step].title}
            </h2>
            <p className="text-body mt-2 max-w-md font-sans opacity-70">{STEP_COPY[step].hint}</p>

            <div className="mt-8">
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="nome"
                    label="Nome completo"
                    autoComplete="name"
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
                    hint="Só pra nota fiscal."
                  />
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-6">
                  <Field
                    id="cep"
                    label="CEP"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    className="sm:col-span-2"
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
                    className="sm:col-span-4"
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    error={errors["address.street"]}
                  />
                  <Field
                    ref={numberRef}
                    id="numero"
                    label="Número"
                    inputMode="numeric"
                    className="sm:col-span-2"
                    value={address.number}
                    onChange={(e) => setAddress({ ...address, number: e.target.value })}
                    error={errors["address.number"]}
                  />
                  <Field
                    id="complemento"
                    label="Complemento (opcional)"
                    autoComplete="address-line2"
                    className="sm:col-span-4"
                    value={address.complement}
                    onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                    error={errors["address.complement"]}
                  />
                  <Field
                    id="bairro"
                    label="Bairro"
                    className="sm:col-span-2"
                    value={address.neighborhood}
                    onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                    error={errors["address.neighborhood"]}
                  />
                  <Field
                    id="cidade"
                    label="Cidade"
                    autoComplete="address-level2"
                    className="sm:col-span-3"
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
                    className="sm:col-span-1"
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
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-body flex flex-wrap items-center gap-2 font-bold">
                              {option.carrier}
                              {i === 0 && option.source !== "local" && (
                                <span className="bg-fernandito-verde-claro text-fernandito-off-white rounded-full px-2 py-0.5 font-sans text-[0.62rem] tracking-[0.08em] uppercase">
                                  Mais barato
                                </span>
                              )}
                            </span>
                            <span className="text-label opacity-65">
                              {option.service} · {formatDays(option.days)}
                            </span>
                          </span>
                          <span className="font-rampart text-[1.3rem] leading-none tabular-nums">
                            <Price cents={option.priceCents} />
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ))}

              {step === 3 && (
                <div className="flex flex-col gap-3 font-sans">
                  <ConfirmRow
                    checked={ageConfirmedAt !== null}
                    onChange={(checked) =>
                      setAgeConfirmedAt(checked ? new Date().toISOString() : null)
                    }
                    title="Tenho 18 anos ou mais"
                    hint="Venda proibida para menores de 18 anos."
                    required
                  />
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="mt-9 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(step - 1)}
                  className="text-label duration-base ease-out-standard hover:text-fernandito-verde-medio h-11 self-center font-sans tracking-[0.12em] uppercase opacity-70 transition-[color,opacity] hover:opacity-100 sm:self-auto"
                >
                  ← Voltar
                </button>
              ) : (
                <span className="hidden sm:block" />
              )}
              {step === 0 && <NextButton onClick={submitContact}>Continuar</NextButton>}
              {step === 1 && (
                <NextButton onClick={() => void submitAddress()}>Ver opções de frete</NextButton>
              )}
              {step === 2 && (
                <NextButton onClick={submitShipping} disabled={!shipping || shippingLoading}>
                  Continuar
                </NextButton>
              )}
              {step === 3 && (
                <NextButton
                  onClick={() => void pay()}
                  disabled={!ageConfirmedAt || !shipping || paying || soldOut}
                >
                  {soldOut
                    ? STORE.soldOut
                    : paying
                      ? "Gerando Pix…"
                      : `Pagar ${formatBRL(totalCents)} no Pix`}
                </NextButton>
              )}
            </div>
            {soldOut && (
              <p role="alert" className="text-body mt-4 font-sans">
                {STORE.soldOutText}
              </p>
            )}
            {step === 3 && (
              <>
                {payError && (
                  <p role="alert" className="text-body mt-4 font-sans text-red-700">
                    {payError}
                  </p>
                )}
                <p className="text-label mt-5 font-sans tracking-[0.04em] opacity-60 sm:text-right">
                  Ao pagar, tu aceita os{" "}
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

/** Linha de confirmação: cartão clicável com caixa de seleção própria. */
function ConfirmRow({
  checked,
  onChange,
  title,
  hint,
  required,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint: string;
  required?: boolean;
}) {
  return (
    <label
      className={clsx(
        "duration-base ease-out-standard flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3.5 transition-[background-color,border-color]",
        checked
          ? "border-fernandito-verde-claro bg-fernandito-verde-claro/15"
          : "border-fernandito-verde-escuro/12 hover:border-fernandito-verde-claro/60 bg-white/40",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={clsx(
          "duration-base ease-out-standard peer-focus-visible:outline-fernandito-verde-medio flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.8rem] leading-none transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          checked
            ? "bg-fernandito-verde-claro border-fernandito-verde-claro text-fernandito-off-white"
            : "border-fernandito-verde-escuro/30",
        )}
      >
        {checked ? "✓" : ""}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body leading-snug font-bold">{title}</span>
        <span className="text-label mt-0.5 leading-snug opacity-65">{hint}</span>
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
function Progress({ step, onGo }: { step: number; onGo: (index: number) => void }) {
  return (
    <nav data-enter aria-label="Etapas da compra" className="font-sans">
      <div className="bg-fernandito-off-white/15 relative h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-fernandito-verde-claro duration-slow ease-out-standard absolute inset-y-0 left-0 rounded-full transition-[width]"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <ol className="mt-3 grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => onGo(i)}
                disabled={!done}
                aria-current={i === step ? "step" : undefined}
                className={clsx(
                  "text-label duration-base ease-out-standard flex items-center gap-1.5 tracking-[0.08em] uppercase transition-opacity",
                  i === step && "font-bold opacity-100",
                  done && "opacity-80 hover:opacity-100",
                  i > step && "cursor-default opacity-40",
                )}
              >
                {done && (
                  <span aria-hidden="true" className="text-fernandito-verde-claro">
                    ✓
                  </span>
                )}
                {label}
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
      className="!bg-fernandito-verde-escuro hover:!bg-fernandito-verde-medio w-full !py-3.5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[14rem]"
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
}: {
  shipping: ShippingOption | null;
  totalCents: number;
  recap: { label: string; value: string }[];
  onEdit: (index: number) => void;
}) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const details = (
    <>
      <ul className="flex flex-col gap-4">
        {cart.lines.map((line) => {
          const { main, sub } = splitName(line.product.name);
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
                {sub && (
                  <p className="text-label mt-1 tracking-[0.06em] uppercase opacity-65">{sub}</p>
                )}
              </div>
              <p className="text-body whitespace-nowrap tabular-nums">
                {formatBRL(line.lineTotalCents)}
              </p>
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
              <span className="opacity-60">no passo 3</span>
            )}
          </dd>
        </div>
      </dl>
    </>
  );

  return (
    <section
      data-enter
      aria-label="Resumo do pedido"
      className="bg-fernandito-verde-escuro/35 ring-fernandito-off-white/10 rounded-3xl p-5 font-sans ring-1 sm:p-6"
    >
      {/* Total sempre à vista; no celular é o botão que abre o resto. */}
      <div className="flex items-end justify-between gap-4">
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
          <button
            type="button"
            onClick={cart.open}
            className="text-label hover:text-fernandito-verde-claro duration-base ease-out-standard mt-1 hidden tracking-[0.08em] uppercase underline underline-offset-4 opacity-70 transition-[color,opacity] hover:opacity-100 lg:block"
          >
            Editar carrinho
          </button>
        </div>
        <p className="font-rampart text-[2.25rem] leading-none tabular-nums">
          <Price cents={totalCents} />
        </p>
      </div>

      <div className="mt-6 hidden lg:block">{details}</div>
      <AnimatePresence initial={false}>
        {open && (
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
        <ul className="border-fernandito-off-white/15 mt-5 flex flex-col gap-3 border-t pt-5">
          {recap.map((item, i) => (
            <li key={item.label} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-label text-fernandito-verde-claro tracking-[0.1em] uppercase brightness-150">
                  {item.label}
                </p>
                <p className="text-body mt-0.5 truncate opacity-85">{item.value}</p>
              </div>
              <button
                type="button"
                onClick={() => onEdit(i)}
                className="text-label duration-base ease-out-standard shrink-0 tracking-[0.08em] uppercase underline underline-offset-4 opacity-60 transition-opacity hover:opacity-100"
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default CheckoutClient;
