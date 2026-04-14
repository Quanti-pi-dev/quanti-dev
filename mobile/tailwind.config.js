/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Board theme — Light (whiteboard)
        'board-light': '#F5F3EE',
        'board-surface': '#FFFFFE',
        'board-ink': '#1A1A1A',
        'board-ink-soft': '#3A3A3A',
        // Board theme — Dark (blackboard)
        'board-dark': '#1C1C1E',
        'board-chalk': '#F0EDE8',
        'board-chalk-soft': '#B8B4AE',
        // Accent
        primary: '#2563EB',
        'primary-light': '#60A5FA',
        'primary-dark': '#1D4ED8',
        // Feedback
        correct: '#10B981',
        'correct-light': '#D1FAE5',
        incorrect: '#EF4444',
        'incorrect-light': '#FEE2E2',
        // Coin / gamify
        coin: '#F59E0B',
        'coin-light': '#FEF3C7',
      },
      fontFamily: {
        heading: ['PlayfairDisplay_700Bold'],
        'heading-regular': ['PlayfairDisplay_400Regular'],
        body: ['Inter_400Regular'],
        'body-medium': ['Inter_500Medium'],
        'body-semibold': ['Inter_600SemiBold'],
        'body-bold': ['Inter_700Bold'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
    },
  },
  plugins: [],
};
