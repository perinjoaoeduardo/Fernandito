"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ANNOUNCEMENT, SHOP_HREF } from "@/content/site";
import { useModo } from "@/components/providers/ModoProvider";
import { useStock } from "@/components/cart/useStock";

/**
 * Faixa fina fixa no topo, do pré-lançamento: "Estamos chegando". Só na
 * home e só nos primeiros 10 segundos: depois sobe e some (até recarregar
 * a página). Fica por cima de tudo (menos a intro e a cortina do
 * teletransporte), com uma sombra leve embaixo pra se destacar tanto na Hero escura
 * quanto nas seções claras. Liga/desliga em `ANNOUNCEMENT.enabled`
 * (`src/content/site.ts`): o `layout.tsx` põe a classe `has-announcement`
 * no `<html>`, que define `--announcement-h` — é isso que empurra o menu
 * flutuante pra baixo da faixa. Desligada, a variável vale 0. Quem liga a
 * classe no 1º carregamento é o script do `layout.tsx` (sem pulo na tela);
 * daqui ela é tirada quando a faixa sai.
 */
const VISIBLE_MS = 10_000;
// Já saiu nesta visita: não volta ao navegar pela home de novo.
let dismissed = false;
export function AnnouncementBar() {
  // Com a loja no ar (site completo), a faixa inteira leva pra página do kit;
  // esgotado, ela avisa (e continua levando pro kit, que mostra "Esgotado").
  const modo = useModo();
  const shop = modo.store && !modo.prelaunch;
  const { soldOut } = useStock();
  const pathname = usePathname();
  const [gone, setGone] = useState(dismissed);

  useEffect(() => {
    if (!ANNOUNCEMENT.enabled) return;
    const html = document.documentElement;
    if (pathname !== "/" || dismissed) {
      dismissed = true;
      html.classList.remove("has-announcement");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- saiu da home
      setGone(true);
      return;
    }
    html.classList.add("has-announcement");
    let unmount = 0;
    const hide = window.setTimeout(() => {
      dismissed = true;
      html.classList.remove("has-announcement");
      // A faixa sobe junto com a variável (0,6 s); depois sai do DOM.
      unmount = window.setTimeout(() => setGone(true), 700);
    }, VISIBLE_MS);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(unmount);
    };
  }, [pathname]);

  if (!ANNOUNCEMENT.enabled || gone || pathname !== "/") return null;
  const text = modo.publico
    ? ANNOUNCEMENT.publicText
    : shop && soldOut
      ? ANNOUNCEMENT.soldOutText
      : ANNOUNCEMENT.text;
  const content = (
    <>
      <span
        aria-hidden="true"
        className="bg-fernandito-verde-medio h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-pulse"
      />
      {/* A Special Elite reserva espaço de descendente embaixo — sem o
          deslocamento as maiúsculas ficam acima do centro da faixa. */}
      <p className="font-accent translate-y-[0.12em] text-[12px] tracking-[0.2em] uppercase sm:text-[13px]">
        {text}
        {shop && !soldOut && (
          <span aria-hidden="true" className="hidden sm:inline">
            {" "}
            →
          </span>
        )}
      </p>
    </>
  );
  const bar =
    "bg-fernandito-off-white text-fernandito-verde-escuro fixed inset-x-0 top-0 z-[55] flex h-8 translate-y-[calc(var(--announcement-h)-2rem)] items-center justify-center gap-2.5 shadow-[0_4px_14px_rgba(36,48,34,0.28)]";

  return shop ? (
    <NextLink
      href={SHOP_HREF}
      aria-label={`${text} — ver o kit`}
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
