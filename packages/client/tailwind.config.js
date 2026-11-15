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
          1: 'rgb(255 255 255 / 0.05)',
          2: 'rgb(255 255 255 / 0.07)',
          3: 'rgb(255 255 255 / 0.10)',
          4: 'rgb(255 255 255 / 0.13)',
          5: 'rgb(255 255 255 / 0.20)',
        },
        // Hairlines
        line: {
          DEFAULT: 'rgb(255 255 255 / 0.08)',
          faint: 'rgb(255 255 255 / 0.05)',
          strong: 'rgb(255 255 255 / 0.16)',
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
        // On dark, depth is mostly a lighter surface; shadows only separate floating things
        card: '0 1px 2px rgb(0 0 0 / 0.25)',
        float: '0 0 0 1px rgb(255 255 255 / 0.10), 0 4px 16px rgb(0 0 0 / 0.4), 0 12px 32px rgb(0 0 0 / 0.3)',
        lift: '0 0 0 1px rgb(255 255 255 / 0.10), 0 12px 28px -6px rgb(0 0 0 / 0.6)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
