/* Local server that mimics how Cloudflare Pages actually serves this site, so the
   routing can be tested for real instead of assumed:
     - a static file wins if it exists
     - /foo resolves to foo.html  (this is why the .html back door has to be gated)
     - anything else falls through to /index.html with a 200 (the SPA rule in _redirects)
   The password gate is NOT applied here - this is for exercising the router.
   Run: node tools/serve-like-cloudflare.mjs [port] */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.argv[2] || 8899);
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg',
  '.webp':'image/webp', '.avif':'image/avif', '.ico':'image/x-icon' };

const exists = async p => { try { const s = await stat(p); return s.isFile(); } catch { return false; } };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const tries = [
    join(ROOT, path),
    join(ROOT, path + '.html'),                 // extensionless
    join(ROOT, path, 'index.html'),             // directory
  ];
  for (const f of tries) {
    if (f.startsWith(ROOT) && await exists(f)) {
      res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
      return res.end(await readFile(f));
    }
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });          // SPA fallback
  res.end(await readFile(join(ROOT, 'index.html')));
}).listen(PORT, () => console.log('serving ' + ROOT + ' on http://127.0.0.1:' + PORT));
