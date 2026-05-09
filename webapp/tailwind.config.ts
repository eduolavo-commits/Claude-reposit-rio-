import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d12",
          soft: "#12151c",
          card: "#171a23",
          hover: "#1f2330",
        },
        brand: {
          DEFAULT: "#1f3a8a",
          accent: "#d4a23a",
          light: "#3b5dd1",
        },
        muted: "#9aa3b2",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 10px 30px -10px rgba(31, 58, 138, 0.55)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 220ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
