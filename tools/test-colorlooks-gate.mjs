/* Throwaway test harness for _middleware.js - NOT part of the site.
   Run: node functions/test-gate.mjs   */
import { onRequest } from '../functions/_middleware.js';

const SENTINEL = '<html>SECRET COLOR TOOL</html>';
const next = async () => new Response(SENTINEL, { status: 200, headers: { 'Content-Type': 'text/html' } });
const basic = (u, p) => 'Basic ' + Buffer.from(u + ':' + p).toString('base64');

const call = (path, headers = {}, env = { COLORLOOKS_PASSWORD: 's3cret' }) =>
  onRequest({ request: new Request('https://www.rarepond.com' + path, { headers }), env, next });

let fails = 0;
async function check(name, res, wantStatus, mustNotLeak = true) {
  const body = await res.clone().text();
  const leaked = mustNotLeak && body.includes('SECRET COLOR TOOL');
  const ok = res.status === wantStatus && !leaked;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -> ${res.status}${leaked ? '  *** LEAKED HTML ***' : ''}`);
}

// Normal pages must be untouched.
await check('/ (homepage) passes through', await call('/'), 200, false);
await check('/rentals/ passes through', await call('/rentals/'), 200, false);
await check('/data/colorlooks.json stays public', await call('/data/colorlooks.json'), 200, false);

// The gate.
await check('/colorlooks.html  no credentials', await call('/colorlooks.html'), 401);
await check('/colorlooks       no credentials', await call('/colorlooks'), 401);
await check('wrong password', await call('/colorlooks.html', { Authorization: basic('rarepond', 'wrong') }), 401);
await check('wrong username', await call('/colorlooks.html', { Authorization: basic('nope', 's3cret') }), 401);
await check('empty password', await call('/colorlooks.html', { Authorization: basic('rarepond', '') }), 401);
await check('garbage auth header', await call('/colorlooks.html', { Authorization: 'Basic !!!!not-base64' }), 401);
await check('bearer token instead of basic', await call('/colorlooks.html', { Authorization: 'Bearer s3cret' }), 401);
await check('secret not configured -> locked', await call('/colorlooks.html', {}, {}), 503);

// The happy path.
const good = await call('/colorlooks.html', { Authorization: basic('rarepond', 's3cret') });
const goodBody = await good.clone().text();
const served = good.status === 200 && goodBody.includes('SECRET COLOR TOOL');
console.log(`${served ? 'PASS' : 'FAIL'}  correct password serves the page  -> ${good.status}`);
if (!served) fails++;
const nocache = (good.headers.get('Cache-Control') || '').includes('no-store');
console.log(`${nocache ? 'PASS' : 'FAIL'}  authed response is no-store`);
if (!nocache) fails++;

// --- the internal page directory must be gated too ---
await check('/pagesindex  no credentials', await call('/pagesindex'), 401);
await check('/pagesindex.html back-door is gated too', await call('/pagesindex.html'), 401);
await check('/pagesindex  wrong password', await call('/pagesindex', { Authorization: basic('rarepond','wrong') }), 401);
const goodPages = await call('/pagesindex', { Authorization: basic('rarepond', 's3cret') });
const gpBody = await goodPages.clone().text();
const gpOk = goodPages.status === 200 && gpBody.includes('SECRET COLOR TOOL');
console.log(`${gpOk ? 'PASS' : 'FAIL'}  /pagesindex correct password serves the page  -> ${goodPages.status}`);
if (!gpOk) fails++;

// --- the OLD name must not still serve the directory ---
await check('/pages (old name) is not the directory', await call('/pages'), 200, false);

// --- and PUBLIC pages must NOT be gated ---
await check('/projects stays public', await call('/projects'), 200, false);
await check('/geriaction stays public', await call('/geriaction'), 200, false);
await check('/?p=submit-a-screenplay stays public', await call('/?p=submit-a-screenplay'), 200, false);

console.log(fails === 0 ? '\nALL TESTS PASSED' : `\n${fails} TEST(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
