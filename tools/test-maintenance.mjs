/* Tests for the maintenance cover in functions/_middleware.js.
   Run: node tools/test-maintenance.mjs

   Two ways this can fail, and both are tested:
     1. it covers a page that should be OPEN   -> the rentals page is off the air
     2. it fails to cover a page that is CLOSED -> the thing you closed is still public
   (1) is the dangerous one, so the switch deliberately FAILS OPEN: anything unexpected
   (missing file, broken JSON, absent key) serves the real page. */
import { onRequest } from '../functions/_middleware.js';

const REAL_PAGE = '<html>THE REAL RENTALS PAGE</html>';
const COVER     = '<!doctype html>\n<html lang="en">\n<body>cover</body></html>';

const next = async () => new Response(REAL_PAGE, { status: 200, headers: { 'Content-Type': 'text/html' } });

/* A fake Pages ASSETS binding. `flag` is what /data/rentals.json will contain;
   pass null to simulate the file being missing. */
function makeEnv(flag, { coverMissing = false, dotHtmlRedirects = false,
                        team = { publicAccess: true },
                        projects = { publicAccess: true },
                        pages = { pages: [{ slug: 'summer-open-house', title: 'Summer Open House', publicAccess: true }] } } = {}) {
  return {
    COLORLOOKS_PASSWORD: 's3cret',
    ASSETS: {
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        if (p === '/data/team.json')     return new Response(JSON.stringify(team), { status: 200 });
        if (p === '/data/projects.json') return new Response(JSON.stringify(projects), { status: 200 });
        if (p === '/data/pages.json')    return new Response(JSON.stringify(pages), { status: 200 });
        if (p === '/data/rentals.json') {
          if (flag === null) return new Response('not found', { status: 404 });
          if (flag === 'broken') return new Response('{ this is not json', { status: 200 });
          return new Response(JSON.stringify(flag), { status: 200 });
        }
        /* PRODUCTION BEHAVIOUR: Cloudflare Pages answers /maintenance.html with a 308
           redirect to the clean /maintenance. A 308 is not `ok`, so asking for the .html
           spelling alone would fall through and the cover would silently never appear -
           while a naive test that served .html with a 200 kept passing. This models the
           real thing. */
        if (p === '/maintenance' || p === '/maintenance.html') {
          if (coverMissing) return new Response('gone', { status: 404 });
          if (dotHtmlRedirects && p === '/maintenance.html') {
            return new Response('', { status: 308, headers: { Location: '/maintenance' } });
          }
          return new Response(COVER, { status: 200 });
        }
        return new Response('nope', { status: 404 });
      },
    },
  };
}

const call = (path, env) =>
  onRequest({ request: new Request('https://www.rarepond.com' + path), env, next });

