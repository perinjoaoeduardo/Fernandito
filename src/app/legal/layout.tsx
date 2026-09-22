import type { ReactNode } from "react";
import { LegalSidebar } from "@/components/ui/LegalSidebar";

// Shell compartilhado pelos documentos legais — layout de sidebar +
// conteúdo, inspirado no /legal/privacy da Lassie, adaptado pra paleta e
// tipografia do site (off-white/verde-escuro, serif nos títulos).
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-fernandito-off-white text-fernandito-verde-escuro min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 pt-32 pb-24 sm:flex-row sm:gap-16 sm:px-10 sm:pt-40">
        <LegalSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
