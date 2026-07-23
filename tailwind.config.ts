import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F6F2",
        surface: "#FCFBF9",
        ink: { DEFAULT: "#191C22", soft: "#3A3E47", faint: "#71747C" },
        hairline: "#E4E1D8",
        blue: { DEFAULT: "#274A6D", deep: "#1C374F", wash: "#EDF1F5" },
        deal: {
          dark: "#0B5A32",
          green: "#1F8A4C",
          amber: "#B45309",
          red: "#B42318",
          darkwash: "#E7F1EB",
          greenwash: "#EAF4EE",
          amberwash: "#F8EEE2",
          redwash: "#F8E9E7",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(25,28,34,0.05)",
        raised: "0 4px 16px rgba(25,28,34,0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
