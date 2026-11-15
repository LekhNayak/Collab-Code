/** @type {import('tailwindcss').Config} */
// One design system for the whole product (see src/index.css for the values).
// Colors are RGB triplets in CSS variables so opacity modifiers work: bg-accent/20.
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest
        well: rgb('well'),
        canvas: rgb('canvas'),
        surface: rgb('surface'),
        chrome: rgb('chrome'),
        raised: rgb('raised'),
        // Text
        fg: { DEFAULT: rgb('fg'), 2: rgb('fg-2'), 3: rgb('fg-3') },
        // Translucent fills for hover, selected and quiet placeholder shapes
        tint: {
          1: 'rgb(var(--ink) / 0.05)',
          2: 'rgb(var(--ink) / 0.07)',
          3: 'rgb(var(--ink) / 0.10)',
          4: 'rgb(var(--ink) / 0.13)',
          5: 'rgb(var(--ink) / 0.20)',
        },
        // Hairlines
        line: {
          DEFAULT: 'rgb(var(--ink) / 0.08)',
          faint: 'rgb(var(--ink) / 0.05)',
          strong: 'rgb(var(--ink) / 0.16)',
        },
        // One accent. `solid` carries white text (a filled button); the base is for rings and fills.
        accent: {
          DEFAULT: rgb('accent'),
          solid: rgb('accent-solid'),
          soft: 'rgb(var(--accent) / 0.16)',
          text: rgb('accent-text'),
        },
        // Status colors mean status, and nothing else
        success: {
          DEFAULT: rgb('success'),
          solid: rgb('success-solid'),
          soft: 'rgb(var(--success) / 0.14)',
          text: rgb('success-text'),
        },
        danger: {
          DEFAULT: rgb('danger'),
          solid: rgb('danger-solid'),
          soft: 'rgb(var(--danger) / 0.14)',
          text: rgb('danger-text'),
        },
        warning: {
          DEFAULT: rgb('warning'),
          solid: rgb('warning-solid'),
          soft: 'rgb(var(--warning) / 0.14)',
          text: rgb('warning-text'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Cascadia Code"', '"SF Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      boxShadow: {
        // Depth is a lighter surface on dark and a whisper of shadow on light; both come from tokens
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
        lift: 'var(--shadow-lift)',
      },
      transitionTimingFunction: {
        // Arrival from nowhere, and travel; the only two curves besides linear
        arrive: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
        travel: 'cubic-bezier(0.45, 0, 0.1, 1)',
      },
    },
  },
  plugins: [],
};
