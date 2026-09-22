"use client";

import { clsx } from "clsx";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { gsap, EASE, prefersReducedMotion, supportsHover } from "@/lib/gsap";

type Elevation = "sm" | "md" | "lg";

// `md` reproduz exatamente os valores originais da CartaSection (-8px,
// sombra 0 20px 40px/0.18) — as outras duas escalam a partir dali.
const ELEVATION_CONFIG: Record<Elevation, { y: number; shadowHover: string }> = {
  sm: { y: -6, shadowHover: "0 12px 24px rgba(36,48,34,0.14)" },
  md: { y: -8, shadowHover: "0 20px 40px rgba(36,48,34,0.18)" },
  lg: { y: -12, shadowHover: "0 28px 56px rgba(36,48,34,0.22)" },
};

const SHADOW_REST = "0 4px 12px rgba(36,48,34,0.08)";
const ROTATE_HOVER = -1.5;

type ElevatedCardProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  elevation?: Elevation;
  rotateOnHover?: boolean;
  className?: string;
};

/**
 * Card com elevação física no hover (sobe + sombra cresce), extraído da
 * CartaSection. `data-cursor-hover` já vem embutido — é um alvo de hover
 * forte mesmo sendo uma div sem role semântico de clique.
 */
export const ElevatedCard = forwardRef<HTMLDivElement, ElevatedCardProps>(function ElevatedCard(
  { children, elevation = "sm", rotateOnHover = false, className, style, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => innerRef.current as HTMLDivElement);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (prefersReducedMotion() || !supportsHover()) return;

    const { y, shadowHover } = ELEVATION_CONFIG[elevation];

    const handleEnter = () => {
      gsap.to(el, {
        y,
        rotate: rotateOnHover ? ROTATE_HOVER : 0,
        boxShadow: shadowHover,
        duration: 0.5,
        ease: EASE.outStandard,
      });
    };
    const handleLeave = () => {
      gsap.to(el, {
        y: 0,
        rotate: 0,
        boxShadow: SHADOW_REST,
        duration: 0.5,
        ease: EASE.outStandard,
      });
    };

    el.addEventListener("mouseenter", handleEnter);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mouseenter", handleEnter);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [elevation, rotateOnHover]);

  return (
    <div
      ref={innerRef}
      data-cursor-hover
      style={{ boxShadow: SHADOW_REST, ...style }}
      className={clsx("[will-change:transform,box-shadow]", className)}
      {...rest}
    >
      {children}
    </div>
  );
});

export default ElevatedCard;
