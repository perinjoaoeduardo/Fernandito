import { clsx } from "clsx";

type SectionLabelProps = {
  index: string;
  children: string;
  className?: string;
};

/** Rótulo de "andar" do site (ex.: "02 — Galeria") — mesma voz em toda
 * seção, pra quem rola saber onde está. Special Elite = fonte de destaque. */
export function SectionLabel({ index, children, className }: SectionLabelProps) {
  return (
    <p
      className={clsx(
        "text-label font-accent flex items-center gap-3 tracking-[0.12em] uppercase",
        className,
      )}
    >
      <span className="opacity-60">{index}</span>
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-40" />
      <span>{children}</span>
    </p>
  );
}

export default SectionLabel;
