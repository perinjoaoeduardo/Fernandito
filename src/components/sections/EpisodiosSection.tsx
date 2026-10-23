"use client";

import { useEffect, useRef } from "react";
import { EPISODIOS, LINKS } from "@/content/site";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { Button } from "@/components/ui/Button";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { InstagramIcon } from "@/components/ui/icons";
import { gsap, IS_TOUCH, prefersReducedMotion, SCRUB } from "@/lib/gsap";

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 translate-x-[1px]"
      fill="currentColor"
    >
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />
    </svg>
  );
}

/**
 * Episódios do Fernandito (no lugar do "O que anda rolando"): um cartão
 * vertical por episódio, no formato do reel. Com a prévia em vídeo
 * (`EPISODIOS.items[].preview`): no computador ela toca ao passar o mouse;
 * no celular, quando o cartão está no meio da tela. Clique/toque abre o
 * episódio no Instagram. Sem prévia: a capa com o ícone de play. No
 * computador ficam lado a lado; no celular viram um trilho que desliza.
 */
export function EpisodiosSection() {
  const sectionRef = useRef<HTMLElement>(null);

  // Animações presas à rolagem (nos dois sentidos):
  // • entrada: título e cartões sobem e aparecem; cada cartão com uma
  //   profundidade diferente (o do meio vem de mais longe);
  // • parallax: a mídia dentro de cada cartão anda mais devagar que o cartão;
  // • saída: tudo sobe um pouco e esmaece ao sair da seção.
  // No celular (trilho que desliza na horizontal) o trilho todo anda junto:
  // mexer num cartão só cortaria ele no overflow.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion()) return;
    const q = <T extends HTMLElement>(selector: string) =>
      Array.from(section.querySelectorAll<T>(selector));
    const rail = section.querySelector<HTMLElement>("[data-ep-rail]");
    const foot = section.querySelector<HTMLElement>("[data-ep-foot]");
    if (!rail || !foot) return;

    const mm = gsap.matchMedia();
    const enter = { start: "top 98%", end: "top 55%", scrub: SCRUB.soft };

    // Parallax da mídia (mais leve no toque).
    const amp = IS_TOUCH ? 2.5 : 5;
    const mediaTweens = () =>
      q("[data-ep-media]").forEach((media) =>
        gsap.fromTo(
          media,
          { yPercent: -amp },
          {
            yPercent: amp,
            ease: "none",
            scrollTrigger: {
              trigger: media.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        ),
      );

    // Saída: o que já entrou sobe um pouco e esmaece.
    const leave = (target: gsap.TweenTarget, y: number, trigger: Element, from = "bottom 50%") =>
      gsap.fromTo(
        target,
        { y: 0, opacity: 1 },
        {
          y: -y,
          opacity: 0.2,
          ease: "none",
          immediateRender: false,
          scrollTrigger: { trigger, start: from, end: "bottom 0%", scrub: SCRUB.soft },
        },
      );

    mm.add("(min-width: 768px)", () => {
      const depth = [70, 130, 90]; // px: cada cartão vem de uma distância
      q("[data-ep-card]").forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: depth[i % depth.length], opacity: 0, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: rail, ...enter },
          },
        );
        leave(card, 30 + (i % 3) * 20, rail);
      });
      mediaTweens();
    });

    mm.add("(max-width: 767px)", () => {
      gsap.fromTo(
        rail,
        { y: 70, opacity: 0 },
        { y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: rail, ...enter } },
      );
      leave(rail, 40, rail);
      mediaTweens();
    });

    // Rodapé da seção (Instagram): entra por último e sai junto.
    gsap.fromTo(
      foot,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        ease: "none",
        scrollTrigger: { trigger: foot, start: "top 100%", end: "top 78%", scrub: SCRUB.soft },
      },
    );
    leave(foot, 30, foot, "bottom 40%");

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="episodios"
      aria-label="Episódios"
      className="bg-fernandito-verde-medio text-fernandito-off-white w-full overflow-hidden pt-24 pb-12 md:pt-32 md:pb-14 lg:pt-36 lg:pb-16"
    >
      {/* Ritmo vertical: 24/32/36 de respiro em cima e embaixo; 12/16 entre
          o título e os cartões; 12/20 entre os cartões e o Instagram. */}
      <div data-ep-head className="mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
        <TypewriterText
          text={EPISODIOS.title}
          className="font-rampart text-[min(6.8vw,1.75rem)] leading-[1.05] tracking-[0.02em] whitespace-nowrap sm:text-[clamp(1.75rem,4vw,3rem)] lg:text-[clamp(2.75rem,3.6vw,3.75rem)]"
        />
      </div>

      <div data-ep-rail className="mt-12 md:mt-16">
        <ul className="mx-auto flex max-w-6xl snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-6 pb-2 sm:px-10 md:grid md:grid-cols-3 md:overflow-visible lg:gap-6 lg:px-16 [&::-webkit-scrollbar]:hidden">
          {EPISODIOS.items.map((ep) => (
            <li
              key={ep.number}
              data-ep-card
              className="w-[68%] shrink-0 snap-center sm:w-[42%] md:w-auto"
            >
              <EpisodeCard ep={ep} />
            </li>
          ))}
        </ul>
      </div>

      <div
        data-ep-foot
        className="mx-auto mt-12 flex max-w-5xl flex-col items-center px-6 text-center md:mt-20"
      >
        <p className="text-body font-accent mb-3 tracking-[0.04em]">{EPISODIOS.follow}</p>
        <Button
          as="a"
          href={LINKS.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          icon={<InstagramIcon />}
          iconPosition="left"
          // Fundo escuro: o ghost padrão é verde-escuro, aqui vira claro.
          className="!text-fernandito-off-white hover:!text-fernandito-verde-claro"
          aria-label={`${LINKS.instagramHandle} — seguir no Instagram, abre em nova aba`}
        >
          {LINKS.instagramHandle}
        </Button>
      </div>
    </section>
  );
}

