import site from '../data/site.json';
import categories from '../data/categories.json';
import products from '../data/products.json';

const BASE = import.meta.env.BASE_URL;

/** Build a site-absolute path that respects the configured base. */
export function url(path = '') {
  const b = BASE.replace(/\/+$/, '');
  const p = String(path).replace(/^\/+/, '');
  return p ? `${b}/${p}` : `${b}/`;
}

/** 43240 → "43 240 ₽" with non-breaking spaces. */
export function formatPrice(n) {
  return `${Math.round(n).toLocaleString('ru-RU').replace(/[\s  ]/g, ' ')} ${site.pricing.currency}`;
}

/** Price shown on the site according to site.pricing.priceMode. */
export function priceOf(product) {
  return site.pricing.priceMode === 'rrp' ? product.priceRrp : product.pricePromo;
}

export const isTodo = (v) => typeof v !== 'string' || v.trim() === '' || v.startsWith('TODO');

export const enabledCategories = categories.filter((c) => c.enabled);
export const menu = site.menu.filter((m) => m.enabled).map((m) => ({ ...m, href: url(m.href) }));
export { site, categories, products };
