"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { gsap, EASE, prefersReducedMotion, supportsHover } from "@/lib/gsap";

type Variant = "primary" | "secondary" | "ghost" | "cta-destaque";

// Compartilhado por todos: radius-full, padding generoso, fonte sans,
// letter-spacing sutil ("label style"), transition base — ver
// DESIGN_SYSTEM.md "## Interação".
const baseClasses =
  "group relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-sans text-body font-medium tracking-[0.01em] transition-[background-color,color,box-shadow,transform] duration-base ease-out-standard";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-fernandito-verde-medio text-fernandito-off-white hover:bg-fernandito-verde-escuro active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fernandito-verde-medio",
  // Preenchimento do centro pra fora + swap de cor do texto são feitos por
  // dois spans internos (ver `renderContent`), não só por className.
  secondary:
    "overflow-hidden border-[1.5px] border-fernandito-verde-escuro bg-transparent text-fernandito-verde-escuro active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fernandito-verde-medio",
  // Sublinhado igual ao Link `underline-grow` (crescer da esquerda, retrair
  // pra direita via troca de transform-origin) — texto sem borda/fundo.
  ghost:
    "w-fit bg-transparent text-fernandito-verde-escuro after:absolute after:bottom-2 after:left-0 after:h-px after:w-[calc(100%-3rem)] after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-base after:ease-out-standard hover:text-fernandito-verde-medio hover:after:origin-left hover:after:scale-x-100 focus-visible:text-fernandito-verde-medio focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fernandito-verde-medio focus-visible:after:origin-left focus-visible:after:scale-x-100 active:opacity-70",
  "cta-destaque":
    "bg-fernandito-verde-escuro text-fernandito-off-white hover:bg-fernandito-verde-medio hover:shadow-[0_0_20px_rgba(64,81,57,0.3)] active:scale-[0.96] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-fernandito-verde-medio",
};

// Magnetic hover só existe no cta-destaque (o CTA de maior hierarquia).
const MAGNET_RADIUS = 80;
const MAGNET_MAX_PULL = 8;

function IconSlide({ icon }: { icon: ReactNode }) {
  return (
    <span className="bg-fernandito-off-white text-fernandito-verde-medio relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
      <span
        aria-hidden="true"
        className="duration-base ease-out-standard absolute inset-0 flex items-center justify-center transition-transform group-hover:translate-x-full"
      >
        {icon}
      </span>
      <span
        aria-hidden="true"
        className="duration-base ease-out-standard absolute inset-0 flex -translate-x-full items-center justify-center transition-transform group-hover:translate-x-0"
      >
        {icon}
      </span>
    </span>
  );
}

type SharedProps = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  /** Ícone estático (ex: WhatsApp) ou, com `animatedIcon`, o par
   * duplicado que desliza no hover (ver Parte 2 do prompt de interação). */
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  animatedIcon?: boolean;
};

type ButtonAsButton = ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: "button";
  href?: undefined;
};

type ButtonAsAnchor = AnchorHTMLAttributes<HTMLAnchorElement> & {
  as: "a";
  href: string;
};

type ButtonProps = (ButtonAsButton | ButtonAsAnchor) & SharedProps;

export function Button({
  variant = "primary",
  children,
  className,
  icon,
  iconPosition = "right",
  animatedIcon = false,
  ...props
}: ButtonProps) {
  const magneticRef = useRef<HTMLElement | null>(null);

  // Magnetic hover (cta-destaque only): quando o mouse chega a até 80px do
  // botão, ele "puxa" até 8px na direção do cursor. Desktop + motion only.
  useEffect(() => {
    if (variant !== "cta-destaque") return;
    if (props["aria-disabled"] === "true" || props["aria-disabled"] === true) return;
    if (prefersReducedMotion() || !supportsHover()) return;

    const el = magneticRef.current;
    if (!el) return;

    const moveX = gsap.quickTo(el, "x", { duration: 0.3, ease: EASE.outStandard });
    const moveY = gsap.quickTo(el, "y", { duration: 0.3, ease: EASE.outStandard });

    const handleMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < MAGNET_RADIUS) {
        const pull = (1 - dist / MAGNET_RADIUS) * MAGNET_MAX_PULL;
        const angle = Math.atan2(dy, dx);
        moveX(Math.cos(angle) * pull);
        moveY(Math.sin(angle) * pull);
      } else {
        moveX(0);
        moveY(0);
      }
    };

    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      gsap.set(el, { x: 0, y: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aria-disabled read once at effect setup on purpose, not a reactive dep
  }, [variant]);

  const classes = clsx(baseClasses, variantClasses[variant], className);

  const iconNode = icon ? (
    animatedIcon ? (
      <IconSlide icon={icon} />
    ) : (
      <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
    )
  ) : null;

  const innerContent = (
    <>
      {icon && iconPosition === "left" && iconNode}
      {children}
      {icon && iconPosition === "right" && iconNode}
    </>
  );

  // Secondary precisa de dois spans extras: o preenchimento que cresce do
  // centro (::before "manual", já que Tailwind puro não anima pseudo +
  // troca de cor do texto junto sem um layer próprio) e o texto por cima.
  const content =
    variant === "secondary" ? (
      <>
        <span
          aria-hidden="true"
          className="bg-fernandito-verde-escuro duration-base ease-out-standard pointer-events-none absolute inset-0 origin-center scale-x-0 transition-transform group-hover:scale-x-100"
        />
        <span className="duration-base ease-out-standard group-hover:text-fernandito-off-white relative z-10 flex items-center gap-2 transition-colors">
          {innerContent}
        </span>
      </>
    ) : (
      innerContent
    );

  const setRef = (el: HTMLButtonElement | HTMLAnchorElement | null) => {
    magneticRef.current = el;
  };

  if (props.as === "a") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip custom `as` before spreading onto the DOM node
    const { as: _as, ...anchorProps } = props;
    return (
      <a ref={setRef} className={classes} {...anchorProps}>
        {content}
      </a>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip custom `as` before spreading onto the DOM node
  const { as: _as, ...buttonProps } = props;
  return (
    <button ref={setRef} className={classes} {...buttonProps}>
      {content}
    </button>
  );
}

export default Button;
