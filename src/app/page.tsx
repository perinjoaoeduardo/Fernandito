import { HeroSection } from "@/components/sections/HeroSection";
import { OQueESection } from "@/components/sections/OQueESection";
import { GaleriaSection } from "@/components/sections/GaleriaSection";
import { CartaSection } from "@/components/sections/CartaSection";
import { ContatoSection } from "@/components/sections/ContatoSection";
import { SocialGallerySection } from "@/components/sections/SocialGallerySection";
import { FichaTecnicaSection } from "@/components/sections/FichaTecnicaSection";
import { FooterSection } from "@/components/sections/FooterSection";

// ManifestoSection e ProdutoSection saíram da página por enquanto (pedido
// explícito) — os componentes continuam em src/components/sections/, só
// não estão montados aqui. Ver DESIGN_SYSTEM.md.
export default function Home() {
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
