import { notFound, redirect } from "next/navigation";
import { STORE } from "@/content/site";

// O kit mora dentro da home (seção #comprar) — assim quem compra vê a Hero e
// o resto do site em volta, e o menu volta pra home naturalmente. Esta rota
// fica só pra links antigos/compartilhados: manda pra home já na seção.
export default function ComprarPage() {
  // Loja desligada (`STORE.enabled` em src/content/site.ts) → 404.
  if (!STORE.enabled) notFound();
  redirect("/#comprar");
}
