import type { LegalIcon } from "@/content/legal";

// Ícones do "Em resumo" (traço, 24px, cor do texto).
const PATHS: Record<LegalIcon, React.ReactNode> = {
  age: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 9.5 10 8.5v7M14.5 12a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Zm0 0a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z" />
    </>
  ),
  pix: (
    <path d="m12 3 3.2 3.2-3.2 3.2-3.2-3.2L12 3Zm0 11.6 3.2 3.2L12 21l-3.2-3.2 3.2-3.2ZM3 12l3.2-3.2L9.4 12l-3.2 3.2L3 12Zm11.6 0 3.2-3.2L21 12l-3.2 3.2-3.2-3.2Z" />
  ),
  truck: (
    <>
      <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" />
      <circle cx="7" cy="17" r="1.8" />
      <circle cx="17.5" cy="17" r="1.8" />
    </>
  ),
  back: <path d="M9 7 4 12l5 5M4.5 12H15a5 5 0 0 1 0 10h-2" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 11h6M9 14h4" />,
  shield: <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4V5Zm4 5h8M8 13h5" />,
};

export function LegalIconSvg({ name, className }: { name: LegalIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
