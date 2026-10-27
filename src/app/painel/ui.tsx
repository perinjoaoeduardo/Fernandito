import Link from "next/link";

// Peças do painel (ferramenta interna, visual shadcn/zinc). Regras:
// 1) uma ação principal por tela (botão preto); o resto é secundário (branco);
// 2) o que exige ação vem primeiro; o que é só consulta vem recolhido;
// 3) toda seção tem o mesmo cabeçalho; todo cartão tem a mesma borda e raio;
// 4) alvos de toque com 36px+ e foco visível.

export type Tone = "zinc" | "amber" | "green" | "red" | "blue";

const BADGE: Record<Tone, string> = {
  zinc: "border-zinc-200 bg-zinc-100 text-zinc-600",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-red-200 bg-red-50 text-red-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
};
const DOT: Record<Tone, string> = {
  zinc: "bg-zinc-400",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  blue: "bg-sky-500",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-lenis-prevent
      className="painel fixed inset-0 z-[500] overflow-y-auto bg-zinc-50 font-[system-ui,-apple-system,'Segoe_UI',Roboto,sans-serif] text-zinc-900 antialiased [color-scheme:light]"
    >
      {children}
    </div>
  );
}

export const CARD = "rounded-xl border border-zinc-200 bg-white shadow-sm";
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";
const BTN_BASE = `inline-flex items-center justify-center rounded-md text-sm font-medium whitespace-nowrap transition-colors ${FOCUS}`;

/** Botão: `primary` (a ação principal), `secondary` (as demais). */
export function btn(variant: "primary" | "secondary" = "secondary", size: "md" | "sm" = "md") {
  const h = size === "md" ? "h-9 px-4" : "h-8 px-3 text-xs";
  return `${BTN_BASE} ${h} ${
    variant === "primary"
      ? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800"
      : "border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-100"
  }`;
}

export const LINK =
  "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900";

/** Cabeçalho padrão de seção: título, uma linha de apoio e algo à direita. */
export function SectionHead({
  title,
  hint,
  aside,
}: {
  title: string;
  hint?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-sm text-zinc-500">{hint}</p>}
      </div>
      {aside && <div className="text-sm text-zinc-500">{aside}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
      {children}
    </p>
  );
}

/** Seção de consulta: vem recolhida, com o resumo na linha de cima. */
export function Fold({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className={`group ${CARD}`}>
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-4 marker:hidden hover:bg-zinc-50 ${FOCUS}`}
      >
        <span>
          <span className="block text-base font-semibold tracking-tight">{title}</span>
          <span className="block text-sm text-zinc-500">{summary}</span>
        </span>
        <span aria-hidden className="text-zinc-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-zinc-100">{children}</div>
    </details>
  );
}

/** Número que pede ação: vira link pro filtro correspondente. */
export function ActionCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: Tone;
}) {
  const on = value > 0;
  return (
    <Link
      href={href}
      className={`flex flex-col items-start justify-between gap-1 rounded-xl border p-3 shadow-sm transition-colors sm:p-4 ${FOCUS} ${
        on
          ? `${BADGE[tone]} hover:brightness-95`
          : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
      }`}
    >
      <span className="text-xs leading-tight font-medium sm:text-sm">{label}</span>
      <span
        className={`text-2xl font-semibold tracking-tight sm:text-3xl ${on ? "" : "text-zinc-400"}`}
      >
        {value}
      </span>
    </Link>
  );
}

/** Número de acompanhamento (não pede ação). */
export function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
