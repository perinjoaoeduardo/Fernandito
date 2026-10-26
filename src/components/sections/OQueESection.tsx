"use client";

import NextLink from "next/link";
import { useEffect, useRef } from "react";
import { useStock } from "@/components/cart/useStock";
import { gsap, ScrollTrigger, SplitText, SCRUB, prefersReducedMotion } from "@/lib/gsap";
import Image from "next/image";
import { O_QUE_E, PAGES, PRELAUNCH, SHOP_HREF, STORE } from "@/content/site";
import { Parallax } from "@/components/ui/Parallax";

// Textos curtos ("o que somos") revelados letra a letra, tipo máquina de
// escrever — combina com a Courier Prime (font-sans) já usada no corpo do
// site. Preso ao scroll via `scrub` (ver useEffect abaixo), não um "toca
// uma vez": avança enquanto rola pra baixo, volta se rolar pra cima. A
// frase de fechamento mora na MESMA coluna dos parágrafos (não vira um
// bloco gigante à parte) e usa a mesma máquina de escrever, só que num
// tamanho bem mais contido — estilo do segundo bloco da home da Lassie,
// onde a frase de efeito fica logo abaixo do texto curto, não domina a
// tela sozinha. Textos em `src/content/site.ts`.
const TYPE_STAGGER = 0.014;

export function OQueESection() {
  const columnRef = useRef<HTMLDivElement>(null);
  const { soldOut } = useStock();
  const p1Ref = useRef<HTMLParagraphElement>(null);
  const p2Ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const column = columnRef.current;
    const p1 = p1Ref.current;
    const p2 = p2Ref.current;
    if (!column || !p1 || !p2) return;

    const reduceMotion = prefersReducedMotion();
    const splitInstances: SplitText[] = [];

    if (reduceMotion) {
      gsap.set([p1, p2], { opacity: 1 });
      return;
    }

    let chars: Element[] = [];
    try {
      // "words,chars": cada palavra vira um inline-block próprio, então a
      // quebra de linha só acontece entre palavras. Só "chars" deixava o
      // navegador quebrar no meio da palavra ("qu / anto").
      const splitP1 = new SplitText(p1, { type: "words,chars", aria: "none" });
      const splitP2 = new SplitText(p2, { type: "words,chars", aria: "none" });
      splitInstances.push(splitP1, splitP2);
      chars = [...splitP1.chars, ...splitP2.chars];
    } catch (err) {
      console.warn("[OQueESection] SplitText indisponível, usando fallback manual.", err);
      gsap.set([p1, p2], { opacity: 1 });
      return;
    }

    gsap.set(chars, { opacity: 0 });

    // Preso ao scroll (scrub), não um "dispara e esquece": a máquina de
    // escrever avança enquanto você rola pra baixo E volta letra por letra
    // se você rolar pra cima — mesma lógica de "aparece e some conforme
    // rola" que o resto do site usa pros títulos grandes. Uma trilha só
    // (os dois parágrafos juntos), não dois triggers
    // separados — lê como um bloco de texto contínuo, não duas animações
    // independentes.
    const trigger = ScrollTrigger.create({
      trigger: column,
      // Termina quando o fim da coluna entra na tela (bottom 85%): o texto
      // tem que estar todo escrito enquanto a seção ainda está à vista,
      // não só quando ela já está saindo por cima.
      start: "top 90%",
      end: "bottom 85%",
      scrub: SCRUB.tight,
      animation: gsap.timeline().to(chars, { opacity: 1, stagger: TYPE_STAGGER, ease: "none" }),
    });

    return () => {
      trigger.kill();
      splitInstances.forEach((split) => split.revert());
    };
  }, []);

  return (
    <section
      id="o-que-e"
      aria-label="O que é o Fernandito"
      className="bg-fernandito-off-white text-fernandito-verde-escuro w-full px-6 py-20 sm:py-32"
    >
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[minmax(0,300px)_1fr] md:items-center md:gap-16">
        {/* A lata (arte em `src/content/site.ts`; sem arte, placeholder
            tracejado). Parallax: lata atrás (mais lenta), texto na frente —
            o texto só no computador; no celular ele fica parado (andando
            fora do ritmo do dedo parecia solto). */}
        <Parallax speed={-50}>
          <div className="relative mx-auto w-fit md:mx-0 md:w-full">
            <div
              className={
                O_QUE_E.lata.src
                  ? // Foto (2:3), não mais a arte recortada da lata.
                    "relative mx-auto aspect-[2/3] w-[min(18rem,78vw)] shrink-0 overflow-hidden rounded-[1.75rem] shadow-[0_30px_70px_rgba(36,48,34,0.28)] md:mx-0 md:w-full"
                  : "border-fernandito-verde-escuro/25 mx-auto flex aspect-[3/7] w-24 shrink-0 items-center justify-center rounded-[2rem] border-2 border-dashed md:mx-0 md:w-full"
              }
            >
              {O_QUE_E.lata.src ? (
                <Image
                  src={O_QUE_E.lata.src}
                  alt={O_QUE_E.lata.alt}
                  fill
                  sizes="(max-width: 767px) 78vw, 300px"
                  quality={90}
                  className="object-cover"
                />
              ) : (
                <span className="text-label font-accent px-3 text-center uppercase opacity-80">
                  {O_QUE_E.lata.placeholder}
                </span>
              )}
            </div>
            {/* Pré-venda: adesivo colado na lata, leva pra página do kit —
              sem gastar uma seção só pra isso. */}
            {STORE.enabled && !PRELAUNCH.enabled && (
              <NextLink
                href={SHOP_HREF}
                className="group bg-fernandito-verde-escuro text-fernandito-off-white ring-fernandito-off-white duration-base ease-out-standard absolute -top-4 -right-3 flex rotate-[-6deg] flex-col items-start gap-0.5 rounded-xl px-3.5 py-2 whitespace-nowrap uppercase shadow-[0_10px_24px_rgba(36,48,34,0.35)] ring-[3px] transition-transform hover:scale-105 hover:rotate-[-3deg] md:-top-6 md:-right-10"
              >
                <span className="flex items-center gap-1.5 font-sans text-[0.6rem] tracking-[0.16em] opacity-85">
                  <span className="bg-fernandito-verde-claro h-1.5 w-1.5 rounded-full motion-safe:animate-pulse" />
                  {soldOut ? PAGES.preVenda.soldOutTag : PAGES.preVenda.tag}
                </span>
                <span className="font-rampart-stamp flex items-center gap-1.5 text-[1rem] leading-none tracking-[0.08em]">
                  {soldOut ? PAGES.preVenda.soldOutCta : PAGES.preVenda.cta}
                  {!soldOut && (
                    <span className="duration-base ease-out-standard transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  )}
                </span>
              </NextLink>
            )}
          </div>
        </Parallax>

        <Parallax speed={30} touch={false}>
          <div ref={columnRef} className="flex flex-col gap-6">
            <p ref={p1Ref} className="text-body-lg font-sans">
              {O_QUE_E.paragraphs[0]}
            </p>
            <p ref={p2Ref} className="text-body-lg font-sans">
              {O_QUE_E.paragraphs[1]}
            </p>
          </div>
        </Parallax>
      </div>
    </section>
  );
}

export default OQueESection;
