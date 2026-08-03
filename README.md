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
  projects.json       One entry per project (home bubble + project page). GENERATED from NocoDB — never hand-edit.
  team.json           Team members
  rentals.json        Rentals page copy + logos
  colorlooks.json     Every colour look. GENERATED from the NocoDB color_looks table — never hand-edit.
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

### Colour convention (foreground vs. glow) — for anyone editing `index.html` / `looks.js`
`--g1/--g2/--g3` are the **bubble-glow colours ONLY** (signature stops on `:root`; a project's
opt-in bubble hover uses `--h1/--h2/--h3`). Every **foreground** look colour — carousel/project
kicker, date/meta, section label, type/genre chip, accent text, accent borders/hovers — must read
a **semantic token**: `var(--kicker-color)` for kickers, `var(--accent)` for everything else. The
shared resolver `assets/looks.js` `filmCss()` sets those per project on the `.theme-<key>` scope
(and sets `--accent` inline on every `.citem` carousel card), so each film's own accent is
inherited automatically. **Never** paint foreground text with a raw `var(--g1/2/3)`, and any new
view that shows a project must go through `filmCss()` / `.theme-<key>`. (jackcarlsen.com follows
the identical convention with its inline `applyLook` / `lookVarCss` resolver.)

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
**Icon** chosen from the shared platform set: `yt` YouTube · `vimeo` Vimeo · `ig` Instagram ·
`li` LinkedIn · `x` X · `fb` Facebook · `tiktok` TikTok · `threads` Threads · `web` website ·
`imdb` IMDb. Add, remove and reorder freely. On hover each icon fills with that network's brand
gradient.

The logos + brand colours all come from the **shared `data/platforms.json`** (see *The shared
cross-site backend* below) — ONE source for both sites, feeding both the header/footer social
icons AND the project-page "Watch on" buttons (YouTube and Vimeo are a single dual record).
Enabling an icon already defined there needs no code change; adding a brand-new platform means
adding it to the shared platform source, which then exports to every repo.

## Adding or editing a project

The film list lives in **NocoDB**, not in Pages CMS — see *The shared cross-site backend* below.
Add a row (or edit one), tick `on_rarepond` (and/or `on_jackcarlsen`), set its colour look, order
and per-film text, and the background sync rebuilds `data/projects.json` and redeploys. A bubble
appears on the home carousel and the Projects grid, with its own page. Never hand-edit
`data/projects.json`. (Pages CMS → Projects only holds the shared text templates + a pointer to
NocoDB.)

Note: stills are managed through the per-project media folders (see the folder schema below) and
served responsively. The high-resolution versions are generated from the film master by the
stills pipeline - see **[`STILLS.md`](STILLS.md)**.

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

---

## The shared cross-site backend (rarepond.com ↔ jackcarlsen.com)

rarepond.com and **jackcarlsen.com** are two static sites that **share one backend**. The film
catalogue and the colour looks are not stored in either repo by hand — they flow from a single
database, through per-site exporters, into each repo's `data/*.json`, which the site reads at
load. Both READMEs describe this same system; the authoritative map is
`bts-automation/SYSTEM_MAP_AND_PLAN.md` (local, not public).

### 1. NocoDB = the single source of truth
On the Mac Mini, **NocoDB** (a spreadsheet-style UI over a Supabase Postgres database) holds the
two tables both sites depend on:
- **`projects`** — one row per film. Per-film site membership is the **`on_rarepond` /
  `on_jackcarlsen`** checkboxes.
- **`color_looks`** — one row per colour look (palettes that theme film pages + glow the bubbles).
NocoDB is **local-only** (loopback + Tailscale, `http://localhost:8080`) — never exposed
publicly, so it is described here, not linked.

### 2. Per-site exporters + the sites registry
Headless scripts in `~/bts-automation`, run on a schedule by macOS **launchd**, read the database
and **regenerate each site's `data/*.json`, then commit + push** so Cloudflare Pages redeploys:
- **`projects.json` (BOTH sites)** ← one shared Python exporter **`projects_sync.py`** on
  launchd. It loops `sites.json` and emits each site's exact shape. rarepond runs it via
  `com.rarepond.rpprojsync` (every 5 min). *(This **replaced the n8n** workflow "Projects: DB to
  site (rarepond)", now retired — n8n no longer builds site content.)* jackcarlsen currently still
  publishes via the equivalent **`jc_projects_sync.py`** (launchd `com.rarepond.jcprojsync`);
  `projects_sync.py` reproduces its output byte-for-byte and can subsume it by flipping that job.
  The old JC GitHub-Action export is retired — ONE pipeline per site.
- **`colorlooks_sync.py`** → every repo's `data/colorlooks.json` from `color_looks` (JC keeps its
  own purple `signature` via `data/colorlooks-overrides.json`; rarepond is the colour-look owner).
