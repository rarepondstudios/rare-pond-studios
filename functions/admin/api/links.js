/* Admin API for the go-links manager (links + groups + stats).
 * Under /admin/, so the site-wide _middleware.js Basic-auth gate protects every method.
 * Reads/writes the D1 database bound as GOLINKS. Schema is ensured on each call (idempotent),
 * so new columns/tables roll out on first request with no separate migration step.
 *
 *   GET    /admin/api/links                              -> { links (with group_id), groups, grand_total_scans }
 *   GET    /admin/api/links?slug=<s>&stats=1[&from&to]   -> per-link stats in a time range
 *   GET    /admin/api/links?group=<id>&stats=1[&from&to] -> aggregated stats for a whole group
 *   POST   /admin/api/links {slug,dest,title,active,group_id} -> create/update
 *   DELETE /admin/api/links?slug=<s>[&keepStats=1]       -> delete link (and its scans)
 */
const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const cleanSlug = (s) => String(s || '').trim().replace(/^\/+|\/+$/g, '');
const validSlug = (s) => /^[A-Za-z0-9._-]{1,64}$/.test(s);
function validDest(u) { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch (e) { return false; } }

async function ensureSchema(DB) {
  await DB.prepare("CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#7aa2ff', sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')))").run();
  try { await DB.prepare('ALTER TABLE links ADD COLUMN group_id INTEGER').run(); } catch (e) { /* column already exists */ }
  try { await DB.prepare('ALTER TABLE links ADD COLUMN sort INTEGER NOT NULL DEFAULT 0').run(); } catch (e) { /* column already exists */ }
}

function rangeOf(url) {
  const now = Math.floor(Date.now() / 1000);
  let to = parseInt(url.searchParams.get('to') || '', 10); if (!to) to = now;
  let from = parseInt(url.searchParams.get('from') || '', 10); if (!from) from = to - 30 * 86400;
  return { from, to };
}

