import { clsx } from "clsx";
import { useId } from "react";

/**
 * Selo redondo de carimbo: texto correndo em volta (girando devagar) e o
 * cavalo no meio. Usado sobre a foto do kit. O giro some sob
 * prefers-reduced-motion (ver `.kit-seal-ring` em globals.css).
 */
export function KitSeal({ text, className }: { text: string; className?: string }) {
  // Uma volta: "PRÉ-LANÇAMENTO ✦ EDIÇÃO LIMITADA ✦" (o textLength espalha
  // as letras pra fechar o círculo certinho).
  const ring = `${text.replace(" · ", " ✦ ")} ✦ `;
  // id único: o selo aparece mais de uma vez na página (kit e portão).
  const pathId = `seal-path-${useId().replace(/:/g, "")}`;
  return (
    <div
      role="img"
      aria-label={text}
      className={clsx(
        "bg-fernandito-verde-escuro text-fernandito-off-white relative rounded-full shadow-[0_14px_34px_rgba(20,28,18,0.45)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 200 200"
        className="kit-seal-ring absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <path id={pathId} d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" />
        </defs>
        <text
          className="font-accent fill-current uppercase"
          style={{ fontSize: 15.5, letterSpacing: "0.16em" }}
        >
          <textPath href={`#${pathId}`} textLength={474} lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
      </svg>
      {/* Aros do carimbo. */}
      <span
        aria-hidden="true"
        className="border-fernandito-off-white/30 absolute inset-[5%] rounded-full border"
      />
      <span
        aria-hidden="true"
        className="border-fernandito-off-white/40 absolute inset-[24%] rounded-full border border-dashed"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- raster estático de tamanho fixo */}
      <img
        src="/logo/fernandito-horse.webp"
        alt=""
        width={128}
        height={129}
        className="absolute inset-[28%] h-[44%] w-[44%] rounded-full"
      />
    </div>
  );
}

export default KitSeal;
