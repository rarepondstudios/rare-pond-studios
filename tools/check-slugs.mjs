/* Custom-page slug guard.
 *
 * THE PROBLEM
 *   Custom pages live at /<slug>, sharing the root namespace with film slugs and the
 *   built-in views. index.html resolves  reserved -> film -> custom page,  so a custom
 *   page whose slug is already taken is simply never reachable. Nothing errors. You just
 *   get the film instead, and the page you wrote is invisible.
 *
 * THE FIX
 *   Two layers, both driven by the LIVE data so neither can go stale:
 *
 *   1. This script computes the reserved set from projects.json + the router's built-ins,
 *      and fails if any custom page collides. It runs with the tests.
 *
 *   2. `--write` bakes that same set into the slug field's regex in .pages.yml, so Pages
 *      CMS refuses to SAVE a colliding slug in the first place.
 *
 *   The trap with (2) alone is staleness: add a film, and the regex silently no longer
 *   knows about it. So this script also checks that the regex in .pages.yml MATCHES the
 *   live films, and fails if it does not. Forgetting to regenerate is therefore a loud
 *   test failure, not a silent hole.
 *
 * Run:  node tools/check-slugs.mjs          (check - used by the tests)
 *       node tools/check-slugs.mjs --write  (regenerate the regex in .pages.yml)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = f => JSON.parse(readFileSync(ROOT + f, 'utf8'));

/* Built-in addresses the router answers itself, plus real folders that are served as
   files. Keep in step with RESERVED in index.html. */
const BUILT_IN = ['team', 'projects', 'rentals', 'admin', 'data', 'assets', 'media', 'functions', 'tools'];

/* The router's slug rule for films, copied verbatim from index.html. */
const slugify = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const projects = read('data/projects.json').projects || [];
const pages    = read('data/pages.json').pages || [];

const filmSlugs = projects.filter(p => !p.placeholder).map(p => p.slug || slugify(p.title));
const reserved  = [...new Set([...BUILT_IN, ...filmSlugs])].sort();

/* The regex Pages CMS uses to reject a slug at save time. */
const pattern = '^(?!(?:' + reserved.join('|') + ')$)[a-z0-9]+(?:-[a-z0-9]+)*$';

let fails = 0;
const fail = m => { console.log('FAIL  ' + m); fails++; };
const pass = m => console.log('PASS  ' + m);

if (process.argv.includes('--write')) {
  const f = ROOT + '.pages.yml';
  const before = readFileSync(f, 'utf8');
  const after = before.replace(/(\n\s+pattern:\s*)(?:'[^']*'|"[^"]*")/, `$1'${pattern}'`);
  if (before === after) { console.log('Could not find a pattern: line to update in .pages.yml'); process.exit(1); }
  writeFileSync(f, after);
  console.log('.pages.yml slug pattern regenerated from live data:\n  ' + pattern);
  process.exit(0);
}

console.log('reserved (generated from live data): ' + reserved.join(', ') + '\n');

/* 1. no custom page may collide */
for (const p of pages) {
  const s = String(p.slug || '').trim();
  if (!s) { fail(`a custom page ("${p.title || '?'}") has no slug`); continue; }
  if (reserved.includes(s)) fail(`custom page "${p.title || s}" uses the slug "${s}", which is already taken -> it can never open`);
  else pass(`custom page "${s}" is reachable`);
}
if (!pages.length) pass('no custom pages to check');

/* 2. duplicate custom-page slugs shadow each other too */
const seen = new Set();
for (const p of pages) {
  const s = String(p.slug || '').trim();
  if (seen.has(s)) fail(`two custom pages both use the slug "${s}"`);
  seen.add(s);
}

/* 3. the CMS regex must still match the live films - this is the staleness check */
const yml = readFileSync(ROOT + '.pages.yml', 'utf8');
const m = yml.match(/\n\s+pattern:\s*(?:'([^']*)'|"([^"]*)")/);
if (!m) fail('.pages.yml has no slug pattern - Pages CMS will happily save a colliding slug');
else if ((m[1] || m[2]) !== pattern)
  fail('the slug pattern in .pages.yml is STALE (a film was probably added or renamed).\n'
     + '      Run:  node tools/check-slugs.mjs --write\n'
     + '      have: ' + (m[1] || m[2]) + '\n      want: ' + pattern);
else pass('the Pages CMS slug rule is in step with the live films');

console.log(fails === 0 ? '\nSLUGS OK' : `\n${fails} SLUG PROBLEM(S)`);
process.exit(fails === 0 ? 0 : 1);
