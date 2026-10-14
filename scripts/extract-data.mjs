// Extracts catalog data from _source/*.docx and _source/*.xlsx into src/data/*.json
// and writes docs/stage1-report.md (photo mapping, discrepancies, prices).
// Run: npm run data
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, '_source');
const PHOTOS = path.join(SRC, 'проуют диваны фото');
const OUT = path.join(ROOT, 'src', 'data');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const map = read('scripts/model-map.json').products;
const overrides = read('scripts/overrides.json');

const unescapeXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/* ---------------------------------------------------------------- docx */
function docxLines(file) {
  const xml = new AdmZip(path.join(SRC, file)).readAsText('word/document.xml');
  const body = xml.split('<w:body>')[1] ?? xml;
  // a soft line break (<w:br/>) inside a paragraph is treated as a paragraph break
  return body.split('</w:p>').flatMap((p) => {
    let s = '';
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
      s += m[0].startsWith('<w:tab') ? ' ' : m[0].startsWith('<w:br') ? '\n' : unescapeXml(m[1] ?? '');
    }
    return s.split('\n').map((x) => x.replace(/\s+/g, ' ').trim());
  });
}

const SECTION = { 'ДИВАНЫ': 'straight', 'УГЛОВЫЕ ДИВАНЫ': 'corner', 'МОДУЛЬНЫЕ СИСТЕМЫ': 'modular', 'КРЕСЛА': 'armchairs' };
const lines = docxLines('проуют для сайта.docx');

const docModels = new Map(); // "section|NAME" -> {description[], specs[]}
let section = null;
let cur = null;
let mode = null;
let aboutStart = -1;
let aboutEnd = -1;
lines.forEach((line, i) => {
  if (/^1\.\s*О КОМПАНИИ/.test(line)) aboutStart = i;
  if (/^2\.\s*ЦЕЛЕВАЯ АУДИТОРИЯ/.test(line)) aboutEnd = i;
});
const catalogLines = lines.slice(0, aboutStart);
for (const line of catalogLines) {
  if (!line || /^(Начало|Конец) формы$/.test(line)) continue;
  let m = line.match(/^РАЗДЕЛ\s+(.+)$/);
  if (m) { section = SECTION[m[1].trim()]; cur = null; continue; }
  m = line.match(/^МОДЕЛЬ\s+[«"]?(.+?)[»"]?$/);
  if (m) {
    cur = { description: [], specs: [] };
    docModels.set(`${section}|${m[1].trim().toUpperCase()}`, cur);
    mode = 'desc';
    continue;
  }
  if (!cur) continue;
  if (/^Характеристики/.test(line)) { mode = 'specs'; continue; } // also swallows the stray editor note "…оставляем без изменений:"
  if (mode === 'desc') cur.description.push(line.replace(/\s*\.$/, '.').replace(/([^.!?])$/, '$1.'));
  else {
    const k = line.indexOf(':');
    if (k > 0) cur.specs.push({ label: line.slice(0, k).trim(), value: line.slice(k + 1).trim() });
  }
}

const aboutLines = lines.slice(aboutStart + 1, aboutEnd).filter(Boolean);
const about = { lead: aboutLines[0], paragraphs: [], advantages: [], note: [] };
{
  let bucket = 'paragraphs';
  for (const l of aboutLines.slice(1)) {
    if (/^Наши преимущества/.test(l)) { bucket = 'advantages'; continue; }
    if (/^Слоган/.test(l)) continue; // slogan comes from the brief, with the correct punctuation
    if (bucket === 'advantages') {
      if (/^[-–—]/.test(l)) about.advantages.push(l.replace(/^[-–—]\s*/, ''));
      else { bucket = 'note'; about.note.push(l); }
    } else about[bucket].push(l.replace(/([^.!?])$/, '$1.'));
  }
}

