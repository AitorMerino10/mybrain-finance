import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Azul del logo (#12222E): sustituye a los azules oscuros por defecto en toda la app
        slate: {
          700: '#2B4357',
          800: '#1A3142',
          900: '#12222E',
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          primary: '#90EBD6',
          dark: '#073763',
          darkGreen: '#2D5F4F',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;



