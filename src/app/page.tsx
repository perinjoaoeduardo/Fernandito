import { HeroSection } from "@/components/sections/HeroSection";
import { ManifestoSection } from "@/components/sections/ManifestoSection";
import { CartaSection } from "@/components/sections/CartaSection";
import { ProdutoSection } from "@/components/sections/ProdutoSection";
import { FichaTecnicaSection } from "@/components/sections/FichaTecnicaSection";
import { VideoSection } from "@/components/sections/VideoSection";
import { CTASection } from "@/components/sections/CTASection";
import { FooterSection } from "@/components/sections/FooterSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <ManifestoSection />
      <CartaSection />
      <ProdutoSection />
      <FichaTecnicaSection />
      <VideoSection />
      <CTASection />
      <FooterSection />
    </main>
  );
}
