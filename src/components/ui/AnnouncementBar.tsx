import NextLink from "next/link";
import { ANNOUNCEMENT, PRELAUNCH, SHOP_HREF, STORE } from "@/content/site";

/**
 * Faixa fina fixa no topo, do pré-lançamento: "Estamos chegando". Fica por
 * cima de tudo (menos a intro e a cortina do teletransporte) em qualquer
 * tela, com uma sombra leve embaixo pra se destacar tanto na Hero escura
 * quanto nas seções claras. Liga/desliga em `ANNOUNCEMENT.enabled`
 * (`src/content/site.ts`): o `layout.tsx` põe a classe `has-announcement`
 * no `<html>`, que define `--announcement-h` — é isso que empurra o menu
 * flutuante pra baixo da faixa. Desligada, a variável vale 0.
 */
export function AnnouncementBar() {
  if (!ANNOUNCEMENT.enabled) return null;
  // Com a loja no ar (site completo), a faixa inteira leva pra página do kit.
  const shop = STORE.enabled && !PRELAUNCH.enabled;
  const content = (
    <>
      <span
        aria-hidden="true"
        className="bg-fernandito-verde-medio h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-pulse"
      />
      {/* A Special Elite reserva espaço de descendente embaixo — sem o
          deslocamento as maiúsculas ficam acima do centro da faixa. */}
      <p className="font-accent translate-y-[0.12em] text-[12px] tracking-[0.2em] uppercase sm:text-[13px]">
        {ANNOUNCEMENT.text}
        {shop && (
          <span aria-hidden="true" className="hidden sm:inline">
            {" "}
            →
          </span>
        )}
      </p>
    </>
  );
  const bar =
    "bg-fernandito-off-white text-fernandito-verde-escuro fixed inset-x-0 top-0 z-[55] flex h-[var(--announcement-h)] items-center justify-center gap-2.5 shadow-[0_4px_14px_rgba(36,48,34,0.28)]";

  return shop ? (
    <NextLink
      href={SHOP_HREF}
      aria-label={`${ANNOUNCEMENT.text} — ver o kit`}
      className={`${bar} hover:bg-fernandito-verde-claro hover:text-fernandito-off-white duration-base ease-out-standard transition-colors`}
    >
      {content}
    </NextLink>
  ) : (
    <aside aria-label="Aviso" className={bar}>
      {content}
    </aside>
  );
}

export default AnnouncementBar;
