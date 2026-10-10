import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { IntroLoader } from "@/components/providers/IntroLoader";
import { ThemeColorSync } from "@/components/providers/ThemeColorSync";
import { FloatingNav } from "@/components/ui/FloatingNav";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { AnnouncementBar } from "@/components/ui/AnnouncementBar";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ANNOUNCEMENT } from "@/content/site";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, GOOGLE_SITE_VERIFICATION } from "@/lib/site";
import "./globals.css";

// `preload` é o que decide o custo do primeiro carregamento: o Next injeta
// um `<link rel=preload>` por fonte pré-carregada, e elas competem com o
// LCP. Fontes que aparecem cedo na rolagem ficam com preload: Courier
// Prime (nav + indicador de scroll), Rampart Sans e Rampart Stamp (a
// tagline da Hero) e Rampart Regular — a fonte de título de todas as
// seções (a SEGUNDA seção já usa), então sem preload aparecia o fallback
// num scroll rápido. Todo o resto carrega sob demanda — continua com
// `display: swap`, então nunca bloqueia texto.

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

// Família Rampart — a fonte que deu origem ao logo. `rampart` (Regular) é a
// fonte de título do site inteiro; cada sub-variante é seu próprio
// font-family (ver DESIGN_SYSTEM.md). `rampart-spurs` e `rampart-spurs-stamp`
// seguem declaradas como tokens, sem uso hoje — sem preload não custam nada
// até alguém aplicar a classe (a SpursStamp sozinha tem 718KB).
const rampart = localFont({
  src: [{ path: "../../public/fonts/Rampart-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-rampart",
  display: "swap",
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
  // Google Search Console: só emite a meta tag se a variável estiver
  // preenchida (NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION — ver README).
  ...(GOOGLE_SITE_VERIFICATION ? { verification: { google: GOOGLE_SITE_VERIFICATION } } : {}),
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
  courierPrime.variable,
  specialElite.variable,
  rampart.variable,
  rampartSans.variable,
  rampartStamp.variable,
  rampartSpurs.variable,
  rampartSpursStamp.variable,
].join(" ");

// Dados estruturados (um único @graph). Só o que é verdade hoje — sem
// `offers`, preço, estoque ou `aggregateRating`: não há e-commerce nem
// avaliações, e marcar campo que não existe derruba o rich result.
const ORG_ID = `${SITE_URL}/#organization`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Fernandito",
      legalName: "Fernandito Bebidas Ltda",
      taxID: "69.252.946/0001-41",
      url: SITE_URL,
      logo: `${SITE_URL}/logo/fernandito-horse-illustration.png`,
      image: `${SITE_URL}/og-image.jpg`,
      address: {
        "@type": "PostalAddress",
        streetAddress: "Rua Castro Alves, 433",
        addressLocality: "Porto Alegre",
        addressRegion: "RS",
        postalCode: "90430-131",
        addressCountry: "BR",
      },
      sameAs: ["https://www.instagram.com/toma.fernandito/"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Fernandito",
      url: SITE_URL,
      inLanguage: "pt-BR",
      publisher: { "@id": ORG_ID },
    },
    {
      "@type": "Product",
      "@id": `${SITE_URL}/#product`,
      name: "Fernandito — Fernet com cola em lata 350ml",
      description:
        "Fernandito em lata: fernet com cola pronto pra beber, bebida alcoólica mista gaseificada, 8% v/v, lata de 350ml, feita no Rio Grande do Sul.",
      brand: { "@id": ORG_ID },
      image: `${SITE_URL}/og-image.jpg`,
      category: "Bebida alcoólica mista gaseificada",
      additionalProperty: [
        { "@type": "PropertyValue", name: "Volume", value: "350 ml" },
        { "@type": "PropertyValue", name: "Teor alcoólico", value: "8% v/v" },
      ],
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={[fontVariables, "antialiased", ANNOUNCEMENT.enabled && "has-announcement"]
        .filter(Boolean)
        .join(" ")}
    >
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
          <CartProvider>
            <IntroLoader />
            <ScrollProgress />
            <CustomCursor />
            <AnnouncementBar />
            <FloatingNav />
            <ThemeColorSync />
            {children}
            <CartDrawer />
          </CartProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
