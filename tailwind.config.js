/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#0B0F14',
        panel: '#151B23',
        panel2: '#1B232D',
        line: '#263241',
        accent: '#FF6B35',
        accent2: '#FF8A5C',
        ink: '#F5F5F5',
        muted: '#8C98A8',
      },
      fontFamily: {
        display: ['"Rajdhani"', '"Oswald"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,107,53,.35), 0 8px 30px -8px rgba(255,107,53,.45)',
      },
    },
  },
  plugins: [],
};
