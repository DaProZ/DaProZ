/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:       '#0a0d12',
          card:       '#111419',
          border:     '#21262d',
          green:      '#3fb950',
          red:        '#f85149',
          blue:       '#58a6ff',
          yellow:     '#d29922',
          // Mode colours
          scalping:   '#f59e0b',
          intraday:   '#38bdf8',
          swingCorto: '#a78bfa',
          swingLargo: '#34d399',
          neutral:    '#6b7280',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
