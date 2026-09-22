import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { IntroLoader } from "@/components/providers/IntroLoader";
import { FloatingNav } from "@/components/ui/FloatingNav";
import { CustomCursor } from "@/components/ui/CustomCursor";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

// Fonte de texto geral do site (papel do antigo `font-sans`/Inter).
const courierPrime = localFont({
  src: [
    { path: "../../public/fonts/CourierPrime-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/CourierPrime-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/CourierPrime-Italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/CourierPrime-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-courier-prime",
  display: "swap",
});

// Acompanha a Courier Prime — usada pontualmente pra dar destaque/elemento
// diferenciado dentro do texto (não é a fonte de texto corrido).
const specialElite = localFont({
  src: [{ path: "../../public/fonts/SpecialElite-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-special-elite",
  display: "swap",
});

// Família Rampart — é a fonte que deu origem ao logo. Usada pra texto
// próximo/relacionado ao logo; a família tem vários papéis dentro de si
// (ver DESIGN_SYSTEM.md), cada sub-variante como seu próprio font-family.
const rampart = localFont({
  src: [{ path: "../../public/fonts/Rampart-Regular.otf", weight: "400", style: "normal" }],
  variable: "--font-rampart",
  display: "swap",
});

const rampartSans = localFont({
  src: [
    { path: "../../public/fonts/Rampart-Sans.otf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Rampart-SansBold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-rampart-sans",
  display: "swap",
});

const rampartStamp = localFont({
  src: [{ path: "../../public/fonts/Rampart-Stamp.otf", weight: "400", style: "normal" }],
  variable: "--font-rampart-stamp",
  display: "swap",
});

const rampartSpurs = localFont({
  src: [{ path: "../../public/fonts/Rampart-Spurs.otf", weight: "400", style: "normal" }],
  variable: "--font-rampart-spurs",
  display: "swap",
});

const rampartSpursStamp = localFont({
  src: [{ path: "../../public/fonts/Rampart-SpursStamp.otf", weight: "400", style: "normal" }],
  variable: "--font-rampart-spurs-stamp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fernandito",
  description: "Fernet com cola. Direto da lata.",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${fontVariables} antialiased`}>
      <body>
        <SmoothScrollProvider>
          <IntroLoader />
          <CustomCursor />
          <FloatingNav />
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
