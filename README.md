# Rare Pond Studios - Cloudflare Pages site

Two static sites (studio + rentals), no build step. All content lives in editable JSON,
so projects, photos, logos and whole new pages can be changed from a no-code admin.

**Start here:**
- **[`OPERATIONS.md`](OPERATIONS.md)** - how everything runs: hosting, the rental pipeline,
  n8n automations, Supabase, alerting, and the mistakes already made. Read this first.
- **[`STILLS.md`](STILLS.md)** - how film stills are pulled from the ProRes masters. Read
  before touching any still.
- **[`CUSTOM_PAGES.md`](CUSTOM_PAGES.md)** - the CMS-driven page builder.

> This repo is **public**. Never commit keys, tokens or passwords.

## What's where

```
index.html            Studio site (HTML + CSS + JS). Reads the data files below at load.
rentals/index.html    Rentals site. Shares the header/footer/socials data.
data/
  site.json           Logos, hero, About, SOCIAL LINKS, HubSpot form ids, event banner
  projects.json       One entry per project → drives its home bubble AND its project page
  team.json           Team members
  rentals.json        Rentals page copy + logos
  colorlooks.json     Single source of truth for every gradient on both sites
  pages.json          Custom pages (see CUSTOM_PAGES.md)
  stills-hd.json      Which stills have high-res versions, and at which widths (see STILLS.md)
  form-fields.json    Input type per form field (text/email/number/tel/url)
media/                All images (logos, projects, stills, team)
.pages.yml            Pages CMS config - defines the edit forms AND the image specs
_headers              Cache rules (no-cache on /data/* so CMS edits show up immediately)
_redirects            SPA rewrite so deep links like /geriaction work
```

Editing `data/*.json` or replacing a file in `media/` changes the site. `index.html` does
not need to be touched.

## Editing (Pages CMS)

Sign in at **https://app.pagescms.org** with the same GitHub account and open this repo.
Saving commits to GitHub, which auto-redeploys Cloudflare Pages - live in about a minute.

Sections: **Site Settings · Color Looks · Projects · Team · Rentals page · Form input types ·
Custom Pages.**

### Image specs - they're built into the CMS
Every image upload field in the CMS shows its own **SPECS** line (size, format, file-size cap,
colour space) right under the field. There is also a pinned **"📐 READ ME - image specs"** note
at the top of **Site Settings**.

The universal rules: **sRGB 8-bit** (not Display P3 / Adobe RGB - browsers render those wrong);
video frames are **Rec.709 limited range (16–235)** and must be expanded to **full (0–255)** or
blacks look milky; keep files **under 600 KB**; and **never upscale** - a sharp 1600 px file
beats a soft fake 2560.

## Social links (one list, both sites, header + footer)

All social icons on **both** sites, in **both** the header and footer, come from a single list:
`data/site.json → socials`. Edit it once, everything updates.

In the CMS: **Site Settings → Social links**. Each entry has a **Label**, a **URL**, and an
**Icon**: `yt` YouTube · `ig` Instagram · `li` LinkedIn · `fb` Facebook. Add, remove and
reorder freely. On hover each icon fills with that network's brand gradient.

**Adding a network that isn't in the list above needs a code change** - an SVG path plus a
hover gradient, in three places: `index.html` (`SOCIAL_SVG` + the `.socials a[data-net=…]:hover`
rule), `rentals/index.html` (`SOCIAL_SVG`), and `rentals/assets/styles.css` (the hover rule).
Then add the new key to the `icon` options in `.pages.yml`.

## Adding a project

Projects → **＋ Add** → unique `key`, title, theme, images, loglines, where-to-watch, stills,
credits → Save. A bubble appears on the home carousel and the Projects grid, with its own page.

Note: stills uploaded here are served **exactly as uploaded**. The high-resolution responsive
versions are generated from the film master by the stills pipeline - see
**[`STILLS.md`](STILLS.md)**.

## Changing a form field's input type

`data/form-fields.json`, editable in the CMS under **Form input types**. Pick `text`, `email`,
`number`, `tel` or `url` per field. `number` accepts digits only; `email` is validated on submit.
If the file is ever missing, every field falls back to plain text so the forms never break.

## Local preview

The site loads JSON at runtime, so open it through a server, not `file://`:

```
python3 -m http.server 8080
# http://localhost:8080
```
