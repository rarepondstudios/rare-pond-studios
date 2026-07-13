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
import { join, extname } from 'node:path';
import { onRequest } from '../functions/_middleware.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.argv[2] || 8899);
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
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
  const request = new Request(url, { method: req.method });

  // Static serving + the SPA fallback, expressed as the middleware's next().
  const next = async () => {
    const pathname = decodeURIComponent(new URL(url).pathname);
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
