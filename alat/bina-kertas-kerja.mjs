// Tukar alat/kertas-kerja.html → aset/kertas-kerja.pdf + aset/kertas-kerja.json (kedudukan ruang isian)
// Jalankan semula selepas ubah kandungan kertas kerja:  node alat/bina-kertas-kerja.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
await p.goto('file://' + path.join(ROOT, 'alat/kertas-kerja.html'));
await p.evaluate(() => document.fonts.ready);
const PX = 0.75; // 1px CSS = 0.75pt
const stamps = await p.evaluate(() => {
  const pages = [...document.querySelectorAll('.page')];
  return [...document.querySelectorAll('[data-stamp]')].map(el => {
    const pg = el.closest('.page'), pr = pg.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { key: el.dataset.stamp, page: pages.indexOf(pg), x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height };
  });
});
const out = {};
for (const s of stamps) out[s.key] = { page: s.page, x: +(s.x * PX).toFixed(2), top: +(s.y * PX).toFixed(2), w: +(s.w * PX).toFixed(2), h: +(s.h * PX).toFixed(2) };
await p.pdf({ path: path.join(ROOT, 'aset/kertas-kerja.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
fs.writeFileSync(path.join(ROOT, 'aset/kertas-kerja.json'), JSON.stringify(out, null, 2));
await b.close();
console.log('aset/kertas-kerja.pdf & kertas-kerja.json dikemas kini', out);
