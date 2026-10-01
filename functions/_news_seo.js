/* News SEO at the edge (added 2026-09-30).
 *
 * The studio site is a single-page app: /news and /news/<key> both serve index.html and the
 * browser renders the article from /data/news.json. That is fine for people and useless for
 * link previews and crawlers that read the <head> first. So, for those two routes only, this
 * rewrites the <head> of the SPA shell on the way out: <title>, description, canonical, the
 * Open Graph / Twitter tags and a JSON-LD NewsArticle (or a CollectionPage for the list), all
 * taken from data/news.json, the SAME file the browser renders from, so the two never disagree.
 *
 * FAILS OPEN: any error, a missing data file, or no HTMLRewriter (local harness) returns null and
 * the middleware serves the untouched page. An unknown article key serves the shell with a real
 * 404 status so a dead link is never indexed as a page (the SPA still shows the list).
 */
import { readJson, esc } from './_maintenance.js';

const ORIGIN = 'https://www.rarepond.com';
const FALLBACK_IMG = ORIGIN + '/media/logos/rare-pond-color.png';

function abs(p) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return ORIGIN + (p.charAt(0) === '/' ? p : '/' + p);
}

function clip(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
}

function articleMeta(a) {
  const url = ORIGIN + '/news/' + encodeURIComponent(a.key);
  const img = abs(Array.isArray(a.images) && a.images.length ? a.images[0] : '') || FALLBACK_IMG;   /* the first image is the lead */
  const desc = clip(a.teaser || '', 160);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.title || '',
    description: desc,
    image: [img],
    datePublished: a.date || undefined,
    dateModified: a.updated || a.date || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'Rare Pond Studios', url: ORIGIN + '/' },
    publisher: { '@type': 'Organization', name: 'Rare Pond Studios', url: ORIGIN + '/',
      logo: { '@type': 'ImageObject', url: FALLBACK_IMG } },
    articleSection: a.category || undefined,
  };
  return { title: (a.title || 'News') + ' | Rare Pond Studios', desc, url, img, type: 'article', ld };
}

function listMeta(page, list) {
  const seo = (page && page.seo) || {};
  const url = ORIGIN + '/news';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'News | Rare Pond Studios',
    url,
    mainEntity: { '@type': 'ItemList', itemListElement: list.slice(0, 20).map((a, i) => ({
      '@type': 'ListItem', position: i + 1, url: ORIGIN + '/news/' + encodeURIComponent(a.key), name: a.title || '' })) },
  };
  return {
    title: seo.title || 'News | Rare Pond Studios',
    desc: clip(seo.description || 'News and updates from Rare Pond Studios.', 160),
    url, img: FALLBACK_IMG, type: 'website', ld,
  };
}

function rewrite(res, m) {
  if (typeof HTMLRewriter === 'undefined') return null;
  const setContent = (v) => ({ element(e) { e.setAttribute('content', v); } });
  const ldJson = JSON.stringify(m.ld).replace(/</g, '\\u003c');
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(m.title); } })
    .on('meta[name="description"]', setContent(m.desc))
    .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', m.url); } })
    .on('meta[property="og:type"]', setContent(m.type))
    .on('meta[property="og:title"]', setContent(m.title))
    .on('meta[property="og:description"]', setContent(m.desc))
    .on('meta[property="og:url"]', setContent(m.url))
    .on('meta[property="og:image"]', setContent(m.img))
    .on('meta[name="twitter:title"]', setContent(m.title))
    .on('meta[name="twitter:description"]', setContent(m.desc))
    .on('meta[name="twitter:image"]', setContent(m.img))
    .on('head', { element(e) { e.append('<script type="application/ld+json">' + ldJson + '</script>', { html: true }); } })
    .transform(res);
}

/* Returns a Response for /news and /news/<key>, or null to let the middleware carry on. */
export async function newsSeo(context, pathname) {
  const { request, env, next } = context;
  const m = /^\/news(?:\/([^\/]+))?\/?$/i.exec(pathname || '');
  if (!m) return null;
  let key = '';
  try { key = m[1] ? decodeURIComponent(m[1]) : ''; } catch (e) { key = m[1] || ''; }
  let page = null, data = null;
  try { page = await readJson(env, request, '/data/news-page.json'); } catch (e) { page = null; }
  try { data = await readJson(env, request, '/data/news.json'); } catch (e) { data = null; }
  const list = (data && Array.isArray(data.news)) ? data.news.filter((a) => a && a.key) : null;
  if (!list) return null;                                    // data unreadable -> untouched page
  const article = key ? list.find((a) => a.key === key) : null;
  if (key && !article) {
    const res = await next();
    const out = new Response(res.body, res);
    return new Response(out.body, { status: 404, headers: out.headers });   // dead link, real 404
  }
  const res = await next();
  const ct = (res.headers.get('Content-Type') || '').toLowerCase();
  if (!ct.includes('text/html')) return res;
  const meta = article ? articleMeta(article) : listMeta(page, list);
  const rewritten = rewrite(res, meta);
  return rewritten || res;
}
