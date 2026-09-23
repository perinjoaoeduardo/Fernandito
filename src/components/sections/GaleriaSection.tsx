"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

// Cada foto tem proporção (`ratio` = largura/altura), altura relativa ao
// palco (`h`), deslocamento vertical (`off`, fração da altura do palco) e
// velocidade (`speed`). Parallax de profundidade: as fotos grandes ficam na
// frente e correm mais rápido; as pequenas ficam atrás e correm mais
// devagar. A foto 0 (a "inteira") e a última andam na velocidade base.
type Photo = {
  label: string;
  tone: string;
  ratio: number;
  h: number;
  off: number;
  speed: number;
  z: number;
};

const PHOTOS: Photo[] = [
  { label: "Foto 01", tone: "bg-fernandito-verde-medio", ratio: 4 / 5, h: 0.62, off: 0, speed: 1, z: 5 },
  { label: "Foto 02", tone: "bg-fernandito-verde-claro", ratio: 3 / 4, h: 0.42, off: -0.17, speed: 0.85, z: 2 },
  { label: "Foto 03", tone: "bg-fernandito-verde-medio", ratio: 4 / 3, h: 0.5, off: 0.13, speed: 1.2, z: 6 },
  { label: "Foto 04", tone: "bg-fernandito-verde-claro", ratio: 4 / 5, h: 0.58, off: -0.06, speed: 1, z: 4 },
  { label: "Foto 05", tone: "bg-fernandito-verde-escuro", ratio: 3 / 4, h: 0.4, off: 0.19, speed: 0.8, z: 1 },
  { label: "Foto 06", tone: "bg-fernandito-verde-claro", ratio: 4 / 3, h: 0.46, off: -0.13, speed: 1.15, z: 6 },
  { label: "Foto 07", tone: "bg-fernandito-verde-medio", ratio: 4 / 5, h: 0.6, off: 0.04, speed: 1, z: 5 },
];

const RADIUS = 20;
const BG_FROM = "#243022"; // verde-escuro
const BG_TO = "#e6e6cb"; // off-white (bege) — mesma cor do Manifesto, logo abaixo
// px de deslocamento horizontal da trilha base por px rolado.
const SPEED = 1.1;
const PARALLAX = 7; // xPercent da imagem dentro do card (±)

function layout(W: number, H: number) {
  const mobile = W < 768;
  const maxW = W * (mobile ? 0.72 : 0.42);
  const sizes = PHOTOS.map((p) => {
    let h = H * (mobile ? p.h * 0.82 : p.h);
    let w = h * p.ratio;
    if (w > maxW) {
      w = maxW;
      h = w / p.ratio;
    }
    return { w, h, off: p.off * H * (mobile ? 0.7 : 1) };
  });
  const gap = mobile ? W * 0.08 : Math.max(40, W * 0.035);
  const avgW = sizes.reduce((a, s) => a + s.w, 0) / sizes.length;
  // Distância que a trilha base anda na fase 2: cada foto cruza o centro da
  // tela num instante t_i = i/(n-1), espaçadas pela largura média + gap.
  const D = (PHOTOS.length - 1) * (avgW + gap);
  return { sizes, D };
}

/** Miolo de cada card — hoje placeholder; com a foto real, trocar o
 * conteúdo por `<Image fill className="object-cover" />` mantendo o wrapper
 * (ele é mais largo que o card pra sobrar margem pro parallax). */
function PhotoFill({ photo, innerRef }: { photo: Photo; innerRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={innerRef}
      className={clsx(
        "absolute inset-y-0 -left-[10%] flex w-[120%] items-center justify-center [will-change:transform]",
        photo.tone,
      )}
    >
      <span className="text-label text-fernandito-off-white font-sans tracking-[0.12em] uppercase opacity-80">
        {photo.label}
      </span>
    </div>
  );
}

