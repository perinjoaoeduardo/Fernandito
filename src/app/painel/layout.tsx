// Fontes do painel (as do Lakeshore): Public Sans pra tudo, Space Grotesk só
// no nome da marca, IBM Plex Mono só pra códigos (pedido, rastreio, nota).
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
