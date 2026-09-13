import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  'hsl(220,80%,97%)',
          100: 'hsl(220,75%,93%)',
          200: 'hsl(220,70%,85%)',
          300: 'hsl(220,65%,73%)',
          400: 'hsl(220,60%,62%)',
          500: 'hsl(220,56%,52%)',
          600: 'hsl(220,60%,44%)',
          700: 'hsl(220,65%,36%)',
          800: 'hsl(220,70%,26%)',
          900: 'hsl(220,75%,16%)',
        },
        surface: {
          900: 'hsl(224,20%,6%)',
          800: 'hsl(224,18%,10%)',
          700: 'hsl(224,16%,14%)',
          600: 'hsl(224,14%,18%)',
          500: 'hsl(224,12%,24%)',
          400: 'hsl(224,10%,32%)',
          300: 'hsl(224,8%,42%)',
          200: 'hsl(224,6%,62%)',
          100: 'hsl(224,4%,82%)',
          50:  'hsl(224,3%,94%)',
        },
        accent: {
          cyan:   'hsl(186,95%,55%)',
          violet: 'hsl(263,80%,65%)',
          amber:  'hsl(38,95%,58%)',
          rose:   'hsl(348,90%,62%)',
          emerald:'hsl(158,75%,50%)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, hsl(263,80%,15%) 0%, hsl(224,20%,6%) 50%, hsl(186,60%,10%) 100%)',
      },
      boxShadow: {
        'glow-brand': '0 0 24px hsl(220,56%,52% / 0.35)',
        'glow-cyan':  '0 0 24px hsl(186,95%,55% / 0.30)',
        'card':       '0 4px 24px hsl(0,0%,0% / 0.4), 0 1px 4px hsl(0,0%,0% / 0.25)',
      },
      animation: {
        'fade-in':    'fadeIn 0.35s ease-out forwards',
        'slide-up':   'slideUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':  'spin 3s linear infinite',
        'shimmer':    'shimmer 1.8s infinite linear',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer:  { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
    },
  },
  plugins: [],
}

export default config
