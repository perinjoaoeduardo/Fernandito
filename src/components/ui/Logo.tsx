import { clsx } from "clsx";

type LogoProps = {
  className?: string;
};

/**
 * Lockup completo da marca — `/public/logo/fernandito-logo-text.svg`.
 */
export function Logo({ className }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático, next/image não traz benefício aqui
    <img
      src="/logo/fernandito-logo-text.svg"
      alt="Fernandito"
      className={clsx("w-full max-w-[280px] sm:max-w-md", className)}
    />
  );
}

export default Logo;
