import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        canvas: '#06060A',
        base: '#0C0C14',
        surface: '#11111C',
        elevated: '#171726',
        overlay: '#1D1D30',
        gold: {
          400: '#FFDC6B',
          500: '#F5C842',
          600: '#C9A420',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          default: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.16)',
        }
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #F5C842 0%, #FF9D2F 100%)',
        'gradient-card': 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,200,66,0.15) 0%, transparent 60%)',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245,200,66,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(245,200,66,0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
} satisfies Config
