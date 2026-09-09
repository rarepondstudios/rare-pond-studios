/* Admin API for the go-links manager.
 *
 * It lives under /admin/, so the site-wide _middleware.js Basic-auth gate protects every
 * method here with the same credentials as the other internal tools (COLORLOOKS_PASSWORD).
 * Reads and writes the D1 database bound as GOLINKS.
 *
 *   GET  /admin/api/links                      -> list links with scan totals
 *   GET  /admin/api/links?slug=<s>&stats=1     -> detail + breakdowns for one link
 *   POST /admin/api/links   {slug,dest,title,active}  -> create or update
 *   DELETE /admin/api/links?slug=<s>[&keepStats=1]    -> delete link (and its scans)
 */
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const cleanSlug = (s) => String(s || '').trim().replace(/^\/+|\/+$/g, '');
const validSlug = (s) => /^[A-Za-z0-9._-]{1,64}$/.test(s);
function validDest(u) {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; }
  catch (e) { return false; }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.GOLINKS) return json({ error: 'storage not bound (GOLINKS)' }, 500);
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const DB = env.GOLINKS;

  try {
    if (method === 'GET') {
      const slug = url.searchParams.get('slug');
      if (slug && url.searchParams.get('stats') === '1') {
        const link = await DB.prepare('SELECT * FROM links WHERE slug=?1').bind(slug).first();
        const total = (await DB.prepare('SELECT COUNT(*) c FROM scans WHERE slug=?1').bind(slug).first())?.c || 0;
        const byCountry = (await DB.prepare("SELECT COALESCE(country,'?') k, COUNT(*) c FROM scans WHERE slug=?1 GROUP BY country ORDER BY c DESC LIMIT 20").bind(slug).all()).results || [];
        const byDevice = (await DB.prepare("SELECT COALESCE(device,'?') k, COUNT(*) c FROM scans WHERE slug=?1 GROUP BY device ORDER BY c DESC").bind(slug).all()).results || [];
        const byDay = (await DB.prepare("SELECT date(ts,'unixepoch') k, COUNT(*) c FROM scans WHERE slug=?1 GROUP BY k ORDER BY k DESC LIMIT 60").bind(slug).all()).results || [];
        const recent = (await DB.prepare('SELECT ts,country,region,city,device,browser,referer FROM scans WHERE slug=?1 ORDER BY ts DESC LIMIT 25').bind(slug).all()).results || [];
        return json({ link, total, byCountry, byDevice, byDay, recent });
      }
      const links = (await DB.prepare(
        'SELECT l.slug, l.dest, l.title, l.active, l.created_at, l.updated_at, ' +
        '(SELECT COUNT(*) FROM scans s WHERE s.slug=l.slug) AS scans_total, ' +
        '(SELECT MAX(ts) FROM scans s WHERE s.slug=l.slug) AS last_scan ' +
        'FROM links l ORDER BY l.created_at DESC'
      ).all()).results || [];
      const grand = (await DB.prepare('SELECT COUNT(*) c FROM scans').first())?.c || 0;
      return json({ links, grand_total_scans: grand });
    }

    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const slug = cleanSlug(body.slug);
      const dest = String(body.dest || '').trim();
      const title = (body.title != null && String(body.title).trim() !== '') ? String(body.title).trim() : null;
      const active = (body.active === false || body.active === 0) ? 0 : 1;
      if (!validSlug(slug)) return json({ error: 'Slug must be 1-64 chars: letters, numbers, . _ - only.' }, 400);
      if (!validDest(dest)) return json({ error: 'Destination must be a full http(s) URL.' }, 400);
      const now = Math.floor(Date.now() / 1000);
      await DB.prepare(
        'INSERT INTO links (slug,dest,title,active,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?5) ' +
        'ON CONFLICT(slug) DO UPDATE SET dest=?2, title=?3, active=?4, updated_at=?5'
      ).bind(slug, dest, title, active, now).run();
      return json({ ok: true, slug });
    }

    if (method === 'DELETE') {
      const slug = cleanSlug(url.searchParams.get('slug'));
      if (!slug) return json({ error: 'slug required' }, 400);
      await DB.prepare('DELETE FROM links WHERE slug=?1').bind(slug).run();
      if (url.searchParams.get('keepStats') !== '1') {
        await DB.prepare('DELETE FROM scans WHERE slug=?1').bind(slug).run();
      }
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
