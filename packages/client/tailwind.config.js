/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          neo: {
            bg: 'var(--neo-bg)',
            surface: 'var(--neo-surface)',
            text: 'var(--neo-text)',
            border: 'var(--neo-border)',
            shadow: 'var(--neo-shadow)',
            accent: 'var(--neo-accent)',
            error: 'var(--neo-error)',
          }
        },
        boxShadow: {
          'brutal': '4px 4px 0px 0px var(--neo-shadow)',
          'brutal-hover': '6px 6px 0px 0px var(--neo-shadow)',
          'brutal-sm': '2px 2px 0px 0px var(--neo-shadow)',
          'brutal-lg': '8px 8px 0px 0px var(--neo-shadow)',
        }
      },
    },
    plugins: [],
  }