/* ---------------------------------------------------------------- xlsx */
const xz = new AdmZip(path.join(SRC, 'АКЦИЯ МФ ПРОУЮТ 2026.xlsx'));
const sst = xz.readAsText('xl/sharedStrings.xml');
const strings = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  unescapeXml([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((a) => a[1]).join('')),
);
const sheet = xz.readAsText('xl/worksheets/sheet1.xml');
const xrows = {};
for (const r of sheet.matchAll(/<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const row = {};
  for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const v = c[3] && /<v>([^<]*)<\/v>/.exec(c[3]);
    if (!v) continue;
    row[c[1]] = /t="s"/.test(c[2]) ? strings[+v[1]] : v[1];
  }
  xrows[+r[1]] = row;
}
const grade = (v, set) => { const d = Math.min(...set.map((c) => Math.abs(c - v))); return d <= 0.5 ? 'ok' : d <= 1 ? 'minor' : 'diff'; };
const round10 = (n) => Math.round(Number(n) / 10) * 10;
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function xlsxInfo(rowNo) {
  const r = xrows[rowNo];
  if (!r) throw new Error(`xlsx row ${rowNo} missing`);
  const nameRow = xrows[rowNo - 1] ?? {};
  const rawName = clean(nameRow.A ?? nameRow.B ?? nameRow.E);
  const dimText = clean(r.D).replace(/^Габаритные\s*размеры\s*/i, '').replace(/^Дл\.\s*Х\s*Гл\.\s*Х\s*Выс\.\s*/i, '');
  const [dimsPart, ...rest] = dimText.split(/сп\.?\s*место/i);
  const nums = (s) => [...s.matchAll(/\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)*/g)].map((m) => m[0].split('/').map((x) => Number(x.replace(',', '.'))));
  const restText = rest.join(' ');
  const seatMatch = restText.match(/h\s*посад\.?\s*места\s*(\d+)/i);
  const sleepText = restText.replace(/h\s*посад\.?\s*места\s*\d+/i, '');
  return {
    row: rowNo,
    name: rawName,
    mechanism: clean(r.B),
    filling: clean(r.C),
    dimsRaw: dimText,
    dims: nums(dimsPart),
    sleeping: nums(sleepText).map((a) => a[0]),
    seatHeight: seatMatch ? Number(seatMatch[1]) : null,
    usp: clean(r.E),
    fabric: clean(r.F),
    promoExact: Number(r.G),
    rrpExact: Number(r.H),
    pricePromo: round10(r.G),
    priceRrp: round10(r.H),
    note: clean(r.I),
  };
}

/* ---------------------------------------------------------------- photos */
const natural = (a, b) => a.localeCompare(b, 'ru', { numeric: true });
async function photoInfo(dir, file) {
  const p = path.join(PHOTOS, dir, file);
  const meta = await sharp(p).metadata();
  return { src: `${dir}/${file}`, w: meta.width, h: meta.height, bytes: fs.statSync(p).size };
}
async function collectPhotos(m) {
  if (!m.photoDir) return [];
  const files = fs.readdirSync(path.join(PHOTOS, m.photoDir)).filter((f) => !(m.excludePhotos ?? []).includes(f));
  const list = [];
  for (const f of files) list.push(await photoInfo(m.photoDir, f));
  for (const e of m.extraPhotos ?? []) list.push(await photoInfo(e.dir, e.file));
  list.forEach((p) => { p.kind = /студ/i.test(p.src) ? 'studio' : 'interior'; });
  const studio = list.filter((p) => p.kind === 'studio').sort((a, b) => b.w * b.h - a.w * a.h || b.bytes - a.bytes || natural(a.src, b.src));
  const interior = list.filter((p) => p.kind === 'interior').sort((a, b) => natural(a.src, b.src));
  // cover = largest studio shot, then interior shots, then remaining studio angles
  const ordered = [...studio.slice(0, 1), ...interior, ...studio.slice(1)];
  let s = 0;
  let i = 0;
  const idOf = (p) => (p.kind === 'studio' ? `studio-${++s}` : `interior-${++i}`);
  // numbering follows kind order, not gallery order
  const ids = new Map();
  studio.forEach((p, n) => ids.set(p, `studio-${n + 1}`));
  interior.forEach((p, n) => ids.set(p, `interior-${n + 1}`));
  void idOf;
  return ordered.map((p) => ({ ...p, id: ids.get(p) }));
}

