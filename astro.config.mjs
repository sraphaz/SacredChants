import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_ORIGIN || 'https://sacredchants.org',
  base: process.env.BASE_PATH || '/',
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
