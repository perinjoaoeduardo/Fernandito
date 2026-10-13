import { STORE } from "@/content/site";

/** Aviso de venda a maiores de 18 anos: pílula verde com selo "+18". */
export function AgeNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-fernandito-verde-medio text-fernandito-off-white inline-flex items-center gap-3 rounded-full py-1.5 pr-5 pl-1.5 ${className}`}
    >
      <span
        aria-hidden="true"
        className="border-fernandito-off-white/80 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-sans text-[0.8rem] leading-none font-bold"
      >
        +18
      </span>
      <p className="text-label font-sans tracking-[0.08em] uppercase">{STORE.ageNotice}</p>
    </div>
  );
}

export default AgeNotice;
