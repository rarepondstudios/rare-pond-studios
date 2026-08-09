/* _maintenance.js - the page-cover engine, shared by every site.
 *
 * SINGLE SOURCE OF TRUTH: bts-automation/maintenance_lib.js, published to
 * <repo>/functions/_maintenance.js by social_ui_sync.py. Edit the master, not a copy.
 * The leading underscore is what stops Cloudflare Pages treating it as a route.
 *
 * WHAT IT DOES
 *   A primary page can be closed from Pages CMS. When it is, the cover is served AT THE PAGE'S
 *   OWN URL: /media stays /media. No redirect, so a refresh does not escape it and a shared link
 *   still works and comes straight back when the page reopens.
 *
 * WHY AT THE EDGE AND NOT IN THE BROWSER
 *   A client-side check would ship the real page and then hide it, which anyone can undo with the
 *   developer tools. Here the closed page's HTML is never sent at all.
 *
 * WHERE THE SWITCHES LIVE, and how a NEW page inherits one automatically
 *   `data/site.json` -> `pageAccess`, a list of { path, name, open }. Any request whose path
 *   matches a row with `open === false` is covered. **Adding a page to the site means adding a
 *   row in Site Settings, not editing this file.** That is the whole point: the register is data,
 *   so a page added next year inherits the control without a code change.
 *
 *   Two older mechanisms still work behind it, in this order:
 *     1. `pageAccess` above, which wins whenever it has a row for the path.
 *     2. a site's own legacy rules, passed in as `legacy` (Rare Pond's rentals/team/projects
 *        switches predate the register).
 *     3. custom pages, looked up by slug in `pages.json`, which were never a fixed list.
 *
 * FAILS OPEN, deliberately. If a switch file cannot be read or is malformed, the REAL page is
 * served. Wrongly showing a page costs far less than wrongly hiding one, and a JSON hiccup must
 * never take a site off the air.
 */

/* The page name comes from the CMS and is written into an HTML attribute, so it must be escaped.
   A page titled  Bob's "Big" Day  would otherwise break out of the attribute. */
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export async function readJson(env, request, path) {
  const url = new URL(path, request.url);
  /* env.ASSETS is the Pages static-asset binding; fall back to a plain fetch when it is absent
     (local test harnesses), so this is testable outside Cloudflare. */
  const res = env && env.ASSETS && env.ASSETS.fetch
    ? await env.ASSETS.fetch(new Request(url.toString(), { headers: request.headers }))
    : await fetch(url.toString());
  if (!res || !res.ok) return null;
  return res.json();
}

/* Which chrome the cover wears. DERIVED from the path, never stored: Pages CMS omits any key
   that is not in the schema, so a `covers` field saved into the register would disappear the
   first time the register was edited, and the cover would quietly change appearance. */
function coverStyle(path) {
  return /^\/rentals(\/|$)/i.test(String(path || '')) ? 'rentals' : 'studio';
}

/* Normalise for comparison: lowercase, no trailing slash, '' becomes '/'. */
function norm(p) {
  const s = String(p || '').trim().toLowerCase().replace(/\/+$/, '');
  return s === '' ? '/' : s;
}

/* THE REGISTER. A row matches its own path exactly, and also anything beneath it, so closing
   `/rentals` closes `/rentals/checkout` with it. `/` matches only the home page itself, never
   the whole site, because a prefix match on `/` would cover everything including the cover. */
async function registerRule(env, request, pathname) {
  let site;
  try { site = await readJson(env, request, '/data/site.json'); } catch (e) { return null; }
  const rows = (site && site.pageAccess) || [];
  if (!rows.length) return null;
  const p = norm(pathname);

  /* A whole-site row (path '*') closes everything except the cover itself. Checked first so it
     cannot be defeated by a more specific row being open. */
  const all = rows.find((r) => r && String(r.path || '').trim() === '*');
  if (all && all.open === false) return { covers: coverStyle('/'), name: all.name || 'This site' };

  let best = null;
  for (const r of rows) {
    if (!r || !r.path || String(r.path).trim() === '*') continue;
    const rp = norm(r.path);
    const hit = rp === '/' ? (p === '/') : (p === rp || p.startsWith(rp + '/'));
    if (!hit) continue;
    /* longest match wins, so a row for /rentals/gear beats the one for /rentals */
    if (!best || rp.length > norm(best.path).length) best = r;
  }
  if (!best) return null;
  if (best.open === false) return { covers: coverStyle(best.path), name: best.name || best.path };
  /* Open in the register FALLS THROUGH to the legacy rules rather than short-circuiting. Either
     source may close a page; neither can force one open over the other. That is the safe
     direction: a site added to the register cannot silently disable a switch that already
     worked. The CMS only ever shows the register, so in practice legacy never fires. */
  return null;
}