- **`platforms_export.py`** → every repo's `data/platforms.json` from the shared platform source.
- BTS syncs → `data/bts.json` + the NocoDB `bts` field.
Every exporter loops the **connected-sites registry** `bts-automation/sites.json` (one entry per
site: repo path, git identity/askpass, per-site column names). **Adding a third site = one new
entry there, not a code fork.**

### 3. The media folder schema (folder = source of truth)
Media lives in the Synology `Project Repository (Web)/<Project>/` folders. Selection is by
**FOLDER, never by filename**. Each project folder has six subfolders:

| Folder | Fills | Rule |
|---|---|---|
| `Project Stills/` | the film's still gallery + NocoDB `stills` list | every image, in order = gallery order |
| `Project Video/` | the background / hover reel + NocoDB `focus_video` | **first reel wins** (name order): `*-reel-web.mp4`, else `*-web.mp4`, else a loose `*.mp4`; `High Resolution Versions/` ignored |
| `BTS/` | the behind-the-scenes gallery | every image, in order |
| `Bubble Image/` | the home-bubble image | **first file wins** |
| `Logo/` | the title logo | **first file wins** |
| `Focus Image/` | the page-background image (optional override) | **first file wins** |

The **Focus Image is ALWAYS the FIRST still** on every project page (both sites), then the
Project Stills in order; the `Focus Image/` folder only overrides that. Drop a file in a folder
and it appears with that folder's role next sync; move it and it re-homes cleanly. **The `stills`
list and the `focus_video` reel path are written into NocoDB automatically from the folder**
(auto-fill on drop, clear on removal, idempotent) — so a new film's reel goes live from the
folder alone, with no path typed into the database. **Unsorted /
general BTS:** the `Unsorted Photo and Video` folder is split into `jackcarlsen.com/` and
`rarepond.com/` subfolders — a file's enclosing subfolder decides which site's general BTS scroll
it shows on.

### 3a. Folder auto-provision & #recycling (adding / removing a film)
Project folders stay **1:1** with the NocoDB projects table automatically — never hand-make or
hand-delete one. `projects_folder_sync.py` (launchd `com.rarepond.projfoldersync`, every 5 min):
- **New row → new folder.** A project row with no matching folder gets a folder named by its
  **title** (fallback `key`), pre-built with the six D1 subfolders above (+ `Logo/.noletterbox`).
  Then drop media in and the media syncs take over — the row flows to both sites via the exports.
- **Deleted row → recycled folder.** When a row is deleted, its previously-linked folder is
  **moved to `Project Repository (Web)/#recycling/`** (never deleted; restore by moving it back).
- **Matching:** `slug(folder) == slug(title)` or `slug(key)` (`slug` = lowercase, strip
  non-alphanumerics) — the same rule the media syncs use.
- **Safety:** aborts if NocoDB is unreachable or returns 0 rows; only recycles folders that were
  linked in its state file (`bts-automation/projects_folder_state.json`), so pre-existing unmapped
  folders (e.g. `Stolen Heart`) and the BTS pool are never touched; placeholder rows get no folder.
  (`color_look` blank ⇒ each site still exports `"signature"` — that default is applied at export,
  unchanged.)

