/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vault: {
          50: '#f4f6fb',
          100: '#e8edf6',
          200: '#cbd7eb',
          300: '#9eb7db',
          400: '#6b92c7',
          500: '#4873b1',
          600: '#355994',
          700: '#2b4777',
          800: '#263d63',
          900: '#233553',
          950: '#0e1624',
        },
        shield: {
          50: '#eefbf4',
          100: '#d6f6e4',
          200: '#b0eccb',
          300: '#79dcab',
          400: '#3ec385',
          500: '#18a86a',
          600: '#0d8753',
          700: '#0c6a43',
          800: '#0d5437',
          900: '#0c452e',
          950: '#052719',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
