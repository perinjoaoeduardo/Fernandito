import { CARD, Shell } from "./ui";

/** Aparece na hora a cada clique (filtro, página, busca) enquanto a lista carrega. */
export default function PainelLoading() {
  const bar = "animate-pulse rounded bg-zinc-200";
  return (
    <Shell>
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8" aria-busy="true">
        <div className="flex flex-col gap-2">
          <div className={`${bar} h-7 w-32`} />
          <div className={`${bar} h-4 w-64`} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${CARD} h-24 animate-pulse bg-zinc-100`} />
          ))}
        </div>
        <div className={`${CARD} flex flex-col gap-4 p-5`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className={`${bar} h-4 w-48`} />
              <div className={`${bar} h-3 w-80 max-w-full`} />
            </div>
          ))}
        </div>
      </main>
    </Shell>
  );
}
