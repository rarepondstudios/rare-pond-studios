# Site template: the standard every Rare Pond site is built to

> **THIS FILE IS LIVE, NOT A SNAPSHOT.** It describes what a site built on this system has today,
> so a new site can be stood up with the standard sections already right. **When you change a
> standard section on rarepond.com or jackcarlsen.com, change it here in the same commit.** A
> template that lags behind the sites it describes is worse than none, because the next site gets
> built from it confidently and wrong.
>
> It bridges hourly into the context folder as
> `project-docs/rp_site_work__SITE-TEMPLATE.md`, so a session with no device access can read it.
>
> **Two templates exist and both stay current.** This file is the standard for a site INSIDE
> Jack's system (NocoDB + exporters + Synology media tree; a new site is one `sites.json`
> entry). **`SITE-TEMPLATE-STANDALONE.md`** is the playbook for a fully separate site for
> someone else: their accounts, no connection to this backend, no always-on machine required.
> When a standard section changes here, check in the same commit whether the standalone
> playbook needs the matching change.
>
> Last updated: 2026-08-09.

## What a site is made of

Every site is a static Cloudflare Pages repo with the same five layers:

| Layer | What it is |
|-------|------------|
| `index.html` | The whole SPA: markup, CSS and JS in one file. Reads the data files at load. |
| `data/*.json` | Everything editable. Some files are edited in Pages CMS, some are GENERATED from NocoDB by a Python exporter and must never be hand-edited. |
| `assets/` | Styles and scripts. Several are **shared masters** owned by `bts-automation` (see below). |
| `functions/_middleware.js` | Cloudflare edge logic: the `/admin/` password gate and the maintenance cover. Server-side, so it cannot be bypassed in the browser. |
| `.pages.yml` | The Pages CMS config: which files are editable, and every field's label and description. |

## The standard Pages CMS sidebar

In this order. A site omits a section only when it genuinely has no such surface.

| # | Section | Edits | Purpose |
|---|---------|-------|---------|
| 1 | **Site Settings** | `data/site.json` | Copy, nav, logos, footer, per-page public switches. |
| 2 | **&lt;Name&gt; Sub Site** | `data/<name>.json` | One per sub site, grouped directly under Site Settings. |
| 3 | **Projects** | `data/section-templates.json` | The shared text templates for project pages. The project LIST lives in NocoDB. |
| 4 | **Team** | `data/team.json` | Only where the site has a team page. |
| 5 | **Custom Pages** | `data/pages.json` | Ad-hoc pages with their own slugs and blocks. |
| 6 | **Contact Popup** | `data/contact.json` | Heading text and the HubSpot form connection. |
| 7 | **Form Input Types** | `data/form-fields.json` | Every CUSTOM form on the site and the input type of each field. |
| 8 | **Color Looks** | `data/colorlooks.json` | View-only. Links to that site's own preview page. Edited in NocoDB. |
| 9 | **Maintenance Cover** | `data/maintenance.json` | The messages shown when a page is switched off. |

**Every primary page carries its own switch, at the top of its own screen.** Not gathered in a
central list: when you want to close the Rentals page you are already on the Rentals screen, so
that is where the switch is. Site Settings additionally holds `siteOpen`, the whole-site switch,
because that is not a page.

**And a page cannot exist without one, structurally.** A data file that declares a `route` IS a
page. `bts-automation/page_index_sync.py` derives `data/page-index.json` from those declarations,
so a page screen added next year is wired into the cover system automatically, with no code
change. `tools/check-page-switches.mjs` (shared master) then fails the build if:

- a file declares a route and has no `publicAccess` switch,
- a declared route is missing from the generated index,
- **the index still lists a route nothing declares any more.** That last one is the dangerous
  case: a stale row sends the engine to read a switch that is gone, absent reads as OPEN, and a
  closed page silently reopens. Both failure modes were confirmed to fail the check before it was
  trusted.
