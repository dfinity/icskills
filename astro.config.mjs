import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.SITE_URL || 'https://skills.internetcomputer.org',
  base: '/',
  integrations: [preact(), sitemap({ lastmod: new Date() })],
  build: {
    format: 'directory',
  },
});
