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
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
      />
      <button
        type="submit"
        disabled={pending}
        className={`${btn("primary")} h-10 disabled:opacity-60`}
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
