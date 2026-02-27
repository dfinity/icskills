import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://dfinity.github.io',
  base: '/icskills',
  integrations: [preact(), sitemap()],
  build: {
    format: 'directory',
  },
});
