import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Fotos da marca saem em 90 (o padrão do Next 16 é só 75, que deixava
    // as fotos de câmera com cara de compressão). Ver `PHOTO_QUALITY`.
    qualities: [75, 90],
  },
};

export default nextConfig;
