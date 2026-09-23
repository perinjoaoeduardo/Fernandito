import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { IntroLoader } from "@/components/providers/IntroLoader";
import { FloatingNav } from "@/components/ui/FloatingNav";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site";
import "./globals.css";

// `preload` é o que decide o custo do primeiro carregamento: o Next injeta
// um `<link rel=preload>` por fonte pré-carregada, e elas competem com o
// LCP. Só as fontes que aparecem na PRIMEIRA dobra ficam com preload:
// Courier Prime (nav + indicador de scroll), Rampart Sans e Rampart Stamp
// (a tagline da Hero). Todo o resto carrega sob demanda quando a seção
// entra em cena — continua com `display: swap`, então nunca bloqueia texto.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

// Fonte de texto geral do site (papel do antigo `font-sans`/Inter).
const courierPrime = localFont({
  src: [
    { path: "../../public/fonts/CourierPrime-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/CourierPrime-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/CourierPrime-Italic.woff2", weight: "400", style: "italic" },
    { path: "../../public/fonts/CourierPrime-BoldItalic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-courier-prime",
  display: "swap",
});

// Acompanha a Courier Prime — usada pontualmente pra dar destaque/elemento
// diferenciado dentro do texto (não é a fonte de texto corrido).
const specialElite = localFont({
  src: [{ path: "../../public/fonts/SpecialElite-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-special-elite",
  display: "swap",
  preload: false,
});

// Família Rampart — é a fonte que deu origem ao logo. Usada pra texto
// próximo/relacionado ao logo; a família tem vários papéis dentro de si
// (ver DESIGN_SYSTEM.md), cada sub-variante como seu próprio font-family.
// `rampart`, `rampart-spurs` e `rampart-spurs-stamp` seguem declaradas como
// tokens disponíveis, mas hoje nenhum componente usa — sem preload elas não
// custam nada até alguém aplicar a classe (a SpursStamp sozinha tem 718KB).
const rampart = localFont({
  src: [{ path: "../../public/fonts/Rampart-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-rampart",
  display: "swap",
  preload: false,
});

const rampartSans = localFont({
  src: [
    { path: "../../public/fonts/Rampart-Sans.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Rampart-SansBold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-rampart-sans",
  display: "swap",
});

const rampartStamp = localFont({
  src: [{ path: "../../public/fonts/Rampart-Stamp.woff2", weight: "400", style: "normal" }],
  variable: "--font-rampart-stamp",
  display: "swap",
});

const rampartSpurs = localFont({
  src: [{ path: "../../public/fonts/Rampart-Spurs.woff2", weight: "400", style: "normal" }],
  variable: "--font-rampart-spurs",
  display: "swap",
  preload: false,
});

const rampartSpursStamp = localFont({
  src: [{ path: "../../public/fonts/Rampart-SpursStamp.woff2", weight: "400", style: "normal" }],
  variable: "--font-rampart-spurs-stamp",
  display: "swap",
  preload: false,
});

const TITLE = SITE_TITLE;
const DESCRIPTION = SITE_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s — Fernandito",
  },
  description: DESCRIPTION,
  keywords: [
    "fernet",
    "fernet com cola",
    "fernet y cola",
    "bebida pronta pra beber",
    "RTD",
    "bebida em lata",
    "Rio Grande do Sul",
    "Porto Alegre",
  ],
  applicationName: "Fernandito",
  authors: [{ name: "Fernandito" }],
  creator: "Fernandito",
  publisher: "Fernandito",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Fernandito",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Fernandito — fernet com cola em lata, 350ml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Metadados de geo não têm campo próprio na Metadata API — vão como
  // `<meta name>` cru, que é exatamente o formato que os buscadores leem.
  other: {
    "geo.region": "BR-RS",
    "geo.placename": "Porto Alegre",
    "geo.position": "-30.0346;-51.2177",
    ICBM: "-30.0346, -51.2177",
  },
};

export const viewport: Viewport = {
  themeColor: "#243022",
  colorScheme: "dark",
};

const fontVariables = [
  instrumentSerif.variable,
  courierPrime.variable,
  specialElite.variable,
  rampart.variable,
  rampartSans.variable,
  rampartStamp.variable,
  rampartSpurs.variable,
  rampartSpursStamp.variable,
].join(" ");

// Dados estruturados — só o que já é verdade no site hoje (ficha técnica e
// /legal/avisos). Sem `offers`, `price` ou `aggregateRating`: não há
// e-commerce nem avaliações, e marcar campo que não existe é o tipo de coisa
// que derruba o rich result inteiro na validação do Google.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Fernandito",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      image: `${SITE_URL}/og-image.jpg`,
      description:
        "Fernet com cola pronto pra beber, em lata de 350ml, feito no Rio Grande do Sul.",
      sameAs: ["https://www.instagram.com/toma.fernandito/"],
      address: {
        "@type": "PostalAddress",
        addressLocality: "Porto Alegre",
        addressRegion: "RS",
        addressCountry: "BR",
      },
    },
    {
      "@type": "Product",
      "@id": `${SITE_URL}/#product`,
      name: "Fernandito",
      description: "Bebida alcoólica mista gaseificada, fernet com cola, 350ml, 8% v/v",
      brand: { "@type": "Brand", name: "Fernandito" },
      image: `${SITE_URL}/og-image.jpg`,
      category: "Bebida alcoólica mista gaseificada",
      countryOfOrigin: { "@type": "Country", name: "Brasil" },
      additionalProperty: [
        { "@type": "PropertyValue", name: "Volume", value: "350 ml" },
        { "@type": "PropertyValue", name: "Teor alcoólico", value: "8% v/v" },
        { "@type": "PropertyValue", name: "Registro MAPA", value: "RS 002594-1.000127" },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Fernandito",
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${fontVariables} antialiased`}>
      <body>
        <script
          type="application/ld+json"
          // JSON gerado por nós, sem entrada de usuário — o replace de "<"
          // é a proteção padrão contra fechar a tag por acidente.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
        {/* Landing de página única: refresh sempre volta pro topo, nunca
            fica "preso" no meio (decisão explícita — o restauro nativo do
            navegador ficaria estranho aqui, já que a intro/curtain também
            roda do zero a cada carregamento). beforeInteractive roda antes
            da hidratação, então evita o flash de restaurar-e-depois-pular. */}
        <Script id="scroll-restoration" strategy="beforeInteractive">
          {`try {
            if ("scrollRestoration" in history) history.scrollRestoration = "manual";
            window.scrollTo(0, 0);
          } catch (e) {}`}
        </Script>
        <SmoothScrollProvider>
          <IntroLoader />
          <ScrollProgress />
          <CustomCursor />
          <FloatingNav />
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
