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
const want = JSON.parse(py(`cur.execute("select s.name from public.sections s where s.department='Grip & Electric' and exists (select 1 from public.items i where i.section_id=s.id and not i.hidden and not i.only_in_packages) order by s.sort_order, s.id"); print(json.dumps([r[0] for r in cur.fetchall()]))`));
const pb0 = py(`cur.execute("select sort_order from public.sections where department='Grip & Electric' and name='Power Banks'"); print(cur.fetchone()[0])`);
const browser = await chromium.launch();
const heads = async (page) => page.$$eval('#results .sub:not(.rp-cartsub)', xs => xs.map(x => x.textContent));   // section headings only (the "Carts for ..." heading is not a section)
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const open = async () => {
    await page.goto(BASE + '/rentals/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof SEC_ORDER !== 'undefined' && Object.keys(SEC_ORDER).length > 0, null, { timeout: 15000 });
    await page.$eval('.tab[data-c="Grip & Electric"]', el => el.click()); await page.waitForTimeout(400);
  };
  // first paint, before the live catalog arrives: hold every Supabase call for 4 s
  const slow = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await slow.route(/supabase\.co/, async r => { await new Promise(x => setTimeout(x, 4000)); try { await r.continue(); } catch {} });
  await slow.goto(BASE + '/rentals/', { waitUntil: 'domcontentloaded' }); await slow.waitForTimeout(900);
  const early = await slow.evaluate(() => ({ tabs: [...document.querySelectorAll('.tab')].map(t => t.dataset.c), live: RP_LIVE }));
  ok(!early.live && ['Effects', 'Logistics', 'DIT'].every(c => early.tabs.includes(c)), 'every tab is there on first paint, before the live catalog: ' + early.tabs.join(','));
  await slow.$eval('.tab[data-c="Effects"]', el => el.click()); await slow.waitForTimeout(200);
  const earlyFx = await slow.evaluate(() => [...document.querySelectorAll('.card h3')].map(h => h.textContent));
  ok(earlyFx.some(n => /WOLFBOX/.test(n)), 'Effects already has its gear from the built-in list: ' + earlyFx.join(', '));
  await slow.close();
  await open();
  const h1 = await heads(page);
  ok(JSON.stringify(h1) === JSON.stringify(want), 'Grip & Electric sections in the database order: ' + h1.join(', '));
  py(`cur.execute("update public.sections set sort_order=-1 where department='Grip & Electric' and name='Power Banks'"); c.commit()`);
  await open();
  const h2 = await heads(page);
  ok(h2[0] === 'Power Banks', 'giving Power Banks the lowest order moves it to the top: ' + h2.join(', '));
  const icons = await page.$$eval('.tab', ts => ts.map(t => [t.dataset.c, (t.querySelector('svg path') || {}).getAttribute ? t.querySelector('svg path').getAttribute('d').length : 0]));
  ok(icons.every(([c, n]) => n > 10), 'every tab has an icon: ' + icons.map(x => x.join(':')).join(' '));
  await page.$eval('.tab[data-c="Effects"]', el => el.click()); await page.waitForTimeout(400);
  const fx = await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => /WOLFBOX/.test(x.textContent)); const img = c && c.querySelector('img'); return { card: !!c, img: img ? img.getAttribute('src') : null }; });
  ok(fx.card && /wolfbox_mf200_kit/.test(fx.img || ''), 'Effects shows the WolfBox with its photo: ' + fx.img);
  // photo standard: 16:9 frames, light blue behind, wide photos cropped, the rest shown whole
  await page.$eval('.tab[data-c="Lighting"]', el => el.click()); await page.waitForTimeout(600);
  const fr = await page.$$eval('.thumb', ts => ts.map(t => { const r = t.getBoundingClientRect(); return [r.width / r.height, getComputedStyle(t).backgroundColor]; }));
  ok(fr.length > 3 && fr.every(([a, bg]) => Math.abs(a - 16 / 9) < 0.03 && bg === 'rgb(238, 243, 250)'), 'every catalog photo frame is 16:9 on light blue: ' + fr.map(x => x[0].toFixed(2)).join(','));
  const fit = await page.evaluate(async () => {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').fillRect(0, 0, w, h); return c.toDataURL(); };
    const t = document.querySelector('.thumb'); const res = {};
    for (const [k, w, h] of [['wide', 2100, 900], ['square', 900, 900], ['exact', 1600, 900]]) {
      const i = new Image(); const done = new Promise(r => i.addEventListener('load', () => setTimeout(r, 50))); i.src = mk(w, h); t.appendChild(i); await done;
      res[k] = getComputedStyle(i).objectFit; i.remove();
    }
    return res;
  });
  ok(fit.wide === 'cover' && fit.square === 'contain' && fit.exact === 'contain', 'wider than 16:9 is cropped, square and 16:9 are shown whole: ' + JSON.stringify(fit));
  await page.$eval('.card[data-open]', el => el.click()); await page.waitForTimeout(700);
  const hero = await page.$eval('.dphero', h => { const r = h.getBoundingClientRect(); const i = h.querySelector('img'); const q = i.getBoundingClientRect();
    return { a: q.width / q.height, inside: q.top >= r.top - 1 && q.bottom <= r.bottom + 1 && q.left >= r.left - 1 && q.right <= r.right + 1, centred: Math.abs((q.left + q.right) / 2 - (r.left + r.right) / 2) < 2 }; });
  ok(Math.abs(hero.a - 16 / 9) < 0.03 && hero.inside && hero.centred, 'the item popup photo frame is 16:9, inside the popup and centred: ' + JSON.stringify(hero));
  const cardImg = await page.$$eval('.thumb img', is => is.every(i => { const a = i.getBoundingClientRect(), b = i.parentElement.getBoundingClientRect(); return Math.abs(a.height - b.height) < 1; }));
  ok(cardImg, 'every card photo sits inside its frame');
  const minis = await page.$$eval('.rp-mcard img, .kc img', is => is.map(i => (i.getBoundingClientRect().width / i.getBoundingClientRect().height).toFixed(2)));
  ok(minis.every(a => Math.abs(a - 16 / 9) < 0.05), 'small photos in the popup are 16:9 too: ' + (minis.join(',') || 'none'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok(!errs.length, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  await page.$eval('.tab[data-c="Grip & Electric"]', el => el.click()); await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/rp_site_tabs.png', clip: { x: 0, y: 0, width: 1360, height: 420 } });
  // every popup fits the window (item, Build your own, dates, request), on a laptop, a short screen and a phone
  for (const [w, h] of [[1280, 720], [1366, 600], [390, 844]]) {
    const q = await browser.newPage({ viewport: { width: w, height: h } });
    await q.goto(BASE + '/rentals/', { waitUntil: 'networkidle' });
    await q.waitForFunction(() => typeof RP_LIVE !== 'undefined' && RP_LIVE, null, { timeout: 20000 });
    const fits = async (sel) => q.evaluate(s => { const e = document.querySelector(s); if (!e) return 'missing'; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 ? 'ok' : Math.round(r.height) + '>' + innerHeight; }, sel);
    const shut = async () => { await q.evaluate(() => { document.querySelectorAll('.show').forEach(e => e.classList.remove('show')); document.body.style.overflow = ''; }); await q.waitForTimeout(150); };
    const r = {};
    await q.$eval('.tab[data-c="Lighting"]', el => el.click()); await q.waitForTimeout(300);
    await q.$eval('.card[data-open]', el => el.click()); await q.waitForTimeout(500); r.item = await fits('.dpc');
    r.photo = await q.$eval('.dphero img', i => { const a = i.getBoundingClientRect(); return Math.abs(a.width / a.height - 16 / 9) < 0.03 ? 'ok' : (a.width / a.height).toFixed(2); }).catch(() => 'no photo');
    await shut();
    await q.$eval('.tab[data-c="Grip & Electric"]', el => el.click()); await q.waitForTimeout(300);
    await q.$eval('[data-builder]', el => el.click()); await q.waitForTimeout(500); r.builder = await fits('.dpc');
    r.done = await q.$eval('#crateDone', b => { const a = b.getBoundingClientRect(); return a.bottom <= innerHeight ? 'ok' : 'off screen'; });
    await shut();
    await q.evaluate(() => openDates()); await q.waitForTimeout(400); r.dates = await fits('.dpop .box'); await shut();
    await q.evaluate(() => openReq()); await q.waitForTimeout(400); r.request = await fits('.reqbox'); await shut();
    ok(Object.values(r).every(v => v === 'ok'), 'every popup fits a ' + w + 'x' + h + ' window: ' + JSON.stringify(r));
    await q.close();
  }
} finally {
  await browser.close(); server.kill();
  py(`cur.execute("update public.sections set sort_order=%s where department='Grip & Electric' and name='Power Banks'", (${pb0},)); c.commit()`);
  console.log('put back');
}
console.log(fails.length ? 'FAILED: ' + fails.join(' ; ') : 'ALL PASS');
process.exit(fails.length ? 1 : 0);
