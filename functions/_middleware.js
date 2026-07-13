/* Cloudflare Pages Function - password gate for every internal page (/admin/*).
 *
 * WHY THIS EXISTS
 *   The pages under /admin/ are internal tools. They are READ-ONLY (they cannot
 *   change the site - only Pages CMS can do that), but we don't want them publicly
 *   browsable.
 *
 * HOW IT WORKS  (the important part)
 *   This runs on Cloudflare's EDGE - server-side, before any bytes reach the
 *   browser. If the password is wrong, the browser receives a bare 401 and NO
 *   HTML AT ALL. There is nothing to "view source" on, because nothing was sent.
 *   The password lives in an encrypted Cloudflare environment variable and is
 *   never transmitted to the client.
 *
 *   Do NOT ever "simplify" this into a client-side JS password check. That would
 *   ship the password to every visitor and be worthless.
 */
/*
 * SETUP (one time, in the Cloudflare dashboard)
 *   Workers & Pages -> rare-pond-studios -> Settings -> Variables and secrets.
 *   Add as type "Secret", for BOTH Production and Preview:
 *     COLORLOOKS_PASSWORD = <the password>
 *   Optional:
 *     COLORLOOKS_USER     = <username>   (defaults to "rarepond")
 *   Secrets are never read from this repo - this repo is PUBLIC.
 *
 * NOTE
 *   /data/colorlooks.json is deliberately NOT gated: assets/looks.js on the live
 *   site fetches it to paint the gradients. Gating it would break the site. The
 *   hex values aren't secret (they're on screen anyway) - we're hiding the tool.
 */

/* EVERY INTERNAL-ONLY PAGE LIVES UNDER /admin/ AND IS GATED BY THAT FACT ALONE.
 *
 *   /admin/colorlooks    colour-look preview + picker
 *   /admin/pagesindex    the internal page directory
 *
 * This is a PREFIX rule, not a list of filenames, and that is deliberate. The old
 * version was a hand-maintained list, which meant a new admin page was public until
 * someone remembered to add it - the failure was silent and the default was "exposed".
 * Now the default is "locked": drop any file into /admin/ and it is behind the
 * password from its first deploy. To make something public, you must move it OUT of
 * /admin/, which is a deliberate act rather than an omission.
 *
 * The check below covers both spellings (/admin/colorlooks and /admin/colorlooks.html)
 * because Cloudflare Pages serves them as the same file; matching the folder rather
 * than the filename closes that back door automatically.
 */
function isProtected(pathname) {
  const p = (pathname || '').toLowerCase().replace(/\/+$/, '');   // ignore a trailing slash
  return p === '/admin' || p.startsWith('/admin/');
}
const REALM = 'Rare Pond - Internal';

/* Constant-time compare, so nobody can time their way to the password
   one character at a time. */