### 4. Shared platform map, 5. colour-look flow, 6. cache-busting
- **Platforms:** all social + "watch on" branding (real logos + brand colours) lives in one
  shared source → `data/platforms.json` in every repo. **YouTube and Vimeo are dual** — one
  record with `contexts: ["social","watch"]` feeds both the header icon and the watch button.
  IMDb is defined once (enabled on JC's header; can be turned on for RP with no code change).
- **Colour looks:** a look holds `c1/c2/c3` and, for a `film` look, tokens saying which colour
  drives accent / washes / kicker / tagline / title. A film points at a look by key
  (`color_look`), gated per-site by `rp_use_look` / `jc_use_look`. The
  **[preview page](https://www.rarepond.com/admin/colorlooks)** (password-protected) renders each
  look exactly as the site does, so **preview == live**.
- **Cache-busting:** exporters append `?h=<short sha1 of the file bytes>` to changed media paths,
  so a replaced file always gets a fresh URL and never serves stale; unchanged files stay cached.

### ⚠️ The one structural rule (D7 — no frontend bandaids)
**Every change to films, colour looks, platforms, or media is made at the DATABASE / SYNC SOURCE
layer, and BOTH sites are regenerated from it.** Never hand-edit a rendered value in one site's
`data/*.json`, `index.html`, or `colorlooks.json` to "fix" what shows on screen — fix the NocoDB
row / the shared source file / the sync, then let the exporter rewrite every repo. This keeps the
two sites (and any future third) identical-by-construction. If something looks wrong on only one
site, the bug is in the source or the sync, not the frontend.

| Concern | Single source | Published to every repo by |
|---|---|---|
| Films | NocoDB `projects` | Python `projects_sync.py` (RP, launchd) / `jc_projects_sync.py` (JC), via `sites.json` |
| Colour looks | NocoDB `color_looks` | `colorlooks_sync.py` → `data/colorlooks.json` |
| Platforms / socials | shared `platforms.json` source | `platforms_export.py` → `data/platforms.json` |
| Media | Synology project folders | the media + BTS syncs (folder = source of truth) |
| Site copy | Pages CMS `data/*.json` | committed directly |

### n8n vs Python (the split)
Two automation runtimes, one clear division of labour:
- **Python (macOS `launchd`) BUILDS SITE CONTENT** — it turns the database / source layer into
  each repo's `data/*.json` + media (`projects_sync.py`, `jc_projects_sync.py`, `colorlooks_sync.py`,
  `platforms_export.py`, the media + BTS syncs, `projects_folder_sync.py`, `rentals_units_sync.py`).
- **n8n is EVENT-DRIVEN GLUE ONLY** — forms intake, the rentals HubSpot↔DB sync, third-party
  integrations, failure alerts + watchdog, weekly backups, and the health monitor. **n8n no longer
  builds any site content** (the "Projects: DB to site (rarepond)" workflow was retired 2026-08-03).

**Automation inventory:** the ClickUp doc **"[Monitor] Automation Health"** now covers BOTH — the
n8n workflows (page "Automation Health", written from inside the container) and the Python launchd
jobs (page "Automation Health — Python Jobs (launchd)", written by the host-side
`automation_health_launchd.py`, launchd `com.rarepond.pyhealthmon`). Each entry shows purpose,
schedule, and last-run status.

### Field schema (the fields future edits touch)
**`projects`** (NocoDB): `key`, `title`, `year`, `kicker`, `tagline`, `blurb`, `page_logline`,
`credits`, `genre`, `type`, `medium`, `production`, `status`, `social_links`, `watch`; media path fields
`bubble_image`, `title_logo`, `focus_bg`, `focus_video`, `stills`, `bts`; per-site toggles
`on_rarepond` / `on_jackcarlsen`, `rp_use_look` / `jc_use_look`, `rp_in_carousel` /
`jc_in_carousel`, `jc_in_workwall`, `rp_sort_order` / `jc_sort_order`; and the shared
`color_look`. Multi-value fields (genre, stills, bts, credits) are plain text, **one entry per
line**.
**`medium`** (SingleSelect: **Live Action / Animation / Mixed Media**) categorises each film's
production medium. It renders as a highlighted chip on the project page immediately **after** the
`type` chip and **before** the genre pills (order `[type][medium][genres]`, type + medium both in
the secondary accent colour), and is the sort key the jackcarlsen portfolios will use later. It
was **migrated out of `genre`** (2026-08): the medium tokens (`Live Action` / `Live-Action` /
`Animation` / `Mixed Media`) were stripped from `genre`, which now holds **story genre only**.
**`color_looks`** (NocoDB): `key`, `name`, `kind` (`basics` / `special` / `category` / `film`),
`c1` `c2` `c3`; and — for a `film` look only — `accent`, `main` + `main_alpha`, `tint` +
`tint_alpha`, `kicker_color`, `kicker_tracking`, `tagline_color`, `tagline_italic`,
`title_style`, `title_gradient_from` / `title_gradient_to`, plus `note`.

### See also
The **jackcarlsen-website** repo `README.md` documents this same shared system from the portfolio
side. Studio-specific operations (rentals pipeline, n8n, Supabase, alerting) are in
[`OPERATIONS.md`](OPERATIONS.md); the stills pipeline in [`STILLS.md`](STILLS.md).
