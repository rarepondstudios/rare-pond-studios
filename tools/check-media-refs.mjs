#!/usr/bin/env node
/* check-media-refs.mjs: verify every /media/... path referenced in data/*.json exists on disk.
   WHY: the SPA rewrite in _redirects serves index.html with HTTP 200 for ANY missing file,
   so a broken media reference is invisible to status-code checks (the <img> just fails to
   decode). This catches the whole class at the source. Run:  node tools/check-media-refs.mjs
   Exit 0 = clean, exit 1 = missing refs listed on stdout. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const refs = new Map(); // path -> first data file that references it

const walk = (v, src) => {
  if (typeof v === 'string') {
    for (const m of v.matchAll(/\/media\/[A-Za-z0-9_\-./]+/g)) {
      const p = m[0].replace(/[.,)]+$/, '').split('?')[0];
      if (/\.[a-z0-9]{2,5}$/i.test(p) && !refs.has(p)) refs.set(p, src);
    }
  } else if (Array.isArray(v)) v.forEach(x => walk(x, src));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, src));
};

for (const f of readdirSync(join(root, 'data')).filter(f => f.endsWith('.json'))) {
  try { walk(JSON.parse(readFileSync(join(root, 'data', f), 'utf8')), 'data/' + f); }
  catch (e) { console.log(`PARSE FAIL data/${f}: ${e.message}`); process.exitCode = 1; }
}

let missing = 0;
for (const [p, src] of [...refs.entries()].sort()) {
  if (!existsSync(join(root, p))) { console.log(`MISSING ${p}   (referenced in ${src})`); missing++; }
}
console.log(`${refs.size} media refs checked, ${missing} missing`);
if (missing) process.exitCode = 1;

/* deploy-cap gate, chained: one committed file over 25 MiB fails the WHOLE Cloudflare
   Pages deploy while the site keeps serving the previous build (froze jackcarlsen.com
   for a day on 2026-08-09, HANDOFF 0.0.-37D). Running it here means the habitual
   pre-deploy command covers it on both repos; it also runs standalone. */
const sz = spawnSync(process.execPath, [join(root, 'tools', 'check-asset-sizes.mjs')], { stdio: 'inherit' });
if (sz.status) process.exitCode = 1;
