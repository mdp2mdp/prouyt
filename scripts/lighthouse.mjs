// Mobile Lighthouse run for key pages. Usage: node scripts/lighthouse.mjs [origin]
// Uses the Chromium installed by Playwright.
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import fs from 'node:fs';

const origin = (process.argv[2] || 'https://mdp2mdp.github.io/prouyt').replace(/\/$/, '');
const pages = ['/', '/catalog/', '/catalog/straight/', '/catalog/straight/trio/', '/catalog/corner/oskar-p/', '/catalog/modular/estetik/', '/catalog/armchairs/komfort/'];
// Chromium from Playwright, started with a remote debugging port that Lighthouse connects to
const PORT = 9333;
const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
const rows = [];
for (const p of pages) {
  const res = await lighthouse(origin + p, { port: PORT, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], formFactor: 'mobile', screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }, throttlingMethod: 'simulate' });
  const c = res.lhr.categories, a = res.lhr.audits;
  const row = { page: p, perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100), lcp: a['largest-contentful-paint'].displayValue, cls: a['cumulative-layout-shift'].displayValue, tbt: a['total-blocking-time'].displayValue };
  const failed = Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'manual').map((x) => `${x.id}(${x.score})`);
  row.issues = failed;
  rows.push(row);
  fs.writeFileSync(`docs/lighthouse/${p.replace(/\W+/g, '_') || 'home'}.json`, JSON.stringify({ ...row }, null, 1));
  console.log(JSON.stringify(row));
}
await browser.close();
fs.writeFileSync('docs/lighthouse/summary.json', JSON.stringify(rows, null, 1));
