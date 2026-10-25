// QR resolver test (2026-10-25): runs functions/g/[id].js as rarepond.com/g/<code> in headless Chromium on the mini
// (on the tailnet). Cloudflare Access is simulated: --signed-in answers scan.rarepond.com/healthz "ok" with CORS (a phone
// with an Access session), otherwise it redirects to the sign-in like Access does. --block-ts = a Private Relay phone.
// Usage: node tools/test-g-resolver.mjs [--block-ts] [--signed-in] [--expect tailnet|access|found]
import { chromium } from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../functions/g/[id].js', import.meta.url), 'utf8').replace('export async function', 'async function');
const onRequest = new Function(src + '; return onRequest;')();
const A = process.argv; const blockTs = A.includes('--block-ts'), signed = A.includes('--signed-in');
const expect = A.includes('--expect') ? A[A.indexOf('--expect') + 1] : (blockTs ? (signed ? 'access' : 'found') : 'tailnet');
const b = await chromium.launch(); const ctx = await b.newContext(); let ok = true;
await ctx.route('https://rarepond.com/g/**', async r => {
  const res = await onRequest({ params: { id: r.request().url().split('/g/')[1] } });
  await r.fulfill({ status: 200, contentType: 'text/html', body: await res.text() });
});
await ctx.route('https://rarepond.com/found', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'found page' }));
await ctx.route(/scan\.rarepond\.com\/healthz/, r => signed
  ? r.fulfill({ status: 200, contentType: 'text/plain', body: 'ok', headers: { 'Access-Control-Allow-Origin': 'https://rarepond.com', 'Access-Control-Allow-Credentials': 'true' } })
  : r.fulfill({ status: 302, headers: { Location: 'https://rarepond.cloudflareaccess.com/cdn-cgi/access/login' } }));
await ctx.route(/rarepond\.cloudflareaccess\.com/, r => r.fulfill({ status: 200, contentType: 'text/html', body: 'sign in' }));
await ctx.route(/scan\.rarepond\.com\/(i|u|find)/, r => r.fulfill({ status: 200, contentType: 'text/html', body: 'scan app via Access' }));
if (blockTs) await ctx.route(/pond\.tail8c2778\.ts\.net/, r => r.abort());
for (const [code, path] of [['2102-A', '/u/2102-A'], ['2100', '/i/2100'], ['2100.001-B', '/find?code=2100.001-B']]) {
  const p = await ctx.newPage(); await p.goto('https://rarepond.com/g/' + code);
  await p.waitForURL(u => !u.toString().includes('/g/'), { timeout: 8000 }).catch(() => {});
  const u = p.url();
  const pass = expect === 'found' ? u.endsWith('/found') : expect === 'access' ? u === 'https://scan.rarepond.com' + path
             : u.startsWith('https://pond.tail8c2778.ts.net:8444/') && !u.includes('/found');
  console.log((pass ? 'PASS ' : 'FAIL ') + '[' + expect + '] ' + code + ' -> ' + u); ok = ok && pass; await p.close();
}
await b.close(); process.exit(ok ? 0 : 1);