- a page's switch is not reachable from any Pages CMS screen.

Custom Pages keep their own nested switch, which was always the exception. The cover is served at
the closed page's OWN url by Cloudflare before any bytes reach the browser. Everything fails OPEN:
an unreadable index or data file serves the real page, because wrongly hiding a page costs far
more than wrongly showing one.

**Adding a page, end to end:** create its CMS screen, give its data file `route`, `pageName` and
`publicAccess`, put the switch first on the screen. Run `page_index_sync.py`. That is the whole
wiring, and `check-page-switches.mjs` tells you if you missed a step.

## Read-only fields: the empty-box rule

Pages CMS has no "notice" element, so explanatory text is carried by a `readonly` field. There are
two kinds and they must not be mixed.

**Explaining something: leave the box EMPTY and put every word in `description`.**

```yaml
- name: cmsNote
  label: "📋 What this screen is for"
  type: string
  readonly: true
  description: "The home for every custom form on this site and the fields inside it. ..."
```

The empty box is the visual cue that there is nothing to type here. Fields named `cmsNote`,
`nocodbNote` and `readme` all follow this.

**Displaying a value the user needs to read or copy: keep the value, and let `description`
explain what it is for.** A URL, a username, or where a password is stored. `colorlooks.previewUrl`
and `pages.directoryUrl` are the legitimate cases.

**Never put the same text in both.** `imageSpecs` and `varsKey` did exactly that, a condensed copy
in the box and the full version underneath, so a reader had to compare two blocks of prose to
discover they said the same thing. Both were emptied on 2026-08-09.

## Shared masters: edit once, published to every site

These live in `~/bts-automation` and are copied into every site repo by `social_ui_sync.py`.
**Editing the copy inside a site repo is silently reverted on the next run.** Edit the master,
commit `bts-automation`, then run `python3 ~/bts-automation/social_ui_sync.py --publish`.

| Master | Lands as | What it does |
|--------|----------|--------------|
| `contact.js` / `contact.css` | `assets/contact.*` | The Contact popup. |
| `social_ui.js` | `assets/social_ui.js` | Social bubbles and the transport wipe. |
| `cursor.js` | `assets/cursor.js` | The custom cursor engine. |
| `legal_render.js` | `assets/legal-render.js` | Draws /terms and /privacy from `data/legal.json`. |
| `admin_colorlooks.html` | `admin/colorlooks.html` | The colour-look preview. Skins itself per host. |
| `maintenance_lib.js` | `functions/_maintenance.js` | The page-cover engine. `maintenance.html` itself stays per-site chrome. |
| `check_page_switches.mjs` | `tools/check-page-switches.mjs` | Fails when a page has no switch, or the index is stale. |

Adding a shared module is one entry in that script's `FILES` list, and a row here.

## The media pipeline standard (added 2026-08-09)

The rule in one line: **the file you drop is the master and is never degraded; the pipeline
derives everything the web needs, and the site picks the right derivative per screen.**
Masters stay at full resolution in the Synology source folders (plus a 45-day originals
buffer in `bts-automation/_ingest_originals`); what ships is derived from them.

**Images.** Every published image gets WebP derivatives at standard widths alongside a JPEG
fallback, and renderers serve them with `srcset`/`sizes` so a phone pulls only the pixels it
shows. Stills: 800/1600/2560 WebP + 1600 JPEG (the stills pipeline, `stills-hd.json`).
BTS: grid + lightbox WebP (q90, same dimensions as the JPGs) on rarepond
(`rp_bts_sync.py`, `srcW`/`fullW` in `bts.json`) and 800/1600 WebP on the jackcarlsen collage
(`bts_sync.py`, `srcW8`/`srcW`). Never upscale: a derivative larger than its master is never
generated.

