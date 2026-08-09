#!/usr/bin/env python3
# Local dev server that mirrors the Cloudflare Pages _redirects behaviour for THIS repo, so the
# /media and /rentals routes + SPA fallback resolve exactly like production. Static files win
# first (static-first), then the exact-path rewrites, then the SPA fallback. TEST ONLY.
import http.server, socketserver, os, urllib.parse, posixpath
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # rp_site_work
PORT = int(os.environ.get("PORT", "8799"))

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Mirror Cloudflare Pages: /rentals -> /rentals/ (308) so relative assets resolve.
        p = urllib.parse.urlparse(self.path).path
        # Mirror Cloudflare Pages directory canonicalisation: /section -> /section/
        if p in ("/rentals", "/media"):
            self.send_response(308); self.send_header("Location", p + "/"); self.end_headers(); return
        return super().do_GET()
    def translate_path(self, path):
        p = urllib.parse.urlparse(path).path
        p = posixpath.normpath(urllib.parse.unquote(p))
        fs = os.path.join(ROOT, p.lstrip("/"))
        # static-first: real file wins
        if os.path.isfile(fs):
            return fs
        # directory with an index.html
        if os.path.isdir(fs) and os.path.isfile(os.path.join(fs, "index.html")):
            return os.path.join(fs, "index.html")
        # _redirects rewrites (rentals section + SPA fallback). /media/ resolves to
        # media/index.html via the directory-index branch above, like rentals.
        if p.startswith("/rentals"):
            return os.path.join(ROOT, "rentals", "index.html")
        return os.path.join(ROOT, "index.html")
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a): pass

os.chdir(ROOT)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), H) as httpd:
    print("devserve on http://127.0.0.1:%d (root=%s)" % (PORT, ROOT))
    httpd.serve_forever()
