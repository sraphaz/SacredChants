/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'sc-xs': ['var(--sc-font-size-xs)', { lineHeight: 'var(--sc-leading-normal)' }],
        'sc-sm': ['var(--sc-font-size-sm)', { lineHeight: 'var(--sc-leading-normal)' }],
        'sc-base': ['var(--sc-font-size-base)', { lineHeight: 'var(--sc-leading-relaxed)' }],
        'sc-lg': ['var(--sc-font-size-lg)', { lineHeight: 'var(--sc-leading-relaxed)' }],
        'sc-xl': ['var(--sc-font-size-xl)', { lineHeight: 'var(--sc-leading-relaxed)' }],
        'sc-2xl': ['var(--sc-font-size-2xl)', { lineHeight: 'var(--sc-leading-sacred)' }],
        'sc-3xl': ['var(--sc-font-size-3xl)', { lineHeight: 'var(--sc-leading-sacred)' }],
        'sc-4xl': ['var(--sc-font-size-4xl)', { lineHeight: 'var(--sc-leading-snug)' }],
        'sc-5xl': ['var(--sc-font-size-5xl)', { lineHeight: 'var(--sc-leading-tight)' }],
      },
      maxWidth: {
        'measure-narrow': 'var(--sc-measure-narrow)',
        'measure-reading': 'var(--sc-measure-reading)',
        'measure-wide': 'var(--sc-measure-wide)',
      },
      spacing: {
        'verse': 'var(--sc-space-verse)',
        'verse-inner': 'var(--sc-space-verse-inner)',
        'section': 'var(--sc-space-section)',
      },
      letterSpacing: {
        'label': 'var(--sc-tracking-label)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'var(--sc-measure-reading)',
            color: '#374151',
          },
        },
      },
    },
  },
  plugins: [],
};