**Video.** The dropped `*-reel-web.mp4` publishes untouched as the full-quality original.
The web encode itself is budgeted at the source (`reel_ingest.py`): 1920-wide H.264, CRF
ladder 19 -> 21 -> 23 until the file averages <= ~3.5 Mbps (these are muted ambient loops
served lazily, so first play waits on the download; CRF 23 is the quality floor for the
budget, verified visually transparent, and only the 25 MiB Cloudflare Pages per-file cap
can push the ladder further).
`video_variants.py` (run by `jc_native_media_sync`, and by `projects_media_sync` for the
rarepond repo since 2026-08-10) guarantees, per video in `media/reels`, `media/clips` AND
`media/projects/*/video`: a high-quality 720p
companion (`<name>-720.mp4`, H.264 CRF 19) whenever the original is taller than 720p, a poster
(`<name>.jpg`, reels only, never overwriting a hand-made one), and an entry in
`data/video-variants.json`, which is the manifest the site's `vsrc()` helper reads. Small
screens and Save-Data connections get the companion; desktop always streams the original, so
quality is never reduced where it can be seen. On rarepond the small HOVER PREVIEWS (carousel
side cards, projects-grid bubbles) additionally prefer the companion at every screen size
(`psrc()`): they render a few hundred px wide, so 720p is beyond-retina there and the preview
starts in a fraction of the time. Full-bleed surfaces (film-page background, featured card)
keep the `vsrc()` rule. Off-viewport landing reels are paused by an
IntersectionObserver, which changes nothing visually and cuts mobile streaming to a third.

## Which data files are generated, and which are yours

**Generated from NocoDB, never hand-edit:** `projects.json`, `colorlooks.json`, `platforms.json`,
`socials.json`, `bts.json`. Also generated: `video-variants.json` (from the video files on
disk) and `page-index.json` (from the data files). A background sync rewrites them, so an edit
is lost at the next run.

**Edited in Pages CMS:** `site.json`, `contact.json`, `legal.json`, `form-fields.json`,
`maintenance.json`, `pages.json`, `team.json`, `section-templates.json`, and each sub site's file.

## Where the two sites stand against this template

Kept current deliberately, so the gaps are visible rather than discovered.

| Standard section | rarepond.com | jackcarlsen.com |
|------------------|--------------|-----------------|
| Site Settings | yes | yes |
| Sub Sites | Media, Rentals | none, and none planned |
| Projects | yes, four templates | yes, two templates |
| Team | yes | no team page, correctly absent |
| Custom Pages | yes | not yet needed |
| Contact Popup | yes | yes |
| Form Input Types | yes, one form | yes, empty until a custom form exists |
| Color Looks | yes, own branded page | yes, own branded page, own login |
| Maintenance Cover | yes | yes |
| Legal Terms + Privacy | yes | yes |

### The template count is per site, not fixed

RP uses FOUR shared templates: a project-page eyebrow, the featured-card eyebrow, the
featured-card logline and the grid caption. **jackcarlsen.com uses two**, because its design has
no project-page eyebrow row and no bubble grid to caption. Shipping four fields where two do
nothing is exactly the dead-CMS-field problem this document exists to prevent, so a site gets the
templates its design can actually show, and its `Projects` screen says how many and why.

A template that fills to nothing renders NO element, never an empty one. That rule is what makes
it safe to leave a variable unset: a film with no production company shows no eyebrow row, and a
film with no tagline shows no caption line, rather than a gap where one should be.

## Standing up a new site

1. Copy the repo skeleton: `index.html`, `functions/_middleware.js`, `_headers`, `_redirects`,
   `robots.txt`, `tools/`.
2. Run `social_ui_sync.py` to pull in every shared master.
3. Create the `data/` files for the standard sections above, even the ones that start empty.
4. Copy `.pages.yml` and cut the sections the site genuinely lacks. Keep the order.
5. Register the repo with the exporters and the backup job, then add the row to the parity table
   above and to `04-automations-and-tools.md`.
