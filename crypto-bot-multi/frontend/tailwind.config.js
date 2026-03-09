/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0d1117',
          card: '#161b22',
          border: '#30363d',
          green: '#3fb950',
          red: '#f85149',
          blue: '#58a6ff',
          yellow: '#d29922',
        },
      },
    },
  },
  plugins: [],
};
