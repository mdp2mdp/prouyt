// Builds web images from _source into public/img: WebP + AVIF in several widths,
// never upscaling. Quality-first settings (see QUALITY below).
// Reads scripts/generated/photo-map.json (written by `npm run data`).
// Run: npm run images [-- --force]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, '_source');
const PHOTOS = path.join(SRC, 'проуют диваны фото');
const OUT = path.join(ROOT, 'public', 'img');
const FORCE = process.argv.includes('--force');

const WIDTHS = [480, 960, 1600, 2400];
const QUALITY = { webp: 86, avif: 62 };

sharp.cache(false);
sharp.concurrency(2);

const manifest = {};
let written = 0;
let skipped = 0;

/** Widths to produce for a source of width w: standard steps below w, plus w itself when it adds detail. */
function widthsFor(w) {
  const list = WIDTHS.filter((x) => x < w);
  const top = list.length ? list[list.length - 1] : 0;
  if (w <= WIDTHS[WIDTHS.length - 1] && w - top >= 160) list.push(w);
  else if (!list.length) list.push(w);
  return list;
}

async function emit(input, dir, name, { avif = true } = {}) {
  const meta = await sharp(input).rotate().metadata();
  const w = meta.autoOrient?.width ?? meta.width;
  const h = meta.autoOrient?.height ?? meta.height;
  const widths = widthsFor(w);
  fs.mkdirSync(dir, { recursive: true });
  const srcTime = fs.statSync(input).mtimeMs;
  for (const width of widths) {
    for (const fmt of avif ? ['webp', 'avif'] : ['webp']) {
      const file = path.join(dir, `${name}-${width}.${fmt}`);
      if (!FORCE && fs.existsSync(file) && fs.statSync(file).mtimeMs > srcTime) { skipped++; continue; }
      let img = sharp(input).rotate().toColorspace('srgb').resize({ width, withoutEnlargement: true, kernel: 'lanczos3' });
      img = fmt === 'webp'
        ? img.webp({ quality: QUALITY.webp, effort: 5, smartSubsample: true })
        : img.avif({ quality: QUALITY.avif, effort: 4, chromaSubsampling: '4:4:4' });
      await img.toFile(file);
      written++;
    }
  }
  return { w, h, widths };
}

/* ---- retouching: remove the smudge left by a removed watermark (source 'оскар/оскар угол студ.png').
   Each column inside the region is re-interpolated between the clean rows above and below it. */
const RETOUCH = {
  'оскар/оскар угол студ.png': { x0: 0.24, x1: 0.83, y0: 0.058, y1: 0.285, feather: 0.03 },
};
async function retouch(src, r) {
  const outFile = path.join(SRC, 'retouched', src.replaceAll('/', '__'));
  const inFile = path.join(PHOTOS, src);
  if (!FORCE && fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs > fs.statSync(inFile).mtimeMs) return outFile;
  const { data, info } = await sharp(inFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const X0 = Math.round(r.x0 * W), X1 = Math.round(r.x1 * W), Y0 = Math.round(r.y0 * H), Y1 = Math.round(r.y1 * H);
  const F = Math.round(r.feather * W), band = 6;
  const avg = (x, yc, c) => { let t = 0; for (let k = -band; k <= band; k++) for (let d = -2; d <= 2; d++) t += data[((yc + k) * W + Math.min(W - 1, Math.max(0, x + d))) * C + c]; return t / ((2 * band + 1) * 5); };
  const out = Buffer.from(data);
  for (let x = X0; x < X1; x++) {
    const edge = Math.min(1, (x - X0) / F, (X1 - x) / F);
    for (let c = 0; c < C; c++) {
      const top = avg(x, Y0 - band - 2, c), bot = avg(x, Y1 + band + 2, c);
      for (let y = Y0; y < Y1; y++) {
        const t = (y - Y0) / (Y1 - Y0);
        const v = top + (bot - top) * t + (Math.random() - 0.5) * 1.6; // tiny grain so the patch does not look flat
        const i = (y * W + x) * C + c;
        out[i] = Math.round(data[i] * (1 - edge) + v * edge);
      }
    }
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await sharp(out, { raw: { width: W, height: H, channels: C } }).png().toFile(outFile);
  return outFile;
}

/* ---- catalog photos */
const photoMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'generated', 'photo-map.json'), 'utf8'));
for (const [slug, list] of Object.entries(photoMap)) {
  for (const p of list) {
    const input = RETOUCH[p.src] ? await retouch(p.src, RETOUCH[p.src]) : path.join(PHOTOS, p.src);
    const info = await emit(input, path.join(OUT, slug), p.id);
    manifest[`${slug}/${p.id}`] = info;
  }
  process.stdout.write(`${slug} `);
}
console.log();

/* ---- hero */
const heroSrc = path.join(PHOTOS, 'фото для главной страницы сайта.PNG');
manifest['hero/hero'] = await emit(heroSrc, path.join(OUT, 'hero'), 'hero');
// social preview 1200x630
const og = path.join(OUT, 'og.jpg');
if (FORCE || !fs.existsSync(og))
  await sharp(heroSrc).resize(1200, 630, { fit: 'cover', position: 'attention', kernel: 'lanczos3' }).jpeg({ quality: 88, mozjpeg: true }).toFile(og);

/* ---- logos: crop the square canvas down to the artwork, recolour to beige / dark green, plus a favicon from the sofa glyph */
const logoSrc = path.join(SRC, 'проуют лого прозрачный.png');
const { data: rgba, info: li } = await sharp(logoSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const bbox = (x0, y0, x1, y1) => {
  let minX = x1, minY = y1, maxX = x0, maxY = y0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (rgba[(y * li.width + x) * 4 + 3] > 24) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};
const recolor = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) { out[i] = r; out[i + 1] = g; out[i + 2] = b; }
  return sharp(out, { raw: { width: li.width, height: li.height, channels: 4 } });
};
const pad = 16;
const full = bbox(0, 0, li.width, li.height);
const box = { left: full.left - pad, top: full.top - pad, width: full.width + pad * 2, height: full.height + pad * 2 };
const logoDir = path.join(OUT, 'brand');
fs.mkdirSync(logoDir, { recursive: true });
for (const [name, hex] of [['beige', '#F2E9CD'], ['green', '#182A1E']])
  for (const w of [320, 640])
    await recolor(hex).extract(box).resize({ width: w, kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(path.join(logoDir, `logo-${name}-${w}.png`));
manifest.logo = { w: box.width, h: box.height, ratio: +(box.width / box.height).toFixed(4) };

// favicon: the sofa glyph occupies the top of the artwork (above the wordmark row)
const glyphBottom = full.top + Math.round(full.height * 0.34);
const gb = bbox(0, 0, li.width, glyphBottom);
const glyphPng = await recolor('#F2E9CD').extract(gb).png().toBuffer();
const icon = async (size) => {
  const inner = Math.round(size * 0.64);
  const g = await sharp(glyphPng).resize({ width: inner, fit: 'inside', kernel: 'lanczos3' }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: '#182A1E' } }).composite([{ input: g, gravity: 'center' }]).png({ compressionLevel: 9 });
};
for (const s of [32, 192, 512]) await (await icon(s)).toFile(path.join(OUT, `icon-${s}.png`));
await (await icon(180)).toFile(path.join(OUT, 'apple-touch-icon.png'));

fs.writeFileSync(path.join(ROOT, 'src', 'data', 'image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

let total = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : (total += fs.statSync(path.join(d, e.name)).size); })(OUT);
console.log(`written ${written}, skipped ${skipped}, public/img = ${(total / 1048576).toFixed(1)} MB`);
