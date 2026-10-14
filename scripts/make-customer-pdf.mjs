// Renders ВОПРОСЫ_ЗАКАЗЧИКУ.md to a printable PDF (A4) using the Chromium that Playwright installed.
// Usage: node scripts/make-customer-pdf.mjs
import fs from 'node:fs';
import { marked } from 'marked';
import { chromium } from 'playwright';

const md = fs.readFileSync('ВОПРОСЫ_ЗАКАЗЧИКУ.md', 'utf8');
const body = marked.parse(md);
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 16mm 14mm; }
body { font: 10.5pt/1.5 'Segoe UI', Arial, sans-serif; color: #2b312d; }
h1 { font-size: 20pt; color: #182A1E; margin: 0 0 6pt; }
h2 { font-size: 14pt; color: #182A1E; margin: 20pt 0 6pt; padding-bottom: 3pt; border-bottom: 1.5pt solid #F2E9CD; break-after: avoid; }
h3 { font-size: 11.5pt; color: #182A1E; margin: 14pt 0 4pt; break-after: avoid; }
p, li { margin: 4pt 0; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9pt; break-inside: auto; }
tr { break-inside: avoid; }
th, td { border: 0.6pt solid #cfc6bb; padding: 4pt 5pt; text-align: left; vertical-align: top; }
th { background: #f2e9cd; color: #182A1E; }
hr { border: 0; border-top: 0.6pt solid #cfc6bb; margin: 14pt 0; }
a { color: #182A1E; }
ul { padding-left: 16pt; }
</style></head><body>${body}</body></html>`;
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html, { waitUntil: 'load' });
if (process.env.PREVIEW) { await p.setViewportSize({ width: 794, height: 1123 }); await p.screenshot({ path: process.env.PREVIEW, fullPage: true }); }
await p.pdf({ path: 'ВОПРОСЫ_ЗАКАЗЧИКУ.pdf', format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#777"><span class="pageNumber"></span> / <span class="totalPages"></span></div>', margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
await b.close();
console.log('ok');
