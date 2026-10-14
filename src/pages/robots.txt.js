import { url } from '../lib/site.js';

export function GET({ site }) {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL(url('sitemap.xml'), site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
