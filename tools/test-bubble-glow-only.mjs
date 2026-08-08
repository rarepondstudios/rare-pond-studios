/* THE RP BUBBLES AND CARDS ARE GLOW-ONLY. THE HARD HUG OUTLINE MUST NEVER APPEAR ON THEM.
 *
 *     node tools/serve-like-cloudflare.mjs 8899 &
 *     node tools/test-bubble-glow-only.mjs
 *
 * Needs playwright, which is NOT a dependency of this repo (package.json and node_modules are
 * gitignored so Cloudflare Pages never starts a build for a site that has none):
 *
 *     npm i -D playwright && npx playwright install chromium
 *
 * WHY THIS FILE EXISTS
 * The outline came back once already, silently, and it took an OBS recording to catch it.
 * The engine used to infer "this object is glow-only" from its SHAPE: a big circle
 * (%-radius >= 45). The home carousel's cards are circles as side bubbles and pass, but the
 * featured one morphs to .cbub{border-radius:13%/20%}, so the inference stopped holding
 * exactly when the card grew. Following the bubble with the mouse as it expanded put the
 * pointer on the card in its rounded-rect state and the engine drew the 3px .rpc-bord band
 * around it. Clicking and moving the mouse AWAY never reproduced it, which is why it lived
 * so long. The fix is data-cursor~="nohug" on .citem and .bubble, an intent the markup states
 * instead of a shape the engine guesses at. This test is what keeps the next pass honest.
 *
 * THE VIEWPORT SWEEP IS NOT PADDING. The bug was invisible below ~1760px: .citem.feat is
 * clamp(360px,69vw,1010px), so on a narrow window it is 69% of the viewport, over the
 * engine's oversize cutoff, and never engages at all. Only once the 1010px clamp takes over
 * does it fall under the cutoff and get hugged. A single-width test would have passed
 * through the whole bug.
 *
 * WHAT MUST STAY TRUE (a fix that breaks any of these is not a fix):
 *   - buttons and links still get the hug outline; this is not a licence to remove it
 *   - keyboard still selects, still travels, still activates with Enter
 *   - the side bubbles still FADE the ring (focus-vs-enter, v18: no glow = clicking only
 *     brings it to the foreground) while the featured card KEEPS it (clicking enters)
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8899';
const EXE = process.env.CHROME_PATH || undefined;
const WIDTHS = [1280, 1560, 1760, 1920, 2200];

let fails = 0;
const ok = (name, pass, detail = '') => {
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

/* Everything the cursor is doing right now, read off the live computed styles rather than
   off our own state, so the test cannot pass on an engine that thinks it is fine. */
const read = (page) => page.evaluate(() => {
  const ring = document.querySelector('.rpc-ring');
  const bord = document.querySelector('.rpc-bord');
  if (!ring || !bord) return null;
  const cs = getComputedStyle(ring), bs = getComputedStyle(bord);
  const feat = document.querySelector('.citem.feat');
  return {
    ringOpacity: +cs.opacity,
    bordOpacity: +bs.opacity,
    w: Math.round(parseFloat(cs.width)), h: Math.round(parseFloat(cs.height)),
    cls: ring.className,
    featPk: feat ? feat.dataset.pk : null,
    kbsel: !!document.querySelector('.rpc-kbsel'),
  };
});

/* The outline is SHOWING when the ring is visible, painting its border band, and has grown
   past the 50px free orb onto the element. All three, or a lit free orb would read as a
   failure and the whole test would invert. */
const outlined = (s) => !!s && s.ringOpacity > 0.05 && s.bordOpacity > 0.05 && (s.w > 90 || s.h > 90);

/* the engine only wakes on a REAL pointer move, and it needs two of them to have a delta */
async function wake(page, x = 60, y = 60) {
  await page.mouse.move(x, y);
  await page.mouse.move(x + 8, y + 5);
  await page.waitForTimeout(250);
}
const centre = (b) => [b.x + b.width / 2, b.y + b.height / 2];

/* Park the pointer on a target and read the cursor only once it has STOPPED changing.
   Every state here crossfades (opacity .16s, size .22s) and the hover-out grace holds the
   previous state for ~120ms, so a fixed sleep samples a different frame on every run and the
   assertions flap between pass and fail for reasons that have nothing to do with the bug.
   The extra 1px nudge guarantees a pointermove lands ON the target: the last step of a
   stepped move can be swallowed by the grace timer. */
