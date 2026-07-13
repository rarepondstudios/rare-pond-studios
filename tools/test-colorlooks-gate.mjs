/* Tests for functions/_middleware.js - the password gate on /admin/*.
   Run: node tools/test-colorlooks-gate.mjs

   Two ways this gate can fail, and both are tested here:
     1. it lets an admin page out  (a leak)
     2. it locks a public page in  (an outage - would take the whole site down)
   The SENTINEL is the body next() would serve; if it ever appears in a 401 response,
   the page was sent before the password was checked and the gate is worthless. */
import { onRequest } from '../functions/_middleware.js';

const SENTINEL = '<html>SECRET ADMIN TOOL</html>';
const next = async () => new Response(SENTINEL, { status: 200, headers: { 'Content-Type': 'text/html' } });
const basic = (u, p) => 'Basic ' + Buffer.from(u + ':' + p).toString('base64');

const call = (path, headers = {}, env = { COLORLOOKS_PASSWORD: 's3cret' }) =>
  onRequest({ request: new Request('https://www.rarepond.com' + path, { headers }), env, next });

let fails = 0;
async function check(name, res, wantStatus, mustNotLeak = true) {
  const body = await res.clone().text();
  const leaked = mustNotLeak && body.includes('SECRET ADMIN TOOL');
  const ok = res.status === wantStatus && !leaked;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${res.status}${leaked ? '  *** LEAKED HTML ***' : ''}`);
}
async function serves(name, path) {
  const res = await call(path, { Authorization: basic('rarepond', 's3cret') });
  const body = await res.clone().text();
  const ok = res.status === 200 && body.includes('SECRET ADMIN TOOL');
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${res.status}`);
  return res;
}

// --- public pages must NOT be gated. Locking the site is the loudest way this breaks. ---
await check('/ (homepage) passes through', await call('/'), 200, false);
await check('/rentals/ passes through', await call('/rentals/'), 200, false);
await check('/data/colorlooks.json stays public', await call('/data/colorlooks.json'), 200, false);
await check('/projects stays public', await call('/projects'), 200, false);
await check('/geriaction stays public', await call('/geriaction'), 200, false);
await check('/submit-a-screenplay (custom page) stays public', await call('/submit-a-screenplay'), 200, false);
await check('/?p=submit-a-screenplay (legacy link) stays public', await call('/?p=submit-a-screenplay'), 200, false);
// A page whose name merely STARTS with "admin" is not an admin page.
await check('/administration is NOT gated', await call('/administration'), 200, false);
await check('/admin-notes is NOT gated', await call('/admin-notes'), 200, false);

// --- the gate itself ---
await check('/admin/colorlooks  no credentials', await call('/admin/colorlooks'), 401);
await check('/admin/colorlooks.html back door is gated', await call('/admin/colorlooks.html'), 401);
await check('/admin/pagesindex  no credentials', await call('/admin/pagesindex'), 401);
await check('/admin/pagesindex.html back door is gated', await call('/admin/pagesindex.html'), 401);
await check('/admin (the bare folder)', await call('/admin'), 401);
await check('/admin/ (trailing slash)', await call('/admin/'), 401);
await check('/ADMIN/CoLorLooks (case games)', await call('/ADMIN/CoLorLooks'), 401);

// The whole point of the prefix rule: a NEW admin page nobody listed anywhere is
// still locked on its first deploy. Under the old filename list it would have been public.
await check('a brand-new, unlisted /admin/ page is locked by default', await call('/admin/some-future-tool'), 401);

// --- wrong credentials ---
await check('wrong password', await call('/admin/colorlooks', { Authorization: basic('rarepond', 'wrong') }), 401);
await check('wrong username', await call('/admin/colorlooks', { Authorization: basic('nope', 's3cret') }), 401);
await check('empty password', await call('/admin/colorlooks', { Authorization: basic('rarepond', '') }), 401);
await check('garbage auth header', await call('/admin/colorlooks', { Authorization: 'Basic !!!!not-base64' }), 401);
await check('bearer token instead of basic', await call('/admin/colorlooks', { Authorization: 'Bearer s3cret' }), 401);
await check('secret not configured -> locked, not exposed', await call('/admin/colorlooks', {}, {}), 503);

// --- the happy path ---
const good = await serves('correct password serves /admin/colorlooks', '/admin/colorlooks');
await serves('correct password serves /admin/pagesindex', '/admin/pagesindex');
const nocache = (good.headers.get('Cache-Control') || '').includes('no-store');
console.log(`${nocache ? 'PASS' : 'FAIL'}  authed response is no-store`);
if (!nocache) fails++;
const noindex = (good.headers.get('X-Robots-Tag') || '').includes('noindex');
console.log(`${noindex ? 'PASS' : 'FAIL'}  authed response is noindex`);
if (!noindex) fails++;

// --- the OLD addresses must be gone (they now fall through to the SPA, not the tool) ---
await check('/colorlooks (old address) no longer serves the tool', await call('/colorlooks'), 200, false);
await check('/pagesindex (old address) no longer serves the tool', await call('/pagesindex'), 200, false);

console.log(fails === 0 ? '\nALL TESTS PASSED' : `\n${fails} TEST(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
