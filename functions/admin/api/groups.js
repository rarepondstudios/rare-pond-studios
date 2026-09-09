/* Admin API for go-link GROUPS. Under /admin/, gated by _middleware.js. Uses D1 binding GOLINKS.
 *   GET    /admin/api/groups                 -> { groups }
 *   POST   /admin/api/groups {id?,name,color} -> create (no id) or update (id)
 *   DELETE /admin/api/groups?id=<n>          -> delete group; its links become ungrouped
 */
const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
async function ensureSchema(DB) {
  await DB.prepare("CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#7aa2ff', sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')))").run();
  try { await DB.prepare('ALTER TABLE links ADD COLUMN group_id INTEGER').run(); } catch (e) {}
}
function normColor(c) { c = String(c || ''); if (/^#[0-9a-fA-F]{6}$/.test(c)) return c; if (/^[0-9a-fA-F]{6}$/.test(c)) return '#' + c; return '#7aa2ff'; }

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.GOLINKS) return json({ error: 'storage not bound (GOLINKS)' }, 500);
  const DB = env.GOLINKS;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  try {
    await ensureSchema(DB);
    if (method === 'GET') {
      const groups = (await DB.prepare('SELECT * FROM groups ORDER BY sort, name').all()).results || [];
      return json({ groups });
    }
    if (method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const name = String(b.name || '').trim();
      const color = normColor(b.color);
      if (!name) return json({ error: 'Group name required.' }, 400);
      if (b.id) {
        await DB.prepare('UPDATE groups SET name=?1, color=?2 WHERE id=?3').bind(name, color, parseInt(b.id, 10)).run();
        return json({ ok: true, id: parseInt(b.id, 10) });
      }
      const r = await DB.prepare('INSERT INTO groups (name,color) VALUES (?1,?2)').bind(name, color).run();
      return json({ ok: true, id: r.meta && r.meta.last_row_id });
    }
    if (method === 'DELETE') {
      const id = parseInt(url.searchParams.get('id') || '', 10);
      if (!id) return json({ error: 'id required' }, 400);
      await DB.prepare('UPDATE links SET group_id=NULL WHERE group_id=?1').bind(id).run();
      await DB.prepare('DELETE FROM groups WHERE id=?1').bind(id).run();
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
