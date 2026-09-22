import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Avisos e registro — Fernandito",
  description: "Informações regulatórias do Fernandito: glúten, idade mínima e registro no MAPA.",
};

export default function AvisosPage() {
  return (
    <article>
      <h1 className="text-display-lg font-serif leading-[0.95]">Avisos e registro</h1>
      <p className="text-body mt-4 opacity-60">Última atualização: 22 de setembro de 2026</p>

      <div className="mt-10 flex flex-col gap-8 font-sans">
        <section>
          <h2 className="text-body-lg font-bold">Contém glúten</h2>
          <p className="text-body mt-2">
            Fernandito é feito com ingredientes que contêm glúten. Se você tem doença celíaca ou
            sensibilidade ao glúten, não consuma este produto.
          </p>
        </section>

        <section>
          <h2 className="text-body-lg font-bold">Venda proibida para menores de 18 anos</h2>
          <p className="text-body mt-2">
            Fernandito é uma bebida alcoólica. A venda e o consumo são proibidos para menores de 18
            anos, conforme a legislação brasileira.
          </p>
        </section>

        <section>
          <h2 className="text-body-lg font-bold">Registro MAPA</h2>
          <p className="text-body mt-2">
            Registro no Ministério da Agricultura, Pecuária e Abastecimento (MAPA):{" "}
            <span className="font-medium">RS 002594-1.000127</span>.
          </p>
        </section>
      </div>
    </article>
  );
}
