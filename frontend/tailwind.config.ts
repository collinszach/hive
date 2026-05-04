import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:         ['var(--font-sans)',       'system-ui', 'sans-serif'],
        mono:         ['var(--font-mono)',       'ui-monospace', 'monospace'],
        geist:        ['var(--font-geist)',      'system-ui', 'sans-serif'],
        'geist-mono': ['var(--font-geist-mono)','ui-monospace', 'monospace'],
      },
      colors: {
        base:     '#13151A',
        surface:  '#1A1D24',
        elevated: '#1F2229',
        overlay:  '#252830',

        honey: {
          DEFAULT: '#4A7A5A',
          deep:    '#2E5A3E',
          bright:  '#7AB88A',
          faint:   'rgba(74, 122, 90, 0.08)',
          subtle:  'rgba(74, 122, 90, 0.05)',
          glow:    'rgba(74, 122, 90, 0.22)',
          border:  'rgba(74, 122, 90, 0.18)',
        },

        blue: {
          DEFAULT: '#4A7A5A',
          hover:   '#3D6B4D',
          faint:   'rgba(74, 122, 90, 0.08)',
          subtle:  'rgba(74, 122, 90, 0.05)',
          glow:    'rgba(74, 122, 90, 0.22)',
          border:  'rgba(74, 122, 90, 0.20)',
        },

        ink: {
          primary:   '#F0F2F5',
          secondary: '#9CA3AF',
          tertiary:  '#6B7280',
          ghost:     '#4B5563',
        },

        semantic: {
          income:  '#5AA86A',
          expense: '#C85A5A',
          warning: '#D4921A',
          info:    '#4A7A5A',
        },

        border: {
          DEFAULT: '#2A2D35',
          subtle:  '#22252E',
          strong:  '#3A3E4A',
          white:   'rgba(255, 255, 255, 0.09)',
          honey:   'rgba(74, 122, 90, 0.18)',
        },
      },
      animation: {
        'bar-grow':     'barGrow 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        'bar-rise':     'barRise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-row': 'slideInRow 0.15s cubic-bezier(0.16, 1, 0.3, 1) both',
        'chart-draw':   'chartDraw 1.2s cubic-bezier(0.4, 0, 0.2, 1) both',
        'fade-up':      'fadeUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in':     'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in':      'fadeIn 0.2s ease both',
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
          from: { opacity: '0', transform: 'translateX(-6px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        chartDraw: {
          from: { strokeDashoffset: 'var(--path-len, 1000)' },
          to:   { strokeDashoffset: '0' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
