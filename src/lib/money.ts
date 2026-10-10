/** Formata centavos (inteiro) como "R$ 100,00". Todo preço do site mora em
 * centavos pra nunca somar com ponto flutuante. */
export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
