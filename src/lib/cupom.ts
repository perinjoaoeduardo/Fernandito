import "server-only";

/**
 * Cupom dos amigos: frete grátis porque a equipe ENTREGA EM MÃOS.
 *
 * A pessoa digita o código no checkout. Valendo, o frete do pedido vira R$ 0
 * e o pedido vira entrega em mãos (`local-amigos`), seja qual for o endereço:
 * NÃO compra etiqueta no Melhor Envio. O Pix, o e-mail, o Bling e a nota saem
 * sem frete; no painel fica "Entregar em mãos" até marcar entregue.
 * (Frete grátis COM etiqueta paga pela Fernandito seria outro cupom, a criar.)
 *
 * Os códigos ficam SÓ no env `CUPOM_FRETE_GRATIS` da Vercel (vários
 * separados por vírgula). Sem o env (ou vazio), nenhum cupom vale. Nunca
 * escrever um código aqui: o repositório é público. Maiúscula/minúscula e
 * espaços não importam.
 */

export const normalizeCupom = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");

function cupons() {
  return (process.env.CUPOM_FRETE_GRATIS ?? "").split(",").map(normalizeCupom).filter(Boolean);
}

/** Código normalizado se o cupom vale; `null` se não vale (ou veio vazio). */
export function cupomFreteGratis(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = normalizeCupom(value);
  return code && cupons().includes(code) ? code : null;
}
