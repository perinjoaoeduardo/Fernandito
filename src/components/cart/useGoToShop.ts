"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { teleportTo } from "@/lib/lenis";

/** CTA "Comprar": na home vai pra seção #comprar (teletransporte, igual aos
 * links do menu); em qualquer outra página, volta pra home já na seção
 * (`HashScroll` faz o pulo). O kit não tem página solta. */
export function useGoToShop() {
  const pathname = usePathname();
  const router = useRouter();
  return useCallback(() => {
    if (pathname === "/" && document.getElementById("comprar")) teleportTo("#comprar");
    else router.push("/#comprar", { scroll: false });
  }, [pathname, router]);
}
