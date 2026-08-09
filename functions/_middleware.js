import { maintenanceFor } from './_maintenance.js';
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
  // Decode percent-encoding BEFORE the prefix test. Cloudflare's asset layer decodes %2F to a
  // slash when it locates the file, so /admin%2Fcolorlooks resolves to the admin asset; testing
  // the still-encoded path let it slip PAST the gate. Decode (and defuse double-encoding) so an
  // encoded slash can never bypass the /admin/ check. Decoding only ever makes MORE paths match
  // (fail-closed): no public path legitimately contains an encoded '/admin/'.
  let p = (pathname || '');
  try { p = decodeURIComponent(p); } catch (e) { /* malformed escape -> fall back to the raw path */ }
  p = p.replace(/%2f/gi, '/');                    // belt-and-suspenders for %252F double-encoding
  p = p.toLowerCase().replace(/\/+$/, '');        // ignore a trailing slash
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

/* Rare Pond's PRE-REGISTER switches. New pages do NOT go here: add a row to
   Site Settings -> Page access, which the shared engine checks first. These three predate the
   register and are kept so an existing switch cannot silently stop working. */
const LEGACY = [
  { match: (p) => p === '/rentals' || p.startsWith('/rentals/'),
    flag: '/data/rentals.json', key: 'publicAccess', covers: 'rentals', name: 'Rentals' },
  { match: (p) => p === '/team',
    flag: '/data/team.json', key: 'publicAccess', covers: 'studio', name: 'Our Team' },
  { match: (p) => p === '/projects',
    flag: '/data/site.json', key: 'projectsPublicAccess', covers: 'studio', name: 'Projects' },
];

/* Segments that are real routes, so a custom page can never be slugged one of them and stand in
   front of a real page. Keeping /admin here means a page slugged "admin" can never sit in front
   of the auth gate. */
const RESERVED_SEGS = new Set(['admin','assets','data','functions','media','tools','maintenance','rentals','team','projects']);

const MAINT = { legacy: LEGACY, reservedSegs: RESERVED_SEGS, customPages: '/data/pages.json' };

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
  // Wrapped so an unexpected throw fails OPEN (serve the page) rather than 500-ing it; the
  // /admin gate below is separate and still fails closed.
  let cover = null;
  try { cover = await maintenanceFor(context, pathname, MAINT); } catch (e) { cover = null; }
  if (cover) return cover;

  // A missing file under /media/ must 404, not fall through to the SPA. Cloudflare Pages cannot
  // express this statically: a root 404.html HIJACKS the SPA /* catch-all (it 404'd every film
  // route once), and _redirects only supports a 200 rewrite, never a 404. So decide it here -- for
  // a /media/ FILE path, resolve the pipeline and, if it came back HTML, the real file is missing:
  // return a real 404 (no-store) so a wrong response can never be cached as an image (the 7-day
  // /media cache-poison). Real images resolve to image/*, so they pass straight through.
  if (pathname.startsWith('/media/') && !pathname.endsWith('/')) {
    try {
      const r = await next();
      const ct = (r.headers.get('Content-Type') || '').toLowerCase();
      if (ct.startsWith('text/html')) {
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">' +
          '<title>Not found | Rare Pond Studios</title>' +
          '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
          'background:#0a1f3c;color:#eaf1ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center">' +
          '<div><h1 style="margin:0 0 .5rem">Page not found</h1>' +
          '<p style="color:#a9c2e8">That file doesn\u2019t exist. ' +
          '<a style="color:#7aa2ff" href="/">Back to Rare Pond Studios</a></p></div>',
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
      }
      return r;
    } catch (e) { return next(); }   // fail OPEN
  }

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
