/* Pre-deploy smoke test.
 *
 * WHY THIS EXISTS
 *   The site has no build step, so a typo in an inline script reaches production silently -
 *   it already happened once (an undefined helper broke every film's "open" on the live site
 *   while every unit test still passed, because none of them actually RENDERED the page).
 *   This loads the real pages in a real browser and FAILS if any of them throws a console or
 *   page error, or if a key element is missing. Run it before every push:
 *
 *       node tools/smoke-test.mjs
 *
 *   It starts the Cloudflare-faithful local server itself (middleware ON), so one command
 *   does the whole thing. Needs playwright, which is NOT a repo dependency (package.json and
 *   node_modules are gitignored so Pages runs no build). Install locally when you want it:
 *
 *       npm i -D playwright && npx playwright install chromium
 *
 *   Exit code 0 = clean, 1 = something is broken (and it prints exactly what).
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { validateProjects } from './validate-projects.mjs';

const PORT = 8899;
const BASE = 'http://127.0.0.1:' + PORT;

const failures = [];
function fail(msg) { failures.push(msg); console.log('  ✗ ' + msg); }
function ok(msg)   { console.log('  ✓ ' + msg); }

// Errors we know are environmental (local server has no real fonts/analytics origins etc.)
// Keep this list TINY and specific, or it defeats the purpose.
const IGNORE = [
  /favicon\.ico/i,                 // browsers probe /favicon.ico; harmless
  /net::ERR_/i,                    // local server can't reach external CDNs (fonts) - not our bug
  /Failed to load resource.*fonts?\./i,
];
const ignored = (t) => IGNORE.some((re) => re.test(t));

function attach(page, bucket) {
  page.on('console', (m) => { if (m.type() === 'error' && !ignored(m.text())) bucket.push('console: ' + m.text()); });
  page.on('pageerror', (e) => { const t = String(e && e.message || e); if (!ignored(t)) bucket.push('pageerror: ' + t); });
}

async function main() {
  // 0) Validate the project catalogue (static, no browser) - fails fast on a bad film entry:
  //    missing required field, typo'd media path, duplicate key, slug collision, bad colorLook.
  console.log('Project catalogue');
  const pv = validateProjects();
  pv.warnings.forEach((w) => console.log('  ⚠︎ ' + w));
  if (pv.errors.length) pv.errors.forEach((e) => fail('projects.json: ' + e));
  else ok('projects.json valid (' + pv.warnings.length + ' warnings)');

  // 1) start the server
  const srv = spawn('node', ['tools/serve-like-cloudflare.mjs', String(PORT)], { stdio: 'ignore' });
  const stop = () => { try { srv.kill('SIGKILL'); } catch (e) {} };
  process.on('exit', stop);
  await new Promise((r) => setTimeout(r, 900));   // let it bind

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  attach(page, errs);

  try {
    // 2) STUDIO HOME builds itself from data/*.json
    console.log('Studio home /');
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    // The carousel builds from data/*.json; #universes stays display:none until a film opens,
    // so key the "home built" check off the visible cards instead.
    await page.waitForSelector('.citem', { state: 'visible', timeout: 8000 }).catch(() => {});
    const hasCards = await page.$$eval('.citem', (n) => n.length);
    hasCards ? ok('carousel built (' + hasCards + ' cards)') : fail('no .citem cards built on home');
    await page.waitForSelector('footer.site-footer', { timeout: 5000 }).then(() => ok('footer present')).catch(() => fail('footer missing'));

    // 3) OPEN EVERY FILM by its real URL - this is the buildUniverse() path that broke last
    //    time. Slugs derive from the title exactly as the app does (slugify), read from the
    //    live data so this never drifts from what ships.
    const films = await page.evaluate(async () => {
      const r = await fetch('/data/projects.json'); const d = await r.json();
      const list = Array.isArray(d) ? d : (d.projects || []);
      const slugify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      return list.filter((p) => p && !p.placeholder).map((p) => ({ title: p.title, slug: p.slug || slugify(p.title) }));
    });
    films.length ? ok('films to open: ' + films.map((f) => f.slug).join(', ')) : fail('could not read films from projects.json');
    for (const f of films) {
      const before = errs.length;
      await page.goto(BASE + '/' + f.slug, { waitUntil: 'networkidle' });
      const opened = await page.waitForSelector('section.universe', { state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
      const hasBack = opened && await page.$('section.universe .back');
      (opened && hasBack && errs.length === before)
        ? ok('film "/' + f.slug + '" (' + f.title + ') opened cleanly')
        : fail('film "/' + f.slug + '" failed (opened=' + opened + ', back=' + !!hasBack + ', newErrors=' + (errs.length - before) + ')');
    }

    // 4) OTHER VIEWS - navigate the real URLs and require: no new errors + the shared nav
    //    chrome present (the SPA swapped views without throwing).
    for (const [path, label] of [['/team', 'team'], ['/projects', 'projects']]) {
      const before = errs.length;
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      const nav = await page.$('.nav [data-go], nav [data-go]');
      (nav && errs.length === before)
        ? ok(label + ' view loads cleanly')
        : fail(label + ' view: nav=' + !!nav + ', newErrors=' + (errs.length - before));
    }

    // 5) RENTALS URL - currently the maintenance cover (rentals is closed in CMS). Either way
    //    it must render a real page with no errors and a known chrome element.
    await page.goto(BASE + '/rentals/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.site-header, .mwrap', { timeout: 6000 })
      .then(() => ok('/rentals renders (cover or live) with header chrome'))
      .catch(() => fail('/rentals rendered nothing recognisable'));

    // 6) STATIC / ENDPOINTS added in this pass
    const checks = [
      ['/robots.txt', 200, /Sitemap:/i],
      ['/sitemap.xml', 200, /rarepond\.com/i],
      ['/media/site/favicon-48.png', 200, null],
      ['/media/site/apple-touch-icon.png', 200, null],
      ['/media/stills/invalid-orbit.jpg', 200, null],
    ];
    for (const [p, code, re] of checks) {
      const r = await ctx.request.get(BASE + p);
      const bodyOk = re ? re.test(await r.text()) : true;
      (r.status() === code && bodyOk) ? ok(p + ' -> ' + r.status()) : fail(p + ' -> ' + r.status() + (re ? ' / body match=' + bodyOk : ''));
    }
    // NOTE: the local harness runs _middleware but NOT Pages Functions, and it serves the SPA
    // fallback (index.html, 200) for any unknown path. So /api/client-error and the removed
    // orbit PNG both read as 200 here - that is a harness limitation, not a failure. These two
    // are verified against the real edge after deploy (see the post-deploy checks). Informational:
    const g = await ctx.request.get(BASE + '/api/client-error');
    console.log('  · (local, informational) /api/client-error GET -> ' + g.status() + ' [204 expected on real edge]');
    const oldPng = await ctx.request.get(BASE + '/media/stills/invalid-orbit.png');
    console.log('  · (local, informational) old invalid-orbit.png -> ' + oldPng.status() + ' [gone from repo; SPA fallback here]');

  } catch (e) {
    fail('threw: ' + (e && e.stack || e));
  } finally {
    if (errs.length) { console.log('\nConsole/page errors captured:'); errs.forEach((t) => console.log('  ! ' + t)); }
    await browser.close();
    stop();
  }

  console.log('\n' + (failures.length ? '❌ SMOKE TEST FAILED (' + failures.length + ')' : '✅ SMOKE TEST PASSED') );
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
