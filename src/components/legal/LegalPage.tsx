import NextLink from "next/link";
import type { LegalDoc, LegalSlug } from "@/lib/legal";
import { highlightTodo } from "@/lib/legal";
import { LEGAL } from "@/content/legal";
import { LINKS } from "@/content/site";
import { FooterSection } from "@/components/sections/FooterSection";
import { PrintButton } from "@/components/legal/PrintButton";
import { LegalReader } from "@/components/legal/LegalReader";
import { LegalIconSvg } from "@/components/legal/LegalIcons";

/**
 * Modelo das páginas legais (Termos e Privacidade), o mesmo nas duas:
 * 1. topo curto: troca entre os dois documentos, título, uma frase do que é
 *    e data/versão;
 * 2. "Em resumo": 6 pontos com ícone, lidos em 20 segundos;
 * 3. o texto completo em partes por assunto (`LEGAL[slug].groups`), cada
 *    seção num acordeão que abre e fecha;
 * 4. índice fixo do lado no computador (marca onde a pessoa está) e
 *    atalhos das partes no celular;
 * 5. fim: dúvida → WhatsApp, o outro documento e salvar em PDF.
 * O texto jurídico vem dos .md (`content/legal`); a moldura, de
 * `src/content/legal.ts`.
 */

// Página do servidor: o link do WhatsApp é montado aqui (o do botão mora
// num módulo de cliente).
const WA = LINKS.whatsappNumber
  ? `https://wa.me/${LINKS.whatsappNumber}?text=${encodeURIComponent("Oi! Fiquei com uma dúvida sobre os termos/privacidade do site.")}`
  : null;

const PILL =
  "text-label duration-base ease-out-standard inline-flex items-center rounded-full px-4 py-2 font-sans tracking-[0.08em] uppercase transition-colors";

