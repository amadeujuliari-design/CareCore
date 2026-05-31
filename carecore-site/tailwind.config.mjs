/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6d28d9',
          600: '#7c3aed',
          500: '#8b5cf6',
          400: '#a855f7',
          soft: '#faf5ff',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
