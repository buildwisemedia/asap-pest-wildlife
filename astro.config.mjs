// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://asap-pest-wildlife.pages.dev',
  compressHTML: true,
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [sitemap()]
});
