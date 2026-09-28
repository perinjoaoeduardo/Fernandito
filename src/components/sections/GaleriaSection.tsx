"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, IS_TOUCH, SCRUB, prefersReducedMotion } from "@/lib/gsap";
import { GALERIA } from "@/content/site";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

// Cada foto tem proporção (`ratio` = largura/altura), altura relativa ao
// palco (`h`), deslocamento vertical (`off`, fração da altura do palco) e
// velocidade (`speed`). Parallax de profundidade: as fotos grandes ficam na
// frente e correm mais rápido; as pequenas ficam atrás e correm mais
// devagar. A foto 0 (a "inteira") e a última andam na velocidade base.
type Photo = {
  tone: string;
  ratio: number;
  h: number;
  off: number;
  speed: number;
  z: number;
};

const PHOTOS: Photo[] = [
  {
    tone: "bg-fernandito-verde-medio",
    ratio: 4 / 5,
    h: 0.62,
    off: 0,
    speed: 1,
    z: 5,
  },
  {
    tone: "bg-fernandito-verde-claro",
    ratio: 3 / 4,
    h: 0.42,
    off: -0.17,
    speed: 0.85,
    z: 2,
  },
  {
    tone: "bg-fernandito-verde-medio",
    ratio: 4 / 3,
    h: 0.5,
    off: 0.13,
    speed: 1.2,
    z: 6,
  },
  {
    tone: "bg-fernandito-verde-claro",
    ratio: 4 / 5,
    h: 0.58,
    off: -0.06,
    speed: 1,
    z: 4,
  },
  {
    tone: "bg-fernandito-verde-escuro",
    ratio: 3 / 4,
    h: 0.4,
    off: 0.15,
    speed: 0.8,
    z: 1,
  },
  {
    tone: "bg-fernandito-verde-claro",
    ratio: 4 / 3,
    h: 0.46,
    off: -0.13,
    speed: 1.15,
    z: 6,
  },
  {
    tone: "bg-fernandito-verde-medio",
    ratio: 4 / 5,
    h: 0.6,
    off: 0.04,
    speed: 1,
    z: 5,
  },
];

const RADIUS = 20;
const BG_FROM = "#243022"; // verde-escuro
const BG_TO = "#e6e6cb"; // off-white (bege) — mesma cor do Manifesto, logo abaixo
// Paradas no meio do caminho: indo direto do verde-escuro pro bege, o meio
// da mistura era um cinza-barro que não é da marca. Passando pelos verdes
// da própria paleta, a rolagem inteira fica dentro dela.
const BG_STOPS = {
  "0%": { backgroundColor: BG_FROM },
  "32%": { backgroundColor: "#405139" }, // verde-medio
  "62%": { backgroundColor: "#6c7d4f" }, // verde-claro
  "100%": { backgroundColor: BG_TO },
  easeEach: "none", // a curva é a da tween inteira (power1.inOut)
};
// px de deslocamento horizontal da trilha base por px rolado.
const SPEED = 0.9; // toque
const SPEED_DESKTOP = 1.1; // mouse
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

/** Miolo de cada card: a foto de `src/content/site.ts` (ou o placeholder).
 * O wrapper é mais largo que o card pra sobrar margem pro parallax. */
function PhotoFill({
  index,
  innerRef,
}: {
  index: number;
  innerRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={innerRef} className="absolute inset-y-0 -left-[10%] w-[120%] [will-change:transform]">
      {/* Hover "respira": a foto dá zoom por dentro e a moldura fica
          parada. Só em aparelho com mouse (o group-hover do Tailwind v4 já
          vem dentro de @media (hover: hover)). */}
      <div className="duration-slow ease-out-standard absolute inset-0 transition-transform group-hover:scale-[1.06]">
        <PhotoSlot
          image={GALERIA.photos[index]}
          sizes="(max-width: 767px) 90vw, 60vw"
          placeholderClassName={PHOTOS[index].tone}
        />
      </div>
    </div>
  );
}