export function GaleriaSection() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const stage = stageRef.current;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    const inners = innerRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!stage || cards.length !== PHOTOS.length) return;

    let ctx: gsap.Context | null = null;

    const build = () => {
      ctx?.revert();
      ctx = gsap.context(() => {
        const W = stage.clientWidth;
        const H = stage.clientHeight;
        const { sizes, D } = layout(W, H);
        const n = PHOTOS.length;
        const p1 = H * 0.9;
        const p2 = D / SPEED;

        // Posição (canto superior esquerdo) do card i no instante t da
        // fase 2 (0 → 1): o centro dele cruza o meio da tela em t_i.
        const posX = (i: number, t: number) =>
          W / 2 + PHOTOS[i].speed * D * (i / (n - 1) - t) - sizes[i].w / 2;
        const posY = (i: number) => H / 2 - sizes[i].h / 2 + sizes[i].off;

        gsap.set(stage, { backgroundColor: BG_FROM });
        // Foto 0 começa ocupando o palco inteiro, por cima de tudo.
        gsap.set(cards[0], { x: 0, y: 0, width: W, height: H, borderRadius: 0, zIndex: 20 });
        cards.slice(1).forEach((card, k) => {
          const i = k + 1;
          gsap.set(card, {
            x: posX(i, 0) + W * 0.6,
            y: posY(i),
            width: sizes[i].w,
            height: sizes[i].h,
            borderRadius: RADIUS,
            zIndex: PHOTOS[i].z,
            opacity: 1,
          });
        });
        gsap.set(inners, { xPercent: PARALLAX });

        const tl = gsap.timeline({ defaults: { ease: "none" } });

        // Fase 1 — a foto inteira encolhe até virar card; as outras entram
        // pela direita, cada uma já na sua altura.
        tl.to(
          cards[0],
          {
            x: posX(0, 0),
            y: posY(0),
            width: sizes[0].w,
            height: sizes[0].h,
            borderRadius: RADIUS,
            duration: p1,
            ease: "power2.inOut",
          },
          0,
        ).set(cards[0], { zIndex: PHOTOS[0].z }, p1);
        cards.slice(1).forEach((card, k) => {
          tl.to(card, { x: posX(k + 1, 0), duration: p1, ease: "power2.out" }, 0);
        });

        // Fase 2 — cada foto anda na sua velocidade; um leve desvio
        // vertical proporcional à velocidade reforça a profundidade.
        cards.forEach((card, i) => {
          const drift = (PHOTOS[i].speed - 1) * H * 0.12;
          tl.to(card, { x: posX(i, 1), y: posY(i) - drift, duration: p2 }, p1);
        });

        tl.to(inners, { xPercent: -PARALLAX, duration: p1 + p2 }, 0)
          // Fundo verde-escuro → bege ao longo da trilha, emendando no
          // Manifesto (off-white) logo abaixo.
          .to(stage, { backgroundColor: BG_TO, duration: p2 * 0.85, ease: "power1.inOut" }, p1);

        ScrollTrigger.create({
          trigger: stage,
          start: "top top",
          end: `+=${p1 + p2}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          animation: tl,
        });
      }, stage);
    };

    build();

    // Rebuild só quando a LARGURA muda — no celular a barra de endereço
    // muda a altura a cada rolagem e reconstruir nisso travaria o scroll.
    let lastW = window.innerWidth;
    let timer: number | undefined;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        build();
        ScrollTrigger.refresh();
      }, 200);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
      ctx?.revert();
    };
  }, []);

  return (
    <section id="galeria" aria-label="Galeria" className="bg-fernandito-verde-escuro relative w-full">
      <h2 className="sr-only">Galeria</h2>

      {/* ── Animado (some sob prefers-reduced-motion) ── */}
      <div
        ref={stageRef}
        className="bg-fernandito-verde-escuro relative h-[100svh] w-full overflow-hidden motion-reduce:hidden"
      >
        {PHOTOS.map((photo, i) => (
          <div
            key={photo.label}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            role="img"
            aria-label={`Galeria Fernandito — ${photo.label.toLowerCase()}`}
            className={clsx(
              "absolute top-0 left-0 overflow-hidden shadow-[0_24px_60px_rgba(36,48,34,0.3)] [will-change:transform]",
              // Antes do JS (SSR): foto 0 já é a foto inteira; o resto fica
              // invisível até o GSAP posicionar (translate via classe
              // somaria com o transform do GSAP, por isso opacity).
              i === 0 ? "h-full w-full" : "h-[50%] w-[30%] rounded-[20px] opacity-0",
            )}
          >
            <PhotoFill
              photo={photo}
              innerRef={(el) => {
                innerRefs.current[i] = el;
              }}
            />
          </div>
        ))}
      </div>

      {/* ── prefers-reduced-motion: grid estático, sem pin nem scroll ── */}
      <div className="hidden px-6 py-24 motion-reduce:block">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {PHOTOS.map((photo) => (
            <div
              key={photo.label}
              role="img"
              aria-label={`Galeria Fernandito — ${photo.label.toLowerCase()}`}
              className="relative aspect-[4/5] overflow-hidden rounded-[20px]"
            >
              <PhotoFill photo={photo} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GaleriaSection;
