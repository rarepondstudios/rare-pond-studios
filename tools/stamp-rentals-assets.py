#!/usr/bin/env python3
"""Give the rentals page's own scripts and stylesheet a version that changes whenever the file changes (2026-10-25).

rentals/index.html loads assets/app.js?v=..., availability.js?v=... and styles.css?v=.... Cloudflare tells browsers
to keep those for 4 hours (zone Browser Cache TTL), so after a deploy a returning visitor kept the OLD script until the
?v= changed by hand (new tab icons "missing", 2026-10-25). This sets v= to the first 10 characters of the file's
SHA-1, so every change gets a fresh URL and an unchanged file stays cached.

Run by the pre-commit hook (bts-automation/hooks/pre-commit, global core.hooksPath) on every commit, by people and by the scheduled
jobs alike, using the STAGED copy of each file; also safe to run by hand: python3 tools/stamp-rentals-assets.py
Exit 0 always; prints what it changed."""
import hashlib, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "rentals", "index.html")
ASSETS = ["app.js", "availability.js", "styles.css"]

def staged(rel):
    """The staged copy when called from the hook (what is being committed), else the working file."""
    if os.environ.get("RP_STAMP_STAGED"):
        r = subprocess.run(["git", "-C", ROOT, "show", ":" + rel], capture_output=True)
        if r.returncode == 0: return r.stdout
    return open(os.path.join(ROOT, rel), "rb").read()

def stamp(text, vers):
    for a, v in vers.items():
        text = re.sub(r'(assets/%s\?v=)[0-9A-Za-z]+' % re.escape(a), r"\g<1>" + v, text)
    return text

def main():
    vers = {a: hashlib.sha1(staged("rentals/assets/" + a)).hexdigest()[:10] for a in ASSETS}
    # the working file
    html = open(PAGE, encoding="utf-8").read(); out = stamp(html, vers)
    if out != html:
        open(PAGE, "w", encoding="utf-8").write(out); print("stamped rentals/index.html")
    # from the hook: stamp the STAGED page only (never stage other unstaged edits to it)
    if os.environ.get("RP_STAMP_STAGED"):
        cur = staged("rentals/index.html").decode("utf-8"); new = stamp(cur, vers)
        if new != cur:
            h = subprocess.run(["git", "-C", ROOT, "hash-object", "-w", "--stdin"], input=new.encode("utf-8"), capture_output=True).stdout.decode().strip()
            mode = subprocess.run(["git", "-C", ROOT, "ls-files", "-s", "rentals/index.html"], capture_output=True, text=True).stdout.split()[0]
            subprocess.run(["git", "-C", ROOT, "update-index", "--cacheinfo", "%s,%s,rentals/index.html" % (mode, h)], check=True)
            print("stamped the staged rentals/index.html")
    return 0

if __name__ == "__main__":
    sys.exit(main())
