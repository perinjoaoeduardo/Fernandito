"use client";

/** "Imprimir / salvar PDF" — o CSS de impressão (globals.css) deixa só o texto. */
export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Imprimir / salvar PDF
    </button>
  );
}
