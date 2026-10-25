/* Browser test for rentals sections, the Effects tab and the department icons (2026-10-25).
   Serves the repo like Cloudflare on a local port, checks the section order follows public.sections.sort_order,
   moves one section to the top for a moment (put back at the end), and checks every tab has its icon.
   Run: node tools/test-rentals-sections.mjs */
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
const PORT = 8898, BASE = `http://127.0.0.1:${PORT}`;
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const py = (code) => execFileSync('python3', ['-c', `import sys,json;sys.path.insert(0,'${process.env.HOME}/bts-automation');import _rp_db\nc=_rp_db.connect();cur=c.cursor()\n` + code],
  { encoding: 'utf8' }).trim();
const server = spawn('node', ['tools/serve-like-cloudflare.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const want = JSON.parse(py(`cur.execute("select s.name from public.sections s where s.department='Electric' and exists (select 1 from public.items i where i.section_id=s.id and not i.hidden and not i.only_in_packages) order by s.sort_order, s.id"); print(json.dumps([r[0] for r in cur.fetchall()]))`));
const pb0 = py(`cur.execute("select sort_order from public.sections where department='Electric' and name='Power Banks'"); print(cur.fetchone()[0])`);
const browser = await chromium.launch();
const heads = async (page) => page.$$eval('#results .sub', xs => xs.map(x => x.textContent));
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const open = async () => {
    await page.goto(BASE + '/rentals/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof SEC_ORDER !== 'undefined' && Object.keys(SEC_ORDER).length > 0, null, { timeout: 15000 });
    await page.$eval('.tab[data-c="Electric"]', el => el.click()); await page.waitForTimeout(400);
  };
  await open();
  const h1 = await heads(page);
  ok(JSON.stringify(h1) === JSON.stringify(want), 'Electric sections in the database order: ' + h1.join(', '));
  py(`cur.execute("update public.sections set sort_order=-1 where department='Electric' and name='Power Banks'"); c.commit()`);
  await open();
  const h2 = await heads(page);
  ok(h2[0] === 'Power Banks', 'giving Power Banks the lowest order moves it to the top: ' + h2.join(', '));
  const icons = await page.$$eval('.tab', ts => ts.map(t => [t.dataset.c, (t.querySelector('svg path') || {}).getAttribute ? t.querySelector('svg path').getAttribute('d').length : 0]));
  ok(icons.every(([c, n]) => n > 10), 'every tab has an icon: ' + icons.map(x => x.join(':')).join(' '));
  await page.$eval('.tab[data-c="Effects"]', el => el.click()); await page.waitForTimeout(400);
  const fx = await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => /WOLFBOX/.test(x.textContent)); const img = c && c.querySelector('img'); return { card: !!c, img: img ? img.getAttribute('src') : null }; });
  ok(fx.card && /wolfbox_mf200_kit/.test(fx.img || ''), 'Effects shows the WolfBox with its photo: ' + fx.img);
  ok(!errs.length, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  await page.$eval('.tab[data-c="Electric"]', el => el.click()); await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/rp_site_tabs.png', clip: { x: 0, y: 0, width: 1360, height: 420 } });
} finally {
  await browser.close(); server.kill();
  py(`cur.execute("update public.sections set sort_order=%s where department='Electric' and name='Power Banks'", (${pb0},)); c.commit()`);
  console.log('put back');
}
console.log(fails.length ? 'FAILED: ' + fails.join(' ; ') : 'ALL PASS');
process.exit(fails.length ? 1 : 0);
