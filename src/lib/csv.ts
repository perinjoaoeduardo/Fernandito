/**
 * Célula de planilha sem fórmula: um texto que começa com `=`, `+`, `-`, `@`
 * (ou tab/enter) o Excel/Google Planilhas executa como fórmula. Alguém podia
 * pôr `=HYPERLINK(...)` no nome ou no recado e isso rodaria ao abrir a
 * planilha. Com um apóstrofo na frente vira texto. Números (ex.: "-5", "1,50")
 * ficam como estão.
 */
export function csvSafe(value: string) {
  if (/^[=+\-@\t\r]/.test(value) && !/^[-+]?\d[\d.,]*$/.test(value)) return `'${value}`;
  return value;
}
