"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, EASE, SCRUB, prefersReducedMotion } from "@/lib/gsap";
import { Parallax } from "@/components/ui/Parallax";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { InstagramIcon } from "@/components/ui/icons";
import { useGoToShop } from "@/components/cart/useGoToShop";
import { CONTATO, LINKS } from "@/content/site";

/**
 * CTA de contato, tela dividida: texto à esquerda (título escrito à máquina
 * + botão), imagem à direita com parallax no scroll. No celular a imagem
 * vai pra baixo do texto, com o mesmo parallax.
 */
type ContatoSectionProps = {
  /** Textos no lugar dos de `CONTATO` (usado no pré-lançamento). */
  title?: string;
  text?: string;
  cta?: string;
  /** Botão de compra acima do WhatsApp (bloco final do pré-lançamento). */
  shopCta?: string;
  /** Classes do título no lugar das padrão (tamanho/largura). */
  titleClassName?: string;
  /** Pré-lançamento (logo abaixo da Hero): a foto sobe até encostar no
   * cartão da Hero e já aparece inteira, sem o fade — senão sobrava um vão
   * verde entre as duas fotos. */
  joinHero?: boolean;
  /** Texto de um link pro Instagram ao lado do WhatsApp (pré-lançamento). */
  instagram?: string;
};

export function ContatoSection({
  title = CONTATO.title,
  text = CONTATO.text,
  cta = CONTATO.cta,
  instagram,
  joinHero = false,
  shopCta,
  titleClassName = "max-w-[13ch] text-[clamp(2.5rem,5vw,5rem)] leading-[1]",
}: ContatoSectionProps) {
  const goToShop = useGoToShop();
  const sectionRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const cta = ctaRef.current;
    const image = imageRef.current;
    const frame = frameRef.current;
    if (!section || !cta || !image || !frame || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cta,
        // opacity, não autoAlpha: com visibility:hidden o botão saía da
        // ordem do Tab e quem navega pelo teclado não chegava nele.
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          ease: EASE.outStandard,
          // Mesmo gatilho dos textos (a seção), logo depois do parágrafo
          // terminar de se escrever — o botão é o último da sequência.
          scrollTrigger: { trigger: section, start: "top 8%", end: "top -4%", scrub: SCRUB.base },
        },
      );
      // Entrada suave da imagem: só um fade longo, somado ao parallax e ao
      // zoom leve que já existem por dentro. (Já foi uma cortina de
      // clip-path abrindo de baixo pra cima — agressiva demais.)
      if (!joinHero) {
        gsap.fromTo(
          frame,
          { opacity: 0 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: { trigger: frame, start: "top 95%", end: "top 45%", scrub: SCRUB.base },
          },
        );
      }
      // Imagem 120% da altura da moldura: desliza de cima pra baixo e
      // desfaz um leve zoom enquanto a seção atravessa a tela.
      gsap.fromTo(
        image,
        { yPercent: -8, scale: 1.08 },
        {
          yPercent: 8,
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    }, section);

    return () => ctx.revert();
  }, [joinHero]);

  return (
    <section
      ref={sectionRef}
      id="contato"
      aria-label="Contato"
      className="bg-fernandito-verde-medio text-fernandito-off-white grid w-full md:min-h-[110vh] md:grid-cols-2"
    >
      <div
        className={clsx(
          "flex flex-col items-start justify-center px-6 sm:px-10 md:py-32 lg:px-16",
          // Logo abaixo da Hero (pré-lançamento), no celular o bloco já começa
          // depois da sobra da moldura — com o py-24 inteiro ficava um vão.
          joinHero ? "pt-10 pb-20" : "py-24",
        )}
      >
        {/* Parallax na coluna de texto só no computador. */}
        <Parallax speed={40} touch={false}>
          <TypewriterText
            text={title}
            triggerSelector="#contato"
            start="top 90%"
            end="top 30%"
            className={`font-rampart tracking-[0.01em] ${titleClassName}`}
          />
          <TypewriterText
            as="p"
            text={text}
            caret={false}
            triggerSelector="#contato"
            start="top 30%"
            end="top 5%"
            className="text-body-lg mt-8 max-w-md font-sans"
          />
          {/* Empilhados e com a mesma largura: WhatsApp (verde-escuro) e,
              embaixo, o Instagram num botão claro — cor diferente pra não
              confundir os dois. */}
          <div ref={ctaRef} className="mt-10 inline-flex flex-col items-stretch gap-3">
            {/* Com `shopCta`: a compra vem primeiro, no botão claro; o
                WhatsApp vira o contato secundário logo embaixo. */}
            {shopCta && (
              <button
                type="button"
                onClick={goToShop}
                className="bg-fernandito-off-white text-fernandito-verde-escuro text-body duration-base ease-out-standard hover:bg-fernandito-verde-claro hover:text-fernandito-off-white focus-visible:outline-fernandito-off-white inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-sans font-medium tracking-[0.01em] transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 active:scale-[0.96]"
              >
                {shopCta}
              </button>
            )}
            <WhatsAppButton background="verde-escuro">{cta}</WhatsAppButton>
            {instagram && (
              <a
                href={LINKS.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${instagram} ${LINKS.instagramHandle} — abre em nova aba`}
                className={clsx(
                  "text-body duration-base ease-out-standard focus-visible:outline-fernandito-off-white inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-sans font-medium tracking-[0.01em] transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 active:scale-[0.96]",
                  // Com a compra em cima, o Instagram desce pra contornado.
                  shopCta
                    ? "border-fernandito-off-white/40 text-fernandito-off-white hover:bg-fernandito-off-white/10 border"
                    : "bg-fernandito-off-white text-fernandito-verde-escuro hover:bg-fernandito-verde-claro hover:text-fernandito-off-white",
                )}
              >
                <InstagramIcon />
                {instagram}
              </a>
            )}
          </div>
        </Parallax>
      </div>

      {/* Metade da imagem (foto em `src/content/site.ts`), 120% da altura
          da moldura pra sobrar margem pro parallax. */}
      <div
        ref={frameRef}
        className={clsx(
          "relative aspect-[4/5] overflow-hidden md:aspect-auto",
          // Sobe o tamanho da moldura da Hero que sobra embaixo do cartão
          // fechado (escala 0.9 no toque, 0.86 com mouse → 5vh / 7vh).
          joinHero && "md:-mt-[5vh] md:pointer-fine:-mt-[7vh]",
        )}
      >
        <div
          ref={imageRef}
          className="absolute inset-x-0 -top-[10%] h-[120%] [will-change:transform]"
        >
          <PhotoSlot
            image={CONTATO.photo}
            sizes="(max-width: 767px) 100vw, 50vw"
            placeholderClassName="bg-fernandito-verde-escuro"
          />
          <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
        </div>
      </div>
    </section>
  );
}

export default ContatoSection;