async function legacyRule(env, request, pathname, legacy) {
  const rule = (legacy || []).find((r) => r.match(pathname));
  if (!rule) return null;
  const cfg = await readJson(env, request, rule.flag);
  /* Absent === open. Only an explicit false closes a page, so a missing or partial file can
     never accidentally take one down. */
  if (cfg && cfg[rule.key] === false) return { covers: rule.covers, name: rule.name };
  return null;
}

/* CUSTOM PAGES are created in the CMS, so they cannot be a fixed list. Look the single path
   segment up in pages.json: switched off there means covered, and the cover is told the page's
   real TITLE so it can name it. Add a page, get the switch for free. */
async function customPageRule(env, request, pathname, reserved, file) {
  const seg = pathname.replace(/^\/+|\/+$/g, '');
  if (!seg || seg.indexOf('/') !== -1) return null;      // not a single-segment path
  if (reserved.has(seg)) return null;                    // a real route, not a custom page
  let data;
  try { data = await readJson(env, request, file); } catch (e) { return null; }
  const list = (data && data.pages) || [];
  const page = list.find((p) => p && String(p.slug || '').trim() === seg);
  if (!page || page.publicAccess !== false) return null; // absent === open
  return { covers: 'studio', name: page.title || seg };
}

/* Resolve, then serve. `opts`:
     legacy        [{match(path), flag, key, covers, name}]  a site's pre-register switches
     reservedSegs  Set of path segments that are real routes, never custom-page slugs
     customPages   path to pages.json, or null if the site has no custom pages           */
export async function maintenanceFor(context, pathname, opts) {
  const { request, env } = context;
  const o = opts || {};

  let hit = null;
  try {
    hit = await registerRule(env, request, pathname);
    if (!hit) hit = await legacyRule(env, request, pathname, o.legacy);
    if (!hit && o.customPages) {
      hit = await customPageRule(env, request, pathname, o.reservedSegs || new Set(), o.customPages);
    }
  } catch (e) {
    return null;                                            // fail open
  }
  if (!hit) return null;

  /* Ask for the EXTENSIONLESS path first. Cloudflare Pages answers /maintenance.html with a 308
     to /maintenance, and a 308 is not `ok`, so requesting only the .html form would fail the
     check below, fall through, and the cover would silently never appear while every test still
     passed. Try both, so neither spelling can break it. */
  let html;
  try {
    const grab = async (p) => {
      const u = new URL(p, request.url).toString();
      return (env && env.ASSETS && env.ASSETS.fetch) ? env.ASSETS.fetch(new Request(u)) : fetch(u);
    };
    let res = await grab('/maintenance');
    if (!res || !res.ok) res = await grab('/maintenance.html');
    if (!res || !res.ok) return null;                       // cover missing -> show the real page
    html = await res.text();
    if (!html || html.indexOf('<html') === -1) return null;  // not a page -> fail open
  } catch (e) {
    return null;
  }

  /* Tell the cover which page it stands in front of:
       data-covers    -> which chrome to wear
       data-page-name -> the page's real name, so it can say "come back to Projects later".
     The NAME is passed rather than looked up, because a custom page's name lives in the CMS and
     the cover has no way to know it otherwise. */
  const attrs = ' data-covers="' + esc(hit.covers) + '" data-page-name="' + esc(hit.name) + '"';
  html = html.replace(/<html\b[^>]*>/i, (tag) => tag.replace(/>\s*$/, attrs + '>'));

  return new Response(html, {
    status: 200,                        // 200, not 503: to a visitor this is a normal page
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',      // never cache, or it lingers after the page reopens
      'X-Robots-Tag': 'noindex',
    },
  });
}