let fails = 0;
async function expectPage(name, res, want) {
  const body = await res.clone().text();
  const isCover = body.includes('cover') && !body.includes('THE REAL RENTALS PAGE');
  const isReal  = body.includes('THE REAL RENTALS PAGE');
  const got = isCover ? 'cover' : isReal ? 'real page' : 'something else';
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${got}`);
  return res;
}

const OPEN   = { publicAccess: true };
const CLOSED = { publicAccess: false };

// --- the switch does what it says ---
await expectPage('switch ON  -> /rentals serves the real page', await call('/rentals', makeEnv(OPEN)), 'real page');
await expectPage('switch OFF -> /rentals serves the cover',     await call('/rentals', makeEnv(CLOSED)), 'cover');
await expectPage('switch OFF -> /rentals/ (trailing slash) too', await call('/rentals/', makeEnv(CLOSED)), 'cover');
await expectPage('switch OFF -> a deep rentals URL too',         await call('/rentals/index.html', makeEnv(CLOSED)), 'cover');

// The real Cloudflare behaviour: .html 308-redirects to the clean URL. The cover must
// still be found. (Asking only for /maintenance.html would silently fail open here.)
await expectPage('cover still found when .html 308-redirects (real CF behaviour)',
  await call('/rentals', makeEnv(CLOSED, { dotHtmlRedirects: true })), 'cover');

// --- FAIL OPEN. None of these may take the rentals page down. ---
await expectPage('switch file MISSING     -> real page (fail open)', await call('/rentals', makeEnv(null)), 'real page');
await expectPage('switch file BROKEN json -> real page (fail open)', await call('/rentals', makeEnv('broken')), 'real page');
await expectPage('key absent entirely     -> real page (fail open)', await call('/rentals', makeEnv({})), 'real page');
await expectPage('key is null             -> real page (fail open)', await call('/rentals', makeEnv({ publicAccess: null })), 'real page');
await expectPage('cover page itself missing -> real page, not a blank', await call('/rentals', makeEnv(CLOSED, { coverMissing: true })), 'real page');

// --- the other three switches: Our Team, Projects, and each custom page ---
const OFF = { publicAccess: false };
await expectPage('Team switch ON  -> real page',  await call('/team', makeEnv(OPEN)), 'real page');
await expectPage('Team switch OFF -> cover',      await call('/team', makeEnv(OPEN, { team: OFF })), 'cover');
await expectPage('Projects ON  -> real page',     await call('/projects', makeEnv(OPEN)), 'real page');
await expectPage('Projects OFF -> cover',         await call('/projects', makeEnv(OPEN, { projects: OFF })), 'cover');

const PAGES_OFF = { pages: [
  { slug: 'summer-open-house', title: 'Summer Open House', publicAccess: false },
  { slug: 'other-page',        title: 'Other Page',        publicAccess: true  },
]};
await expectPage('custom page ON  -> real page',
  await call('/summer-open-house', makeEnv(OPEN)), 'real page');
await expectPage('custom page OFF -> cover',
  await call('/summer-open-house', makeEnv(OPEN, { pages: PAGES_OFF })), 'cover');
await expectPage('closing ONE custom page does not close the others',
  await call('/other-page', makeEnv(OPEN, { pages: PAGES_OFF })), 'real page');

// each switch is independent - closing Team must not close Projects or Rentals
await expectPage('Team OFF does not close Projects', await call('/projects', makeEnv(OPEN, { team: OFF })), 'real page');
await expectPage('Team OFF does not close Rentals',  await call('/rentals',  makeEnv(OPEN, { team: OFF })), 'real page');

// the cover must know the real NAME of what it covers, incl. a custom page's CMS title
const teamCover = await call('/team', makeEnv(OPEN, { team: OFF }));
const teamNamed = (await teamCover.clone().text()).includes('data-page-name="Our Team"');
console.log(`${teamNamed ? 'PASS' : 'FAIL'}  cover is told it is covering "Our Team"`);
if (!teamNamed) fails++;
const cpCover = await call('/summer-open-house', makeEnv(OPEN, { pages: PAGES_OFF }));
const cpNamed = (await cpCover.clone().text()).includes('data-page-name="Summer Open House"');
console.log(`${cpNamed ? 'PASS' : 'FAIL'}  cover is told the custom page's CMS title`);
if (!cpNamed) fails++;

// a CMS title with a quote in it must not break out of the HTML attribute
const XSS = { pages: [{ slug: 'x', title: 'Bob\'s "Big" <Day>', publicAccess: false }] };
const xssCover = await call('/x', makeEnv(OPEN, { pages: XSS }));
const xssBody = await xssCover.clone().text();
const escaped = xssBody.includes('&quot;') && !xssBody.includes('data-page-name="Bob\'s "Big"');
console.log(`${escaped ? 'PASS' : 'FAIL'}  a page title with quotes/angle brackets is escaped`);
if (!escaped) fails++;

// --- the cover must not leak onto anything else ---
await expectPage('/ (studio) is never covered',        await call('/', makeEnv(CLOSED)), 'real page');
await expectPage('/projects is never covered',         await call('/projects', makeEnv(CLOSED)), 'real page');
await expectPage('/rentalsomething is NOT a rentals URL', await call('/rentalsomething', makeEnv(CLOSED)), 'real page');

// --- the cover itself behaves like a real page to a visitor ---
const cov = await call('/rentals', makeEnv(CLOSED));
const okStatus = cov.status === 200;
console.log(`${okStatus ? 'PASS' : 'FAIL'}  cover returns 200, not an error  -> ${cov.status}`);
if (!okStatus) fails++;
const noStore = (cov.headers.get('Cache-Control') || '').includes('no-store');
console.log(`${noStore ? 'PASS' : 'FAIL'}  cover is no-store (so it cannot linger after you reopen the page)`);
if (!noStore) fails++;
const noIndex = (cov.headers.get('X-Robots-Tag') || '').includes('noindex');
console.log(`${noIndex ? 'PASS' : 'FAIL'}  cover is noindex (Google must not index "back soon")`);
if (!noIndex) fails++;
const stamped = (await cov.clone().text()).includes('data-covers="rentals"');
console.log(`${stamped ? 'PASS' : 'FAIL'}  cover is told WHICH page it covers (data-covers)`);
if (!stamped) fails++;

// --- the admin gate still works alongside all of this ---
const admin = await call('/admin/colorlooks', makeEnv(OPEN));
const gated = admin.status === 401;
console.log(`${gated ? 'PASS' : 'FAIL'}  /admin/ is still password-gated  -> ${admin.status}`);
if (!gated) fails++;

console.log(fails === 0 ? '\nALL TESTS PASSED' : `\n${fails} TEST(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
