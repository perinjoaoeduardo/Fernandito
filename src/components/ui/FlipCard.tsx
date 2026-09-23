"use client";

import { clsx } from "clsx";
import { useRef, useState } from "react";
import { useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { ElevatedCard } from "@/components/ui/ElevatedCard";

const FLIP_DURATION = 0.8;
const LIFT_PX = 10;
const AMBIENT_ROTATE = 5;

/** Ícone de "virar" — duas setas circulares com uma respiração contínua e
 * discreta (não reage a hover sozinho: o destaque de opacidade/label vem
 * do group-hover no cartão inteiro, ver `FlipHint`). */
function RotateIcon() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const tween = gsap.to(el, {
      rotate: AMBIENT_ROTATE,
      duration: 2,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className="h-5 w-5 origin-center [will-change:transform]"
    >
      <path d="M20 11a8 8 0 1 0-2.34 5.66" />
      <path d="M20 6v5h-5" />
    </svg>
  );
}

/** Área de toque confortável (44×44) com o ícone visualmente menor dentro —
 * opacidade e label reagem via `group-hover` do cartão inteiro (mesmo
 * padrão do Button.tsx: CSS puro, sem listener JS de hover próprio). */
function FlipHint({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      className="text-fernandito-verde-escuro absolute bottom-1 left-1 flex h-11 w-11 items-center gap-1.5 sm:bottom-2 sm:left-2"
    >
      <span className="duration-base ease-out-standard flex items-center gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
        <RotateIcon />
        <span className="text-label duration-base ease-out-standard font-sans tracking-[0.08em] uppercase opacity-0 transition-opacity group-hover:opacity-100">
          {label}
        </span>
      </span>
    </div>
  );
}

export type FlipCardProps = {
  front: ReactNode;
  back: ReactNode;
  /** Como chamar o conteúdo de cada face nos textos de acessibilidade —
   * ex.: frontLabel="o texto", backLabel="os fundadores". */
  frontLabel: string;
  backLabel: string;
  frontFlipLabel?: string;
  backFlipLabel?: string;
  paddingClassName?: string;
  cardClassName?: string;
  elevation?: "sm" | "md" | "lg";
  rotateOnHover?: boolean;
};

/**
 * Cartão com verso: clique/Enter/Espaço vira em 3D (rotateY), com um
 * pequeno "sizer" invisível em fluxo normal definindo a altura a partir da
 * frente (as duas faces reais ficam absolutas uma sobre a outra). Elevação
 * no hover é a mesma do `ElevatedCard` — fica no container externo, fora
 * do `perspective`/`preserve-3d`, pra não competir com a rotação do flip
 * na mesma propriedade `transform`.
 */
export function FlipCard({
  front,
  back,
  frontLabel,
  backLabel,
  frontFlipLabel = "Virar",
  backFlipLabel = "Voltar",
  paddingClassName = "p-6 sm:p-8 lg:p-12",
  cardClassName,
  elevation = "md",
  rotateOnHover = false,
}: FlipCardProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const isAnimatingRef = useRef(false);

  const flip = () => {
    if (isAnimatingRef.current) return;
    const flipper = flipperRef.current;
    const outer = outerRef.current;
    if (!flipper || !outer) return;

    const next = !flipped;

    if (prefersReducedMotion()) {
      setFlipped(next);
      return;
    }

    isAnimatingRef.current = true;
    const tl = gsap.timeline({
      onComplete: () => {
        isAnimatingRef.current = false;
        setFlipped(next);
      },
    });

    // Rotação do flip + elevação extra no meio do movimento (pega peso
    // físico, como se o cartão fosse levantado e virado na mão) — a
    // elevação usa valores relativos ("-=","+=") pra compor sem conflito
    // com o y que o hover do ElevatedCard já pode estar controlando.
    tl.to(flipper, { rotationY: next ? 180 : 0, duration: FLIP_DURATION, ease: "back.inOut(1.2)" }, 0);
    tl.to(outer, { y: `-=${LIFT_PX}`, duration: FLIP_DURATION / 2, ease: "power2.out" }, 0);
    tl.to(outer, { y: `+=${LIFT_PX}`, duration: FLIP_DURATION / 2, ease: "power2.in" }, FLIP_DURATION / 2);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      flip();
    }
  };

  const frontActionLabel = `Virar cartão para ver ${backLabel}`;
  const backActionLabel = `Virar cartão para ver ${frontLabel}`;

  return (
    <ElevatedCard
      ref={outerRef}
      elevation={elevation}
      rotateOnHover={rotateOnHover}
      className={clsx("group relative", cardClassName)}
      style={{ perspective: "1200px" }}
    >
      {/* Sizer invisível em fluxo normal — as duas faces reais abaixo são
          absolutas (sem altura própria), então isso reserva o espaço do
          cartão a partir do conteúdo da frente. */}
      <div aria-hidden="true" className={clsx("pointer-events-none invisible", paddingClassName)}>
        {front}
      </div>

      <div
        ref={flipperRef}
        role="button"
        tabIndex={0}
        aria-label={flipped ? backActionLabel : frontActionLabel}
        data-cursor-hover
        onClick={flip}
        onKeyDown={handleKeyDown}
        className="absolute inset-0 cursor-pointer [transform-style:preserve-3d] [will-change:transform] motion-reduce:[transform-style:flat]"
      >
        {/* Enquanto uma face está de costas ela some (backface-visibility)
            e ainda ganha pointer-events:none como reforço — evita clique
            fantasma em conteúdo interativo que essa face venha a ter no
            futuro. Sob prefers-reduced-motion a rotação 3D não acontece:
            as classes motion-reduce: trocam pra um crossfade de opacity. */}
        <div
          className={clsx(
            "absolute inset-0 [backface-visibility:hidden] motion-reduce:transition-opacity motion-reduce:duration-fast motion-reduce:ease-out-standard",
            paddingClassName,
            flipped ? "pointer-events-none motion-reduce:opacity-0" : "motion-reduce:opacity-100",
          )}
        >
          {front}
          <FlipHint label={frontFlipLabel} />
        </div>
        <div
          className={clsx(
            "absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:[transform:none] motion-reduce:transition-opacity motion-reduce:duration-fast motion-reduce:ease-out-standard",
            paddingClassName,
            flipped ? "motion-reduce:opacity-100" : "pointer-events-none motion-reduce:opacity-0",
          )}
        >
          {back}
          <FlipHint label={backFlipLabel} />
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {flipped ? `Mostrando ${backLabel}.` : `Mostrando ${frontLabel}.`}
      </span>
    </ElevatedCard>
  );
}

export default FlipCard;
