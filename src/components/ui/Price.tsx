import { formatBRL } from "@/lib/money";

/**
 * Preço em reais pra usar em texto grande na fonte Rampart: o "$" da Rampart
 * sai borrado/quebrado, então o "R$" vai numa fonte comum (menor, alinhada
 * ao topo) e só os números ficam em Rampart. Herda a fonte e o tamanho do
 * elemento pai.
 */
export function Price({ cents }: { cents: number }) {
  const text = formatBRL(cents).replace(/\s/g, " ");
  const match = /^R\$\s*(.*)$/.exec(text);
  if (!match) return <>{text}</>;
  return (
    <>
      <span className="mr-[0.18em] align-[0.5em] font-sans text-[0.5em] font-bold tracking-normal">
        R$
      </span>
      {match[1]}
      <span className="sr-only"> reais</span>
    </>
  );
}

export default Price;