export function LegalPage({ doc, slug }: { doc: LegalDoc; slug: LegalSlug }) {
  const frame = LEGAL[slug];
  const other: LegalSlug = slug === "termos" ? "privacidade" : "termos";
  const OTHER_LABEL: Record<LegalSlug, string> = {
    termos: "os Termos",
    privacidade: "a Privacidade",
    trocas: "Trocas e devoluções",
  };
  const grouped = new Set(frame.groups.flatMap((g) => g.sections));
  const leftovers = doc.sections.filter((s) => !grouped.has(s.number));
  const groups = [
    ...frame.groups.map((g) => ({
      ...g,
      items: doc.sections.filter((s) => g.sections.includes(s.number)),
    })),
    ...(leftovers.length ? [{ title: "Outros", text: "", sections: [], items: leftovers }] : []),
  ].map((g, i) => ({ ...g, id: `parte-${i + 1}` }));

  return (
    <>
      <LegalReader />
      <main className="bg-fernandito-off-white text-fernandito-verde-escuro min-h-svh [color-scheme:light]">
        <div
          data-print-root
          className="mx-auto max-w-6xl px-6 pt-[calc(8rem+var(--announcement-h))] pb-24 motion-safe:animate-[legal-fade_600ms_ease-out_both] sm:px-10"
        >
          {/* 1. Topo */}
          <header className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 print:hidden">
              <NextLink
                href="/"
                className="text-label duration-base ease-out-standard inline-flex items-center gap-2 font-sans tracking-[0.1em] uppercase opacity-60 transition-opacity hover:opacity-100"
              >
                <span aria-hidden="true">←</span> Início
              </NextLink>
              <nav
                aria-label="Documentos"
                className="bg-fernandito-verde-escuro/[0.06] inline-flex rounded-full p-1"
              >
                {(["termos", "privacidade", "trocas"] as const).map((s) => (
                  <NextLink
                    key={s}
                    href={`/${s}`}
                    aria-current={s === slug ? "page" : undefined}
                    className={
                      s === slug
                        ? `${PILL} bg-fernandito-verde-escuro text-fernandito-off-white`
                        : `${PILL} hover:bg-fernandito-verde-escuro/10 opacity-75`
                    }
                  >
                    {LEGAL[s].short}
                  </NextLink>
                ))}
              </nav>
            </div>
            <h1 className="font-rampart mt-8 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] text-balance">
              {doc.title}
            </h1>
            <p className="text-body-lg mt-4 max-w-2xl font-sans opacity-85">{frame.intro}</p>
            <p
              className="text-label mt-4 font-sans tracking-[0.06em] uppercase opacity-60"
              dangerouslySetInnerHTML={{
                __html: highlightTodo(`Atualizado em ${doc.updatedAt} · Versão ${doc.version}`),
              }}
            />
          </header>

          {frame.simple ? (
            <div className="mt-10 flex max-w-3xl flex-col gap-4">
              {doc.sections.map((s) => (
                <section
                  key={s.id}
                  id={s.id}
                  className="border-fernandito-verde-escuro/15 rounded-3xl border bg-white/45 p-6 sm:p-7"
                >
                  <h2 className="font-rampart text-[clamp(1.5rem,3vw,1.9rem)] leading-[1.05]">
                    {s.title}
                  </h2>
                  <div className="legal-prose mt-3" dangerouslySetInnerHTML={{ __html: s.html }} />
                </section>
              ))}
              {WA && (
                <a
                  href={WA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${PILL} bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio mt-2 self-start print:hidden`}
                >
                  Falar no WhatsApp
                </a>
              )}
            </div>
          ) : (
            <>
              {/* 2. Em resumo */}
              <section
                aria-labelledby="resumo-titulo"
                className="bg-fernandito-verde-medio text-fernandito-off-white mt-10 rounded-3xl p-7 shadow-[0_24px_60px_rgba(36,48,34,0.22)] sm:p-9 print:hidden"
              >
                <h2
                  id="resumo-titulo"
                  className="font-accent text-label tracking-[0.18em] uppercase opacity-80"
                >
                  Em resumo
                </h2>
                <ul className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                  {frame.summary.map((item) => (
                    <li key={item.text} className="flex items-start gap-4">
                      <span className="bg-fernandito-off-white/12 ring-fernandito-off-white/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1">
                        <LegalIconSvg name={item.icon} className="h-5 w-5" />
                      </span>
                      <p className="text-body pt-1.5 font-sans leading-snug">{item.text}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-label mt-7 font-sans tracking-[0.04em] opacity-70">
                  É só um resumo pra facilitar. Vale o texto completo aqui embaixo.
                </p>
              </section>

              {/* Atalhos das partes (celular/tablet) */}
              <nav
                aria-label="Partes do documento"
                className="-mx-6 mt-10 flex [scrollbar-width:none] gap-2 overflow-x-auto px-6 sm:-mx-10 sm:px-10 lg:hidden print:hidden [&::-webkit-scrollbar]:hidden"
              >
                {groups.map((g) => (
                  <a
                    key={g.id}
                    href={`#${g.id}`}
                    className={`${PILL} ring-fernandito-verde-escuro/20 shrink-0 whitespace-nowrap ring-1`}
                  >
                    {g.title}
                  </a>
                ))}
              </nav>

              <div className="mt-10 grid gap-12 lg:mt-16 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
                {/* 4. Índice fixo (computador) */}
                <aside className="hidden lg:block print:hidden">
                  <nav aria-label="Índice" className="sticky top-32 flex flex-col gap-6">
                    {groups.map((g) => (
                      <div key={g.id}>
                        <a
                          href={`#${g.id}`}
                          className="text-label font-sans tracking-[0.12em] uppercase opacity-55 hover:opacity-100"
                        >
                          {g.title}
                        </a>
                        <ol className="mt-2.5 flex flex-col gap-1.5 font-sans text-[0.85rem] leading-snug">
                          {g.items.map((s) => (
                            <li key={s.id}>
                              <a
                                href={`#${s.id}`}
                                data-toc-link={s.id}
                                className="duration-base ease-out-standard data-[active]:text-fernandito-verde-medio flex gap-2 opacity-75 transition-[color,opacity] hover:opacity-100 data-[active]:font-bold data-[active]:opacity-100"
                              >
                                <span className="w-5 shrink-0 tabular-nums opacity-60">
                                  {s.number}
                                </span>
                                {s.title}
                              </a>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </nav>
                </aside>

                {/* 3. Texto completo, por partes */}
                <article className="flex max-w-[70ch] flex-col gap-14">
                  {groups.map((g, gi) => (
                    <section
                      key={g.id}
                      id={g.id}
                      aria-labelledby={`${g.id}-titulo`}
                      className="scroll-mt-32"
                    >
                      <p className="font-accent text-label tracking-[0.16em] uppercase opacity-55">
                        Parte {gi + 1} de {groups.length}
                      </p>
                      <h2
                        id={`${g.id}-titulo`}
                        className="font-rampart mt-2 text-[clamp(1.7rem,3.4vw,2.4rem)] leading-[1.05]"
                      >
                        {g.title}
                      </h2>
                      {g.text && <p className="text-body mt-2 font-sans opacity-75">{g.text}</p>}
                      <div className="border-fernandito-verde-escuro/15 mt-6 border-t">
                        {g.items.map((s) => (
                          <details
                            key={s.id}
                            id={s.id}
                            data-legal-item
                            className="group border-fernandito-verde-escuro/15 scroll-mt-32 border-b"
                          >
                            <summary className="hover:text-fernandito-verde-medio duration-base ease-out-standard flex cursor-pointer list-none items-center gap-4 py-5 transition-colors [&::-webkit-details-marker]:hidden">
                              <span className="bg-fernandito-verde-escuro/[0.07] text-label flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-sans tabular-nums">
                                {s.number}
                              </span>
                              <h3 className="flex-1 font-sans text-[1.05rem] leading-snug font-bold">
                                {s.title}
                              </h3>
                              <span
                                aria-hidden="true"
                                className="duration-base ease-out-standard relative h-4 w-4 shrink-0 transition-transform group-open:rotate-45"
                              >
                                <span className="absolute top-1/2 left-0 h-[2px] w-4 -translate-y-1/2 rounded bg-current" />
                                <span className="absolute top-0 left-1/2 h-4 w-[2px] -translate-x-1/2 rounded bg-current" />
                              </span>
                            </summary>
                            <div
                              className="legal-prose pb-7 pl-12"
                              dangerouslySetInnerHTML={{ __html: s.html }}
                            />
                          </details>
                        ))}
                      </div>
                    </section>
                  ))}

                  {/* 5. Fim */}
                  <section
                    aria-label="Ficou dúvida?"
                    className="border-fernandito-verde-escuro/15 flex flex-col gap-5 rounded-3xl border bg-white/45 p-7 sm:p-8 print:hidden"
                  >
                    <div>
                      <h2 className="font-rampart text-[1.8rem] leading-[1.05]">
                        Ficou alguma dúvida?
                      </h2>
                      <p className="text-body mt-2 font-sans opacity-80">
                        Chama a gente — resposta em até 1 dia útil.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {WA && (
                        <a
                          href={WA}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${PILL} bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio`}
                        >
                          Falar no WhatsApp
                        </a>
                      )}
                      <NextLink
                        href={`/${other}`}
                        className={`${PILL} ring-fernandito-verde-escuro/30 hover:bg-fernandito-verde-escuro/10 ring-1`}
                      >
                        Ler {OTHER_LABEL[other]} →
                      </NextLink>
                      <PrintButton
                        className={`${PILL} ring-fernandito-verde-escuro/30 hover:bg-fernandito-verde-escuro/10 ring-1`}
                      />
                    </div>
                  </section>
                </article>
              </div>
            </>
          )}
        </div>
      </main>
      <div className="print:hidden">
        <FooterSection />
      </div>
    </>
  );
}
