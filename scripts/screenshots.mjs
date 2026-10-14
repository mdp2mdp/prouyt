// Full-page screenshots at the widths from the brief.
// Usage: node scripts/screenshots.mjs <outDir> [path=/prouyt/] [base=http://localhost:4321]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
const pagePath = process.env.PAGE_PATH || process.argv[3] || '/prouyt/';
const origin = process.argv[4] || 'http://localhost:4321';
const widths = (process.env.WIDTHS || '360,390,768,1024,1440').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(origin + pagePath, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    // trigger lazy images
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const file = path.join(out, `${pagePath.replace(/\W+/g, '_')}-${w}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(w, 'overflow-x:', overflow, file);
  await ctx.close();
}
await browser.close();
