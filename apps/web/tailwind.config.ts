import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          50: "#f5f5f0",
          100: "#e8e8e2",
          200: "#d0d0c8",
          300: "#a0a098",
          400: "#86868b",
          500: "#6e6e72",
          600: "#565658",
          700: "#3a3a3c",
          800: "#2c2c2e",
          900: "#1c1c1e",
          950: "#0a0a0a",
        },
        apple: {
          green: "#30d158",
          "green-dark": "#1a7a34",
          blue: "#0a84ff",
          yellow: "#ffd60a",
          red: "#ff453a",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
        serif: ["Georgia", "Cambria", '"Times New Roman"', "Times", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
