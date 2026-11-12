"use client";

import { useId, useRef, useState } from "react";
import { LoaderCircle, RotateCcw, X } from "lucide-react";
import { btn } from "./ui";
import { SubmitButton } from "./SubmitButton";

type Opcao = {
  id: string;
  carrier: string;
  service: string;
  priceCents: number;
  days: { min: number; max: number };
  falhou: boolean;
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * "Etiqueta nova": abre um modal (fundo escurecido) com a cotação das
 * transportadoras que o site libera. Você escolhe uma e confirma; a etiqueta
 * antiga já tem que estar cancelada. A mesma nota e o mesmo endereço seguem.
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
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState("");

  const abrir = () => {
    ref.current?.showModal();
    setOpcoes(null);
    setErro(null);
    setEscolhida("");
    fetch(`/painel/cotacao?pedido=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as {
          options?: Opcao[];
          erro?: string;
        } | null;
        if (!r.ok || !data?.options) throw new Error(data?.erro ?? `Erro ${r.status}`);
        setOpcoes(data.options);
        // Já deixa marcada a mais barata que ainda não falhou neste pedido.
        const livre = data.options.find((o) => !o.falhou) ?? data.options[0];
        setEscolhida(livre?.id ?? "");
      })
      .catch((e: Error) => setErro(e.message));
  };

  return (
    <>
      <button type="button" className={btn(destaque ? "primary" : "ghost", "sm")} onClick={abrir}>
        <RotateCcw aria-hidden />
        Etiqueta nova
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="bg-lk-paper text-lk-ink m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 shadow-2xl backdrop:bg-black/50"
        onClick={(e) => {
          // Clique fora do cartão (no fundo escurecido) fecha.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <form action={action} className="space-y-4 p-5 text-left text-sm">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="servico" value={escolhida} />
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
            A etiqueta da {antiga} foi cancelada? Escolhe a transportadora da nova. Vai com a{" "}
            <b>mesma nota</b> e o mesmo endereço, usando o saldo do Melhor Envio. O pedido volta pra{" "}
            <b>Imprimir</b>.
          </p>

          {opcoes === null && !erro && (
            <p className="text-lk-muted flex items-center gap-2" role="status">
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              Cotando o frete…
            </p>
          )}
          {erro && (
            <p className="text-lk-fail text-xs" role="alert">
              Não deu pra cotar agora: {erro}
            </p>
          )}
          {opcoes && (
            <fieldset className="space-y-2">
              <legend className="sr-only">Transportadora</legend>
              {opcoes.map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    escolhida === o.id ? "border-lk-action bg-lk-soft/60" : "border-lk-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="opcao"
                    value={o.id}
                    checked={escolhida === o.id}
                    onChange={() => setEscolhida(o.id)}
                    required
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {o.carrier} {o.service}
                      </span>
                      <span className="font-semibold tabular-nums">{brl(o.priceCents)}</span>
                    </span>
                    <span className="text-lk-muted block text-xs">
                      {o.days.min}–{o.days.max} dias úteis
                    </span>
                    {o.falhou && (
                      <span className="text-lk-fail block text-xs">
                        já deu problema neste pedido
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

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