async function statsForSlugs(DB, slugs, from, to) {
  if (!slugs.length) return { total: 0, byDay: [], byCountry: [], byDevice: [], recent: [] };
  const ph = slugs.map((_, i) => '?' + (i + 1)).join(',');
  const n = slugs.length, fP = '?' + (n + 1), tP = '?' + (n + 2);
  const base = ` FROM scans WHERE slug IN (${ph}) AND ts>=${fP} AND ts<${tP}`;
  const b = [...slugs, from, to];
  const total = (await DB.prepare('SELECT COUNT(*) c' + base).bind(...b).first())?.c || 0;
  const byDay = (await DB.prepare("SELECT date(ts,'unixepoch') k, COUNT(*) c" + base + ' GROUP BY k ORDER BY k').bind(...b).all()).results || [];
  const byCountry = (await DB.prepare("SELECT COALESCE(country,'?') k, COUNT(*) c" + base + ' GROUP BY country ORDER BY c DESC LIMIT 20').bind(...b).all()).results || [];
  const byDevice = (await DB.prepare("SELECT COALESCE(device,'?') k, COUNT(*) c" + base + ' GROUP BY device ORDER BY c DESC').bind(...b).all()).results || [];
  const recent = (await DB.prepare('SELECT ts,slug,country,region,city,device,browser,referer' + base + ' ORDER BY ts DESC LIMIT 25').bind(...b).all()).results || [];
  return { total, byDay, byCountry, byDevice, recent };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.GOLINKS) return json({ error: 'storage not bound (GOLINKS)' }, 500);
  const DB = env.GOLINKS;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  try {
    await ensureSchema(DB);

    if (method === 'GET') {
      if (url.searchParams.get('stats') === '1') {
        const { from, to } = rangeOf(url);
        const groupId = url.searchParams.get('group');
        if (groupId != null && groupId !== '') {
          const gid = parseInt(groupId, 10);
          const group = await DB.prepare('SELECT * FROM groups WHERE id=?1').bind(gid).first();
          const activeOnly = url.searchParams.get('activeOnly') === '1';
          const slugRows = (await DB.prepare('SELECT slug FROM links WHERE group_id=?1' + (activeOnly ? ' AND active=1' : '')).bind(gid).all()).results || [];
          const s = await statsForSlugs(DB, slugRows.map(r => r.slug), from, to);
          return json({ group, from, to, ...s });
        }
        const slug = url.searchParams.get('slug');
        if (slug) {
          const link = await DB.prepare('SELECT * FROM links WHERE slug=?1').bind(slug).first();
          const s = await statsForSlugs(DB, [slug], from, to);
          return json({ link, from, to, ...s });
        }
        return json({ error: 'slug or group required' }, 400);
      }
      const links = (await DB.prepare(
        'SELECT l.slug, l.dest, l.title, l.active, l.group_id, l.sort, l.created_at, l.updated_at, ' +
        '(SELECT COUNT(*) FROM scans s WHERE s.slug=l.slug) AS scans_total, ' +
        '(SELECT MAX(ts) FROM scans s WHERE s.slug=l.slug) AS last_scan ' +
        'FROM links l ORDER BY l.created_at DESC'
      ).all()).results || [];
      const groups = (await DB.prepare(
        'SELECT g.id, g.name, g.color, g.sort, ' +
        '(SELECT COUNT(*) FROM links l WHERE l.group_id=g.id) AS link_count, ' +
        '(SELECT COUNT(*) FROM scans s WHERE s.slug IN (SELECT slug FROM links WHERE group_id=g.id)) AS scans_total ' +
        'FROM groups g ORDER BY g.sort, g.name'
      ).all()).results || [];
      const grand = (await DB.prepare('SELECT COUNT(*) c FROM scans').first())?.c || 0;
      return json({ links, groups, grand_total_scans: grand });
    }

    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (Array.isArray(body.reorder)) {
        const now = Math.floor(Date.now() / 1000);
        for (const it of body.reorder) {
          const sl = cleanSlug(it && it.slug); if (!sl) continue;
          let g = (it.group_id === '' || it.group_id == null) ? null : parseInt(it.group_id, 10);
          if (Number.isNaN(g)) g = null;
          const so = parseInt(it.sort, 10) || 0;
          await DB.prepare('UPDATE links SET group_id=?1, sort=?2, updated_at=?3 WHERE slug=?4').bind(g, so, now, sl).run();
        }
        return json({ ok: true, reordered: body.reorder.length });
      }
      const slug = cleanSlug(body.slug);
      const dest = String(body.dest || '').trim();
      const title = (body.title != null && String(body.title).trim() !== '') ? String(body.title).trim() : null;
      const active = (body.active === false || body.active === 0) ? 0 : 1;
      let gid = body.group_id;
      gid = (gid === '' || gid == null) ? null : parseInt(gid, 10);
      if (Number.isNaN(gid)) gid = null;
      if (!validSlug(slug)) return json({ error: 'Slug must be 1-64 chars: letters, numbers, . _ - only.' }, 400);
      if (!validDest(dest)) return json({ error: 'Destination must be a full http(s) URL.' }, 400);
      const now = Math.floor(Date.now() / 1000);
      await DB.prepare(
        'INSERT INTO links (slug,dest,title,active,group_id,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6) ' +
        'ON CONFLICT(slug) DO UPDATE SET dest=?2, title=?3, active=?4, group_id=?5, updated_at=?6'
      ).bind(slug, dest, title, active, gid, now).run();
      return json({ ok: true, slug });
    }

    if (method === 'DELETE') {
      const slug = cleanSlug(url.searchParams.get('slug'));
      if (!slug) return json({ error: 'slug required' }, 400);
      await DB.prepare('DELETE FROM links WHERE slug=?1').bind(slug).run();
      if (url.searchParams.get('keepStats') !== '1') await DB.prepare('DELETE FROM scans WHERE slug=?1').bind(slug).run();
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
