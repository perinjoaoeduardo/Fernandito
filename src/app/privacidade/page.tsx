import type { Metadata } from "next";
import NextLink from "next/link";

// PLACEHOLDER: texto definitivo ainda não escrito.
export const metadata: Metadata = {
  title: "Política de privacidade",
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <main className="bg-fernandito-off-white text-fernandito-verde-escuro min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pt-[calc(9rem+var(--announcement-h))] pb-24 sm:px-10">
        <h1 className="font-rampart text-display-md leading-[1] text-balance">
          Política de privacidade
        </h1>
        <p className="text-body-lg mt-6 font-sans">Em breve.</p>
        <p className="text-body mt-8 font-sans">
          <NextLink href="/" className="underline underline-offset-4">
            Voltar pro site
          </NextLink>
        </p>
      </div>
    </main>
  );
}
