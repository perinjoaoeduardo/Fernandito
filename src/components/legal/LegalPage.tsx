import { clsx } from "clsx";
import type { LegalDoc } from "@/lib/legal";
import { highlightTodo } from "@/lib/legal";
import { Button } from "@/components/ui/Button";
import { FooterSection } from "@/components/sections/FooterSection";
import { PrintButton } from "@/components/legal/PrintButton";

/**
 * Página legal (Termos / Privacidade): leitura editorial, coluna de ~70
 * caracteres, índice fixo do lado no desktop e recolhível no celular.
 * Sem animação além de um fade de entrada (desligado com reduced motion).
 */

const ACTION_CLASSES =
  "text-label border-fernandito-verde-escuro/30 duration-base ease-out-standard hover:bg-fernandito-verde-escuro hover:text-fernandito-off-white focus-visible:outline-fernandito-verde-medio inline-flex items-center rounded-full border px-4 py-2 font-sans tracking-[0.06em] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function Toc({ doc, className }: { doc: LegalDoc; className?: string }) {
  return (
    <nav aria-label="Índice" className={className}>
      <ol className="flex flex-col gap-2 font-sans text-[0.85rem] leading-snug">
        {doc.toc.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="duration-base ease-out-standard hover:text-fernandito-verde-medio opacity-80 transition-colors hover:opacity-100"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <main className="bg-fernandito-off-white text-fernandito-verde-escuro min-h-screen [color-scheme:light]">
        <div className="mx-auto max-w-6xl px-6 pt-[calc(8rem+var(--announcement-h))] pb-24 motion-safe:animate-[legal-fade_600ms_ease-out_both] sm:px-10">
          <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
            {/* Índice fixo (desktop) */}
            <aside className="hidden lg:block print:hidden">
              <div className="sticky top-32">
                <p className="text-label mb-4 font-sans tracking-[0.12em] uppercase opacity-60">
                  Nesta página
                </p>
                <Toc doc={doc} />
              </div>
            </aside>

            <article data-print-root className="max-w-[70ch]">
              <header>
                <p className="font-accent text-label tracking-[0.16em] uppercase opacity-70">
                  Legal
                </p>
                <h1 className="font-rampart mt-3 text-[clamp(2rem,5vw,3.5rem)] leading-[1.05]">
                  {doc.title}
                </h1>
                <p
                  className="text-label mt-4 font-sans tracking-[0.06em] uppercase opacity-70"
                  dangerouslySetInnerHTML={{
                    __html: highlightTodo(
                      `Última atualização: ${doc.updatedAt} · Versão ${doc.version}`,
                    ),
                  }}
                />
                <div className="mt-6 flex flex-wrap gap-3 print:hidden">
                  <Button as="a" href="/" variant="secondary" className="!text-label !px-4 !py-2">
                    Voltar ao site
                  </Button>
                  <PrintButton className={ACTION_CLASSES} />
                </div>
              </header>

              {/* Índice recolhível (celular/tablet) */}
              <details className="border-fernandito-verde-escuro/15 group mt-8 rounded-2xl border bg-white/40 p-5 lg:hidden print:hidden">
                <summary className="text-label flex cursor-pointer list-none items-center justify-between font-sans tracking-[0.08em] uppercase">
                  Índice
                  <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <Toc doc={doc} className="mt-4" />
              </details>

              <div
                className={clsx("legal-prose mt-10")}
                dangerouslySetInnerHTML={{ __html: doc.html }}
              />
            </article>
          </div>
        </div>
      </main>
      <div className="print:hidden">
        <FooterSection />
      </div>
    </>
  );
}
