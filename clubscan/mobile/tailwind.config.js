/** @type {import('tailwindcss').Config} */
// ClubScan design tokens (Phase 4 §2.1). Dark-first; light mode remaps tokens.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { base: '#0A0A0F', elevated: '#14141C', surface: '#1C1C28' },
        border: { DEFAULT: '#2A2A38' },
        text: { primary: '#F5F5F7', muted: '#A1A1B5' },
        brand: {
          primary: '#7C5CFC',
          accent: '#FF4D8D',
        },
        state: {
          success: '#2ED573',
          warn: '#FFB020',
          danger: '#FF4757',
          safety: '#36C5F0',
        },
      },
      borderRadius: { sm: '8px', md: '12px', lg: '20px', pill: '999px' },
      fontFamily: {
        sans: ['Inter', 'System'],
        display: ['Satoshi', 'Inter', 'System'],
      },
    },
  },
  plugins: [],
};
