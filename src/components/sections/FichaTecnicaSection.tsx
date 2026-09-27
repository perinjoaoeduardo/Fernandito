"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { MARQUEE } from "@/content/site";

// Frase curta, só o essencial de marca — nada de texto regulatório aqui
// (isso mora em /legal/avisos). `font-accent` (Special Elite, o mesmo dos
// carimbos da SocialGallerySection), pra faixa ter voz tipográfica própria.
// Fundo verde-claro: separa visualmente do rodapé verde-escuro logo abaixo.
// Espaços inquebráveis em volta do "·": um espaço comum no fim do texto
// some na emenda do loop, e o padding que compensava deixava um buraco
// maior ali ("COLA ·    TOMA").
const MARQUEE_PHRASE = MARQUEE.phrases.map((phrase) => `${phrase}\u00A0·\u00A0`).join("");

// Repetido várias vezes pra garantir que uma "metade" da trilha já seja mais
// larga que qualquer viewport razoável — condição pro loop (que volta ao
// início a cada metade da trilha) ficar perfeitamente contínuo, sem
// "buraco" em telas muito largas.
const MARQUEE_TRACK_TEXT = MARQUEE_PHRASE.repeat(12);

// Velocidade constante (px/s), independente da largura da trilha e da
// rolagem: a faixa só passa, sempre no mesmo ritmo. (Já reagiu à rolagem,
// acelerando e invertendo, e já deslizou junto com ela; as duas coisas
// saíram por deixar o fim da página agitado demais.)
const SPEED = 90;

function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || prefersReducedMotion()) return;

    let loop: gsap.core.Tween | null = null;
    let lastW = 0;
    // Recria o loop só quando a largura da tela muda: a trilha muda de
    // tamanho junto com a fonte (clamp com vw).
    const build = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      loop?.kill();
      gsap.set(track, { xPercent: 0 });
      loop = gsap.to(track, {
        xPercent: -50,
        duration: track.scrollWidth / 2 / SPEED,
        ease: "none",
        repeat: -1,
      });
    };
    build();
    window.addEventListener("resize", build);

    return () => {
      window.removeEventListener("resize", build);
      loop?.kill();
    };
  }, []);

  return (
    // translate-y 0.15em: na Special Elite a linha reserva ~30% da altura
    // pras descendentes (asc 1440 / desc 608 de 2048); com o texto todo em
    // caixa-alta, o centro das maiúsculas fica 0.15em acima do centro da
    // faixa. O deslocamento compensa isso exatamente.
    <div aria-hidden="true" className="flex items-center overflow-hidden py-3 sm:py-4">
      <div className="shrink-0">
        <div ref={trackRef} className="flex w-max shrink-0 [will-change:transform]">
          <span className="text-fernandito-off-white font-accent translate-y-[0.15em] text-[clamp(1.25rem,2.4vw,1.875rem)] leading-none tracking-[0.02em] whitespace-nowrap uppercase">
            {MARQUEE_TRACK_TEXT}
          </span>
          <span className="text-fernandito-off-white font-accent translate-y-[0.15em] text-[clamp(1.25rem,2.4vw,1.875rem)] leading-none tracking-[0.02em] whitespace-nowrap uppercase">
            {MARQUEE_TRACK_TEXT}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FichaTecnicaSection() {
  return (
    <section id="ficha-tecnica" className="bg-fernandito-verde-claro w-full">
      <h2 className="sr-only">Ficha Técnica</h2>
      <Marquee />
    </section>
  );
}

export default FichaTecnicaSection;
