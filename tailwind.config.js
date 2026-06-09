/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        snow: {
          dark: '#1b3a4b',
          mid: '#293e40',
          nav: '#1d3c4b',
          accent: '#81b5a1',
          green: '#16a34a',
        }
      }
    },
  },
  plugins: [],
}

