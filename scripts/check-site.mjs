// Static audit of dist/: SEO basics, links, images, contacts, forbidden placeholders.
// Run after `npm run build`: node scripts/check-site.mjs
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const BASE = (process.env.BASE_PATH ?? '/prouyt').replace(/\/+$/, '');
const PHONE = 'tel:+79645106747';
const EMAIL = 'mailto:fabrica-proyut@mail.ru';
const FORBIDDEN = [/TODO/, /\(999\)/, /info@prouyt/, /Щелково/, /Ульяновск/i, /10 лет/, /18 месяцев/, /Лион|Марсель|Оливия|Сидней/];
const ALLOWED_EXTERNAL = [/^https:\/\/yandex\.ru\/maps\//, /^https:\/\/schema\.org/, /^https:\/\/mdp2mdp\.github\.io/, /^https:\/\/prouyt\.ru/, /^http:\/\/www\.sitemaps\.org/];

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const problems = [];
const bad = (page, msg) => problems.push(`${path.relative(DIST, page)}: ${msg}`);

const exists = (p) => {
  const rel = decodeURIComponent(p.split('#')[0].split('?')[0]);
  if (!rel.startsWith(BASE + '/') && rel !== BASE) return false;
  const local = path.join(DIST, rel.slice(BASE.length));
  return fs.existsSync(local) && (fs.statSync(local).isFile() || fs.existsSync(path.join(local, 'index.html')));
};

const titles = new Map();
const descs = new Map();
const stats = { links: 0, images: 0, tel: 0, mailto: 0, jsonld: 0 };

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  if (!title) bad(page, 'no <title>');
  if (!desc) bad(page, 'no meta description');
  if (!/<html lang="ru"/.test(html)) bad(page, 'html lang is not ru');
  if (!/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html)) bad(page, 'no canonical');
  if (!/property="og:image" content="https?:\/\/[^"]+"/.test(html)) bad(page, 'no og:image');
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) bad(page, `${h1} <h1>`);
  if (title) titles.set(title, [...(titles.get(title) ?? []), page]);
  if (desc) descs.set(desc, [...(descs.get(desc) ?? []), page]);

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    stats.jsonld++;
    try { JSON.parse(m[1]); } catch { bad(page, 'invalid JSON-LD'); }
  }
  if (/<form[\s>]/.test(html)) bad(page, 'contains a <form>');
  for (const re of FORBIDDEN) if (re.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) bad(page, `forbidden text ${re}`);

  // links and assets
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const v = m[1];
    if (v.startsWith('tel:')) { stats.tel++; if (v !== PHONE) bad(page, `bad tel ${v}`); continue; }
    if (v.startsWith('mailto:')) { stats.mailto++; if (v !== EMAIL) bad(page, `bad mailto ${v}`); continue; }
    if (v.startsWith('#') || v.startsWith('data:')) continue;
    if (/^https?:/.test(v)) { if (!ALLOWED_EXTERNAL.some((re) => re.test(v))) bad(page, `external reference ${v}`); continue; }
    if (v.startsWith('/')) { stats.links++; if (!exists(v)) bad(page, `broken link ${v}`); }
  }
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      stats.images++;
      if (!exists(u)) bad(page, `broken srcset url ${u}`);
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt(=|\s|>)/.test(m[0])) bad(page, 'img without alt');
    if (!/\bwidth="\d+"/.test(m[0]) || !/\bheight="\d+"/.test(m[0])) bad(page, 'img without width/height');
  }
  // every phone link on the page must use the real number; page must offer a call button
  if (page.endsWith('index.html') && !html.includes(PHONE)) bad(page, 'no tel link');
}
for (const [t, ps] of titles) if (ps.length > 1) problems.push(`duplicate title "${t}" on ${ps.length} pages`);
for (const [d, ps] of descs) if (ps.length > 1) problems.push(`duplicate description "${d.slice(0, 60)}…" on ${ps.length} pages`);
for (const f of ['robots.txt', 'sitemap.xml', '404.html']) if (!fs.existsSync(path.join(DIST, f))) problems.push(`missing ${f}`);

// requests to Google Fonts etc. in CSS/JS
for (const f of files.filter((x) => /\.(css|js)$/.test(x))) {
  const c = fs.readFileSync(f, 'utf8');
  if (/fonts\.googleapis|fonts\.gstatic|googletagmanager|google-analytics|cdn\./.test(c)) problems.push(`${path.relative(DIST, f)}: third-party reference`);
}
// JS shipped to the browser: external files plus inline <script> bodies (JSON-LD excluded); worst page wins
const extJs = files.filter((x) => x.endsWith('.js')).reduce((n, f) => n + fs.statSync(f).size, 0);
const inlineJs = Math.max(...pages.map((p) => [...fs.readFileSync(p, 'utf8').matchAll(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + Buffer.byteLength(m[1]), 0)));
const jsBytes = extJs + inlineJs;

console.log(`pages: ${pages.length}, internal links: ${stats.links}, srcset urls: ${stats.images}, tel: ${stats.tel}, mailto: ${stats.mailto}, JSON-LD blocks: ${stats.jsonld}, JS total: ${(jsBytes / 1024).toFixed(1)} KB`);
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):`);
  for (const p of problems.slice(0, 60)) console.log(' -', p);
  process.exitCode = 1;
} else console.log('OK: no problems');
