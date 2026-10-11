/* Cloudflare Pages Function - "Show phone number" on the public Found this item? page.
 *
 * WHY: Jack wants the rentals phone number available to someone who found gear, but NOT
 * sitting on the open web where scrapers can harvest it. So the number is never in this
 * repo (it is PUBLIC) and never in any static file. It lives only in an encrypted
 * Cloudflare environment variable and is returned by this function after the visitor
 * passes a Cloudflare Turnstile check (Cloudflare's privacy-friendly bot check).
 *
 * The page side is the custom-page block type "phone-reveal" in index.html: it shows a
 * "Show phone number" button, loads Turnstile only when tapped, then POSTs the token here.
 *
 * SETUP (one time, Cloudflare dashboard)
 *   1. Turnstile -> Add widget. Hostnames: rarepond.com, www.rarepond.com. Mode: Managed.
 *   2. Workers & Pages -> rare-pond-studios -> Settings -> Variables and secrets,
 *      for Production (and Preview if wanted):
 *        TURNSTILE_SITE_KEY    = <widget site key>   (public by design; Text is fine)
 *        TURNSTILE_SECRET_KEY  = <widget secret key> (type Secret)
 *        FOUND_PHONE           = (213) ...           (type Secret; shown as typed)
 *   3. Redeploy (env changes apply to the next deployment).
 *   Until all three are set, GET reports enabled:false and the page hides the button.
 *
 * GET  -> { enabled, siteKey }               (no number, ever)
 * POST -> { phone, tel } after a valid Turnstile token, else 403
 */
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS });
}

function configured(env) {
  return !!(env && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY && env.FOUND_PHONE);
}

function telHref(display) {
  let raw = String(display || '').replace(/[^0-9+]/g, '');
  if (!raw) return '';
  if (raw.charAt(0) !== '+') {
    if (raw.length === 10) raw = '+1' + raw;
    else if (raw.length === 11 && raw.charAt(0) === '1') raw = '+' + raw;
  }
  return 'tel:' + raw;
}

function sameOrigin(request) {
  try {
    const host = new URL(request.url).host;
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    const src = origin ? new URL(origin).host : (referer ? new URL(referer).host : '');
    return !!src && src === host;
  } catch (e) { return false; }
}

export async function onRequestGet(context) {
  const env = context.env || {};
  if (!configured(env)) return json({ enabled: false });
  return json({ enabled: true, siteKey: env.TURNSTILE_SITE_KEY });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!configured(env)) return json({ error: 'not configured' }, 503);
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);

  let token = '';
  try {
    const body = await request.json();
    token = String((body && body.token) || '').slice(0, 2048);
  } catch (e) { token = ''; }
  if (!token) return json({ error: 'missing token' }, 400);

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);

  let outcome = null;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    outcome = await r.json();
  } catch (e) { outcome = null; }

  // Reject tokens minted for some other site that reuses this site key.
  const host = new URL(request.url).hostname;
  const okHost = !outcome || !outcome.hostname || outcome.hostname === host;
  if (!outcome || !outcome.success || !okHost) return json({ error: 'verification failed' }, 403);

  const phone = String(env.FOUND_PHONE).trim();
  return json({ phone: phone, tel: telHref(phone) });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
