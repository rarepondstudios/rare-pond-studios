/* Pre-deploy validator for the film/project catalogue.
 *
 * WHY THIS EXISTS
 *   Adding a film is a data-only edit in Pages CMS (data/projects.json). That's great, but a
 *   few mistakes could still ship silently and render a broken card/page: a missing image
 *   field, a typo'd media path that 404s, a duplicate key, or a colorLook that points at a
 *   look that doesn't exist. This fails LOUDLY - with the exact film + field named - so a bad
 *   entry can never reach production. It's plain Node, no dependencies, and it's run by the
 *   smoke test before every deploy (and can be run on its own: `node tools/validate-projects.mjs`).
 *
 *   It is also the gate that keeps the SHARED catalogue clean once the same records feed
 *   jackcarlsen.com and the corporate site.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Must match the site's slug rule exactly (index.html: slugify).
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Fields that MUST be present on a real (non-placeholder) film, because their absence renders
// a visibly broken bubble / card / page.
const REQUIRED = ['key', 'title', 'bubbleImage', 'titleLogo', 'focusBg'];
// Every field that holds a media path we can verify exists on disk.
const PATH_FIELDS = ['bubbleImage', 'titleLogo', 'focusBg', 'focusVideo'];

export function validateProjects(root = ROOT) {
  const errors = [];
  const warnings = [];
  const add = (list, film, msg) => list.push(`[${film}] ${msg}`);

  let projData, looks;
  try {
    projData = JSON.parse(readFileSync(join(root, 'data/projects.json'), 'utf8'));
  } catch (e) { return { errors: ['Could not read/parse data/projects.json: ' + e.message], warnings }; }
  try {
    const cl = JSON.parse(readFileSync(join(root, 'data/colorlooks.json'), 'utf8'));
    looks = new Set((Array.isArray(cl) ? cl : (cl.looks || [])).map((l) => String(l.key || '').trim()));
  } catch (e) { looks = null; warnings.push('Could not read data/colorlooks.json - skipping colorLook checks: ' + e.message); }

  const projects = Array.isArray(projData) ? projData : (projData.projects || []);
  const seenKeys = new Map();
  const seenSlugs = new Map();

  projects.forEach((p, i) => {
    const label = p && p.key ? p.key : ('#' + (i + 1) + (p && p.title ? ' "' + p.title + '"' : ''));

    // key: always required + unique (colorLook wiring and, later, the shared DB depend on it).
    const key = String(p.key || '').trim();
    if (!key) add(errors, label, 'missing "key" (url-safe id, e.g. geri)');
    else {
      if (!/^[a-z0-9-]+$/.test(key)) add(errors, label, `key "${key}" must be lowercase letters/numbers/hyphens only`);
      if (seenKeys.has(key)) add(errors, label, `duplicate key "${key}" (also used by ${seenKeys.get(key)})`);
      else seenKeys.set(key, label);
    }

    // Placeholders ("More to come...") intentionally carry no film data - skip the rest for them.
    if (p.placeholder === true) return;

    // Required fields.
    for (const f of REQUIRED) {
      if (f === 'key') continue;
      if (!p[f] || !String(p[f]).trim()) add(errors, label, `missing required field "${f}"`);
    }

    // Slug uniqueness (only routable, non-placeholder films get slugs).
    const slug = slugify(p.title);
    if (slug) {
      if (seenSlugs.has(slug)) add(errors, label, `title "${p.title}" makes slug "${slug}", which collides with ${seenSlugs.get(slug)}`);
      else seenSlugs.set(slug, label);
    }

    // Media paths must resolve to real files in the repo.
    const checkPath = (val, where) => {
      if (!val) return;
      const rel = String(val).replace(/^\/+/, '');
      if (!existsSync(join(root, rel))) add(errors, label, `${where} points at a file that does not exist: ${val}`);
    };
    for (const f of PATH_FIELDS) checkPath(p[f], f);
    (Array.isArray(p.stills) ? p.stills : []).forEach((s, si) => checkPath(s, `stills[${si}]`));
    if (!Array.isArray(p.stills) || p.stills.length === 0) add(warnings, label, 'has no stills - the film page gallery will be empty');

    // colorLook must resolve to a real look (blank is fine - it falls back to signature).
    if (looks && p.colorLook && !looks.has(String(p.colorLook).trim())) {
      add(errors, label, `colorLook "${p.colorLook}" does not match any look in colorlooks.json`);
    }
  });

  return { errors, warnings };
}

// --- standalone runner ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings } = validateProjects();
  warnings.forEach((w) => console.log('  ⚠︎ ' + w));
  if (errors.length) {
    console.log('\n❌ PROJECT VALIDATION FAILED (' + errors.length + '):');
    errors.forEach((e) => console.log('  ✗ ' + e));
    process.exit(1);
  }
  console.log('✅ PROJECTS VALID' + (warnings.length ? ' (' + warnings.length + ' warning' + (warnings.length > 1 ? 's' : '') + ')' : ''));
  process.exit(0);
}
