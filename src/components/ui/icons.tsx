// Ícones inline minimalistas, compartilhados entre componentes (evita
// duplicar o mesmo SVG no Footer e na SocialGallerySection).

export function InstagramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

type IconProps = { className?: string };

const strokeProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Sacola de compras (carrinho). */
export function CartIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function CloseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export default InstagramIcon;

/** Lata de bebida. */
export function CanIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M7 6c0-1.1 2.2-2 5-2s5 .9 5 2v12c0 1.1-2.2 2-5 2s-5-.9-5-2V6Z" />
      <path d="M7 6c0 1.1 2.2 2 5 2s5-.9 5-2" />
      <path d="M7 16c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </svg>
  );
}

/** Copo. */
export function CupIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M6 4h12l-1.4 15.1a2 2 0 0 1-2 1.9H9.4a2 2 0 0 1-2-1.9L6 4Z" />
      <path d="M6.6 10h10.8" />
    </svg>
  );
}

/** Adesivo (folha com a ponta dobrada). */
export function StickerIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M5 5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v8l-6 7H6a1 1 0 0 1-1-1V5Z" />
      <path d="M19 13h-5a1 1 0 0 0-1 1v6" />
    </svg>
  );
}
