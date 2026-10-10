import { z } from "zod";
import { isValidCEP, isValidCPF, isValidPhone, onlyDigits, UFS } from "@/lib/br";

/**
 * Modelo do pedido + validação (zod). O mesmo schema vai ser usado no
 * servidor quando o pedido passar a ser criado de verdade (Pix + Bling), pra
 * nunca confiar só na validação do navegador.
 *
 * Dinheiro sempre em CENTAVOS (inteiro).
 */

export const orderItemSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().int().min(1).max(5),
  unitPriceCents: z.number().int().nonnegative(),
});

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe seu nome completo")
    .refine((value) => value.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  email: z.string().trim().email("E-mail inválido"),
  phone: z.string().refine(isValidPhone, "Telefone inválido").transform(onlyDigits),
  cpf: z.string().refine(isValidCPF, "CPF inválido").transform(onlyDigits),
});

export const addressSchema = z.object({
  cep: z.string().refine(isValidCEP, "CEP inválido").transform(onlyDigits),
  street: z.string().trim().min(1, "Informe a rua"),
  number: z.string().trim().min(1, "Informe o número"),
  complement: z.string().trim().max(80).optional().default(""),
  neighborhood: z.string().trim().min(1, "Informe o bairro"),
  city: z.string().trim().min(1, "Informe a cidade"),
  uf: z.enum(UFS, { message: "UF inválida" }),
});

export const shippingSchema = z.object({
  id: z.string().min(1),
  service: z.string().min(1),
  carrier: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  days: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }),
  source: z.enum(["local", "melhor-envio", "tabela"]),
});

export const orderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1, "Carrinho vazio"),
    customer: customerSchema,
    address: addressSchema,
    shipping: shippingSchema,
    subtotalCents: z.number().int().nonnegative(),
    totalCents: z.number().int().nonnegative(),
    // Declaração de maioridade: obrigatória e com data/hora do aceite.
    ageConfirmed: z.literal(true, { message: "Confirme que tem 18 anos ou mais" }),
    ageConfirmedAt: z.iso.datetime(),
    marketingOptIn: z.boolean(),
  })
  .refine(
    (order) =>
      order.subtotalCents === order.items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0),
    { message: "Subtotal não confere", path: ["subtotalCents"] },
  )
  .refine((order) => order.totalCents === order.subtotalCents + order.shipping.priceCents, {
    message: "Total não confere",
    path: ["totalCents"],
  });

export type OrderItem = z.infer<typeof orderItemSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type Address = z.infer<typeof addressSchema>;
export type Order = z.infer<typeof orderSchema>;

/** Primeira mensagem de erro por campo (pra mostrar embaixo de cada input). */
export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