export function GaleriaSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Uma camada de palco inteiro por foto: a trilha anima o card (x/y), a
  // saída depois do pin anima a camada — nós diferentes, sem conflito de
  // transform. O z-index mora na camada (ela cria o contexto de empilhamento).
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    const layers = layerRefs.current.filter(Boolean) as HTMLDivElement[];
    const inners = innerRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!section || !stage || cards.length !== PHOTOS.length || layers.length !== PHOTOS.length)
      return;

    let ctx: gsap.Context | null = null;

    const build = () => {
      ctx?.revert();
      ctx = gsap.context(() => {
        const W = stage.clientWidth;
        const H = stage.clientHeight;
        const { sizes, D } = layout(W, H);
        const n = PHOTOS.length;
        const last = n - 1;

        // Posição (canto superior esquerdo) do card i no instante t da
        // fase 2 (0 → 1): o centro dele cruza o meio da tela em t_i.
        const posX = (i: number, t: number) =>
          W / 2 + PHOTOS[i].speed * D * (i / (n - 1) - t) - sizes[i].w / 2;
        const posY = (i: number) => H / 2 - sizes[i].h / 2 + sizes[i].off;

        // A fase 2 termina assim que a última foto aparece inteira, com uma
        // folga na direita — não precisa levar ela até o meio da tela.
        const margin = Math.max(24, W * 0.06);
        const tEnd = Math.min(
          1,
          1 - (W - margin - sizes[last].w - posX(last, 1)) / (PHOTOS[last].speed * D),
        );
        // px que a trilha base anda por px rolado. Celular/toque: um pouco
        // mais devagar que o dedo, pra dar tempo de ver cada foto (a 1,5
        // ficava tudo rápido demais). Computador: a roda do mouse já é
        // suavizada pelo Lenis, e a 0,9 a galeria ficava presa ~4 telas —
        // lá volta a 1,1 de antes.
        const v = IS_TOUCH ? (W < 768 ? SPEED * 1.25 : SPEED) : SPEED_DESKTOP;
        const p2 = (D * tEnd) / v;
        // Ritmo da seção presa: pausa com a foto inteira → a foto reduz →
        // as fotos passam → pausa com a última foto inteira → solta. No
        // computador as pausas são mais curtas (com o mouse, parada longa
        // parece trava).
        const holdIn = H * (IS_TOUCH ? 0.2 : 0.12);
        const p1 = H * (IS_TOUCH ? 0.7 : 0.8);
        const holdOut = H * (IS_TOUCH ? 0.2 : 0.12);
        const a2 = holdIn + p1;

        gsap.set([stage, section], { backgroundColor: BG_FROM });
        // Foto 0 começa ocupando o palco inteiro, por cima de tudo.
        gsap.set(cards[0], { x: 0, y: 0, width: W, height: H, borderRadius: 0 });
        layers.forEach((layer, i) => gsap.set(layer, { zIndex: i === 0 ? 20 : PHOTOS[i].z }));
        cards.slice(1).forEach((card, k) => {
          const i = k + 1;
          gsap.set(card, {
            x: posX(i, 0) + W * 0.6,
            y: posY(i),
            width: sizes[i].w,
            height: sizes[i].h,
            borderRadius: RADIUS,
            opacity: 1,
          });
        });
        gsap.set(inners, { xPercent: PARALLAX });

        const tl = gsap.timeline({ defaults: { ease: "none" } });

        // Pausa: a galeria prende com a foto inteira na tela e segura um
        // pouco antes de qualquer coisa mexer.
        tl.to({}, { duration: holdIn }, 0);

        // Fase 1 — com a rolagem seguindo, a foto inteira reduz até virar
        // card; as outras entram pela direita, cada uma já na sua altura.
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
          holdIn,
        ).set(layers[0], { zIndex: PHOTOS[0].z }, a2);
        cards.slice(1).forEach((card, k) => {
          tl.to(card, { x: posX(k + 1, 0), duration: p1, ease: "power2.out" }, holdIn);
        });

        // Fase 2 — cada foto anda na sua velocidade; as da frente sobem um
        // pouco (profundidade). As de trás não descem: o palco recorta o que
        // passa da borda de baixo e a sombra delas era cortada reta ali.
        cards.forEach((card, i) => {
          const drift = Math.max(0, PHOTOS[i].speed - 1) * H * 0.12;
          tl.to(card, { x: posX(i, tEnd), y: posY(i) - drift * tEnd, duration: p2 }, a2);
        });

        tl.to(inners, { xPercent: -PARALLAX, duration: p1 + p2 }, holdIn)
          // Fundo verde-escuro → bege ao longo da trilha, emendando no
          // Manifesto (off-white) logo abaixo. A seção acompanha a cor do
          // palco (faixa que apareça embaixo no celular fica da mesma cor).
          .to(
            [stage, section],
            { keyframes: BG_STOPS, duration: p2 * 0.85, ease: "power1.inOut" },
            a2,
          )
          // Pausa final: a última foto inteira na tela, tudo parado, antes
          // de soltar.
          .to({}, { duration: holdOut }, a2 + p2);

        const pinTrigger = ScrollTrigger.create({
          trigger: stage,
          start: "top top",
          end: `+=${a2 + p2 + holdOut}`,
          pin: true,
          scrub: SCRUB.soft,
          anticipatePin: 1,
          animation: tl,
        });

        // Saída — depois da pausa, o palco sai com a página e as fotos
        // deslizam de leve pra esquerda, subindo cada uma no seu ritmo (as da
        // frente um pouco mais; as de trás nunca descem, pra sombra não ser
        // cortada na borda de baixo).
        layers.forEach((layer, i) => {
          const s = PHOTOS[i].speed;
          gsap.to(layer, {
            x: -W * 0.05 * s,
            y: -H * 0.6 * Math.max(0, s - 1),
            ease: "none",
            scrollTrigger: {
              start: () => pinTrigger.end,
              end: () => pinTrigger.end + H,
              scrub: SCRUB.soft,
            },
          });
        });
      }, stage);
    };

    build();

    // Rebuild só quando a LARGURA ÚTIL muda — no celular a barra de
    // endereço muda a altura a cada rolagem e reconstruir nisso travaria o
    // scroll. Largura útil = clientWidth, sem a barra de rolagem: durante a
    // abertura a rolagem fica travada e a barra some; quando ela volta
    // (~15px no Windows/Mac com barra fixa) a janela não muda de tamanho,
    // então o evento `resize` não dispara — e a galeria ficava 15px mais
    // larga que a página, criando rolagem horizontal. O ResizeObserver no
    // <html> pega essa mudança.
    const root = document.documentElement;
    let lastW = root.clientWidth;
    let timer: number | undefined;
    const onResize = () => {
      if (root.clientWidth === lastW) return;
      lastW = root.clientWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        build();
        ScrollTrigger.refresh();
      }, 200);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(root);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      ctx?.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="galeria"
      aria-label="Galeria"
      className="bg-fernandito-verde-escuro relative w-full"
    >
      <h2 className="sr-only">Galeria</h2>

      {/* ── Animado (some sob prefers-reduced-motion) ── */}
      <div
        ref={stageRef}
        // 100lvh (altura com as barras do navegador recolhidas), não svh:
        // no Safari do iPhone a barra recolhe durante a rolagem e a tela
        // fica mais alta que um palco em svh — sobrava uma faixa embaixo.
        className="bg-fernandito-verde-escuro relative h-lvh w-full overflow-hidden motion-reduce:hidden"
      >
        {PHOTOS.map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              layerRefs.current[i] = el;
            }}
            className="pointer-events-none absolute inset-0 [will-change:transform]"
          >
            <div
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={clsx(
                // pointer-events de volta no card (a camada não recebe) pro hover.
                "group pointer-events-auto absolute top-0 left-0 overflow-hidden shadow-[0_24px_60px_rgba(36,48,34,0.3)] [will-change:transform]",
                // Antes do JS (SSR): foto 0 já é a foto inteira; o resto fica
                // invisível até o GSAP posicionar (translate via classe
                // somaria com o transform do GSAP, por isso opacity).
                i === 0 ? "h-full w-full" : "h-[50%] w-[30%] rounded-[20px] opacity-0",
              )}
            >
              <PhotoFill
                index={i}
                innerRef={(el) => {
                  innerRefs.current[i] = el;
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── prefers-reduced-motion: grid estático, sem pin nem scroll ── */}
      <div className="hidden px-6 py-24 motion-reduce:block">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {PHOTOS.map((_, i) => (
            <div key={i} className="group relative aspect-[4/5] overflow-hidden rounded-[20px]">
              <PhotoFill index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GaleriaSection;
