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
            'surface-alt': 'var(--neo-surface-alt)',
            text: 'var(--neo-text)',
            'text-secondary': 'var(--neo-text-secondary)',
            border: 'var(--neo-border)',
            shadow: 'var(--neo-shadow)',
            accent: 'var(--neo-accent)',
            'accent-text': 'var(--neo-accent-text)',
            error: 'var(--neo-error)',
            success: 'var(--neo-success)',
            info: 'var(--neo-info)',
            warning: 'var(--neo-warning)',
          }
        },
        boxShadow: {
          'brutal': '4px 4px 0px 0px var(--neo-shadow)',
          'brutal-hover': '6px 6px 0px 0px var(--neo-shadow)',
          'brutal-sm': '2px 2px 0px 0px var(--neo-shadow)',
          'brutal-lg': '8px 8px 0px 0px var(--neo-shadow)',
          'brutal-inset': 'inset 2px 2px 0px 0px var(--neo-shadow)',
          'brutal-glow': '4px 4px 0px 0px var(--neo-shadow), 0 0 20px rgba(214, 248, 67, 0.15)',
        },
        animation: {
          'neo-shake': 'neo-shake 0.4s ease-in-out',
          'neo-bounce-in': 'neo-bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          'neo-slide-up': 'neo-slide-up 0.4s ease-out',
          'neo-stamp': 'neo-stamp 0.3s ease-out',
          'neo-pulse': 'neo-pulse-border 2s ease-in-out infinite',
          'neo-glow': 'neo-glow 2s ease-in-out infinite',
          'float': 'float 3s ease-in-out infinite',
          'wiggle': 'wiggle 0.5s ease-in-out',
          'gradient-shift': 'gradient-shift 4s ease infinite',
        },
      },
    },
    plugins: [],
  }
