import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as respostas.
 * - HSTS: o navegador só fala com o site por HTTPS (2 anos).
 * - nosniff: o navegador não "adivinha" tipo de arquivo (evita executar um
 *   upload/JSON como script).
 * - frame-ancestors / X-Frame-Options: ninguém embute o site num iframe
 *   (golpe de página falsa por cima da verdadeira — clickjacking).
 * - Referrer-Policy: links pra fora levam só o domínio, nunca o caminho
 *   (a página do pedido tem o id secreto na URL).
 * - Permissions-Policy: câmera, microfone, localização etc. desligados.
 * - base-uri / form-action / object-src: fecham truques comuns de injeção.
 * Sem `script-src` de propósito: restringir scripts no Next exige nonce em
 * todo script inline e quebraria animações/hidratação — dá pra fazer depois.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), usb=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // Não anunciar "X-Powered-By: Next.js" (menos pista pra quem procura falha).
  poweredByHeader: false,
  // Os textos legais (content/legal/*.md) são lidos em tempo de execução
  // pelo checkout (versão dos termos aceita) — garante que vão junto.
  outputFileTracingIncludes: { "/*": ["./content/legal/**/*"] },
  images: {
    // Fotos da marca saem em 90 (o padrão do Next 16 é só 75, que deixava
    // as fotos de câmera com cara de compressão). Ver `PHOTO_QUALITY`.
    qualities: [75, 90],
    // AVIF primeiro (uns 30% menor que WebP na mesma qualidade); navegador
    // sem AVIF recebe WebP.
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
