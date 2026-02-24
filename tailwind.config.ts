import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef1f8",
          100: "#d5dbed",
          200: "#b0bad9",
          300: "#8495c1",
          400: "#5e72a8",
          500: "#3d5189",
          600: "#2d3d6b",
          700: "#1e2a4a",
          800: "#151e36",
          900: "#0d1322",
          950: "#070a14",
        },
        gold: {
          50: "#fef9eb",
          100: "#fcefc5",
          200: "#f9df8b",
          300: "#f5cb4d",
          400: "#f0b924",
          500: "#e8a817",
          600: "#c98a0f",
          700: "#a66b0b",
          800: "#7d5009",
          900: "#5a3a07",
          950: "#3a2504",
        },
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
