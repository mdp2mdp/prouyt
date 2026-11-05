// Product feed in YML (Yandex Market Language) — the XML format dealers and marketplaces usually import.
// Built from the same data as the site, so prices and texts always match what visitors see.
import { products, enabledCategories, categoryById, productUrl, priceText } from './catalog.js';
import { site, priceOf, url } from './site.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nowStamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Moscow' }).slice(0, 16); // Moscow time, "YYYY-MM-DD HH:mm"
const MAX_PICTURES = 4;

/** Absolute URLs of the JPEG copies written by scripts/optimize-images.mjs (public/img/feed). */
export function feedPictures(p, origin) {
  const n = Math.min(MAX_PICTURES, p.images.gallery.length);
  return Array.from({ length: n }, (_, i) => new URL(url(`img/feed/${p.slug}-${i + 1}.jpg`), origin).href);
}

const modePrice = (x) => (site.pricing.priceMode === 'rrp' ? x.priceRrp : x.pricePromo);

export function buildYml(origin) {
  const catIds = new Map(enabledCategories.filter((c) => c.id !== 'sleep').map((c, i) => [c.id, i + 1]));
  const dimsOf = (p) => (p.dims && /Д/.test(p.dims.label.split('×')[0]) && p.dims.cm.length === 3 ? p.dims.cm.map((n) => n.toFixed(1)).join('/') : null);

  const offerXml = ({ id, name, p, price, description, extraParams = [], pictures }) => {
    const params = [
      ...p.specs.map((s) => [s.label, s.value]),
      ...(site.guarantee ? [['Гарантия', `${site.guarantee.months} месяцев`]] : []),
      ...extraParams,
    ];
    const dims = dimsOf(p);
    return `    <offer id="${esc(id)}" available="true">
      <url>${esc(new URL(productUrl(p), origin).href)}</url>
      <price>${price}</price>
      <currencyId>RUR</currencyId>
      <categoryId>${catIds.get(p.category)}</categoryId>
${pictures.map((u) => `      <picture>${esc(u)}</picture>`).join('\n')}
      <vendor>${esc(site.brand.name)}</vendor>
      <vendorCode>${esc(id)}</vendorCode>
      <name>${esc(name)}</name>
      <description><![CDATA[${description.replace(/]]>/g, ']]]]><![CDATA[>')}]]></description>
      <sales_notes>${esc(site.legal.priceNote.replace('Цена указана «от» и зависит от выбранной ткани и комплектации.', 'Цена «от», зависит от ткани и комплектации.'))}</sales_notes>
      <manufacturer_warranty>true</manufacturer_warranty>
      <country_of_origin>Россия</country_of_origin>
${dims ? `      <dimensions>${dims}</dimensions>\n` : ''}${params.map(([k, v]) => `      <param name="${esc(k)}">${esc(v)}</param>`).join('\n')}
    </offer>`;
  };

  const offers = [];
  for (const p of products) {
    if (!categoryById(p.category)?.enabled || !catIds.has(p.category)) continue;
    const pictures = feedPictures(p, origin);
    const description = p.description.join('\n\n');
    const variantParams = (p.priceVariants ?? []).map((v) => [`Цена, ${v.label}`, `${modePrice(v)} ₽`]);
    // a modular system is listed through its modules and ready-made sets (the base "from" price would duplicate the cheapest module)
    if (!p.modules) offers.push(offerXml({ id: p.slug, name: `${p.type} ${p.name}`, p, price: priceOf(p), description, extraParams: variantParams, pictures }));
    // Estetik: every module and ready-made set is a separate offer
    [...(p.modules ?? []).map((m, i) => ({ m, id: `${p.slug}-module-${i + 1}`, label: 'Модуль' })), ...(p.sets ?? []).map((m, i) => ({ m, id: `${p.slug}-set-${i + 1}`, label: 'Набор' }))].forEach(({ m, id, label }) => {
      offers.push(offerXml({
        id,
        name: `${p.name}. ${m.name}`,
        p: { ...p, specs: [], dims: null },
        price: modePrice(m),
        description: `${label} модульной системы «${p.name}». ${p.description[0]}`,
        extraParams: [['Габариты, см', m.dims], ...(m.sleeping ? [['Спальное место, см', m.sleeping]] : [])],
        pictures,
      }));
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${nowStamp()}">
  <shop>
    <name>${esc(site.brand.name)}</name>
    <company>${esc(site.seller.name)}</company>
    <url>${esc(origin)}</url>
    <currencies>
      <currency id="RUR" rate="1"/>
    </currencies>
    <categories>
${[...catIds].map(([id, n]) => `      <category id="${n}">${esc(categoryById(id).title)}</category>`).join('\n')}
    </categories>
    <offers>
${offers.join('\n')}
    </offers>
  </shop>
</yml_catalog>
`;
}

export { priceText };
