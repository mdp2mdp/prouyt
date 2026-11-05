// Static search index for the header search (fetched once, on first open).
import { products, enabledCategories, categoryById, productUrl, categoryUrl, priceText, dimsText } from '../lib/catalog.js';
import { imageInfo } from '../lib/images.js';

export function GET() {
  const items = products
    .filter((p) => categoryById(p.category)?.enabled)
    .map((p) => ({
      n: p.name,
      t: p.type,
      c: categoryById(p.category).title,
      m: p.mechanism ?? '',
      d: dimsText(p),
      p: priceText(p),
      u: productUrl(p),
      i: p.images.cover ? imageInfo(p.images.cover.id).fallback(480) : null,
      // extra words people may type: the Latin slug and the left/right versions
      k: [p.slug.replace(/-/g, ' '), p.variants.length ? 'правый левый' : ''].join(' ').trim(),
    }));
  const categories = enabledCategories.map((c) => ({ n: c.title, u: categoryUrl(c) }));
  return new Response(JSON.stringify({ items, categories }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
