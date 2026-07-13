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
function makeEnv(flag, { coverMissing = false } = {}) {
  return {
    COLORLOOKS_PASSWORD: 's3cret',
    ASSETS: {
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        if (p === '/data/rentals.json') {
          if (flag === null) return new Response('not found', { status: 404 });
          if (flag === 'broken') return new Response('{ this is not json', { status: 200 });
          return new Response(JSON.stringify(flag), { status: 200 });
        }
        if (p === '/maintenance.html') {
          return coverMissing
            ? new Response('gone', { status: 404 })
            : new Response(COVER, { status: 200 });
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

// --- FAIL OPEN. None of these may take the rentals page down. ---
await expectPage('switch file MISSING     -> real page (fail open)', await call('/rentals', makeEnv(null)), 'real page');
await expectPage('switch file BROKEN json -> real page (fail open)', await call('/rentals', makeEnv('broken')), 'real page');
await expectPage('key absent entirely     -> real page (fail open)', await call('/rentals', makeEnv({})), 'real page');
await expectPage('key is null             -> real page (fail open)', await call('/rentals', makeEnv({ publicAccess: null })), 'real page');
await expectPage('cover page itself missing -> real page, not a blank', await call('/rentals', makeEnv(CLOSED, { coverMissing: true })), 'real page');

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
