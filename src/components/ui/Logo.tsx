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
      className={clsx("w-full max-w-[360px] sm:max-w-xl lg:max-w-2xl", className)}
    />
  );
}

export default Logo;
