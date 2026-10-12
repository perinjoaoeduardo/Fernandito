import { z } from "zod";
import { quoteMelhorEnvio } from "@/lib/melhor-envio";
import { guard } from "@/lib/store/http";

// Cotação de frete (fora de Porto Alegre). O navegador manda o CEP e os
// itens (peso/dimensões); a cotação roda aqui, no servidor, onde vai ficar
// o token do Melhor Envio (ver melhor-envio.ts).
// Qualquer erro → 4xx/5xx, e o checkout cai na tabela fixa da região.

const bodySchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/),
  items: z
    .array(
      z.object({
        qty: z.number().int().min(1).max(50),
        // Limites pra ninguém usar a nossa conta do Melhor Envio pra cotar
        // qualquer coisa: caixa até 100 cm por lado, 30 kg, R$ 10 mil.
        weightKg: z.number().positive().max(30),
        widthCm: z.number().positive().max(100),
        heightCm: z.number().positive().max(100),
        lengthCm: z.number().positive().max(100),
        priceCents: z.number().int().nonnegative().max(1_000_000),
      }),
    )
    .min(1)
    .max(10),
});

export async function POST(request: Request) {
  const blocked = await guard(request, "frete", 30, 10 * 60);
  if (blocked) return blocked;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados inválidos" }, { status: 400 });
  try {
    const options = await quoteMelhorEnvio(parsed.data.cep.replace(/\D/g, ""), parsed.data.items);
    return Response.json({ options });
  } catch {
    return Response.json({ error: "Falha na cotação" }, { status: 502 });
  }
}
