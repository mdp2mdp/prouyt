import { products, enabledCategories } from '../lib/catalog.js';
import { url } from '../lib/site.js';

export function GET({ site }) {
  const paths = ['', 'catalog/', ...enabledCategories.map((c) => `catalog/${c.slug}/`), ...products.filter((p) => enabledCategories.some((c) => c.id === p.category)).map((p) => `catalog/${p.category}/${p.slug}/`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${new URL(url(p), site).href}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
