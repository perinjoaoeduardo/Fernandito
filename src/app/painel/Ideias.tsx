import { Trash2 } from "lucide-react";
import { CATEGORIAS, type Categoria, type Ideia } from "@/lib/ideias";
import { apagarIdeiaAction, registrarIdeia } from "./actions";
import { SubmitButton } from "./SubmitButton";
import { CARD, PageHeader, SectionTitle } from "./ui";

const FIELD =
  "border-lk-border focus:border-lk-action focus:ring-lk-action/15 h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-4";
const LABEL = "text-lk-muted mb-1 block text-xs font-medium";

const dataBR = (d: string) => d.split("-").reverse().join("/");
// Um leve torto em cada post-it (fixo pelo id, não pula a cada visita).
const giro = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 5) - 2) * 0.6;
};

/** Mural de ideias: post-its por categoria, com data. */
export function IdeiasView({
  ideias,
  hoje,
  actions,
}: {
  ideias: Ideia[];
  hoje: string;
  actions?: React.ReactNode;
}) {
  const porCategoria = (Object.keys(CATEGORIAS) as Categoria[]).map((c) => ({
    c,
    lista: ideias
      .filter((i) => i.categoria === c)
      .sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm)),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Brainstorming: vídeos, produtos, marketing e o que tem pra fazer"
        title="Ideias"
        actions={actions}
      />

      <section className={`${CARD} p-5`}>
        <SectionTitle title="Nova ideia" />
        <form action={registrarIdeia} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label>
            <span className={LABEL}>Tipo</span>
            <select name="categoria" required defaultValue="video" className={FIELD}>
              {Object.entries(CATEGORIAS).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>Data</span>
            <input name="data" type="date" required defaultValue={hoje} className={FIELD} />
          </label>
          <label className="sm:col-span-4">
            <span className={LABEL}>A ideia</span>
            <textarea
              name="texto"
              required
              rows={3}
              maxLength={1000}
              placeholder="Ex.: vídeo mostrando a gente montando as caixas"
              className={`${FIELD} h-auto py-2`}
            />
          </label>
          <div className="flex justify-end sm:col-span-4">
            <SubmitButton variant="primary" size="sm">
              Colar no mural
            </SubmitButton>
          </div>
        </form>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {porCategoria.map(({ c, lista }) => (
          <section key={c} className="flex flex-col gap-3">
            <SectionTitle title={CATEGORIAS[c].label} count={lista.length} />
            {lista.length === 0 ? (
              <p className="text-lk-muted text-sm">Nenhuma ainda.</p>
            ) : (
              <ul className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {lista.map((i) => (
                  <li
                    key={i.id}
                    style={{
                      background: CATEGORIAS[c].cor,
                      transform: `rotate(${giro(i.id)}deg)`,
                    }}
                    className="flex min-h-36 flex-col gap-2 rounded-sm p-4 text-[#2b2b2b] shadow-[0_6px_14px_rgb(0_0_0/0.12)]"
                  >
                    <p className="flex-1 text-sm leading-6 whitespace-pre-wrap">{i.texto}</p>
                    <div className="flex items-center justify-between text-xs opacity-70">
                      <span>{dataBR(i.data)}</span>
                      <form action={apagarIdeiaAction}>
                        <input type="hidden" name="id" value={i.id} />
                        <button aria-label="Apagar ideia" className="rounded p-1 hover:bg-black/10">
                          <Trash2 aria-hidden className="size-3.5" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
