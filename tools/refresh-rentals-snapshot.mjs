/* Refresh the built-in rentals catalog (the `let RENTALS=[...]` at the top of rentals/assets/app.js) from the live
   database (2026-10-25). The page paints this list instantly, before the live catalog arrives from Supabase, so a stale
   list shows old gear or missing departments for a moment (Effects and Carts appeared a second late).
   It runs the page's own sbToRentals() on the live rows, so the list has exactly the shape the page builds live.
   Prints "changed" or "unchanged". Run: node tools/refresh-rentals-snapshot.mjs   (scheduled: bts-automation/rentals_snapshot_sync.py) */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'rentals/assets/app.js');
const PORT = 8899;
const server = spawn('node', [path.join(ROOT, 'tools/serve-like-cloudflare.mjs'), String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const browser = await chromium.launch();
let list;
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/rentals/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof sbToRentals === 'function' && typeof sbGet === 'function', null, { timeout: 20000 });
  list = await page.evaluate(async () => {
    const rows = await sbGet('items?select=*&order=sort_order.asc');
    const out = sbToRentals(rows) || [];
    return out.map(p => { const o = Object.assign({}, p); delete o._id; return o; });
  });
} finally { await browser.close(); server.kill(); }
if (!list || list.length < 10) { console.error('refusing: live catalog returned ' + (list ? list.length : 0) + ' items'); process.exit(2); }
const src = readFileSync(APP, 'utf8');
const head = 'let RENTALS=';
const i = src.indexOf(head);
if (i < 0) { console.error('no `let RENTALS=` in app.js'); process.exit(2); }
// find the end of the array literal: the first "];" after the head that parses as JSON
let j = src.indexOf('];', i), cur = null;
while (j > 0) { try { cur = JSON.parse(src.slice(i + head.length, j + 1)); break; } catch { j = src.indexOf('];', j + 1); } }
if (!cur) { console.error('could not read the current list'); process.exit(2); }
const next = JSON.stringify(list);
if (JSON.stringify(cur) === next) { console.log('unchanged (' + list.length + ' items)'); process.exit(0); }
writeFileSync(APP, src.slice(0, i + head.length) + next + src.slice(j + 1));
console.log('changed (' + cur.length + ' -> ' + list.length + ' items)');
