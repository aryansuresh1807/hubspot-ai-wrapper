import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      // 4px base spacing scale (1 unit = 4px)
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '18': '72px',
        '20': '80px',
        '24': '96px',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        // CRM design system — deep slate blue
        primary: {
          DEFAULT: '#334155',
          foreground: '#f8fafc',
          '900': '#1e293b',
          '700': '#334155',
          '500': '#475569',
        },
        status: {
          warm: '#10b981',
          active: '#3b82f6',
          cooling: '#f59e0b',
          dormant: '#6b7280',
          'at-risk': '#ef4444',
        },
        background: {
          DEFAULT: '#f8fafc',
          page: '#f8fafc',
          muted: 'hsl(var(--background))',
        },
        section: 'var(--color-section)',
        surface: 'var(--color-section)',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#1e293b',
          muted: 'hsl(var(--card))',
          'muted-foreground': 'hsl(var(--card-foreground))',
        },
        // Preserve CSS variable-based tokens for dark mode / theming
        foreground: 'hsl(var(--foreground))',
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'card-elevated': '0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
        soft: '0 2px 8px -2px rgb(15 23 42 / 0.08), 0 4px 12px -4px rgb(15 23 42 / 0.06)',
        'soft-lg': '0 8px 24px -4px rgb(15 23 42 / 0.08), 0 4px 12px -2px rgb(15 23 42 / 0.04)',
      },
      keyframes: {
        'loading-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'loading-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'loading-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'loading-dots': {
          '0%, 80%, 100%': { opacity: '0' },
          '40%': { opacity: '1' },
        },
      },
      animation: {
        'loading-pulse': 'loading-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'loading-shimmer': 'loading-shimmer 1.5s ease-in-out infinite',
        'loading-spin': 'loading-spin 0.8s linear infinite',
        'loading-dots': 'loading-dots 1.4s ease-in-out infinite both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
