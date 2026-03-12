import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: process.env.SITE_ORIGIN || 'https://sacredchants.org',
  base: process.env.BASE_PATH || '/',
  integrations: [mdx(), tailwind()],
});
