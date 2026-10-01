import { HeroSection } from "@/components/sections/HeroSection";
import { OQueESection } from "@/components/sections/OQueESection";
import { GaleriaSection } from "@/components/sections/GaleriaSection";
import { CartaSection } from "@/components/sections/CartaSection";
import { ContatoSection } from "@/components/sections/ContatoSection";
import { SocialGallerySection } from "@/components/sections/SocialGallerySection";
import { FichaTecnicaSection } from "@/components/sections/FichaTecnicaSection";
import { FooterSection } from "@/components/sections/FooterSection";
import { PRELAUNCH } from "@/content/site";

// ManifestoSection e ProdutoSection saíram da página por enquanto (pedido
// explícito) — os componentes continuam em src/components/sections/, só
// não estão montados aqui. Ver DESIGN_SYSTEM.md.
export default function Home() {
  // Pré-lançamento (`PRELAUNCH.enabled` em src/content/site.ts): só a Hero,
  // o bloco "estamos chegando" (o Contato com outro texto) e o rodapé.
  if (PRELAUNCH.enabled) {
    return (
      <main>
        <HeroSection />
        <ContatoSection
          title={PRELAUNCH.title}
          text={PRELAUNCH.text}
          cta={PRELAUNCH.cta}
          instagram={PRELAUNCH.instagram}
        />
        <FooterSection />
      </main>
    );
  }

  return (
    <main>
      <HeroSection />
      <OQueESection />
      <GaleriaSection />
      <CartaSection />
      <ContatoSection />
      <SocialGallerySection />
      <FichaTecnicaSection />
      <FooterSection />
    </main>
  );
}
