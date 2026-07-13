/* Local server that mimics how Cloudflare Pages actually serves this site, so behaviour
   can be tested for real instead of assumed:
     - functions/_middleware.js runs first, exactly as it does at the edge (this is what
       serves the maintenance cover and the /admin/ password gate)
     - a static file wins if it exists
     - /foo resolves to foo.html  (this is why the .html back door has to be gated)
     - anything else falls through to /index.html with a 200 (the SPA rule in _redirects)

   Run: node tools/serve-like-cloudflare.mjs [port] */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname } from 'node:path';
import { onRequest } from '../functions/_middleware.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.argv[2] || 8899);
const TYPES = {
  '.mp4': 'video/mp4', '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg',
  '.webp':'image/webp', '.avif':'image/avif', '.ico':'image/x-icon' };

const exists = async p => { try { const s = await stat(p); return s.isFile(); } catch { return false; } };

/* Resolve a path to a static asset the way Pages does. */
async function asset(pathname) {
  for (const f of [join(ROOT, pathname), join(ROOT, pathname + '.html'), join(ROOT, pathname, 'index.html')]) {
    if (f.startsWith(ROOT) && await exists(f)) return f;
  }
  return null;
}

/* Stand-in for Cloudflare's env.ASSETS binding, so the middleware can read data/*.json
   and maintenance.html locally exactly as it does in production. */
const ASSETS = {
  fetch: async (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname);
    const f = await asset(p);
    if (!f) return new Response('not found', { status: 404 });
    return new Response(await readFile(f), {
      status: 200,
      headers: { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' },
    });
  },
};

createServer(async (req, res) => {
  const url = 'http://127.0.0.1:' + PORT + req.url;

  /* HTTP RANGE. Cloudflare serves byte ranges; this server did not, and a <video> that is
     told "no ranges here" either refuses to seek or, in Chrome, sits there waiting - which
     is not a bug in the site but it looks exactly like one while testing. The middleware has
     no interest in media, so ranges are answered before it. */
  const media = /\.(mp4|webm|mov|m4v)$/i.test(req.url.split('?')[0]);
  if (media && req.method === 'GET') {
    const f = await asset(decodeURIComponent(new URL(url).pathname));
    if (f) {
      const size = (await stat(f)).size;
      const type = TYPES[extname(f)] || 'video/mp4';
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
        res.writeHead(206, {
          'Content-Type': type, 'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': end - start + 1,
        });
        createReadStream(f, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
      createReadStream(f).pipe(res);
      return;
    }
  }

  const request = new Request(url, { method: req.method });

  // Static serving + the SPA fallback, expressed as the middleware's next().
  const next = async () => {
    const pathname = decodeURIComponent(new URL(url).pathname);

    /* DIRECTORY -> TRAILING SLASH, 308. Cloudflare Pages redirects /rentals to /rentals/
       before serving rentals/index.html, and that redirect is not cosmetic: the rentals page
       links its CSS and JS RELATIVELY (assets/styles.css), so served at /rentals they resolve
       to /assets/styles.css - the wrong directory - and the page arrives with no stylesheet.
       This server used to serve /rentals directly and so displayed a broken page production
       never shows. It belongs HERE, inside next(), because that is the asset layer: the
       middleware still gets first refusal, which is what lets the maintenance cover answer
       /rentals itself without ever being redirected. (Same lesson as the /maintenance.html
       308 that once hid the cover in production: a dev server that does not redirect exactly
       like the edge will lie to you.) */
    if (!pathname.endsWith('/') && !extname(pathname) && await exists(join(ROOT, pathname, 'index.html'))) {
      return new Response(null, { status: 308, headers: { Location: pathname + '/' } });
    }

    const f = (await asset(pathname)) || join(ROOT, 'index.html');
    return new Response(await readFile(f), {
      status: 200,
      headers: { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' },
    });
  };

  let out;
  try {
    out = await onRequest({
      request,
      next,
      env: { ASSETS, COLORLOOKS_PASSWORD: process.env.PASSWORD || 'localtest' },
    });
  } catch (e) {
    out = new Response('middleware threw: ' + e.message, { status: 500 });
  }

  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(PORT, () => console.log('serving ' + ROOT + ' on http://127.0.0.1:' + PORT + ' (middleware ON)'));
