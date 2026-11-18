"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { avancarPedidos } from "./actions";

/**
 * Enquanto algum pedido ainda está sendo processado (nota saindo na Sefaz,
 * etiqueta sendo comprada), empurra esses pedidos e atualiza a tela sozinho a
 * cada poucos segundos. Para sozinho quando termina (a lista de `ids` fica
 * vazia) ou depois de ~2 minutos, pra não ficar rodando pra sempre.
 */
export function AutoAtualizar({ ids }: { ids: string[] }) {
  const router = useRouter();
  const chave = ids.join(",");
  useEffect(() => {
    if (!chave) return;
    let tentativas = 0;
    let parado = false;
    const volta = window.setInterval(async () => {
      if (parado || document.hidden) return;
      if (++tentativas > 20) {
        window.clearInterval(volta);
        return;
      }
      await avancarPedidos(chave.split(",")).catch(() => {});
      router.refresh();
    }, 6000);
    return () => {
      parado = true;
      window.clearInterval(volta);
    };
  }, [chave, router]);
  return null;
}
