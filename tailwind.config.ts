import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        maroon: {
          50:  '#FBF5F6',
          100: '#F3E0E4',
          200: '#E6B8C0',
          300: '#D48A96',
          400: '#BB5E6E',
          500: '#8B2E42',
          600: '#6B1E2E',
          700: '#4A1220',
          800: '#2E0B14',
          900: '#160508',
        },
        navy: {
          50:  '#F0F4F8',
          100: '#D9E4EF',
          200: '#B0C8DF',
          300: '#7FA4C4',
          400: '#4E7FA9',
          500: '#2A4A72',
          600: '#1C3557',
          700: '#12233A',
          800: '#0A1520',
          900: '#040A10',
        },
        gold: {
          50:  '#FEF9EE',
          100: '#FCF0D0',
          200: '#F8DC96',
          300: '#F3C35A',
          400: '#E8B84B',
          500: '#C9922A',
          600: '#A87520',
          700: '#7A5416',
          800: '#4E350D',
          900: '#261A06',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        modal: '0 20px 60px -10px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}

export default config
