/**
 * Selo de "deu certo": o círculo se desenha, o ✓ risca por dentro e o selo
 * dá um pulinho, com um anel que se espalha. Só CSS (globals.css →
 * `.success-check`), então funciona em página do servidor também.
 * Respeita prefers-reduced-motion (aparece pronto).
 */
export function SuccessCheck({ className = "" }: { className?: string }) {
  return (
    <span className={`success-check relative inline-flex ${className}`} aria-hidden="true">
      <span className="success-check__ring absolute inset-0 rounded-full" />
      <svg viewBox="0 0 52 52" className="relative h-full w-full">
        <circle className="success-check__circle" cx="26" cy="26" r="24" fill="none" />
        <path className="success-check__tick" fill="none" d="M15 27.5l7 7L37.5 18" />
      </svg>
    </span>
  );
}

export default SuccessCheck;
