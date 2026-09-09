/* Cloudflare Pages Function - public branded short-link redirector.
 *
 *   https://rarepond.com/go/<slug>  ->  302 to the link's destination, and logs the scan.
 *
 * This is the marketing/website counterpart of the rentals /g resolver, but a plain public
 * 302 (no tailnet branch). Links and scans live in the D1 database bound as GOLINKS; manage
 * them at /admin/links. Unknown or disabled slugs bounce to the home page. Logging happens
 * after the redirect is queued (waitUntil), so a scan never slows the visitor down, and a
 * logging failure can never break the redirect.
 */
const HOME = 'https://www.rarepond.com/';

function deviceOf(ua) {
  ua = ua || '';
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'Mobile';
  return 'Desktop';
}
function browserOf(ua) {
  ua = ua || '';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Version\/.+Safari/i.test(ua)) return 'Safari';
  return 'Other';
}

export async function onRequest(context) {
  const { request, env, params, waitUntil } = context;
  const slug = String((params && params.slug) || '').trim();
  if (!slug || !env.GOLINKS) return Response.redirect(HOME, 302);

  let row = null;
  try {
    row = await env.GOLINKS
      .prepare('SELECT slug, dest, active FROM links WHERE lower(slug)=lower(?1) LIMIT 1')
      .bind(slug).first();
  } catch (e) { row = null; }

  if (!row || !row.dest || row.active === 0) return Response.redirect(HOME, 302);

  try {
    const cf = request.cf || {};
    const ua = request.headers.get('User-Agent') || '';
    const ref = request.headers.get('Referer') || '';
    const stmt = env.GOLINKS.prepare(
      'INSERT INTO scans (slug, ts, country, region, city, device, browser, referer, ua) ' +
      'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)'
    ).bind(
      row.slug,
      Math.floor(Date.now() / 1000),
      cf.country || null,
      cf.region || null,
      cf.city || null,
      deviceOf(ua),
      browserOf(ua),
      ref ? ref.slice(0, 300) : null,
      ua ? ua.slice(0, 300) : null
    );
    if (waitUntil) waitUntil(stmt.run()); else await stmt.run();
  } catch (e) { /* logging must never block the redirect */ }

  return Response.redirect(row.dest, 302);
}
