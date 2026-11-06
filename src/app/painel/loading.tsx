import { Shell } from "./ui";

/** Aparece na hora a cada clique (filtro, página, busca) enquanto a lista carrega. */
export default function PainelLoading() {
  const bar = "animate-pulse rounded bg-lk-soft";
  return (
    <Shell>
      <div className="lg:flex lg:min-h-full" aria-busy="true">
        <div className="bg-lk-side h-28 lg:hidden" />
        <div className="hidden lg:block lg:w-[calc(19rem+3rem)] lg:shrink-0 lg:p-6">
          <div className="bg-lk-side h-[calc(100svh-3rem)] rounded-2xl" />
        </div>
        <main className="mx-auto flex w-full max-w-[1560px] flex-1 flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-10 xl:px-10">
          <div className="flex flex-col gap-3">
            <div className={`${bar} h-4 w-56`} />
            <div className={`${bar} h-9 w-72`} />
          </div>
          <div className="border-lk-border bg-lk-paper h-[120px] animate-pulse rounded-xl border" />
          <div className="border-lk-border flex flex-col gap-3 rounded-xl border p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className={`${bar} h-4 w-48`} />
                <div className={`${bar} h-3 w-80 max-w-full`} />
              </div>
            ))}
          </div>
        </main>
      </div>
    </Shell>
  );
}
