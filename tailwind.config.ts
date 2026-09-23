import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050e1a',
          900: '#0a1a2e',
          850: '#0d2038',
          800: '#10263f',
          700: '#17314f',
          600: '#1f3f63',
        },
        pitch: {
          DEFAULT: '#00c853',
          light: '#5efc82',
          dark: '#009624',
        },
        gold: '#ffd700',
        mist: '#b0bec5',
        dot: {
          green: '#4caf50',
          yellow: '#ffeb3b',
          orange: '#ff9800',
          red: '#f44336',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-poppins)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      boxShadow: {
        glow: '0 0 24px rgba(0, 200, 83, 0.45)',
        'glow-gold': '0 0 24px rgba(255, 215, 0, 0.45)',
        sheet: '0 -12px 40px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
