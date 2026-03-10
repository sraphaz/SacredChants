import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://sraphaz.github.io',
  base: '/SacredChants/',
  trailingSlash: 'always',
  integrations: [mdx(), tailwind()],
});
