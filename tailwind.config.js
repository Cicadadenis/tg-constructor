/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './design-system/**/*.{js,jsx,ts,tsx}',
  ],
  prefix: 'tw-',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        mc: {
          primary: 'var(--mc-color-primary)',
          'primary-hover': 'var(--mc-color-primary-hover)',
          'primary-muted': 'var(--mc-color-primary-muted)',
          surface: 'var(--mc-color-surface)',
          'surface-muted': 'var(--mc-color-surface-muted)',
          border: 'var(--mc-color-border)',
          text: 'var(--mc-color-text)',
          'text-secondary': 'var(--mc-color-text-secondary)',
          muted: 'var(--mc-color-text-muted)',
          canvas: 'var(--mc-color-canvas-bg)',
          danger: 'var(--mc-color-danger)',
          success: 'var(--mc-color-success)',
          warning: 'var(--mc-color-warning)',
        },
      },
      spacing: {
        'mc-1': 'var(--mc-space-1)',
        'mc-2': 'var(--mc-space-2)',
        'mc-3': 'var(--mc-space-3)',
        'mc-4': 'var(--mc-space-4)',
        'mc-6': 'var(--mc-space-6)',
        'mc-8': 'var(--mc-space-8)',
      },
      borderRadius: {
        'mc-sm': 'var(--mc-radius-sm)',
        'mc-md': 'var(--mc-radius-md)',
        'mc-lg': 'var(--mc-radius-lg)',
        'mc-xl': 'var(--mc-radius-xl)',
        'mc-card': 'var(--mc-radius-card)',
        'mc-panel': 'var(--mc-radius-panel)',
      },
      boxShadow: {
        'mc-xs': 'var(--mc-shadow-xs)',
        'mc-sm': 'var(--mc-shadow-sm)',
        'mc-md': 'var(--mc-shadow-md)',
        'mc-lg': 'var(--mc-shadow-lg)',
        'mc-focus': 'var(--mc-shadow-focus)',
      },
      fontFamily: {
        mc: ['var(--mc-font-sans)'],
        'mc-mono': ['var(--mc-font-mono)'],
      },
      fontSize: {
        'mc-xs': 'var(--mc-font-size-xs)',
        'mc-sm': 'var(--mc-font-size-sm)',
        'mc-base': 'var(--mc-font-size-base)',
        'mc-lg': 'var(--mc-font-size-lg)',
      },
      transitionDuration: {
        'mc-fast': 'var(--mc-duration-fast)',
        'mc-base': 'var(--mc-duration-base)',
        'mc-slow': 'var(--mc-duration-slow)',
      },
      zIndex: {
        'mc-dropdown': 'var(--mc-z-dropdown)',
        'mc-modal': 'var(--mc-z-modal)',
        'mc-tooltip': 'var(--mc-z-tooltip)',
      },
    },
  },
  plugins: [],
};
