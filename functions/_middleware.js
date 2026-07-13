/* Cloudflare Pages Function - password gate for the Color Looks tool.
 *
 * WHY THIS EXISTS
 *   /colorlooks.html is an internal tool. It is READ-ONLY (it cannot change the
 *   site - only Pages CMS can do that), but we don't want it publicly browsable.
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

/* Every internal-only page. Add a page here and it is instantly behind the password;
   forget to, and it is public. Both spellings of each path are listed because
   Cloudflare Pages serves /foo and /foo.html as the same file. */
const PROTECTED = new Set([
  '/colorlooks', '/colorlooks.html',   // the colour-look preview + picker
  '/pages',      '/pages.html',        // the internal page directory
]);
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

export async function onRequest(context) {
  const { request, env, next } = context;

  let pathname;
  try {
    pathname = new URL(request.url).pathname;
  } catch (e) {
    // If we can't even parse the URL, don't take the whole site down.
    return next();
  }

  // Everything that isn't the Color Looks tool is served exactly as before.
  if (!PROTECTED.has(pathname)) return next();

  // --- from here we FAIL CLOSED: never fall through to next() on an error ---
  try {
    const expected = env.COLORLOOKS_PASSWORD;

    // No secret configured => lock it, rather than silently exposing the page.
    if (!expected) {
      return locked(
        'Color Looks is locked: COLORLOOKS_PASSWORD is not set in the ' +
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
    return locked('Color Looks is temporarily unavailable.');
  }
}
