// Builds the files for partners from the built site:
//   ПРОУЮТ_каталог_YML.xml  — copy of dist/feed.xml (run `npm run build` first)
//   ПРОУЮТ_каталог.csv      — the same catalog as a table (opens in Excel)
// Usage: node scripts/make-partner-files.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const products = read('src/data/products.json');
const categories = read('src/data/categories.json');
const site = read('src/data/site.json');
const manifestHost = process.env.SITE_URL ?? 'https://mdp2mdp.github.io';
const base = (process.env.BASE_PATH ?? '/prouyt').replace(/\/+$/, '');
const abs = (p) => `${manifestHost}${base}/${p.replace(/^\/+/, '')}`;

const feed = path.join(ROOT, 'dist', 'feed.xml');
if (!fs.existsSync(feed)) throw new Error('dist/feed.xml not found: run `npm run build` first');
fs.copyFileSync(feed, path.join(ROOT, 'ПРОУЮТ_каталог_YML.xml'));

const price = (x) => (site.pricing.priceMode === 'rrp' ? x.priceRrp : x.pricePromo);
const catTitle = (id) => categories.find((c) => c.id === id)?.title ?? id;
const cols = ['Артикул', 'Название', 'Раздел', 'Тип', 'Цена от, ₽', 'Механизм', 'Габариты, см', 'Спальное место', 'Описание', 'Ссылка на сайт', 'Фото 1', 'Фото 2', 'Фото 3', 'Фото 4'];
const rows = [];
for (const p of products) {
  if (!categories.find((c) => c.id === p.category)?.enabled) continue;
  const sleep = p.specs.find((s) => /^Спальное место/.test(s.label))?.value ?? '';
  const pics = Array.from({ length: Math.min(4, p.images.gallery.length) }, (_, i) => abs(`img/feed/${p.slug}-${i + 1}.jpg`));
  const page = abs(`catalog/${p.category}/${p.slug}/`);
  rows.push([p.slug, p.name, catTitle(p.category), p.type, price(p), p.mechanism ?? '', p.dims ? `${p.dims.cm.join(' × ')} (${p.dims.label})` : '', sleep, p.description.join(' '), page, ...pics, ...Array(4 - pics.length).fill('')]);
  for (const [kind, list] of [['Модуль', p.modules ?? []], ['Набор', p.sets ?? []]]) {
    list.forEach((m, i) => rows.push([`${p.slug}-${kind === 'Модуль' ? 'module' : 'set'}-${i + 1}`, `${p.name}. ${m.name}`, catTitle(p.category), kind, price(m), m.mechanism ?? '', m.dims, m.sleeping ? `${m.sleeping} см` : '', '', page, ...pics, ...Array(4 - pics.length).fill('')]));
  }
}
const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = '﻿' + [cols, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
fs.writeFileSync(path.join(ROOT, 'ПРОУЮТ_каталог.csv'), csv);
console.log(`XML: ${fs.statSync(feed).size} bytes; CSV rows: ${rows.length}`);
