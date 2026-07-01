import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          amber:    '#F59E0B',
          'amber-light': '#FCD34D',
          'amber-dark':  '#D97706',
          shell:    '#0D1117',
          raised:   '#161B22',
          border:   '#21262D',
        },
      },
      fontFamily: {
        display: ['var(--font-sora)', 'sans-serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
        sans:    ['var(--font-dm-sans)', 'sans-serif'],
      },
      boxShadow: {
        card:     '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
        elevated: '0 4px 24px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
        amber:    '0 0 0 3px rgba(245,158,11,0.25)',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        pulseAmber: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245,158,11,0.5)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(245,158,11,0)' },
        },
      },
      animation: {
        'fade-up':     'fadeUp 0.35s ease both',
        'fade-up-1':   'fadeUp 0.35s 0.05s ease both',
        'fade-up-2':   'fadeUp 0.35s 0.1s ease both',
        'fade-up-3':   'fadeUp 0.35s 0.15s ease both',
        'fade-up-4':   'fadeUp 0.35s 0.2s ease both',
        'shimmer':     'shimmer 1.4s infinite',
        'pulse-amber': 'pulseAmber 2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
