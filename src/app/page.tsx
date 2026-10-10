import { HeroSection } from "@/components/sections/HeroSection";
import { OQueESection } from "@/components/sections/OQueESection";
import { GaleriaSection } from "@/components/sections/GaleriaSection";
import { CartaSection } from "@/components/sections/CartaSection";
import { ContatoSection } from "@/components/sections/ContatoSection";
import { ComprarSection } from "@/components/sections/ComprarSection";
import { SocialGallerySection } from "@/components/sections/SocialGallerySection";
import { FichaTecnicaSection } from "@/components/sections/FichaTecnicaSection";
import { FooterSection } from "@/components/sections/FooterSection";
import { PRELAUNCH, STORE } from "@/content/site";

// ManifestoSection e ProdutoSection saíram da página por enquanto (pedido
// explícito) — os componentes continuam em src/components/sections/, só
// não estão montados aqui. Ver DESIGN_SYSTEM.md.
export default function Home() {
  // Pré-lançamento (`PRELAUNCH.enabled` em src/content/site.ts): só a Hero,
  // a compra do kit (#comprar), o bloco "estamos chegando" (o Contato com
  // outro texto, com a compra como CTA principal) e o rodapé.
  if (PRELAUNCH.enabled) {
    return (
      <main>
        <HeroSection />
        <ComprarSection />
        <ContatoSection
          title={PRELAUNCH.title}
          text={PRELAUNCH.text}
          cta={PRELAUNCH.cta}
          instagram={PRELAUNCH.instagram}
          shopCta={STORE.cta}
          // Duas linhas exatas: "O Fernandito" / "está chegando." — a largura
          // em em (cabe a 2ª linha, não cabe "O Fernandito está") vale em
          // qualquer tela, e a fonte acompanha a coluna pra 2ª linha caber.
          // Entrelinha 1.15: o acento do "ESTÁ" encostava no "R" de cima.
          titleClassName="max-w-[9.6em] text-[min(9vw,5rem)] leading-[1.15] md:text-[4vw] lg:text-[min(3.8vw,4.5rem)]"
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
      <ComprarSection />
      <ContatoSection shopCta={STORE.cta} />
      <SocialGallerySection />
      <FichaTecnicaSection />
      <FooterSection />
    </main>
  );
}
