import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://carecoreplus.com.br',
  compressHTML: true,
  integrations: [tailwind({ applyBaseStyles: false })],
});
