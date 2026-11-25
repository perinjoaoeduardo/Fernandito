import Link from "next/link";
import { Beer, Download, Gift, HandCoins, PackageOpen, Trash2 } from "lucide-react";
import {
  PESSOAS,
  TIPOS_CAIXA,
  efeitos,
  resumoCaixas,
  type Pessoa,
  type RegistroCaixa,
} from "@/lib/caixas";
import { apagarRegistroCaixa, registrarCaixas } from "./actions";
import { SubmitButton } from "./SubmitButton";
import {
  Badge,
  CARD,
  Empty,
  KpiStrip,
  LINK,
  PageHeader,
  SectionTitle,
  TABLE_WRAP,
  TD,
  TH,
  Tile,
  btn,
  type Tone,
} from "./ui";

const FIELD =
  "border-lk-border focus:border-lk-action focus:ring-lk-action/15 h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-4";
const LABEL = "text-lk-muted mb-1 block text-xs font-medium";

const TOM: Record<keyof typeof TIPOS_CAIXA, Tone> = {
  pegou: "action",
  vendeu: "pass",
  brinde: "review",
  consumo: "hold",
  passou: "running",
  devolveu: "muted",
  ajuste: "hold",
};

const dataBR = (d: string) => d.split("-").reverse().join("/");
const caixas = (n: number) => `${n} ${Math.abs(n) === 1 ? "caixa" : "caixas"}`;

/**
 * Caixas da equipe: o saldo de cada pessoa e o histórico do que pegou,
 * entregou, deu de brinde ou passou adiante. Lançamento manual (a mensagem do
 * WhatsApp colada no campo de texto).
 */
