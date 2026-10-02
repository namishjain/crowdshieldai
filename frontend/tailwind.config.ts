import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core brand: institutional charcoal + brass (civic / public-service look)
        ink: {
          50: '#f4f5f6',
          100: '#e3e5e8',
          200: '#cdd2d7',
          300: '#a9b0b8',
          400: '#5f6873',
          500: '#4a525c',
          600: '#3d454f',
          700: '#2b323a',
          800: '#1d2329',
          900: '#12161a',
        },
        brass: {
          50: '#faf4e4',
          100: '#efe2bd',
          400: '#d4a94a',
          500: '#a8842c',
          600: '#8a6a1f',
        },
        paper: '#f3f6fa',
        // Semantic status colors — status is ALWAYS mapped through these,
        // never through the brand accent, so severity stays legible.
        safe: {
          bg: '#e7f5ee',
          text: '#0f7a4a',
          dot: '#16a34a',
        },
        watch: {
          bg: '#fdf1dc',
          text: '#9a5a06',
          dot: '#f59e0b',
        },
        high: {
          bg: '#fdece7',
          text: '#c2410c',
          dot: '#ea580c',
        },
        critical: {
          bg: '#fdecec',
          text: '#c81e1e',
          dot: '#dc2626',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.03), 0 8px 24px -18px rgba(15, 23, 42, 0.22)',
        lift: '0 16px 44px -24px rgba(15, 23, 42, 0.22)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
} satisfies Config