function EpisodeCard({ ep }: { ep: (typeof EPISODIOS.items)[number] }) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Celular: a prévia toca com o cartão no meio da tela e pausa ao sair.
  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video || !IS_TOUCH || prefersReducedMotion()) return;
    const observer = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? void video.play().catch(() => {}) : video.pause()),
      { threshold: 0.75 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const play = () => {
    if (IS_TOUCH || prefersReducedMotion()) return;
    void videoRef.current?.play().catch(() => {});
  };
  const stop = () => {
    const video = videoRef.current;
    if (!video || IS_TOUCH) return;
    video.pause();
    video.currentTime = 0;
  };

  return (
    <a
      ref={cardRef}
      href={ep.href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      aria-label={`${ep.title} — assistir no Instagram`}
      className="group bg-fernandito-verde-medio ring-fernandito-off-white/10 hover:ring-fernandito-verde-claro duration-base ease-out-standard relative block aspect-[9/16] overflow-hidden rounded-3xl ring-1 transition-[box-shadow,transform] hover:-translate-y-1"
    >
      {/* Mídia (capa + vídeo) um pouco maior que o cartão: sobra pro parallax. */}
      <div data-ep-media className="absolute inset-x-0 -inset-y-[8%]">
        <PhotoSlot
          image={ep.cover}
          sizes="(max-width: 767px) 68vw, 30vw"
          placeholderClassName="bg-fernandito-verde-medio"
        />
        {ep.preview && (
          <video
            ref={videoRef}
            src={ep.preview}
            muted
            loop
            playsInline
            preload="metadata"
            className="duration-slow ease-out-standard absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100"
          />
        )}
      </div>
      {/* Overlay sutil por cima de qualquer capa/vídeo: tom verde da marca,
          vinheta nas bordas e um grão leve. Clareia no hover pra mídia
          ganhar vida. */}
      <span
        aria-hidden="true"
        className="duration-slow ease-out-standard bg-fernandito-verde-escuro/20 pointer-events-none absolute inset-0 mix-blend-multiply transition-opacity group-hover:opacity-40"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(20,28,18,0.35)_100%)]"
      />
      <span
        aria-hidden="true"
        className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
      />
      {/* Véu pro texto ler por cima de qualquer capa. */}
      <span
        aria-hidden="true"
        className="from-fernandito-verde-escuro/85 absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent"
      />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
        <span>
          <span className="font-accent text-label block tracking-[0.16em] uppercase opacity-80">
            Ep. {String(ep.number).padStart(2, "0")}
          </span>
          <span className="font-rampart mt-1 block text-[1.3rem] leading-[1.02] md:text-[1.5rem]">
            {ep.title}
          </span>
        </span>
        <span className="bg-fernandito-off-white text-fernandito-verde-escuro duration-base ease-out-standard flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110">
          <PlayIcon />
        </span>
      </span>
    </a>
  );
}

export default EpisodiosSection;
