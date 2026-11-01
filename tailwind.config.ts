import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0E1319",
        surface: "#1A2230",
        surface2: "#212B3C",
        line: "#2B3649",
        ink: "#E6EBF2",
        muted: "#8B97A8",
        amber: "#EF9B3E",
        green: "#4FD199",
        red: "#F0664C",
        cyan: "#5DC9E0",
        violet: "#9B8CF2",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        led: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 8px 1px currentColor" },
          "50%": { opacity: "0.35", boxShadow: "0 0 2px 0 currentColor" },
        },
        slidein: {
          from: { transform: "translateX(24px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        led: "led 1.6s ease-in-out infinite",
        slidein: "slidein 0.18s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
