import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d8e8ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      boxShadow: {
        soft: "0 6px 24px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
