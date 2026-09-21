import { HeroSection } from "@/components/sections/HeroSection";
import { ManifestoSection } from "@/components/sections/ManifestoSection";
import { ProdutoSection } from "@/components/sections/ProdutoSection";
import { FichaTecnicaSection } from "@/components/sections/FichaTecnicaSection";
import { VideoSection } from "@/components/sections/VideoSection";
import { CTASection } from "@/components/sections/CTASection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <ManifestoSection />
      <ProdutoSection />
      <FichaTecnicaSection />
      <VideoSection />
      <CTASection />
    </main>
  );
}
