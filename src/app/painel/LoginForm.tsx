"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(entrar, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <input
        type="password"
        name="senha"
        autoComplete="current-password"
        autoFocus
        required
        placeholder="Senha"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none focus:border-neutral-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
