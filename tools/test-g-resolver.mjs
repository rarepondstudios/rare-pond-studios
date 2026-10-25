// QR resolver test (2026-10-25): runs functions/g/[id].js as rarepond.com/g/<code> in headless Chromium on the mini
// (which is on the tailnet) and checks where it lands. Usage: node tools/test-g-resolver.mjs [--block-ts] [--block-scan]
//   --block-ts    pretend pond.tail8c2778.ts.net is unreachable (what a Private Relay phone sees)
//   --block-scan  pretend scan.rarepond.com is unreachable
import { chromium } from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../functions/g/[id].js', import.meta.url), 'utf8').replace('export async function', 'async function');
const onRequest = new Function(src + '; return onRequest;')();
const block = { ts: process.argv.includes('--block-ts'), scan: process.argv.includes('--block-scan') };
// the mini's own plain DNS is intercepted on its network; phones resolve scan.rarepond.com publicly
const b = await chromium.launch({ args: ['--host-resolver-rules=MAP scan.rarepond.com 100.75.94.127'] });
const ctx = await b.newContext(); let ok = true;
await ctx.route('https://rarepond.com/g/**', async r => {
  const id = r.request().url().split('/g/')[1];
  const res = await onRequest({ params: { id } });
  await r.fulfill({ status: 200, contentType: 'text/html', body: await res.text() });
});
await ctx.route('https://rarepond.com/found', r => r.fulfill({ status: 200, contentType: 'text/html', body: 'found page' }));
if (block.ts) await ctx.route(/pond\.tail8c2778\.ts\.net/, r => r.abort());
if (block.scan) await ctx.route(/scan\.rarepond\.com/, r => r.abort());
for (const [code, want] of [['2102-A', '/u/2102-A'], ['2100', '/i/2100'], ['2100.001-B', '/i/2100']]) {
  const p = await ctx.newPage();
  await p.goto('https://rarepond.com/g/' + code);
  await p.waitForURL(u => !u.toString().includes('/g/'), { timeout: 8000 }).catch(() => {});
  const u = p.url(); const pass = want === 'found' ? u.endsWith('/found') : u.endsWith(want) && !u.includes('rarepond.com/found');
  console.log((pass ? 'PASS ' : 'FAIL ') + code + ' -> ' + u); ok = ok && pass; await p.close();
}
await b.close(); process.exit(ok ? 0 : 1);
