import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { FloatingNav } from "@/components/ui/FloatingNav";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fernandito",
  description: "Fernet com cola. Direto da lata.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${instrumentSerif.variable} ${inter.variable} antialiased`}>
      <body>
        <SmoothScrollProvider>
          <FloatingNav />
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
