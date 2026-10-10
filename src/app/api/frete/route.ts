import { z } from "zod";
import { quoteMelhorEnvio } from "@/lib/melhor-envio";

// Cotação de frete (fora de Porto Alegre). O navegador manda o CEP e os
// itens (peso/dimensões); a cotação roda aqui, no servidor, onde vai ficar
// o token do Melhor Envio. Hoje o retorno é mockado — ver melhor-envio.ts.
// Qualquer erro → 4xx/5xx, e o checkout cai na tabela fixa da região.

const bodySchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/),
  items: z
    .array(
      z.object({
        qty: z.number().int().min(1).max(50),
        weightKg: z.number().positive(),
        widthCm: z.number().positive(),
        heightCm: z.number().positive(),
        lengthCm: z.number().positive(),
        priceCents: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  try {
    const options = await quoteMelhorEnvio(parsed.data.cep.replace(/\D/g, ""), parsed.data.items);
    return Response.json({ options });
  } catch {
    return Response.json({ error: "Falha na cotação" }, { status: 502 });
  }
}
