/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f9',
          100: '#dae4f0',
          200: '#b8cde2',
          300: '#8badcf',
          400: '#5d83b8',
          500: '#3d65a0',
          600: '#2f4f82',
          700: '#28406a',
          800: '#1e3252',
          900: '#15263f',
          950: '#0d1a2d',
        },
        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(21, 38, 63, 0.08), 0 1px 2px -1px rgba(21, 38, 63, 0.06)',
        elevated: '0 4px 12px -2px rgba(21, 38, 63, 0.1), 0 2px 6px -2px rgba(21, 38, 63, 0.06)',
      },
    },
  },
  plugins: [],
};
