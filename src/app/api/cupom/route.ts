import { z } from "zod";
import { cupomFreteGratis } from "@/lib/cupom";
import { guard, json } from "@/lib/store/http";

// Confere um cupom no checkout (botão "Aplicar"). Só diz se vale: o desconto
// mesmo é recalculado no servidor quando o Pix é gerado (checkout.ts).
const bodySchema = z.object({ codigo: z.string().max(40) });

export async function POST(request: Request) {
  // Poucas tentativas por IP: ninguém fica chutando código.
  const blocked = await guard(request, "cupom", 10, 10 * 60);
  if (blocked) return blocked;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Cupom inválido" }, 400);
  const codigo = cupomFreteGratis(parsed.data.codigo);
  if (!codigo) return json({ error: "Esse cupom não existe ou já acabou." }, 404);
  return json({ codigo, tipo: "frete-gratis" });
}
