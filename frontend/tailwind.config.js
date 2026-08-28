/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        tajawal: ['Tajawal', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef7ff', 100: '#d9edff', 200: '#bce0ff', 300: '#8ecdff',
          400: '#59b0ff', 500: '#328eff', 600: '#1d6ff5', 700: '#1958e0',
          800: '#1c48b5', 900: '#1d418e',
        },
      },
    },
  },
  plugins: [],
};
