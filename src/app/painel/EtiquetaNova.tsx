"use client";

import { useId, useRef } from "react";
import { RotateCcw, X } from "lucide-react";
import { btn } from "./ui";
import { SubmitButton } from "./SubmitButton";

/**
 * "Etiqueta nova": abre um modal (fundo escurecido) pra confirmar a compra de
 * outra etiqueta, por outra transportadora, com a mesma nota.
 */
export function EtiquetaNova({
  action,
  id,
  back,
  nome,
  antiga,
  destaque,
}: {
  action: (form: FormData) => Promise<void>;
  id: string;
  back: string;
  nome: string;
  antiga: string;
  destaque: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        className={btn(destaque ? "primary" : "ghost", "sm")}
        onClick={() => ref.current?.showModal()}
      >
        <RotateCcw aria-hidden />
        Etiqueta nova
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="bg-lk-paper text-lk-ink m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl p-0 shadow-2xl backdrop:bg-black/50"
        onClick={(e) => {
          // Clique fora do cartão (no fundo escurecido) fecha.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <form action={action} className="space-y-4 p-5 text-left text-sm">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="back" value={back} />
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-base font-semibold">
              Etiqueta nova · {nome}
            </h2>
            <button
              type="button"
              aria-label="Fechar"
              className={btn("ghost", "sm")}
              onClick={() => ref.current?.close()}
            >
              <X aria-hidden />
            </button>
          </div>
          <p className="text-lk-ink">
            A {antiga} recusou ou devolveu o pacote? O site compra uma etiqueta nova por{" "}
            <b>outra transportadora</b> (a mais barata), com a <b>mesma nota</b> e o mesmo endereço,
            usando o saldo do Melhor Envio. O pedido volta pra <b>Imprimir</b>.
          </p>
          <p className="text-lk-muted text-xs">Leva uns 10 a 30 segundos, não fecha a página.</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="confirmo" required className="mt-1" />
            Confirmo: a etiqueta antiga já foi cancelada/estornada no Melhor Envio
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btn("secondary", "sm")}
              onClick={() => ref.current?.close()}
            >
              Cancelar
            </button>
            <SubmitButton variant="primary" size="sm" pending="Comprando etiqueta…">
              <RotateCcw aria-hidden />
              Comprar etiqueta nova
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
