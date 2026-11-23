import "server-only";

/**
 * Cupom de frete grátis (pros amigos da Fernandito).
 *
 * A pessoa digita o código no checkout, na etapa do frete. Valendo, o frete
 * do pedido vira R$ 0: o Pix, o e-mail, o Bling e a nota saem sem frete. A
 * etiqueta continua sendo comprada no Melhor Envio normalmente, com o saldo
 * da conta (quem paga o frete é a Fernandito).
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
