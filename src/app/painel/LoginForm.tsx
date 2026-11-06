"use client";

import { useActionState } from "react";
import { entrar } from "./actions";
import { btn } from "./ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(entrar, null);
  return (
    <form action={action} className="mt-5 flex flex-col gap-3">
      <input
        type="password"
        name="senha"
        autoComplete="current-password"
        autoFocus
        required
        placeholder="Senha"
        className="border-lk-input focus:border-lk-action focus:ring-lk-action/15 h-10 rounded-lg border bg-white px-3 text-sm outline-none focus:ring-4"
      />
      <label className="text-lk-muted flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="lembrar"
          defaultChecked
          className="border-lk-input accent-lk-action h-4 w-4 rounded"
        />
        Manter conectado neste aparelho (30 dias)
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`${btn("primary")} h-10 disabled:opacity-60`}
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
      {state?.error && <p className="text-lk-fail text-sm">{state.error}</p>}
    </form>
  );
}
