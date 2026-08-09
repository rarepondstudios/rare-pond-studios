/* check-page-switches.mjs - the guarantee, enforced.
   Run: node tools/check-page-switches.mjs

   SHARED MASTER: bts-automation/check_page_switches.mjs, published to both repos by
   social_ui_sync.py. Edit the master.

   Jack's rule is that EVERY front-facing page has its own switch, at the top of its own screen.
   That layout is nicer to use than one central list, and its one weakness is that a page added
   later can quietly get a screen and no switch, which nobody discovers until the day they need to
   close it in a hurry. This turns that into a failing test instead:

     1. every data file declaring a `route` also has a `publicAccess` switch
     2. every one of those routes appears in the generated data/page-index.json
     3. the index has no rows pointing at files that no longer declare that route
     4. every declared route is exposed in .pages.yml, so the switch is reachable in the CMS

   (3) is the one that matters after a rename: an index row left pointing at an old file would
   send the engine to read a switch that no longer exists, and absent reads as OPEN, so a closed
   page would silently reopen. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

let fails = 0;
const bad = (m) => { console.log('FAIL  ' + m); fails++; };
const ok = (m) => console.log('PASS  ' + m);

const declared = [];
for (const fn of fs.readdirSync(DATA).sort()) {
  if (!fn.endsWith('.json') || fn === 'page-index.json') continue;
  let d;
  try { d = read(path.join(DATA, fn)); } catch { continue; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || !d.route) continue;
  declared.push({ file: '/data/' + fn, route: String(d.route), hasSwitch: 'publicAccess' in d,
                  name: d.pageName || '' });
}

if (!declared.length) bad('no data file declares a route, so no page has a switch');
else ok(`${declared.length} page(s) declare a route: ${declared.map((d) => d.route).join(', ')}`);

/* 1. a route with no switch */
for (const d of declared) {
  if (!d.hasSwitch) bad(`${d.file} declares route ${d.route} but has NO publicAccess switch`);
}
if (declared.every((d) => d.hasSwitch)) ok('every page that declares a route carries its own switch');

/* 2 + 3. the generated index agrees with the data, in both directions */
let index;
try { index = read(path.join(DATA, 'page-index.json')); } catch { index = null; }
const rows = (index && index.pages) || [];
if (!rows.length) bad('data/page-index.json is missing or empty. Run page_index_sync.py');
else {
  const byRoute = new Map(rows.map((r) => [r.route, r]));
  for (const d of declared) {
    const r = byRoute.get(d.route);
    if (!r) bad(`${d.route} is not in page-index.json. Run page_index_sync.py`);
    else if (r.file !== d.file) bad(`page-index.json sends ${d.route} to ${r.file}, but the route is declared in ${d.file}`);
  }
  const declaredRoutes = new Set(declared.map((d) => d.route));
  for (const r of rows) {
    if (!declaredRoutes.has(r.route)) {
      bad(`page-index.json still lists ${r.route} -> ${r.file}, which no longer declares it. A stale row reads as OPEN, so a closed page would silently reopen`);
    }
  }
  if (!fails) ok('page-index.json matches the data files in both directions');
}

/* 4. the switch is actually reachable in the CMS */
const yml = fs.readFileSync(path.join(ROOT, '.pages.yml'), 'utf8');
const cmsFiles = new Set([...yml.matchAll(/^\s*path:\s*(\S+)\s*$/gm)].map((m) => '/' + m[1]));
for (const d of declared) {
  if (!cmsFiles.has(d.file)) bad(`${d.file} has a switch but no Pages CMS screen edits it, so nobody can flip it`);
}
if (declared.every((d) => cmsFiles.has(d.file))) ok('every page switch is reachable from a Pages CMS screen');

console.log(fails ? `\n${fails} PROBLEM(S)` : '\nPAGE SWITCHES OK');
process.exit(fails ? 1 : 0);
