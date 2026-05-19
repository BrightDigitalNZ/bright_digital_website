// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://brightdigital.co.nz',
  output: 'static',
  integrations: [mdx(), preact(), sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
