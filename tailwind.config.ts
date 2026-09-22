import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        fernandito: {
          "verde-escuro": "#243022",
          "verde-medio": "#405139",
          "verde-claro": "#6C7D4F",
          "off-white": "#E6E6CB",
        },
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        sans: ["var(--font-courier-prime)", "Courier New", "monospace"],
        accent: ["var(--font-special-elite)", "Courier New", "monospace"],
        rampart: ["var(--font-rampart)", "Georgia", "serif"],
        "rampart-sans": ["var(--font-rampart-sans)", "Courier New", "monospace"],
        "rampart-stamp": ["var(--font-rampart-stamp)", "Georgia", "serif"],
        "rampart-spurs": ["var(--font-rampart-spurs)", "Georgia", "serif"],
        "rampart-spurs-stamp": ["var(--font-rampart-spurs-stamp)", "Georgia", "serif"],
      },
      fontSize: {
        "display-xl": ["clamp(4rem, 12vw, 12rem)", { lineHeight: "0.9" }],
        "display-lg": ["clamp(3rem, 8vw, 8rem)", { lineHeight: "0.95" }],
        "display-md": ["clamp(2rem, 5vw, 4rem)", { lineHeight: "1.05" }],
        "body-lg": ["1.25rem", { lineHeight: "1.5" }],
        body: ["1rem", { lineHeight: "1.6" }],
        label: ["0.75rem", { lineHeight: "1.2", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "16px",
        full: "9999px",
      },
      transitionDuration: {
        fast: "150ms",
        base: "300ms",
        slow: "500ms",
      },
      transitionTimingFunction: {
        "out-standard": "cubic-bezier(0.22, 1, 0.36, 1)",
        "out-back": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "in-out-smooth": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
    },
  },
} satisfies Config;