/* ---------------------------------------------------------------- build */
const mmToCm = (n) => Math.round(n / 10);
const numsIn = (s) => [...String(s).matchAll(/\d+/g)].map((m) => Number(m[0]));
const fmtMm = (arr, sep = ' × ') => arr.map((n) => n * 10).join(sep) + ' мм';

function xlsxDerived(info, which) {
  if (which === 'dims') {
    const cols = info.dims.slice(0, 3).map((a) => Math.max(...a));
    return fmtMm(cols);
  }
  if (which === 'sleeping') return fmtMm([...info.sleeping].slice(0, 2).sort((a, b) => b - a));
  throw new Error('unknown xlsx field ' + which);
}

const products = [];
const photoMap = {};
const discrepancies = [];
const todos = [];
const priceVariantsLabels = { versal: ['Жаккард Vatican', 'Жаккард Bristol'], olimp: ['Жаккард Vatican', 'Жаккард Bristol'] };

for (const m of map) {
  const doc = docModels.get(`${m.docx[0]}|${m.docx[1]}`);
  if (!doc) throw new Error(`docx model not found: ${m.docx.join('|')}`);
  const specs = doc.specs.map((s) => ({ ...s }));
  const x = m.xlsx;
  const info = x.main ? xlsxInfo(x.main) : null;
  const altInfo = x.alt ? xlsxInfo(x.alt) : null;

  // --- compare docx vs xlsx
  if (info && m.category !== 'modular') {
    const dimSpec = specs.find((s) => /^Габариты/.test(s.label));
    if (dimSpec) {
      const d = numsIn(dimSpec.value).map(mmToCm);
      const xd = info.dims;
      if (d.length === 3 && xd.length >= 3) {
        const names = specs.find((s) => /^Габариты/.test(s.label)).label.match(/\((.*)\)/)?.[1].split('×') ?? [];
        d.forEach((v, k) => {
          const g = grade(v, xd[k]);
          if (g !== 'ok')
            discrepancies.push({ slug: m.slug, name: m.name, field: `Габариты, ${names[k] ?? k + 1}`, docx: `${v * 10} мм`, xlsx: `${xd[k].join(' / ')} см`, xlsxRow: info.row, minor: g === 'minor' });
        });
      } else if (d.length === 2 && xd.length >= 3) {
        discrepancies.push({ slug: m.slug, name: m.name, field: 'Габариты', docx: dimSpec.value + ' (нет высоты)', xlsx: info.dimsRaw, xlsxRow: info.row });
      }
    }
    const sl = specs.find((s) => /^Спальное место/.test(s.label));
    if (sl && info.sleeping.length >= 2) {
      const a = numsIn(sl.value).map(mmToCm).sort((p, q) => q - p).slice(0, 2);
      const b = [...info.sleeping].slice(0, 2).sort((p, q) => q - p);
      if (a.length === 2) {
        const gs = [grade(a[0], [b[0]]), grade(a[1], [b[1]])];
        if (gs.some((g) => g !== 'ok'))
          discrepancies.push({ slug: m.slug, name: m.name, field: 'Спальное место', docx: sl.value, xlsx: `${b[0]} × ${b[1]} см`, xlsxRow: info.row, minor: gs.every((g) => g !== 'diff') });
      }
    }
    const seat = specs.find((s) => /^Высота сиденья/.test(s.label));
    if (seat && info.seatHeight) {
      const v = mmToCm(numsIn(seat.value)[0]);
      const g = grade(v, [info.seatHeight]);
      if (g !== 'ok')
        discrepancies.push({ slug: m.slug, name: m.name, field: 'Высота сиденья', docx: seat.value, xlsx: `${info.seatHeight} см`, xlsxRow: info.row, minor: g === 'minor' });
    }
    const mech = specs.find((s) => /^Механизм трансформации/.test(s.label));
    if (mech && info.mechanism) {
      const a = mech.value.replace(/[«»"]/g, '').toLowerCase().trim();
      const b = info.mechanism.toLowerCase().trim();
      if (a !== 'отсутствует' && a !== b) discrepancies.push({ slug: m.slug, name: m.name, field: 'Механизм', docx: mech.value, xlsx: info.mechanism, xlsxRow: info.row });
    }
  }

  // --- manual spec operations
  const notes = [];
  for (const op of overrides.specOps.filter((o) => o.slug === m.slug)) {
    if (op.op === 'replaceSpec') {
      const i = specs.findIndex((s) => s.label === op.label);
      if (i < 0) throw new Error(`override target missing: ${m.slug} ${op.label}`);
      const val = xlsxDerived(info, op.xlsx);
      specs[i] = { label: op.newLabel ?? op.label, value: val, source: 'xlsx' };
      notes.push({ field: op.label, used: val, reason: op.reason });
    } else if (op.op === 'addSpec') {
      let at = specs.findIndex((s) => s.label.startsWith(op.before ?? '\u0000'));
      if (op.after) at = specs.findIndex((s) => s.label.startsWith(op.after)) + 1;
      if (at < 0) at = specs.length;
      specs.splice(at, 0, { label: op.label, value: op.value, source: op.source });
      notes.push({ field: op.label, used: op.value, reason: op.reason });
    }
  }

  // --- derived fields
  const mechSpec = specs.find((s) => /^Механизм трансформации/.test(s.label))?.value.replace(/[«»"]/g, '').replace(/\s*\(.*\)/, '').trim();
  const mechanism = !mechSpec ? null : /отсутствует/i.test(mechSpec) ? 'Без механизма' : mechSpec;
  const dimSpec = specs.find((s) => /^Габариты/.test(s.label));
  let dims = null;
  if (dimSpec) {
    const label = dimSpec.label.match(/\((.*)\)/)?.[1] ?? '';
    dims = { label, cm: numsIn(dimSpec.value).map(mmToCm) };
  } else if (m.slug === 'unika') {
    dims = { label: 'Д×Ш×В', cm: [252, 161, 82] }; // length / ottoman depth from docx, height from xlsx
  }
  const variants = specs.some((s) => /^Исполнение/.test(s.label)) ? ['left', 'right'] : [];
  const first = doc.description[0].replace(/^(.+?[.!?])(\s.*)?$/, '$1');
  const shortDescription = first.endsWith('.') ? first : first + '.';

  const type =
    overrides.types[m.slug] ??
    (m.category === 'straight' ? 'Прямой диван-кровать' : m.category === 'corner' ? 'Угловой диван-кровать' : 'Диван');

  // --- prices
  let pricePromo = null;
  let priceRrp = null;
  let priceVariants;
  let modules;
  let sets;
  if (m.slug === 'estetik') {
    const row = (n) => {
      const i = xlsxInfo(n);
      return {
        name: i.name.replace(/^Эстетик\.\s*/, ''),
        dims: i.dimsRaw,
        pricePromo: i.pricePromo,
        priceRrp: i.priceRrp,
        mechanism: i.mechanism || undefined,
        xlsxRow: n,
      };
    };
    modules = x.modules.map(row);
    sets = x.sets.map(row);
    const from = xlsxInfo(x.fromRow);
    pricePromo = from.pricePromo;
    priceRrp = from.priceRrp;
  } else {
    pricePromo = altInfo ? Math.min(info.pricePromo, altInfo.pricePromo) : info.pricePromo;
    priceRrp = altInfo ? Math.min(info.priceRrp, altInfo.priceRrp) : info.priceRrp;
    if (altInfo)
      priceVariants = [info, altInfo].map((i, k) => ({ label: priceVariantsLabels[m.slug][k], pricePromo: i.pricePromo, priceRrp: i.priceRrp, xlsxRow: i.row }));
  }

  // --- photos
  const photos = await collectPhotos(m);
  photoMap[m.slug] = photos.map((p) => ({ id: p.id, kind: p.kind, src: p.src, w: p.w, h: p.h }));
  const img = (p) => ({ id: `${m.slug}/${p.id}`, kind: p.kind, w: p.w, h: p.h });
  const cover = photos[0] ? img(photos[0]) : null;
  const productTodos = [];
  if (!photos.length) productTodos.push('Нет фото: пришлите фото кресла (будет показана заглушка «Фото скоро»).');
  if (photos.length && !photos.some((p) => p.kind === 'studio')) productTodos.push('Нет студийного фото: в каталоге используется фото в интерьере.');
  if (photos.length && photos[0].kind === 'studio' && photos[0].w < 1600) productTodos.push(`Студийное фото низкого разрешения (${photos[0].w}×${photos[0].h}).`);
  if (photos.length && !photos.some((p) => p.kind === 'interior')) productTodos.push('Нет фото в интерьере (в галерее только студийные).');

  products.push({
    slug: m.slug,
    name: m.name,
    category: m.category,
    type,
    pricePromo,
    priceRrp,
    ...(priceVariants ? { priceVariants } : {}),
    description: doc.description,
    shortDescription,
    specs,
    dims,
    mechanism,
    variants,
    ...(modules ? { modules, sets } : {}),
    images: { cover, gallery: photos.map(img), placeholder: photos.length === 0 },
    xlsxRow: m.slug === 'estetik' ? x.fromRow : x.main,
    ...(x.note ? { xlsxNote: x.note } : {}),
    ...(info?.note ? { priceNote: info.note } : {}),
    ...(notes.length ? { dataNotes: notes } : {}),
    ...(productTodos.length ? { todo: productTodos } : {}),
  });
  if (productTodos.length) todos.push(...productTodos.map((t) => `${m.name}: ${t}`));
}

/* ---------------------------------------------------------------- write */
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'products.json'), JSON.stringify(products, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'about.generated.json'), JSON.stringify(about, null, 2) + '\n');
fs.mkdirSync(path.join(ROOT, 'scripts', 'generated'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'scripts', 'generated', 'photo-map.json'), JSON.stringify(photoMap, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'scripts', 'generated', 'discrepancies.json'), JSON.stringify(discrepancies, null, 2) + '\n');

const rub = (n) => n.toLocaleString('ru-RU').replace(/ | /g, ' ');
let md = '# Отчёт этапа 1 (генерируется скриптом `npm run data`)\n\n';
md += '## Цены (акционная → округление до 10 ₽; РРЦ)\n\n| Модель | Раздел | Акц. цена | РРЦ | Строка xlsx |\n|---|---|---:|---:|---|\n';
for (const p of products)
  md += `| ${p.name} | ${p.category} | ${rub(p.pricePromo)} | ${rub(p.priceRrp)} | ${p.xlsxRow}${p.priceVariants ? ' (+' + p.priceVariants.map((v) => v.xlsxRow).join(', ') + ')' : ''} |\n`;
for (const [title, minor] of [['Существенные расхождения docx ↔ xlsx', false], ['Мелкие расхождения (≤ 1 см, вероятно округление в xlsx)', true]]) {
  md += `\n## ${title}\n\n| Модель | Поле | docx | xlsx | Строка |\n|---|---|---|---|---|\n`;
  for (const d of discrepancies.filter((x) => !!x.minor === minor)) md += `| ${d.name} | ${d.field} | ${d.docx} | ${d.xlsx} | ${d.xlsxRow} |\n`;
}
md += '\n## Фото: папка → модель\n\n| Модель | Папка | Обложка | Файлов (студ./интерьер) |\n|---|---|---|---|\n';
for (const m of map) {
  const ph = photoMap[m.slug];
  const cov = ph[0];
  md += `| ${m.name} | ${m.photoDir ?? '—'} | ${cov ? `${cov.src} (${cov.w}×${cov.h})` : 'нет фото'} | ${ph.filter((p) => p.kind === 'studio').length}/${ph.filter((p) => p.kind === 'interior').length} |\n`;
}
md += '\n## Автоматические TODO по данным\n\n' + todos.map((t) => `- ${t}`).join('\n') + '\n';
fs.writeFileSync(path.join(ROOT, 'docs', 'stage1-report.md'), md);
console.log(`products: ${products.length}, discrepancies: ${discrepancies.length}, todos: ${todos.length}`);
