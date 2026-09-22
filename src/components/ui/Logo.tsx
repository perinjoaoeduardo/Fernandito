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
      className={clsx("w-full max-w-[470px] sm:max-w-[750px] lg:max-w-[875px]", className)}
    />
  );
}

export default Logo;
