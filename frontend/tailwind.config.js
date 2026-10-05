/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: "#0D7C7C",
          dark: "#075E63",
          light: "#D9F1EF",
          accent: "#27B3B0",
          bg: "#F7FAFA",
          surface: "#FFFFFF",
          text: "#172525",
          secondary: "#607272",
          border: "#DDE8E7",
          success: "#2E8B67",
          warning: "#D99A2B",
          error: "#C94C4C",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
