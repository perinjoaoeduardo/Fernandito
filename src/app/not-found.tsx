import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Página não encontrada" };

// 404 do site inteiro (o padrão do Next vinha em inglês).
export default function NotFound() {
  return (
    <main className="bg-fernandito-verde-medio text-fernandito-off-white flex min-h-svh flex-col items-start justify-center px-6 pt-32 pb-24 sm:px-10 lg:px-16">
      <p className="text-label font-sans tracking-[0.14em] uppercase opacity-70">Erro 404</p>
      <h1 className="font-rampart mt-3 text-[clamp(2.4rem,6vw,4.4rem)] leading-[0.95]">
        Essa página não existe.
      </h1>
      <p className="mt-4 max-w-md font-sans text-[0.95rem] opacity-80">
        O link pode estar errado ou a página saiu do ar. Volta pro início que o Fernandito tá lá.
      </p>
      <Button
        as="a"
        href="/"
        variant="primary"
        className="!bg-fernandito-off-white !text-fernandito-verde-escuro hover:!bg-fernandito-verde-escuro hover:!text-fernandito-off-white mt-8"
      >
        Voltar pro início
      </Button>
    </main>
  );
}
