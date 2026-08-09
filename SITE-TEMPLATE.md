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

**Every primary page gets its switch from ONE place: `Site Settings -> Page access`.** It is a
list of `{path, name, open}` rows read by the shared cover engine, so **a page added next year
inherits the control by adding a row, with no code change**. `*` is the whole-site switch. Custom
Pages are the exception: each carries its own switch on its own screen, because they were never a
fixed list. **There is exactly ONE switch per page and it lives in the register.** Rare Pond's
older per-section switches (Projects in Site Settings, and `publicAccess` on Team and Rentals)
were removed from the CMS on 2026-08-09: two controls for one page, either of which could close
it, is a trap. The middleware still honours those keys as a silent fallback, so an old value
cannot strand a page, but nothing writes them any more. The cover is served at the closed page's OWN url by Cloudflare, before any bytes
reach the browser, so a closed page is never delivered. Everything fails OPEN: an unreadable
switch file serves the real page, because wrongly hiding a page costs more than wrongly showing
one.
| 10 | **Legal Terms + Privacy** | `data/legal.json` | Both legal documents, and the shared variables they use. |

### Naming rules

- **Title Case for every section label.** "Form Input Types", not "Form input types".
- **A sub site is labelled `<Name> Sub Site`** and sits directly below Site Settings, so it reads
  as a place rather than a topic. Rare Pond has "Media Sub Site" and "Rentals Sub Site".
- **Labels say what the thing IS, not where it applies.** "Contact Popup", not
  "Contact popup (all sites)": which sites use it is a fact for the description, not the label.

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

Adding a shared module is one entry in that script's `FILES` list, and a row here.

## Which data files are generated, and which are yours

**Generated from NocoDB, never hand-edit:** `projects.json`, `colorlooks.json`, `platforms.json`,
`socials.json`, `bts.json`. A background sync rewrites them, so an edit is lost at the next run.

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
