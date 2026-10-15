"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { teleportTo } from "@/lib/lenis";
import { SHOP_HREF } from "@/content/site";

/** CTA "Comprar": vai pra onde mora o kit (`SHOP_HREF`) — a página /comprar
 * no site completo, a seção #comprar da home no pré-lançamento. Já estando
 * com o kit na tela, só teletransporta até a seção. */
export function useGoToShop() {
  const router = useRouter();
  return useCallback(() => {
    if (document.getElementById("comprar")) teleportTo("#comprar");
    else router.push(SHOP_HREF, { scroll: !SHOP_HREF.includes("#") });
  }, [router]);
}
