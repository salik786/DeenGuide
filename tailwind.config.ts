import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#faf6ec",
        "cream-deep": "#f1e9d4",
        ink: "#1f2a24",
        emerald: {
          50: "#f0f8f3",
          100: "#dcefe4",
          200: "#b9dfc9",
          300: "#8fcdac",
          600: "#1f8563",
          700: "#1a6e53",
          800: "#145a44",
          900: "#0f3d30",
          950: "#0a2820",
        },
        gold: {
          100: "#f6e9c8",
          200: "#eeda9e",
          300: "#e6c874",
          400: "#dab55c",
          500: "#c99a3d",
          600: "#b8892b",
          700: "#96701f",
          900: "#5c4413",
        },
      },
      fontFamily: {
        arabic: ["var(--font-amiri)"],
        display: ["var(--font-fraunces)"],
        sans: ["var(--font-manrope)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
