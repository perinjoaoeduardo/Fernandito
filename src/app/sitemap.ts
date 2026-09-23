import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Landing de página única por enquanto. Pra adicionar rota nova é só somar
// uma entrada aqui — o resto (lastModified, XML, headers) o Next resolve.
const ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] =
  [
    { path: "/", changeFrequency: "monthly", priority: 1 },
    { path: "/legal/avisos", changeFrequency: "yearly", priority: 0.3 },
  ];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
