"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { teleportTo } from "@/lib/lenis";

/** CTA "Comprar": na home vai pra seção #comprar (teletransporte, igual aos
 * links do menu); em qualquer outra página, abre /comprar. */
export function useGoToShop() {
  const pathname = usePathname();
  const router = useRouter();
  return useCallback(() => {
    if (pathname === "/" && document.getElementById("comprar")) teleportTo("#comprar");
    else router.push("/comprar");
  }, [pathname, router]);
}
