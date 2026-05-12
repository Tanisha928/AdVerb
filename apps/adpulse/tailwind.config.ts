import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm)", "var(--font-jakarta)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm)", "ui-monospace", "monospace"],
      },
      colors: {
        sidebar: "#0f172a",
        zinc: { 950: "#09090b", 900: "#18181b", 800: "#27272a" },
      },
    },
  },
  plugins: [],
};

export default config;
