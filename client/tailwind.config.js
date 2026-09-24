/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef7ff', 100: '#d9edff', 200: '#bce0ff', 300: '#8ecdff',
          400: '#59b0fc', 500: '#338ef7', 600: '#1d6fec', 700: '#1656d9',
          800: '#1848b0', 900: '#1a3f8b', 950: '#142a55',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.08)',
        'card-dark': '0 1px 3px rgb(0 0 0 / 0.6)',
      },
    },
  },
  plugins: [],
};
