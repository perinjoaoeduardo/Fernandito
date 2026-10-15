import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { PRELAUNCH, STORE } from "@/content/site";

// Home + páginas internas (site completo). Pra adicionar rota nova é só somar
// uma entrada aqui — o resto (lastModified, XML, headers) o Next resolve.
const ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "monthly", priority: 1 },
  ...(PRELAUNCH.enabled
    ? []
    : ["/manifesto", "/eventos", "/revenda", "/contato"].map((path) => ({
        path,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }))),
  ...(STORE.enabled
    ? [
        { path: "/termos", changeFrequency: "yearly" as const, priority: 0.3 },
        { path: "/privacidade", changeFrequency: "yearly" as const, priority: 0.3 },
      ]
    : []),
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
