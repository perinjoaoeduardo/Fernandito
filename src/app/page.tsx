import { HeroSection } from "@/components/sections/HeroSection";
import { OQueESection } from "@/components/sections/OQueESection";
import { ManifestoSection } from "@/components/sections/ManifestoSection";
import { CartaSection } from "@/components/sections/CartaSection";
import { ProdutoSection } from "@/components/sections/ProdutoSection";
import { SocialGallerySection } from "@/components/sections/SocialGallerySection";
import { FichaTecnicaSection } from "@/components/sections/FichaTecnicaSection";
import { FooterSection } from "@/components/sections/FooterSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <OQueESection />
      <ManifestoSection />
      <CartaSection />
      <ProdutoSection />
      <SocialGallerySection />
      <FichaTecnicaSection />
      <FooterSection />
    </main>
  );
}
