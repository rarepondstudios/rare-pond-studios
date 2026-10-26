/* Browser test for rentals packages, build-your-own, carts and pending bookings (2026-10-25).
   Serves the repo like Cloudflare on a local port, seeds throwaway rows in Supabase (far-future dates, no email,
   no HubSpot deal) through python + _rp_db on the mini, drives the page with Playwright, then removes the rows.
   Run: node tools/test-rentals-packages.mjs        (needs playwright, like tools/smoke-test.mjs) */
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
const PORT = 8897, BASE = `http://127.0.0.1:${PORT}`;
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const py = (code) => execFileSync('python3', ['-c', `import sys,json;sys.path.insert(0,'${process.env.HOME}/bts-automation');import _rp_db\nc=_rp_db.connect();cur=c.cursor()\n` + code],
  { encoding: 'utf8' }).trim();

const server = spawn('node', ['tools/serve-like-cloudflare.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
// seed: a pending order on the STORM kit, a confirmed order on both half apple boxes, a curated two-department package
const seed = JSON.parse(py(`
cur.execute("select public.rp_today()+60, public.rp_today()+61"); s,e=cur.fetchone()
def iid(c):
    cur.execute("select id from public.items where item_id_new=%s",(c,)); return cur.fetchone()[0]
cur.execute("insert into public.orders(deal_name,client_name,stage,starts_on,ends_on,source,requested_items) values ('SITE TEST PENDING','Site Test','draft',%s,%s,'test',jsonb_build_array(jsonb_build_object('item_id',%s::bigint,'qty',1))) returning id",(s,e,iid('2100'))); o1=cur.fetchone()[0]
cur.execute("insert into public.orders(deal_name,client_name,stage,starts_on,ends_on,source,requested_items) values ('SITE TEST CONFIRMED','Site Test','confirmed',%s,%s,'test',jsonb_build_array(jsonb_build_object('item_id',%s::bigint,'qty',2))) returning id",(s,e,iid('3101'))); o2=cur.fetchone()[0]
cur.execute("insert into public.packages(name,departments,hidden,description) values ('Site Test Package','Lighting,Grip & Electric',false,'test') returning id"); p=cur.fetchone()[0]
cur.execute("insert into public.package_lines(package_id,item_id,qty) values (%s,%s,1),(%s,%s,2)",(p,iid('2103'),p,iid('3117')))
c.commit()
cur.execute("select price_per_day from public.packages where id=%s",(p,)); pr=float(cur.fetchone()[0])
print(json.dumps({"s":str(s),"e":str(e),"o":[o1,o2],"p":p,"price":pr}))`));
console.log('seeded', seed);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + '/rentals/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof BUILDERS !== 'undefined' && BUILDERS.length > 0, null, { timeout: 15000 });
  const tap = (sel) => page.$eval(sel, el => el.click());     // clicks through the cookie banner (it is not what is under test)
  ok(true, 'live catalog + packages loaded');
  const tabs = await page.$$eval('.tab', ts => ts.map(t => t.dataset.c));
  ok(tabs.includes('Logistics'), 'Logistics tab exists: ' + tabs.join(','));
  // Grip: builder card first, clamps not listed alone, carts at the bottom, the two-department package in its box
  await tap('.tab[data-c="Grip & Electric"]'); await page.waitForTimeout(400);
  const grip = await page.evaluate(() => ({
    first: document.querySelector('#results > *')?.className || '', feat: document.querySelector('[data-builder] h3')?.textContent,
    cards: [...document.querySelectorAll('.card h3')].map(h => h.textContent),
    cartsub: document.querySelector('.rp-cartsub')?.textContent || '', pkgbox: !!document.querySelector('#rppkgbox') }));
  ok(grip.first.includes('rpcrate-feat') && /Grip Crate/.test(grip.feat || ''), 'Grip opens with the build-your-own card: ' + grip.feat);
  ok(!grip.cards.some(n => /Duckbill|Matthellini|Track Wedge|KUPO/.test(n)), 'crate-only gear is not listed on its own');
  ok(/Carts for Grip & Electric/.test(grip.cartsub) && grip.cards.includes('Folding Hand Truck'), 'the hand truck sits under "Carts for Grip & Electric"');
  ok(grip.pkgbox && grip.cards.includes('Site Test Package'), 'a two-department package shows in Grip');
  await tap('.tab[data-c="Lighting"]'); await page.waitForTimeout(300);
  const lightCards = await page.$$eval('.card h3', hs => hs.map(h => h.textContent));
  ok(lightCards.includes('Site Test Package') && lightCards.includes('Folding Hand Truck'), 'it shows in Lighting too, with the cart');
  // builder popup: layered art, KUPO finger, glow grows
  await tap('.tab[data-c="Grip & Electric"]'); await page.waitForTimeout(300);
  await tap('[data-builder]'); await page.waitForTimeout(400);
  const b1 = await page.evaluate(() => ({ back: document.querySelector('#rpbArt .rpb-back')?.getAttribute('src'), front: document.querySelector('#rpbArt .rpb-front')?.getAttribute('src'),
    loaded: [...document.querySelectorAll('#rpbArt img')].every(i => i.complete && i.naturalWidth > 0), g: getComputedStyle(document.getElementById('rpbArt')).getPropertyValue('--g'),
    rows: [...document.querySelectorAll('.rpcrate-rn')].map(x => x.textContent) }));
  ok(/grip-crate-back/.test(b1.back || '') && /grip-crate-front/.test(b1.front || '') && b1.loaded, 'layered crate art loads (back + front)');
  ok(b1.rows.some(n => /KUPO/.test(n)) && b1.rows.length === 11, 'the 11 crate items incl. the KUPO finger: ' + b1.rows.length);
  await tap('[data-crq-a]'); await page.waitForTimeout(150); await tap('[data-crq-a]'); await page.waitForTimeout(150);
  const g2 = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('rpbArt')).getPropertyValue('--g')));
  ok(g2 > parseFloat(b1.g || '0'), 'the glow grows as items go in (' + b1.g + ' -> ' + g2 + ')');
  ok(/2 items/.test(await page.textContent('#rpbCount')), 'the count reads 2 items');
  await tap('#crateDone'); await page.waitForTimeout(200);
  // the package into the cart, then the order payload
  await page.evaluate(() => { var i = RENTALS.findIndex(p => p.name === 'Site Test Package'); addCart(i); var a = RENTALS.findIndex(p => p.name === 'Full Apple Box'); addCart(a); });
  const pay = await page.evaluate(() => { var d = reqSubmitData(); return d[RCFG.fields.orderData] || ''; });
  ok(new RegExp('k' + seed.p + ':1').test(pay) && /\|i:.*b\d+\.\d+:1/.test(pay) && /i:.*\b1202:1/.test(pay), 'payload has the package (k), crate picks (b) and plain gear: ' + pay);
  const cartTxt = await page.textContent('#pit');
  ok(/Build Your Own Grip Crate/.test(cartTxt) && /Site Test Package/.test(cartTxt), 'cart lists the crate block and the package');
  const pkgPrice = await page.evaluate(() => RENTALS.find(p => p.name === 'Site Test Package').fn);
  ok(Math.abs(pkgPrice - seed.price) < 0.01, 'package price on the site = its NocoDB day rate ' + pkgPrice);
  // apple box popup recommends the cart
  await page.evaluate(() => { openDP(RENTALS.findIndex(p => p.name === 'Full Apple Box')); }); await page.waitForTimeout(200);
  ok(/Recommended cart/.test(await page.textContent('#dp')) && /Folding Hand Truck/.test(await page.textContent('#dp')), 'Full Apple Box recommends the hand truck');
  await page.evaluate(() => closeDP());
  // pending vs confirmed for the seeded dates
  await page.evaluate(([s, e]) => { window.RPDates.set(s, e); }, [seed.s, seed.e]); await page.waitForTimeout(2500);
  await tap('.tab[data-c="Lighting"]'); await page.waitForTimeout(800);
  const storm = await page.evaluate(() => { var h = [...document.querySelectorAll('.card h3')].find(x => /STORM 80c/.test(x.textContent)); var c = h && h.closest('.card');
    return c ? { pend: c.classList.contains('rp-pend'), shown: c.style.display !== 'none', banner: c.querySelector('.rp-availbanner')?.textContent, btn: c.querySelector('button.add')?.textContent } : null; });
  ok(storm && storm.pend && storm.shown && /pending/i.test(storm.banner) && /Reserved/.test(storm.btn || ''), 'pending STORM: greyed, "Reserved", still listed: ' + JSON.stringify(storm));
  await page.evaluate(() => { openDP(RENTALS.findIndex(p => /STORM 80c/.test(p.name))); }); await page.waitForTimeout(600);
  const msg = await page.evaluate(() => { var m = document.querySelector('#dp .rp-pendmsg'); return m ? { t: m.textContent, a: !!m.querySelector('a[data-contact]') } : null; });
  ok(msg && /not confirmed yet/.test(msg.t) && msg.a, 'its popup explains and links the contact form');
  await page.evaluate(() => closeDP());
  await tap('.tab[data-c="Grip & Electric"]'); await page.waitForTimeout(800);
  const half = await page.evaluate(() => { var h = [...document.querySelectorAll('.card h3')].find(x => x.textContent === 'Half Apple Box'); var c = h && h.closest('.card'); return c ? c.style.display : 'missing'; });
  ok(half === 'none', 'confirmed Half Apple Boxes are not shown for those dates (' + half + ')');
  const full = await page.evaluate(() => { var h = [...document.querySelectorAll('.card h3')].find(x => x.textContent === 'Full Apple Box'); var c = h && h.closest('.card'); return c ? c.style.display : 'missing'; });
  ok(full === '', 'other gear still shown normally');
  ok(!errs.length, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  await page.screenshot({ path: '/tmp/rp_site_grip.png' });
  await tap('[data-builder]'); await page.waitForTimeout(500); await page.screenshot({ path: '/tmp/rp_site_builder.png' });
} finally {
  await browser.close(); server.kill();
  py(`cur.execute("delete from public.orders where id = any(%s)",(${JSON.stringify(seed.o)},))
cur.execute("delete from public.packages where id=%s",(${seed.p},))
c.commit()`);
  console.log('cleaned up');
}
console.log(fails.length ? 'FAILED: ' + fails.join(' ; ') : 'ALL PASS');
process.exit(fails.length ? 1 : 0);
