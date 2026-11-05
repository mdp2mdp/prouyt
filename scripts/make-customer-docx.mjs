// Converts ВОПРОСЫ_ЗАКАЗЧИКУ.md into an editable Word file (A4).
// Usage: node scripts/make-customer-docx.mjs [source.md] [output.docx]
import fs from 'node:fs';
import { marked } from 'marked';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ExternalHyperlink, HeadingLevel,
  AlignmentType, WidthType, ShadingType, BorderStyle, LevelFormat, Footer, PageNumber, TableLayoutType,
} from 'docx';

const SRC = process.argv[2] ?? 'ВОПРОСЫ_ЗАКАЗЧИКУ.md';
const OUT = process.argv[3] ?? SRC.endsWith('.md') ? SRC.slice(0, -3) + '.docx' : SRC + '.docx';
const GREEN = '182A1E';
const SAND = 'F2E9CD';
const GREY = '5F675F';
const LINE = 'CFC6BB';
const FONT = 'Calibri';

const PAGE_W = 11906; // A4 in DXA
const MARGIN = 1000;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Inline tokens → runs */
function runs(tokens, base = {}) {
  const out = [];
  for (const t of tokens ?? []) {
    if (t.type === 'strong') out.push(...runs(t.tokens, { ...base, bold: true }));
    else if (t.type === 'em') out.push(...runs(t.tokens, { ...base, italics: true }));
    else if (t.type === 'codespan') out.push(new TextRun({ text: decode(t.text), font: 'Consolas', ...base }));
    else if (t.type === 'br') out.push(new TextRun({ break: 1 }));
    else if (t.type === 'link') out.push(new ExternalHyperlink({ link: t.href, children: runs(t.tokens, { ...base, color: '1F5F8B', underline: {} }) }));
    else if (t.type === 'text' && t.tokens) out.push(...runs(t.tokens, base));
    else if (t.type === 'escape' || t.type === 'text') out.push(new TextRun({ text: decode(t.text ?? t.raw), ...base }));
  }
  return out;
}

const para = (tokens, opts = {}) => new Paragraph({ spacing: { after: 100, line: 276 }, ...opts, children: runs(tokens, opts.run) });

/** Column widths: fixed for "№" and "Ваш ответ", the rest proportional to text length */
function widths(table) {
  const n = table.header.length;
  const fixed = table.header.map((h) => (h.text.trim() === '№' ? 700 : /^Ваш ответ/.test(h.text) ? 1900 : 0));
  const weight = Array.from({ length: n }, (_, c) => {
    if (fixed[c]) return 0;
    const lens = [table.header[c], ...table.rows.map((r) => r[c])].map((cell) => cell.text.length);
    const longest = Math.max(...lens);
    const avg = lens.reduce((x, y) => x + y, 0) / lens.length;
    return Math.min(46, Math.max(8, 0.6 * avg + 0.4 * longest));
  });
  const rest = CONTENT_W - fixed.reduce((x, y) => x + y, 0);
  const sum = weight.reduce((x, y) => x + y, 0) || 1;
  // a column must fit its longest single word (about 105 DXA per character at 9.5 pt)
  const minW = Array.from({ length: n }, (_, c) => {
    if (fixed[c]) return fixed[c];
    const words = [table.header[c], ...table.rows.map((r) => r[c])].flatMap((cell) => cell.text.replace(/[*_]/g, '').split(/s+/));
    return Math.min(2600, Math.max(...words.map((x) => x.length)) * 105 + 220);
  });
  let w = weight.map((x, i) => fixed[i] || Math.floor((x / sum) * rest));
  for (let pass = 0; pass < 4; pass++) {
    const low = w.map((x, i) => x < minW[i]);
    if (!low.some(Boolean)) break;
    const deficit = w.reduce((a, x, i) => a + (low[i] ? minW[i] - x : 0), 0);
    const donors = w.map((x, i) => !low[i] && !fixed[i] ? x : 0);
    const donorSum = donors.reduce((a, b) => a + b, 0) || 1;
    w = w.map((x, i) => (low[i] ? minW[i] : fixed[i] ? x : Math.floor(x - (donors[i] / donorSum) * deficit)));
  }
  w[w.length - 1] += CONTENT_W - w.reduce((x, y) => x + y, 0);
  return w;
}

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

function buildTable(tk) {
  const w = widths(tk);
  const answerCol = tk.header.findIndex((h) => /^Ваш ответ/.test(h.text));
  const mkCell = (cell, i, head) =>
    new TableCell({
      width: { size: w[i], type: WidthType.DXA },
      borders,
      margins: { top: 70, bottom: 70, left: 100, right: 100 },
      shading: head ? { fill: SAND, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      children: [new Paragraph({ spacing: { after: 0, line: 252 }, children: runs(cell.tokens, { size: 19, bold: head || undefined, color: head ? GREEN : undefined }) })],
    });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: w,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: tk.header.map((c, i) => mkCell(c, i, true)) }),
      ...tk.rows.map((r) => new TableRow({
        cantSplit: true,
        height: answerCol >= 0 ? { value: 620, rule: 'atLeast' } : undefined,
        children: r.map((c, i) => mkCell(c, i, false)),
      })),
    ],
  });
}

function listItems(list, level = 0) {
  const items = [];
  for (const it of list.items) {
    const inline = it.tokens.filter((t) => t.type === 'text' || t.type === 'paragraph');
    const first = inline[0];
    items.push(new Paragraph({
      numbering: { reference: 'bullets', level },
      spacing: { after: 60, line: 276 },
      children: runs(first?.tokens ?? [{ type: 'text', text: it.text }]),
    }));
    for (const sub of it.tokens.filter((t) => t.type === 'list')) items.push(...listItems(sub, level + 1));
  }
  return items;
}

const children = [];
let firstH1 = true;
for (const t of marked.lexer(fs.readFileSync(SRC, 'utf8'))) {
  if (t.type === 'space') continue;
  if (t.type === 'heading') {
    const level = t.depth === 1 ? HeadingLevel.HEADING_1 : t.depth === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
    children.push(new Paragraph({ heading: level, keepNext: true, children: runs(t.tokens) }));
    firstH1 = false;
  } else if (t.type === 'paragraph') {
    const isAnswer = /^\*\*(Ваш ответ|Берём)/.test(t.raw);
    children.push(para(t.tokens, isAnswer ? { spacing: { before: 60, after: 220 }, run: { color: GREY } } : {}));
  } else if (t.type === 'list') children.push(...listItems(t));
  else if (t.type === 'table') {
    children.push(buildTable(t));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  } else if (t.type === 'hr') {
    children.push(new Paragraph({ spacing: { before: 120, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 1 } }, children: [] }));
  }
}

const doc = new Document({
  creator: 'ПРОУЮТ',
  title: 'Сайт «ПРОУЮТ»: вопросы к вам и предложения',
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: '2B312D' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 40, bold: true, color: GREEN, font: FONT }, paragraph: { spacing: { before: 0, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 29, bold: true, color: GREEN, font: FONT }, paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 1, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: SAND, space: 3 } } } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, color: GREEN, font: FONT }, paragraph: { spacing: { before: 260, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [
    { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
    { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
  ] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1000, bottom: 1000, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 16, color: '777777' })] })] }) },
    children,
  }],
});

fs.writeFileSync(OUT, await Packer.toBuffer(doc));
console.log('written', OUT);
