import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const site = process.env.SITE_URL
  || (vercelUrl ? `https://${vercelUrl}` : 'https://dolfonator-portfolio.netlify.app');

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()]
});
