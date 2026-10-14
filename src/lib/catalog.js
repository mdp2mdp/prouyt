import { site, categories, products, enabledCategories, url, formatPrice, priceOf } from './site.js';

export { enabledCategories, categories, products };

export const categoryUrl = (c) => url(`catalog/${c.slug}/`);
export const productUrl = (p) => url(`catalog/${p.category}/${p.slug}/`);
export const categoryById = (id) => categories.find((c) => c.id === id);
export const productsOf = (categoryId) => products.filter((p) => p.category === categoryId);

/** "от 43 240 ₽" */
export const priceText = (p) => `${site.pricing.prefix} ${formatPrice(priceOf(p))}`;

/** "252 × 107 × 93 см" (cards) */
export function dimsText(p) {
  if (p.dims) return `${p.dims.cm.join(' × ')} см`;
  if (p.modules) return 'Модули и наборы';
  return '';
}

export const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function photoAlt(p, img, index = 0) {
  return img.kind === 'studio'
    ? `${p.name}: ${lc(p.type)} на светлом фоне`
    : `${p.name}: ${lc(p.type)} в интерьере${index > 1 ? `, фото ${index}` : ''}`;
}

/** Short selling points — only what the model's own specs confirm. */
export function features(p) {
  const get = (re) => p.specs.find((s) => re.test(s.label));
  const out = [];
  const sleep = get(/^Спальное место/);
  if (sleep) out.push({ icon: 'sofa', text: `Спальное место ${sleep.value}` });
  const drawer = get(/^(Ящик|Бельевой ящик)/);
  if (drawer) {
    const v = drawer.value;
    let text;
    if (/^есть/i.test(v)) text = 'Ящик для белья';
    else if (/^возможен/i.test(v)) text = 'Бельевой ящик в модуле-оттоманке';
    else if (/^\d/.test(v)) text = parseInt(v, 10) === 1 ? 'Ящик для белья' : `${parseInt(v, 10)} ящика для белья`;
    else text = `${drawer.label} ${v}`;
    out.push({ icon: 'box', text });
  }
  const mech = get(/^Механизм трансформации/);
  if (mech && !/отсутствует/i.test(mech.value)) out.push({ icon: 'cycle', text: `Механизм ${mech.value.replace(/\s*\(.*\)/, '')}` });
  if (p.variants.length) out.push({ icon: 'swap', text: 'Правое или левое исполнение' });
  for (const [re, icon] of [[/^Высота сиденья/, 'ruler'], [/^Каркас/, 'frame']]) {
    const s = get(re);
    if (s && out.length < 3) out.push({ icon, text: `${s.label}: ${s.value}` });
  }
  return out.slice(0, 4);
}

/** Up to `n` other models of the same category, cycling from the current one. */
export function related(p, n = 4) {
  const list = productsOf(p.category);
  const i = list.findIndex((x) => x.slug === p.slug);
  return [...list.slice(i + 1), ...list.slice(0, i)].slice(0, n);
}

export const mechanismsOf = (list) => [...new Set(list.map((p) => p.mechanism).filter(Boolean))];
