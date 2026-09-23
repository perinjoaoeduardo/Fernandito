"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "@/lib/gsap";

type TypewriterTextProps = {
  text: string;
  as?: "h2" | "h3" | "p";
  className?: string;
  /** Faixa do ScrollTrigger (relativa ao próprio texto). */
  start?: string;
  end?: string;
  /** Cursor de máquina de escrever que acompanha a última letra digitada. */
  caret?: boolean;
};

/**
 * Texto que se escreve letra a letra preso ao scroll (scrub — "desescreve"
 * se rolar pra cima). SplitText com "words,chars" pra quebra de linha só
 * acontecer entre palavras. O texto completo está no HTML do servidor
 * (SEO/leitor de tela); o split usa `aria: "none"` e o elemento mantém o
 * texto original acessível via aria-label.
 */
export function TypewriterText({
  text,
  as: Tag = "h2",
  className,
  start = "top 85%",
  end = "top 55%",
  caret = true,
}: TypewriterTextProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const el = textRef.current;
    const caretEl = caretRef.current;
    if (!wrap || !el) return;
    if (prefersReducedMotion()) return;

    let split: SplitText;
    try {
      split = new SplitText(el, { type: "words,chars", aria: "none" });
    } catch {
      return;
    }
    const chars = split.chars as HTMLElement[];
    gsap.set(chars, { opacity: 0 });
    if (caretEl) gsap.set(caretEl, { autoAlpha: 0 });

    const placeCaret = (count: number) => {
      if (!caretEl) return;
      if (count <= 0) {
        gsap.set(caretEl, { autoAlpha: 0 });
        return;
      }
      const box = wrap.getBoundingClientRect();
      const r = chars[Math.min(count, chars.length) - 1].getBoundingClientRect();
      gsap.set(caretEl, {
        autoAlpha: 1,
        x: r.right - box.left + 2,
        y: r.top - box.top,
        height: r.height,
      });
    };

    let shown = 0;
    const tl = gsap.timeline({
      onUpdate: () => {
        // A letra k acende no instante k (stagger 1, duração 0.001), então
        // as visíveis são as de índice ≤ time - 0.001.
        const count = Math.min(chars.length, Math.max(0, Math.floor(tl.time() - 0.001) + 1));
        if (count === shown) return;
        shown = count;
        placeCaret(count);
      },
    });
    tl.to(chars, { opacity: 1, duration: 0.001, stagger: 1, ease: "none" });

    const trigger = ScrollTrigger.create({ trigger: el, start, end, scrub: 0.5, animation: tl });

    return () => {
      trigger.kill();
      tl.kill();
      split.revert();
    };
  }, [start, end]);

  return (
    <div ref={wrapRef} className="relative">
      <Tag ref={textRef} className={className} aria-label={text}>
        {text}
      </Tag>
      {caret && (
        <span
          ref={caretRef}
          aria-hidden="true"
          className={clsx(
            "pointer-events-none invisible absolute top-0 left-0 w-[0.08em] min-w-[2px] bg-current opacity-0",
            "animate-[caret-blink_1s_steps(1,end)_infinite]",
          )}
        />
      )}
    </div>
  );
}

export default TypewriterText;
