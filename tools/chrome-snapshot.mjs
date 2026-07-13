/* Snapshot the RENDERED styles of the shared header/footer chrome on every page that has it.
 *
 * The point: the social icons and the footer are duplicated across the studio, rentals and
 * the maintenance cover. Consolidating them into one stylesheet is a refactor, and the only
 * honest way to do a refactor is to prove the output did not change. So:
 *
 *     node tools/chrome-snapshot.mjs before
 *     ...do the refactor...
 *     node tools/chrome-snapshot.mjs after
 *     node tools/chrome-snapshot.mjs diff
 *
 * `diff` fails loudly if any computed value moved. Needs the local server on :8899, and
 * playwright, which is NOT a dependency of this repo (there is deliberately no package.json -
 * Cloudflare Pages would see one and start running a build for a site that has none). Install
 * it locally when you want to run this:
 *
 *     npm i -D playwright && npx playwright install chromium
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const MODE = process.argv[2];
const BASE = 'http://127.0.0.1:8899';

/* The properties that actually decide how this stuff LOOKS. Everything else is noise. */
const PROPS = ['display','width','height','margin','padding','color','background-color','background-image',
  'border-radius','border','font-size','font-weight','font-family','gap','justify-content','align-items',
  'text-align','opacity','box-shadow','filter','fill','flex-wrap','z-index','position','text-decoration',
  'letter-spacing','line-height','mask-image','-webkit-mask-image','transform','margin-top','margin-bottom'];

/* page -> the chrome elements on it. Selectors differ per page today; that is the whole point. */
const PAGES = {
  studio:  { url: '/',        sels: ['.socials', '.socials a', '.socials svg',
                                     'footer.site-footer', 'footer .footer-logo img', 'footer .tag',
                                     'footer .fsoc', 'footer .fsoc a', 'footer .fsoc svg',
                                     'footer .flinks', 'footer .flinks a', 'footer .copy', 'footer .copy a',
                                     '.deepwater'] },
  rentals: { url: '/rentals/', sels: ['.hsoc', '.hsoc a', '.hsoc svg',
                                      '.rfoot', '.rfoot .footer-logo img', '.rfoot .tag',
                                      '.rfoot .fsoc', '.rfoot .fsoc a', '.rfoot .fsoc svg',
                                      '.rfoot .flinks', '.rfoot .flinks a', '.rfoot .copy', '.rfoot .copy a',
                                      '.rfoot .caustics'] },
  cover:   { url: '/team',    sels: ['#mSocials', '#mSocials a', '#mSocials svg',
                                     'footer.site-footer', '.footer-logo img', 'footer .tag',
                                     'footer .fsoc', 'footer .fsoc a', 'footer .fsoc svg',
                                     'footer .flinks', 'footer .flinks a', 'footer .copy', 'footer .copy a',
                                     '.deepwater'] },
};

async function snap() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const out = {};
  for (const [name, cfg] of Object.entries(PAGES)) {
    await page.goto(BASE + cfg.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);                       // let the JS-built chrome settle
    out[name] = await page.evaluate(({ sels, props }) => {
      const r = {};
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) { r[sel] = 'MISSING'; continue; }
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs.getPropertyValue(p);
        r[sel] = o;
      }
      /* the icons themselves: count + which networks, so a lost icon set is caught */
      r['__socialNets'] = [...document.querySelectorAll('[data-net]')].map(a => a.getAttribute('data-net'));
      r['__svgCount']   = document.querySelectorAll('[data-net] svg').length;
      return r;
    }, { sels: cfg.sels, props: PROPS });
  }
  await browser.close();
  return out;
}

if (MODE === 'diff') {
  const a = JSON.parse(readFileSync('/tmp/chrome-before.json', 'utf8'));
  const b = JSON.parse(readFileSync('/tmp/chrome-after.json', 'utf8'));
  let diffs = 0;
  for (const page of Object.keys(a)) {
    for (const sel of Object.keys(a[page])) {
      const x = a[page][sel], y = b[page][sel];
      if (JSON.stringify(x) === JSON.stringify(y)) continue;
      if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) {
        console.log(`DIFF  ${page}  ${sel}\n      before: ${JSON.stringify(x)}\n      after:  ${JSON.stringify(y)}`);
        diffs++; continue;
      }
      for (const p of Object.keys(x)) {
        if (x[p] !== y[p]) {
          console.log(`DIFF  ${page}  ${sel}  {${p}}\n      before: ${x[p]}\n      after:  ${y[p]}`);
          diffs++;
        }
      }
    }
  }
  console.log(diffs === 0
    ? '\nIDENTICAL - the refactor changed nothing visible on any of the three pages.'
    : `\n${diffs} DIFFERENCE(S) - the refactor changed the rendering. Fix before shipping.`);
  process.exit(diffs === 0 ? 0 : 1);
} else {
  const file = MODE === 'after' ? '/tmp/chrome-after.json' : '/tmp/chrome-before.json';
  const data = await snap();
  writeFileSync(file, JSON.stringify(data, null, 2));
  const missing = [];
  for (const [pg, r] of Object.entries(data))
    for (const [sel, v] of Object.entries(r)) if (v === 'MISSING') missing.push(`${pg} ${sel}`);
  console.log('wrote ' + file);
  console.log('  social networks found:', Object.entries(data).map(([k, v]) => k + '=' + v.__socialNets.length).join('  '));
  console.log('  svg icons rendered:   ', Object.entries(data).map(([k, v]) => k + '=' + v.__svgCount).join('  '));
  if (missing.length) console.log('  MISSING selectors:', missing.join(', '));
}
