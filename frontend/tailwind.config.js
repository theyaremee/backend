/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0A0A0A',
        surface:  '#121212',
        card:     '#1A1A1A',
        border:   '#2A2A2A',
        primary:  '#FFFFFF',
        muted:    '#888888',
        success:  '#22C55E',
        danger:   '#EF4444',
        warning:  '#F59E0B',
        vip:      '#F59E0B',
      },
      fontFamily: { sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'] },
      borderRadius: { xl: '16px', '2xl': '24px' },
    },
  },
  plugins: [],
};
