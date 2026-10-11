import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os textos legais (content/legal/*.md) são lidos em tempo de execução
  // pelo checkout (versão dos termos aceita) — garante que vão junto.
  outputFileTracingIncludes: { "/*": ["./content/legal/**/*"] },
  images: {
    // Fotos da marca saem em 90 (o padrão do Next 16 é só 75, que deixava
    // as fotos de câmera com cara de compressão). Ver `PHOTO_QUALITY`.
    qualities: [75, 90],
  },
};

export default nextConfig;
