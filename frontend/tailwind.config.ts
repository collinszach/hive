import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base:     '#0A0C10',
        surface:  '#0F1117',
        elevated: '#161921',
        overlay:  '#1C2030',

        honey: {
          DEFAULT: '#F5B942',
          deep:    '#C9920E',
          bright:  '#FFD166',
          faint:   'rgba(245, 185, 66, 0.07)',
          subtle:  'rgba(245, 185, 66, 0.04)',
          glow:    'rgba(245, 185, 66, 0.20)',
          border:  'rgba(245, 185, 66, 0.14)',
        },

        ink: {
          primary:   '#F0F0F4',
          secondary: '#9CA3AF',
          tertiary:  '#4B5063',
          ghost:     '#374151',
        },

        semantic: {
          income:  '#34D399',
          expense: '#F87171',
          warning: '#FBBF24',
          info:    '#60A5FA',
        },

        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          subtle:  'rgba(255, 255, 255, 0.03)',
          strong:  'rgba(255, 255, 255, 0.09)',
          white:   'rgba(255, 255, 255, 0.06)',
          honey:   'rgba(245, 185, 66, 0.14)',
        },
      },
      animation: {
        'bar-grow':     'barGrow 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        'bar-rise':     'barRise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-row': 'slideInRow 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'chart-draw':   'chartDraw 1.2s cubic-bezier(0.4, 0, 0.2, 1) both',
      },
      keyframes: {
        barGrow: {
          from: { width: '0%' },
          to:   { width: 'var(--bar-w, 100%)' },
        },
        barRise: {
          from: { transform: 'scaleY(0)', transformOrigin: 'bottom' },
          to:   { transform: 'scaleY(1)', transformOrigin: 'bottom' },
        },
        slideInRow: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        chartDraw: {
          from: { strokeDashoffset: 'var(--path-len, 1000)' },
          to:   { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
