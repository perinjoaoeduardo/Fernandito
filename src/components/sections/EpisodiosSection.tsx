"use client";

import { useEffect, useRef } from "react";
import { EPISODIOS, LINKS } from "@/content/site";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { Button } from "@/components/ui/Button";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { InstagramIcon } from "@/components/ui/icons";
import { IS_TOUCH, prefersReducedMotion } from "@/lib/gsap";

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
  return (
    <section
      id="episodios"
      aria-label="Episódios"
      className="bg-fernandito-verde-escuro text-fernandito-off-white w-full overflow-hidden py-20 md:py-28"
    >
      {/* Título e botão do Instagram iguais aos do antigo "O que anda
          rolando": título centralizado escrito à máquina e, depois dos
          cartões, "Segue a gente no Instagram" + @ do perfil. */}
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
        <TypewriterText
          text={EPISODIOS.title}
          className="font-rampart text-[min(6.8vw,1.75rem)] leading-[1.05] tracking-[0.02em] whitespace-nowrap sm:text-[clamp(1.75rem,4vw,3rem)] lg:text-[clamp(2.75rem,3.6vw,3.75rem)]"
        />
      </div>

      <ul className="mx-auto mt-10 flex max-w-6xl snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-6 pb-2 sm:px-10 md:grid md:grid-cols-3 md:overflow-visible lg:gap-6 lg:px-16 [&::-webkit-scrollbar]:hidden">
        {EPISODIOS.items.map((ep) => (
          <li key={ep.number} className="w-[68%] shrink-0 snap-center sm:w-[42%] md:w-auto">
            <EpisodeCard ep={ep} />
          </li>
        ))}
      </ul>

      <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center px-6 text-center md:mt-16">
        <p className="text-body font-accent mb-2 tracking-[0.04em]">{EPISODIOS.follow}</p>
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