function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a || '');
  const y = enc.encode(b || '');
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function challenge() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="' + REALM + '", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function locked(msg) {
  return new Response(msg, {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* ===== MAINTENANCE COVER =====================================================
 *
 * A page can be temporarily closed from Pages CMS. When it is, we serve the maintenance
 * cover AT THE PAGE'S OWN URL - /rentals stays /rentals. No redirect. That means refresh
 * works, links already shared still work, and flipping the switch back on makes the same
 * URL the real page again.
 *
 * WHY THIS IS DONE HERE, AT THE EDGE, AND NOT IN THE BROWSER
 *   The rentals page renders its gear immediately from a built-in catalogue. A client-side
 *   check would therefore paint the real page first and only then cover it - every visitor
 *   would see a flash of the thing you just closed. Deciding here means the browser is
 *   only ever sent the cover.
 *
 * TO COVER ANOTHER PAGE LATER: add a row to COVERABLE. `flag` is the JSON file holding the
 * switch, `key` the boolean inside it (true = open), and `covers` the id the cover page
 * uses to pick the right header and wording.
 *
 * FAILS OPEN, deliberately: if the switch file cannot be read or is malformed we serve the
 * REAL page. A hiccup fetching a JSON file must never take the rentals page off the air -
 * the cost of wrongly showing the page is far lower than wrongly hiding it.
 */
/* The page name comes from the CMS and is written into an HTML attribute, so it must be
   escaped. A page titled  Bob's "Big" Day  would otherwise break out of the attribute. */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const COVERABLE = [
  { match: (p) => p === '/rentals' || p.startsWith('/rentals/'),
    flag: '/data/rentals.json', key: 'publicAccess', covers: 'rentals', name: 'Rentals' },
  { match: (p) => p === '/team',
    flag: '/data/team.json', key: 'publicAccess', covers: 'studio', name: 'Our Team' },
  { match: (p) => p === '/projects',
    flag: '/data/projects.json', key: 'publicAccess', covers: 'studio', name: 'Projects' },
];

/* CUSTOM PAGES are not a fixed list - you add them in Pages CMS - so they cannot be rows in
   the table above. Instead we look the path up in pages.json: if a page with that slug has
   been switched off, it gets covered, and the cover is told the page's real TITLE so it can
   say "come back to Summer Open House later". Add a page, get the switch for free. */
async function customPageRule(env, request, pathname) {
  const seg = pathname.replace(/^\/+|\/+$/g, '');
  if (!seg || seg.indexOf('/') !== -1) return null;          // not a single-segment path
  let data;
  try { data = await readJson(env, request, '/data/pages.json'); } catch (e) { return null; }
  const list = (data && data.pages) || [];
  const page = list.find((p) => p && String(p.slug || '').trim() === seg);
  if (!page || page.publicAccess !== false) return null;     // absent === open
  return { covers: 'studio', name: page.title || seg };
}

async function readJson(env, request, path) {
  const url = new URL(path, request.url);
  // env.ASSETS is the Pages static-asset binding; fall back to a plain fetch if it is not
  // there (e.g. local harnesses), so this code is testable outside Cloudflare.
  const res = env && env.ASSETS && env.ASSETS.fetch
    ? await env.ASSETS.fetch(new Request(url.toString(), { headers: request.headers }))
    : await fetch(url.toString());
  if (!res || !res.ok) return null;
  return res.json();
}

async function maintenanceFor(context, pathname) {
  const { request, env } = context;

  /* Resolve which page (if any) is closed. Two sources: the fixed table, and - for custom
     pages, which are created in the CMS and so cannot be in a fixed table - pages.json. */
  let hit = null;
  const rule = COVERABLE.find((r) => r.match(pathname));
  if (rule) {
    try {
      const cfg = await readJson(env, request, rule.flag);
      // Absent === open. Only an explicit false closes a page, so a missing or partial file
      // can never accidentally take one down.
      if (cfg && cfg[rule.key] === false) hit = { covers: rule.covers, name: rule.name };
    } catch (e) {
      return null;                     // fail open - serve the real page
    }
  } else {
    try { hit = await customPageRule(env, request, pathname); }
    catch (e) { return null; }         // fail open
  }
  if (!hit) return null;

  /* Ask for the EXTENSIONLESS path. Cloudflare Pages answers /maintenance.html with a 308
     redirect to /maintenance, and a 308 is not `ok` - so requesting the .html form would
     fail the check below, fall through, and the cover would silently never appear while
     every test still passed. Try both, so neither spelling can break it. */
  let html;
  try {
    const grab = async (p) => {
      const u = new URL(p, request.url).toString();
      return (env && env.ASSETS && env.ASSETS.fetch)
        ? env.ASSETS.fetch(new Request(u))
        : fetch(u);
    };
    let res = await grab('/maintenance');
    if (!res || !res.ok) res = await grab('/maintenance.html');
    if (!res || !res.ok) return null;   // cover page missing -> rather show the real page
    html = await res.text();
    if (!html || html.indexOf('<html') === -1) return null;   // not a page -> fail open
  } catch (e) {
    return null;
  }

  /* Tell the cover which page it is standing in front of:
       data-covers    -> which header/chrome to wear (rentals or studio)
       data-page-name -> the page's real name, so it can say "come back to Projects later".
     The NAME is passed rather than looked up, because a custom page's name lives in the CMS
     and the cover has no way to know it otherwise. */
  const attrs = ' data-covers="' + esc(hit.covers) + '" data-page-name="' + esc(hit.name) + '"';
  html = html.replace('<html lang="en">', '<html lang="en"' + attrs + '>');

  return new Response(html, {
    status: 200,                        // 200, not 503: this is a normal page to a visitor
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Never cache the cover, or it would linger after the page is reopened.
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;

  let pathname;
  try {
    pathname = new URL(request.url).pathname;
  } catch (e) {
    // If we can't even parse the URL, don't take the whole site down.
    return next();
  }

  // A page that has been closed in Pages CMS shows the cover instead - at its own URL.
  const cover = await maintenanceFor(context, pathname);
  if (cover) return cover;

  // Everything outside /admin/ is served exactly as before.
  if (!isProtected(pathname)) return next();

  // --- from here we FAIL CLOSED: never fall through to next() on an error ---
  try {
    const expected = env.COLORLOOKS_PASSWORD;

    // No secret configured => lock it, rather than silently exposing the page.
    if (!expected) {
      return locked(
        'This internal page is locked: COLORLOOKS_PASSWORD is not set in the ' +
        'Cloudflare Pages project settings.'
      );
    }

    const header = request.headers.get('Authorization') || '';
    if (header.slice(0, 6) !== 'Basic ') return challenge();

    let decoded;
    try {
      decoded = atob(header.slice(6).trim());
    } catch (e) {
      return challenge();
    }

    const sep = decoded.indexOf(':');
    if (sep < 0) return challenge();

    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    const expectedUser = env.COLORLOOKS_USER || 'rarepond';

    // Evaluate both, then AND - avoids short-circuit timing hints.
    const userOk = safeEqual(user, expectedUser);
    const passOk = safeEqual(pass, expected);
    if (!(userOk && passOk)) return challenge();

    // Authenticated. Serve the real page, but never let it be cached or indexed.
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store, private');
    out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return out;
  } catch (e) {
    return locked('This internal page is temporarily unavailable.');
  }
}