async function park(page, x, y, steps = 12) {
  await page.mouse.move(x, y, { steps });
  await page.waitForTimeout(120);
  await page.mouse.move(x + 1, y + 1);
  let prev = null;
  for (let i = 0; i < 24; i++) {           /* up to ~2.4s, normally settles in three reads */
    /* keep nudging. The engine SLEEPS its rAF loop after ~90 idle frames, and a pointer held
       perfectly still (which only a test does) can put it to sleep mid-morph and leave the
       ring parked at an in-between size forever. A real hand never stops moving. */
    await page.mouse.move(x + (i % 2 ? 1 : 2), y + (i % 2 ? 2 : 1));
    await page.waitForTimeout(100);
    const s = await read(page);
    const key = s && `${s.ringOpacity}|${s.bordOpacity}|${s.w}|${s.h}|${s.cls}`;
    if (prev !== null && key === prev) return s;
    prev = key;
  }
  return read(page);
}

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 940 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.citem.feat', { timeout: 15000 });
  await page.waitForTimeout(900);
  await wake(page);

  /* --- 1. THE RECORDED BUG: follow the bubble with the mouse as it expands ---------- */
  const side = await page.locator('.citem.sideR').first().boundingBox();
  const [sx, sy] = centre(side);
  const onSide = await park(page, sx, sy);
  await page.mouse.down(); await page.mouse.up();

  const [cx, cy] = centre(await page.locator('#stage').boundingBox());
  let worst = null, hits = 0;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    await page.mouse.move(sx + (cx - sx) * t, sy + (cy - sy) * t);
    await page.waitForTimeout(45);
    const s = await read(page);
    if (outlined(s)) { hits++; worst = worst || s; }
  }
  await page.waitForTimeout(900);
  /* and the small hand movements someone makes once the card has settled */
  for (const [dx, dy] of [[0, 0], [7, 4], [-9, 3], [4, -7], [0, 0]]) {
    await page.mouse.move(cx + dx, cy + dy);
    await page.waitForTimeout(140);
    const s = await read(page);
    if (outlined(s)) { hits++; worst = worst || s; }
  }
  ok(`${width}px  follow the bubble into the feat slot, no hug outline`, hits === 0,
    hits ? `${hits} frames outlined, e.g. ${worst.w}x${worst.h} cls="${worst.cls}"` : '');

  /* --- 2. the other way onto the same card: leave, then come back ------------------- */
  await page.mouse.move(24, 900, { steps: 10 }); await page.waitForTimeout(450);
  const reenter = await park(page, cx, cy, 14);
  ok(`${width}px  re-enter the settled featured card, no hug outline`, !outlined(reenter),
    outlined(reenter) ? `${reenter.w}x${reenter.h} cls="${reenter.cls}"` : '');

  /* --- 3. focus-vs-enter (v18) survives: side fades, featured stays lit ------------- */
  ok(`${width}px  side bubble still FADES the ring (focus-only)`,
    !!onSide && onSide.ringOpacity < 0.05, onSide ? `opacity ${onSide.ringOpacity}` : 'no ring');
  ok(`${width}px  featured card KEEPS the ring glow (enterable)`,
    !!reenter && reenter.ringOpacity > 0.5, reenter ? `opacity ${reenter.ringOpacity}` : 'no ring');

  /* --- 4. the outline still works where it belongs: a header nav link --------------- */
  const nav = await page.locator('header a[data-go="team"], .flinks a[data-go="team"]').first().boundingBox();
  if (nav) {
    const [nx, ny] = centre(nav);
    const s = await park(page, nx, ny, 10);
    ok(`${width}px  nav link still gets the hug outline`, outlined(s),
      s ? `bord ${s.bordOpacity} ${s.w}x${s.h}` : 'no ring');
  }

  /* --- 5. Projects-page grid bubbles are glow-only too ------------------------------ */
  await page.evaluate(() => document.querySelector('[data-go="projects"]')?.click());
  await page.waitForTimeout(1400);
  const gb = await page.locator('#grid .bubble:not(.placeholder)').first().boundingBox();
  if (gb) {
    const [gx, gy] = centre(gb);
    const s = await park(page, gx, gy);
    ok(`${width}px  projects grid bubble, no hug outline`, !outlined(s),
      outlined(s) ? `${s.w}x${s.h} cls="${s.cls}"` : '');
  }

  ok(`${width}px  no page errors`, errs.length === 0, errs.join(' | '));
  await page.close();
}

/* --- 6. KEYBOARD, checked once at the width the bug lived at ------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 940 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.citem.feat'); await page.waitForTimeout(900);
  await wake(page);

  const [fx, fy] = centre(await page.locator('.citem.feat').boundingBox());
  const before = await park(page, fx, fy);

  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1000);
  const k1 = await read(page);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1000);
  const k2 = await read(page);

  ok('kb  arrow keys keep a live selection', !!(k1 && k1.kbsel) || !!(k2 && k2.kbsel));
  ok('kb  arrow keys still rotate the carousel',
    before.featPk !== k1.featPk || before.featPk !== k2.featPk,
    `${before.featPk} -> ${k1.featPk} -> ${k2.featPk}`);
  ok('kb  no hug outline on the bubbles', !outlined(k1) && !outlined(k2),
    outlined(k1) ? `k1 ${k1.w}x${k1.h}` : (outlined(k2) ? `k2 ${k2.w}x${k2.h}` : ''));

  /* Enter must still activate. The carousel opens the project in place (SPA), so the
     featured card leaving the DOM is the signal, not a navigation. */
  await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
  const opened = await page.evaluate(() => {
    const feat = document.querySelector('.citem.feat');
    const stage = document.getElementById('stage');
    return !feat || !stage || stage.getBoundingClientRect().height < 40 ||
      getComputedStyle(stage).visibility === 'hidden' ||
      location.pathname !== '/';
  });
  ok('kb  Enter still activates the featured card', opened, 'url ' + page.url());
  ok('kb  no page errors', errs.length === 0, errs.join(' | '));
  await page.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nall green');
process.exit(fails ? 1 : 0);