export function CaixasView({
  registros,
  pessoa,
  hoje,
  actions,
}: {
  registros: RegistroCaixa[];
  pessoa: Pessoa | null;
  hoje: string;
  actions: React.ReactNode;
}) {
  const resumo = resumoCaixas(registros);
  const comEquipe = resumo.reduce((n, r) => n + r.saldo, 0);
  const vendidas = resumo.reduce((n, r) => n + r.vendeu, 0);
  const brindes = resumo.reduce((n, r) => n + r.brinde, 0);
  const consumo = resumo.reduce((n, r) => n + r.consumo, 0);
  const pegas = resumo.reduce((n, r) => n + r.pegou, 0);
  const lista = [...registros]
    .filter((r) => !pessoa || r.pessoa === pessoa || r.para === pessoa)
    .sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm));
  const back = pessoa ? `/painel?aba=caixas&p=${encodeURIComponent(pessoa)}` : "/painel?aba=caixas";

  return (
    <>
      <PageHeader
        eyebrow="Quem está com quantas caixas e pra onde elas foram"
        title="Caixas da equipe"
        actions={
          <>
            <a className={btn("secondary", "sm")} href="/painel/caixas" download>
              <Download aria-hidden />
              Baixar histórico
            </a>
            {actions}
          </>
        }
      />

      <KpiStrip cols={4}>
        <Tile
          icon={PackageOpen}
          label="Com a equipe agora"
          value={comEquipe}
          note={`de ${pegas} pegas no total`}
        />
        <Tile
          icon={HandCoins}
          label="Entregues pra venda"
          value={vendidas}
          note="caixas"
          tone="pass"
        />
        <Tile icon={Gift} label="Brindes" value={brindes} note="caixas" tone="review" />
        <Tile icon={Beer} label="Consumo próprio" value={consumo} note="caixas" tone="hold" />
      </KpiStrip>

      {/* Uma ficha por pessoa: saldo grande + o resumo. Clicar filtra o histórico. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {resumo.map((r) => {
          const ativo = pessoa === r.pessoa;
          return (
            <Link
              key={r.pessoa}
              href={
                ativo
                  ? "/painel?aba=caixas"
                  : `/painel?aba=caixas&p=${encodeURIComponent(r.pessoa)}`
              }
              aria-current={ativo ? "true" : undefined}
              className={`${CARD} flex flex-col gap-1 p-4 transition-colors ${
                ativo ? "border-lk-action ring-lk-action/20 ring-4" : "hover:bg-[#f8f9fa]"
              }`}
            >
              <span className="text-sm font-semibold">{r.pessoa}</span>
              <span
                className={`text-[28px] leading-9 font-semibold tabular-nums ${
                  r.saldo < 0 ? "text-lk-fail" : r.saldo === 0 ? "text-lk-muted" : "text-lk-action"
                }`}
              >
                {r.saldo}
              </span>
              <span className="text-lk-muted text-xs">
                {r.saldo === 1 ? "caixa" : "caixas"} agora
              </span>
              <span className="text-lk-ink3 mt-1 text-xs leading-5">
                pegou {r.pegou}
                {r.recebeu ? ` · recebeu ${r.recebeu}` : ""}
                <br />
                venda {r.vendeu} · brinde {r.brinde}
                {r.consumo ? ` · consumo ${r.consumo}` : ""}
                {r.passou ? ` · passou ${r.passou}` : ""}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Lançar: quem, o quê, quantas, pra onde e a mensagem colada. */}
      <section className={`${CARD} p-5`}>
        <SectionTitle title="Registrar movimento" />
        <form action={registrarCaixas} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="back" value={back} />
          <label className="lg:col-span-1">
            <span className={LABEL}>Quem</span>
            <select name="pessoa" required defaultValue={pessoa ?? ""} className={FIELD}>
              <option value="" disabled>
                Escolher…
              </option>
              {PESSOAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="lg:col-span-2">
            <span className={LABEL}>O que aconteceu</span>
            <select name="tipo" required defaultValue="pegou" className={FIELD}>
              {Object.entries(TIPOS_CAIXA).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>Quantas caixas</span>
            <input
              name="qtd"
              type="number"
              required
              step={1}
              min={-1000}
              max={1000}
              inputMode="numeric"
              placeholder="Ex.: 2"
              className={FIELD}
            />
          </label>
          <label>
            <span className={LABEL}>Data</span>
            <input name="data" type="date" required defaultValue={hoje} className={FIELD} />
          </label>
          <label>
            <span className={LABEL}>Passou pra (se passou)</span>
            <select name="para" defaultValue="" className={FIELD}>
              <option value="">—</option>
              {PESSOAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2 lg:col-span-6">
            <span className={LABEL}>Pra quem / pra onde (cliente, bar, evento…)</span>
            <input
              name="destino"
              maxLength={120}
              placeholder="Ex.: Bar do Zé, aniversário da Ana, Duas Rodas"
              className={FIELD}
            />
          </label>
          <label className="sm:col-span-2 lg:col-span-6">
            <span className={LABEL}>Mensagem / detalhes (pode colar o WhatsApp)</span>
            <textarea
              name="nota"
              rows={3}
              maxLength={2000}
              placeholder="Ex.: “João, peguei 10 caixas, 4 foram pro Bar do Zé e 2 de brinde pro evento”"
              className={`${FIELD} h-auto py-2`}
            />
          </label>
          <p className="text-lk-muted text-xs sm:col-span-2 lg:col-span-4">
            No ajuste, use número negativo se a contagem deu menos do que o saldo.
          </p>
          <div className="flex justify-end sm:col-span-2 lg:col-span-2">
            <SubmitButton variant="primary" size="sm">
              Registrar
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          title={pessoa ? `Histórico de ${pessoa}` : "Histórico"}
          count={lista.length}
          aside={
            pessoa ? (
              <Link className={LINK} href="/painel?aba=caixas">
                Ver de todos
              </Link>
            ) : null
          }
        />
        {lista.length === 0 ? (
          <Empty>Nada registrado ainda.</Empty>
        ) : (
          <div className={TABLE_WRAP}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={TH}>Data</th>
                  <th className={TH}>Quem</th>
                  <th className={TH}>O que</th>
                  <th className={`${TH} text-right`}>Caixas</th>
                  <th className={TH}>Pra quem / detalhes</th>
                  <th className={TH}>
                    <span className="sr-only">Apagar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const meu = efeitos(r).find((e) => e.pessoa === (pessoa ?? r.pessoa));
                  const delta = meu?.delta ?? 0;
                  return (
                    <tr key={r.id} className="border-lk-border border-t">
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>{dataBR(r.data)}</td>
                      <td className={`${TD} font-medium whitespace-nowrap`}>
                        {r.pessoa}
                        {r.para ? (
                          <span className="text-lk-muted font-normal"> → {r.para}</span>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className={TD}>
                        <Badge tone={TOM[r.tipo]}>{TIPOS_CAIXA[r.tipo].label}</Badge>
                      </td>
                      <td
                        className={`${TD} text-right font-semibold whitespace-nowrap tabular-nums ${
                          delta < 0 ? "text-lk-fail" : "text-lk-action"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {caixas(delta)}
                      </td>
                      <td className={`${TD} max-w-[28rem]`}>
                        {r.destino && <p className="font-medium">{r.destino}</p>}
                        {r.nota && (
                          <p className="text-lk-ink3 text-xs leading-5 whitespace-pre-line">
                            {r.nota}
                          </p>
                        )}
                      </td>
                      <td className={`${TD} text-right`}>
                        <form action={apagarRegistroCaixa}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="back" value={back} />
                          <SubmitButton variant="ghost" size="sm" pending="…">
                            <Trash2 aria-hidden />
                            <span className="sr-only">Apagar este registro</span>
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
