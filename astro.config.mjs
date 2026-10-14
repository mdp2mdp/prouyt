import { defineConfig } from 'astro/config';

// `site` and `base` come from the environment so the same build works on
// https://<user>.github.io/<repo>/ and on a custom domain with base "/".
const site = process.env.SITE_URL || 'https://mdp2mdp.github.io';
const base = process.env.BASE_PATH || '/prouyt';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
