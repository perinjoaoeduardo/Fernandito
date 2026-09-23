import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fernandito",
    short_name: "Fernandito",
    description: "Fernet com cola pronto pra beber, em lata de 350ml.",
    start_url: "/",
    display: "standalone",
    lang: "pt-BR",
    theme_color: "#243022",
    background_color: "#E6E6CB",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
