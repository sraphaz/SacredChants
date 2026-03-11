import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: process.env.SITE_ORIGIN || 'https://sraphaz.github.io',
  base: process.env.BASE_PATH || '/SacredChants/',
  integrations: [mdx(), tailwind()],
});
