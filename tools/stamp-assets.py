#!/usr/bin/env python3
"""Give every page's own scripts and stylesheets a version that changes whenever the file changes.

SHARED TOOL: master bts-automation/stamp_assets.py, published to tools/stamp-assets.py in rp_site_work AND
jackcarlsen-website by social_ui_sync.py (2026-10-27; it began as rp_site_work's tools/stamp-rentals-assets.py
on 2026-10-25). Edit the master, not a copy.

WHY: Cloudflare tells browsers to keep .js and .css for 4 hours (the rarepond.com and jackcarlsen.com zones'
Browser Cache TTL overrides the max-age=0 Cloudflare Pages sends, so _headers cannot fix it). After a deploy a
returning visitor kept the OLD script until its ?v= changed: new tab icons "missing" (2026-10-25), and on
2026-10-27 Jack could not be sure his other computers were running the latest bubble code. Every reference like
    "/assets/chrome.css"   "/assets/rp-bubble.js?v=..."   "assets/app.js?v=..." (relative to the page)
in a tracked .html page (and in a tracked .js file that loads another asset, e.g. contact.js -> contact.css)
gets ?v=<first 10 characters of the file's SHA-1>. Every change gets a fresh URL, an unchanged file stays cached.
JS files are stamped first, so a page picks up the new hash of a script whose own reference just changed.
Fonts (/assets/fonts/, cached as immutable under their own file names) and a file's reference to itself are skipped.

Run by the pre-commit hook (bts-automation/hooks/pre-commit, global core.hooksPath) on every commit that stages an
.html, .js or .css file, by people and by the scheduled jobs alike, using the STAGED copy of each file; also safe to
run by hand: python3 tools/stamp-assets.py   Nobody edits v= by hand any more.
Exit 0 always; prints what it changed."""
import hashlib, os, posixpath, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGED = bool(os.environ.get("RP_STAMP_STAGED"))
REF = re.compile(r"""(?P<q>["'])(?P<path>(?:/|\.\./|\./)?(?:[A-Za-z0-9_\-]+/)*assets/[A-Za-z0-9_.\-/]+\.(?:js|css))(?:\?v=[0-9A-Za-z]+)?(?=(?P=q))""")


def git(*a, **k):
    return subprocess.run(["git", "-C", ROOT] + list(a), capture_output=True, **k)


def tracked():
    out = git("ls-files", "-z").stdout.decode("utf-8", "replace").split("\0")
    return set(p for p in out if p)


def content(rel):
    """The staged copy when called from the hook (what is being committed), else the working file."""
    if STAGED:
        r = git("show", ":" + rel)
        if r.returncode == 0:
            return r.stdout
    p = os.path.join(ROOT, rel)
    return open(p, "rb").read() if os.path.exists(p) else None


def resolve(page, ref):
    if ref.startswith("/"):
        return ref[1:]
    return posixpath.normpath(posixpath.join(posixpath.dirname(page), ref))


def stamp_text(page, text, files, cache):
    def sub(m):
        target = resolve(page, m.group("path"))
        if target == page or target.startswith("assets/fonts/") or target not in files:
            return m.group(0)
        if target not in cache:
            data = content(target)
            cache[target] = hashlib.sha1(data).hexdigest()[:10] if data is not None else None
        if not cache[target]:
            return m.group(0)
        return m.group("q") + m.group("path") + "?v=" + cache[target]
    return REF.sub(sub, text)


def write_staged(rel, new):
    h = git("hash-object", "-w", "--stdin", input=new.encode("utf-8")).stdout.decode().strip()
    mode = git("ls-files", "-s", rel, text=True).stdout.split()[0]
    subprocess.run(["git", "-C", ROOT, "update-index", "--cacheinfo", "%s,%s,%s" % (mode, h, rel)], check=True)


def main():
    files = tracked()
    js = sorted(p for p in files if p.endswith(".js") and "/assets/" in "/" + p and not p.startswith("node_modules/"))
    html = sorted(p for p in files if p.endswith(".html"))
    cache = {}
    for page in js + html:   # scripts first: their hashes change when their own references are stamped
        # the working file
        wp = os.path.join(ROOT, page)
        if os.path.exists(wp):
            cur = open(wp, encoding="utf-8").read()
            out = stamp_text(page, cur, files, cache)
            if out != cur:
                open(wp, "w", encoding="utf-8").write(out); print("stamped " + page)
        # from the hook: stamp the STAGED copy only (never stage other unstaged edits to it)
        if STAGED:
            r = git("show", ":" + page)
            if r.returncode != 0:
                continue
            cur = r.stdout.decode("utf-8")
            new = stamp_text(page, cur, files, cache)
            if new != cur:
                write_staged(page, new); print("stamped the staged " + page)
        cache.pop(page, None)   # a stamped script's own hash is recomputed when a page references it
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:   # never block a commit
        print("stamp-assets: " + str(e)); sys.exit(0)
