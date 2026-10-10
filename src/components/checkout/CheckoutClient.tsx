"use client";

import { clsx } from "clsx";
import NextLink from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { maskCEP, maskCPF, maskPhone, onlyDigits } from "@/lib/br";
import { formatBRL } from "@/lib/money";
import { addressSchema, customerSchema, fieldErrors, orderSchema, type Order } from "@/lib/order";
import { formatDays, getShippingOptions, type ShippingOption } from "@/lib/shipping";
import { STORE } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { useCart } from "@/components/cart/CartProvider";
import { Field } from "@/components/checkout/Field";

/**
 * Checkout em 4 etapas, uma de cada vez (as anteriores ficam resumidas, com
 * "Editar"): A contato → B entrega (CEP via ViaCEP) → C frete → D idade e
 * termos. O resumo do pedido fica fixo do lado no desktop e no fim no
 * celular. "Pagar com Pix" ainda não paga: valida o pedido inteiro (zod) e
 * mostra "Pagamento em breve" com o resumo.
 */

const STEPS = ["Contato", "Entrega", "Frete", "Confirmação"] as const;

const AGE_TEXT =
  "Declaro ter 18 anos ou mais e estou ciente de que a venda de bebidas alcoólicas é proibida para menores. A entrega só será feita a maior de 18 anos mediante documento com foto.";

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
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [shippingFallback, setShippingFallback] = useState(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [ageConfirmedAt, setAgeConfirmedAt] = useState<string | null>(null);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

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
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
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
    setStep(next);
    requestAnimationFrame(() =>
      document
        .getElementById(`etapa-${next}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
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

  function pay() {
    if (!shipping || !ageConfirmedAt) return;
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
    if (process.env.NODE_ENV !== "production") {
      console.log("[checkout] pedido (dev)", parsed.data);
    }
    setOrder(parsed.data);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  }

  // ── Telas especiais ──────────────────────────────────────────────────────
  if (order) return <PaymentSoon order={order} />;

  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-6 py-16">
        <h1 className="font-rampart text-[clamp(2rem,5vw,3.5rem)] leading-[1.05]">
          Teu carrinho está vazio
        </h1>
        <p className="text-body-lg font-sans">Escolhe o teu kit e volta aqui pra finalizar.</p>
        <Button as="a" href="/comprar" variant="primary">
          {STORE.cta}
        </Button>
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-32">
      <h1 className="font-rampart text-[clamp(2rem,5vw,3.5rem)] leading-[1.05]">
        Finalizar compra
      </h1>
      <p className="text-label mt-3 font-sans tracking-[0.08em] uppercase opacity-70">
        {STORE.ageNotice}
      </p>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <ol className="flex flex-col gap-4">
          {/* A — Contato */}
          <Step
            index={0}
            current={step}
            onEdit={() => goTo(0)}
            summary={`${contact.name} · ${contact.email}`}
          >
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
                label="Telefone (WhatsApp)"
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
                value={contact.cpf}
                onChange={(e) => setContact({ ...contact, cpf: maskCPF(e.target.value) })}
                error={errors["customer.cpf"]}
                hint="Pra emitir a nota fiscal."
              />
            </div>
            <StepButton onClick={submitContact}>Continuar</StepButton>
          </Step>

          {/* B — Entrega */}
          <Step
            index={1}
            current={step}
            onEdit={() => goTo(1)}
            summary={`${address.street}, ${address.number}${address.complement ? ` — ${address.complement}` : ""} · ${address.city}/${address.uf}`}
          >
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
                hint={cepStatus === "loading" ? "Buscando endereço…" : undefined}
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
            <StepButton onClick={() => void submitAddress()}>Ver opções de frete</StepButton>
          </Step>

          {/* C — Frete */}
          <Step
            index={2}
            current={step}
            onEdit={() => goTo(2)}
            summary={shipping ? `${shipping.service} · ${formatBRL(shipping.priceCents)}` : ""}
          >
            {shippingLoading || !options ? (
              <p className="text-body font-sans opacity-70" aria-live="polite">
                Calculando frete…
              </p>
            ) : (
              <fieldset className="flex flex-col gap-3 font-sans">
                <legend className="sr-only">Escolha o frete</legend>
                {shippingFallback && (
                  <p className="text-label mb-1 tracking-[0.04em] uppercase opacity-70">
                    Não deu pra cotar agora — usando o frete padrão da tua região.
                  </p>
                )}
                {options.map((option) => (
                  <label
                    key={option.id}
                    className={clsx(
                      "duration-base ease-out-standard flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-4 transition-colors",
                      option.id === shippingId
                        ? "border-fernandito-verde-medio bg-fernandito-verde-medio/10"
                        : "border-fernandito-verde-escuro/20 hover:border-fernandito-verde-escuro/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="frete"
                      value={option.id}
                      checked={option.id === shippingId}
                      onChange={() => setShippingId(option.id)}
                      className="accent-fernandito-verde-medio h-4 w-4 shrink-0"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-bold">{option.service}</span>
                      <span className="text-label uppercase opacity-70">
                        {option.carrier} · {formatDays(option.days)}
                      </span>
                    </span>
                    <span className="text-body font-bold tabular-nums">
                      {formatBRL(option.priceCents)}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <StepButton onClick={submitShipping} disabled={!shipping || shippingLoading}>
              Continuar
            </StepButton>
          </Step>

          {/* D — Idade e termos */}
          <Step index={3} current={step} onEdit={() => goTo(3)} summary="">
            <div className="flex flex-col gap-4 font-sans">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={ageConfirmedAt !== null}
                  onChange={(e) =>
                    setAgeConfirmedAt(e.target.checked ? new Date().toISOString() : null)
                  }
                  className="accent-fernandito-verde-medio mt-1 h-5 w-5 shrink-0"
                  required
                />
                <span className="text-body">
                  {AGE_TEXT} <span className="opacity-60">(obrigatório)</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="accent-fernandito-verde-medio mt-1 h-5 w-5 shrink-0"
                />
                <span className="text-body">Quero receber novidades da Fernandito por e-mail</span>
              </label>
              <p className="text-label tracking-[0.04em] uppercase opacity-70">
                Ao continuar você concorda com os{" "}
                <NextLink href="/termos" className="underline underline-offset-4" target="_blank">
                  Termos de uso
                </NextLink>{" "}
                e a{" "}
                <NextLink
                  href="/privacidade"
                  className="underline underline-offset-4"
                  target="_blank"
                >
                  Política de privacidade
                </NextLink>
                .
              </p>
            </div>
            <div className="mt-6">
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                onClick={pay}
                disabled={!ageConfirmedAt || !shipping}
                aria-disabled={!ageConfirmedAt || !shipping}
              >
                Pagar com Pix · {formatBRL(totalCents)}
              </Button>
              {!ageConfirmedAt && (
                <p className="text-label mt-3 font-sans uppercase opacity-60">
                  Confirme a declaração de maioridade pra continuar.
                </p>
              )}
            </div>
          </Step>
        </ol>

        <OrderSummary shipping={shipping} totalCents={totalCents} />
      </div>
    </div>
  );
}

function prefix(group: string, errors: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [`${group}.${key}`, value]),
  );
}

/** Uma etapa: aberta (formulário), concluída (resumo + Editar) ou bloqueada. */
function Step({
  index,
  current,
  onEdit,
  summary,
  children,
}: {
  index: number;
  current: number;
  onEdit: () => void;
  summary: string;
  children: ReactNode;
}) {
  const state = index === current ? "open" : index < current ? "done" : "locked";
  return (
    <li
      id={`etapa-${index}`}
      className={clsx(
        "scroll-mt-32 rounded-2xl border p-5 sm:p-7",
        state === "open"
          ? "border-fernandito-verde-escuro/25 bg-white/40"
          : "border-fernandito-verde-escuro/10",
        state === "locked" && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-baseline gap-3">
          <span className="font-accent text-label tracking-[0.12em] opacity-70">
            {String.fromCharCode(65 + index)}
          </span>
          <span className="font-rampart text-[1.5rem] leading-none">{STEPS[index]}</span>
        </h2>
        {state === "done" && (
          <button
            type="button"
            onClick={onEdit}
            className="text-label duration-base ease-out-standard hover:text-fernandito-verde-medio font-sans uppercase underline underline-offset-4 transition-colors"
          >
            Editar
          </button>
        )}
      </div>
      {state === "done" && summary && (
        <p className="text-body mt-2 font-sans opacity-75">{summary}</p>
      )}
      {state === "open" && <div className="mt-6">{children}</div>}
    </li>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6">
      <Button
        variant="primary"
        onClick={onClick}
        disabled={disabled}
        className="disabled:cursor-not-allowed disabled:opacity-50"
      >
        {children}
      </Button>
    </div>
  );
}

/** Resumo: fixo do lado no desktop, no fim da página no celular. */
function OrderSummary({
  shipping,
  totalCents,
}: {
  shipping: ShippingOption | null;
  totalCents: number;
}) {
  const cart = useCart();
  return (
    <aside
      aria-label="Resumo do pedido"
      className="border-fernandito-verde-escuro/15 rounded-2xl border bg-white/40 p-6 font-sans lg:sticky lg:top-32"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-rampart text-[1.5rem] leading-none">Resumo</h2>
        <button
          type="button"
          onClick={cart.open}
          className="text-label duration-base ease-out-standard hover:text-fernandito-verde-medio uppercase underline underline-offset-4 transition-colors"
        >
          Editar carrinho
        </button>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {cart.lines.map((line) => (
          <li key={line.sku} className="flex items-center gap-3">
            <div className="bg-fernandito-verde-medio relative h-14 w-12 shrink-0 overflow-hidden rounded-md">
              <PhotoSlot
                image={line.product.images[0]}
                sizes="48px"
                placeholderClassName="bg-fernandito-verde-medio"
              />
            </div>
            <p className="text-body min-w-0 flex-1 leading-snug">
              {line.product.name} <span className="opacity-60">× {line.qty}</span>
            </p>
            <p className="text-body tabular-nums">{formatBRL(line.lineTotalCents)}</p>
          </li>
        ))}
      </ul>
      <dl className="border-fernandito-verde-escuro/15 mt-5 flex flex-col gap-2 border-t pt-5">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatBRL(cart.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Frete</dt>
          <dd className="text-right tabular-nums">
            {shipping ? (
              formatBRL(shipping.priceCents)
            ) : (
              <span className="opacity-60">calculado na entrega</span>
            )}
          </dd>
        </div>
        <div className="border-fernandito-verde-escuro/15 mt-2 flex items-baseline justify-between border-t pt-4">
          <dt className="font-bold">Total</dt>
          <dd className="font-rampart text-[1.75rem] leading-none tabular-nums">
            {formatBRL(totalCents)}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

/** Depois do "Pagar com Pix" (o Pix entra no próximo passo). */
function PaymentSoon({ order }: { order: Order }) {
  const cart = useCart();
  return (
    <div className="flex flex-col items-start gap-8 py-8">
      <div>
        <p className="font-accent text-label tracking-[0.16em] uppercase opacity-70">Quase lá</p>
        <h1 className="font-rampart mt-3 text-[clamp(2rem,5vw,3.5rem)] leading-[1.05]">
          Pagamento em breve
        </h1>
        <p className="text-body-lg mt-4 max-w-xl font-sans">
          O pagamento por Pix ainda está sendo ligado. Teu pedido não foi cobrado nem enviado — o
          carrinho continua salvo aqui.
        </p>
      </div>
      <div className="border-fernandito-verde-escuro/15 w-full max-w-xl rounded-2xl border bg-white/40 p-6 font-sans">
        <h2 className="font-rampart text-[1.5rem] leading-none">Resumo do pedido</h2>
        <ul className="mt-5 flex flex-col gap-2">
          {order.items.map((item) => {
            const name = cart.lines.find((l) => l.sku === item.sku)?.product.name ?? item.sku;
            return (
              <li key={item.sku} className="flex justify-between gap-4">
                <span>
                  {name} <span className="opacity-60">× {item.qty}</span>
                </span>
                <span className="tabular-nums">{formatBRL(item.unitPriceCents * item.qty)}</span>
              </li>
            );
          })}
          <li className="flex justify-between gap-4">
            <span>
              Frete — {order.shipping.service}{" "}
              <span className="opacity-60">({formatDays(order.shipping.days)})</span>
            </span>
            <span className="tabular-nums">{formatBRL(order.shipping.priceCents)}</span>
          </li>
        </ul>
        <div className="border-fernandito-verde-escuro/15 mt-4 flex items-baseline justify-between border-t pt-4">
          <span className="font-bold">Total</span>
          <span className="font-rampart text-[1.75rem] leading-none tabular-nums">
            {formatBRL(order.totalCents)}
          </span>
        </div>
        <p className="text-body mt-5 opacity-75">
          Entrega para {order.customer.name} — {order.address.street}, {order.address.number}
          {order.address.complement ? ` (${order.address.complement})` : ""},{" "}
          {order.address.neighborhood}, {order.address.city}/{order.address.uf}
        </p>
      </div>
      <Button as="a" href="/" variant="secondary">
        Voltar pro site
      </Button>
    </div>
  );
}

export default CheckoutClient;
