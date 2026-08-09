# How the whole thing actually runs

Written for the next person - human or AI - who has to keep this working.

> **⚠️ 2026-08-04 refresh.** The cross-site backend has evolved since parts of this doc were
> written: site content is now built by **Python exporters on macOS launchd** (in
> `~/bts-automation`, looping the `sites.json` registry), **not** by n8n, the old n8n
> "Projects: DB to site (rarepond)" workflow was retired 2026-08-03. n8n remains event-driven
> glue only (rentals HubSpot↔DB sync, integrations, alerts, backups). There is also a THIRD
> surface, **`media/index.html` → rarepond.com/media**, and a separate jackcarlsen.com repo
> sharing the same backend. The canonical current-state master is the context folder
> **`~/Desktop/AI_System_Context`** (local, non-public; start with `START-HERE.md`), trust it
> over any stale wording below; the former `SYSTEM_SOURCE_OF_TRUTH.md` is now a pointer. The n8n-specific sections here have been corrected; the rentals pipeline,
> Supabase, alerting, and "things that have bitten us" sections remain fully current.

> **This repository is PUBLIC.** No keys, passwords, tokens or API secrets go in this file
> or anywhere else in this repo. Where a secret is needed, this document says *where it
> lives*, never what it is.

---

## The three surfaces (one repo)

| | |
|---|---|
| **Studio** | `index.html` at the repo root → www.rarepond.com |
| **Rentals** | `rentals/index.html` → www.rarepond.com/rentals/ |
| **Media** | `media/index.html` → www.rarepond.com/media/ |

All three are plain static files with **no build step**. They fetch `data/*.json` at runtime, so
editing a JSON file changes the site with no code change.

**Hosting:** Cloudflare Pages, auto-deploying from the `main` branch of this GitHub repo.
Push to `main` → live in about a minute. There is no staging environment.

**`_headers`** sets no-cache on `/data/*` so CMS edits appear immediately.
**`_redirects`** does the SPA rewrite so deep links like `/geriaction` work.

**Editing, two places, one for each kind of thing:**

- **Projects (the film catalogue)** live in the **shared database**, edited through **NocoDB**
  (`http://localhost:8080`). This is the single source of truth for every project: its content,
  and which sites show it (the `on_rarepond` / `on_jackcarlsen` checkboxes). The background
  **Python exporter `projects_sync.py`** (launchd `com.rarepond.rpprojsync`, every 5 min)
  rebuilds `data/projects.json` from the database and commits it, see "The projects
  pipeline" below.
- **Everything else** stays in **[Pages CMS](https://app.pagescms.org)** (reads `.pages.yml`,
  saving commits to GitHub → redeploys): **Color Looks**, Team, Site Settings, Rentals page,
  Form input types, Custom Pages, Maintenance. The **Projects** section in Pages CMS is now just
  the site-wide *"projects page open/closed"* switch plus a **read-only mirror** of the catalogue,
  edit projects in NocoDB, not there (anything typed into the mirror is overwritten by the sync).

**Why the split:** projects change often and are shared across sites, so they belong in one
database that every site reads from. Color looks, team, and settings are small, site-specific,
and benefit from git history, so they stay in Pages CMS. A project references a color look **by
name** (`colorLook`), so the two never fight: the palette lives in Color Looks, the assignment
lives on the project.

**Recurring maintenance, the exporters' GitHub credentials expire.** The Python exporters
commit to this repo (and the jackcarlsen repo) using stored GitHub credentials (askpass
helpers in `~/bts-automation`) that can lapse. When one lapses, that site's export silently
stops committing. A desktop reminder fires ~8 days before expiry, and the rotation procedure
lives in [`tools/ROTATE-GITHUB-PAT.md`](tools/ROTATE-GITHUB-PAT.md). If "my NocoDB edit isn't
going live", check the exporter logs in `~/bts-automation` and the ClickUp "Automation
Health" doc first.

---

## The projects pipeline (database → site)

**The chain:** edit in NocoDB → the Python exporter **`projects_sync.py --site rarepond`**
(launchd `com.rarepond.rpprojsync`, in `~/bts-automation`) reads `rp.projects` from Supabase →
rebuilds `data/projects.json` (only rows with `on_rarepond` ticked) → commits to GitHub →
Cloudflare redeploys. It runs every 5 minutes and can be run by hand
(`python3 projects_sync.py --site rarepond --publish`). It **only commits when something
actually changed** (it compares by meaning, so JSON key-order never triggers a needless
commit). *(This exporter replaced the old n8n "Projects: DB to site (rarepond)" workflow on
2026-08-03; the jackcarlsen equivalent is `jc_projects_sync.py` on `com.rarepond.jcprojsync`.)*

**Where each thing lives**

| Thing | Lives in | Edited in |
|---|---|---|
| Project content (title, logline, stills, watch, images…) | `rp.projects` row | NocoDB |
| Which sites show a project | `on_rarepond` / `on_jackcarlsen` checkboxes | NocoDB |
| Per-site flags (use look, in carousel, sort order) | `rp_*` / `jc_*` columns | NocoDB |
| Colour palettes (the actual colours) | NocoDB `color_looks` table → exported to `data/colorlooks.json` | NocoDB (Pages CMS → Color Looks is view-only) |
| Projects page open/closed | `data/site.json` `projectsPublicAccess` | Pages CMS → Projects |

**How to make common changes**

- **Add a new Rare Pond project:** in NocoDB, add a row, fill the content, tick `on_rarepond`.
  Leave the color look blank and the site uses the **`signature`** look; when you want a bespoke
  palette, add a *film* look in the NocoDB `color_looks` table and put its key in the project's
  `color_look` field (with `rp_use_look` on). Within ~5 min it's live.
- **Take a project off Rare Pond (or put it back):** just untick/tick `on_rarepond` on that row.
  **Nothing is lost**, the row, all its content, and its per-site settings stay in the
  database. Re-ticking brings it back exactly as it was. (The same row can be on jackcarlsen
  independently via `on_jackcarlsen`.)
- **Change a film's colours:** edit that film's look in the NocoDB `color_looks` table. Every
  project pointing at it updates on both sites (Pages CMS → Color Looks is a view-only preview
  link). No project edit needed.
- **Close/open the projects page:** Pages CMS → Projects → the "open to the public" switch.
- **Reorder the carousel:** the `rp_sort_order` column in NocoDB (**higher = shown first**; leave
  gaps like 30/20/10 so new films slot in without renumbering).

**One source of truth:** never edit the project list inside Pages CMS, it's a read-only mirror and
the sync overwrites it. Projects + colour looks = NocoDB; team, settings, page copy = Pages CMS.

---

## The rental pipeline (the part with moving parts)

A rental request travels like this:

```
Customer on /rentals/  →  Jotform (rental form)
                             │
              ┌──────────────┴───────────────┐
              │ Jotform's NATIVE integrations │   <-- these do the work. Leave them ON.
              ▼                              ▼
        HubSpot deal                  Google Calendar
   (incl. rp_order_data)         (pickup event + return event)
              │
              ▼
     n8n: "HubSpot → Rental DB Sync"  (polls HubSpot every 5 min)
              │
              ▼
        Supabase: orders + bookings   (price recomputed server-side)
              │
              ▼
     n8n: "Rental DB → HubSpot Stage Push"
```

**Critical:** the HubSpot deal and the calendar events are created by **Jotform's own native
integrations**, not by n8n. There used to be an n8n workflow doing the same job - it has been
**retired**, because running both produced duplicate deals and duplicate calendar events. If
you see duplicates reappear, something re-enabled a second path.

**`rp_order_data`** is a hidden Jotform field mapped to a HubSpot deal property. It encodes the
cart (`s:START|e:END|i:ID:QTY,ID:QTY`) and is what lets Supabase rebuild the order.

**Draft deals are skipped on purpose.** `hubspot_sync_order` returns early for deals still at
the draft stage - an order only lands in Supabase once the deal advances (e.g. to contract-sent).
That is intended behaviour, not a bug.

**Pricing is inclusive of both days.** A Jul 27 → Jul 30 rental is **4 days, not 3**. It is
computed server-side in Postgres (see the Supabase section).

---

## How to actually reach n8n / NocoDB (and why no URLs are written here)

This repo is **public**, so no internal hostnames, ports or IPs are written in it - on
purpose. They were removed once already after leaking.

The access details live in two places:

- **ClickUp -> Work -> "Remote Access Cheat Sheet"** - the working doc. Every link in it
  is tested. Start here.
- `~/rp_site_private/REMOTE_ACCESS.md` on the Mac mini - the same thing, offline.

The short version, without the specifics: n8n and NocoDB run in Docker on the studio Mac
and are bound to **loopback + the Tailscale address only**. They are deliberately NOT
reachable over the home Wi-Fi, and never over the public internet. You get to them by
joining the private network (Tailscale), not by opening a port.

Two rules that matter:
- **Never run `tailscale funnel`** on them. `serve` keeps a service private to the
  network; `funnel` publishes it to the entire internet.
- **Never rebind them to `0.0.0.0`** to "make them work at home". That puts the rental
  database and the automation engine on the local Wi-Fi.

## n8n (automations)

Runs in Docker on an in-studio machine, bound to localhost - **not reachable from the
internet**. Backed by SQLite. (Exact host, port and access details are deliberately not in this
public repo - see "Where the private details live" at the bottom.)

Workflows (mind the **Status** column - some are inactive *by design*):

| Workflow | Status | What it does |
|---|---|---|
| HubSpot → Rental DB Sync | **ACTIVE** | polls HubSpot, writes orders/bookings to Supabase |
| Rental DB → HubSpot Stage Push | **ACTIVE** | pushes stage changes back |
| ~~Projects: DB to site (rarepond)~~ | **RETIRED 2026-08-03** | replaced by the Python exporter `projects_sync.py` on launchd (see the projects pipeline). n8n no longer builds any site content. |
| **[Alerts] Workflow Failure → Email** | **ACTIVE** | fires on ANY workflow error |
| **[Alerts] Watchdog - workflow gone silent** | **ACTIVE** | every 30 min, flags a workflow that has stopped running at all |
| ~~`[Website Forms]` Jotform Intake / Crew / Rental → HubSpot + Calendar~~ | **DELETED 2026-08-03** | The old n8n copy of the form → HubSpot + Calendar job. **Jotform's own native integrations do this now** (see "The rental pipeline" above); after a live end-to-end proof the inactive workflows were deleted (backed up to `bts-automation/backups/n8n_20260803/`). Do not resurrect them - running them alongside native previously created duplicate deals + duplicate calendar events. |

> **The `[Website Forms]` workflows are GONE from n8n on purpose** (deleted 2026-08-03, backup in
> `bts-automation/backups/n8n_20260803/`) - not a broken or rolled-back migration. The source of
> truth for form → HubSpot + Calendar is **Jotform's native integrations**, full stop. If someone
> reports "the form workflows are missing, did something break?" - the answer is no; that's how
> it's supposed to be. Never rebuild them while Jotform native is on - that combination created
> duplicate deals + duplicate calendar events, which the "things that have bitten us" list
> warns about.

### The alerting, and why it is shaped this way
- **Layer 1** is an n8n *Error Workflow*. On n8n 2.x an error workflow **must itself be ACTIVE**
  or it silently does nothing. This was missed once and only caught by deliberately breaking a
  workflow to test it. **If you rebuild it, test it by actually causing a failure.**
- **Layer 2** is a watchdog that catches the case Layer 1 cannot: a workflow that isn't failing
  because it isn't *running*. It **auto-discovers** active workflows from the n8n API, so new
  workflows are covered with zero maintenance. "Silent" means *no execution of any status* - a failing workflow is Layer 1's job, not the watchdog's.
- Alerts go to an internal admin address configured inside n8n. Email only - a chat-tool alert
  would depend on the very integrations that might be down.

### Secrets
SMTP credentials and the n8n API key live **only in n8n's own credential store** (encrypted in
the Docker volume). They are not in this repo and must never be.

---

## Supabase

Postgres. Tables `orders` and `bookings`, plus a small set of RPC functions (their names are
visible in `rentals/assets/*.js` where the browser calls them; the internal-only ones are not
listed here on purpose).

The browser uses the public anon key with row-level security. **Prices are always recomputed
server-side** - the cart total shown in the browser is an estimate and is never trusted.

**Pricing lives in a Postgres function, not in the browser.** The day count is *inclusive of
both ends* - Jul 27 → Jul 30 is **4 days, not 3**. This has been wrong before. If a total ever
looks a day light, that function is the first place to look.

---

## Images

**All image specs live in `.pages.yml`** as help text on each upload field, so they appear
inside the CMS at the moment of uploading. The short version:

- **sRGB, 8-bit.** Not Display P3, not Adobe RGB.
- Video frames are **Rec.709 limited range (16–235)** and must be expanded to **full (0–255)**.
- Stills 2560×1440 · backgrounds 2560×1440 · bubbles 1200×1200 · team 800×800 · logos = PNG.
- Under 600 KB. **Never upscale.**

Film stills are a special case with their own pipeline and their own traps - **see [`STILLS.md`](STILLS.md).** Read it before touching stills.

---

## Custom pages

A small CMS-driven page builder (drag-to-reorder blocks). **See [`CUSTOM_PAGES.md`](CUSTOM_PAGES.md).**
Adding a new block type is two edits; the doc says exactly which two.

---

## Database permissions - the rule

The browser holds a **public** Supabase key. It must be able to call **exactly one** function:
`catalog_availability` (a read, used to show what gear is free). Nothing else.

**July 2026:** an audit found 15 `SECURITY DEFINER` functions were callable by the public key.
`SECURITY DEFINER` bypasses row-level security, so a visitor could have invoked order, HubSpot
and repair functions straight against production - right around the RLS that was otherwise
correct. Fixed: revoked public/anon EXECUTE on all of them, re-granted only
`catalog_availability`, and set `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM
PUBLIC` so new functions don't auto-open.

**If you add a Postgres function, it is NOT automatically safe.** Postgres grants EXECUTE to
PUBLIC by default. Check after every migration:

```sql
SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e');
```
Only `catalog_availability` may be `true`. n8n uses the `service_role` key and bypasses all of
this, so tightening these grants never affects the automations.

## Closing a page (the maintenance cover)

A page can be temporarily closed from Pages CMS. Rentals is the first one:
**Pages CMS → Rentals page → "Rentals page is OPEN to the public"** (default ON).

Off, `/rentals` serves `maintenance.html`, a "back soon" page that picks one of the
variations in `data/maintenance.json` (Pages CMS → **Maintenance Cover**) at random on
every load, and generates its own "come back to *Rentals* later" line from the name of the
page it is covering.

Three things about the design are deliberate:

- **It is decided at the EDGE**, in `functions/_middleware.js`, not in the browser. The
  rentals page renders its gear immediately from a built-in catalogue, so a client-side
  check would paint the real page first and only then cover it, every visitor would see a
  flash of the thing you just closed.
- **The URL does not change.** `/rentals` stays `/rentals`; there is no redirect. Refresh
  works, shared links still work, and flipping the switch back on makes the same URL the
  real page again. The cover is a *state* of the page, not a different page.
- **It fails OPEN.** Missing switch file, broken JSON, absent key, missing cover page, all
  serve the REAL page. Wrongly showing the page is far cheaper than wrongly hiding it. All
  of those paths are covered by `tools/test-maintenance.mjs`.

To cover a different page later, add a row to `COVERABLE` in the middleware (which JSON
file holds the switch, which key, and an id) and a matching entry in `PAGES` in
`maintenance.html` (so it shows that page's header and wording). No other code changes.

## Things that have bitten us (don't re-learn these)

- **A root `404.html` HIJACKS the SPA `/*` catch-all on Cloudflare Pages.** Dropping a
  `404.html` at the repo root to 404 missing files made Pages serve it (with a 404) for EVERY
  non-file route -- every film / projects / team SPA route 404'd, LIVE, until rolled back. Pages'
  only static custom-404 IS a root `404.html`, and `_redirects` has no 404 action (only a 200
  rewrite), so a SPA cannot 404 missing assets via static config. Do it in a Pages Function
  (`functions/_middleware.js`): resolve the path, and if a `/media/` file came back `text/html`
  the real file is missing -> return a real 404. (2026-08-06)
- **Cloudflare Pages 308-redirects `/foo.html` to `/foo`.** A 308 is not `ok`, so a
  `fetch('/maintenance.html')` inside the middleware silently failed and fell through to the
  real page, in production only, while every test passed, because the test fixture served
  `.html` with a 200. Ask for the extensionless path. The test now models the 308.
- **A blurred layer on a resizing element is re-rasterised every frame.** This is the single
  biggest frame-rate trap on this site. `filter: blur()` *and* `box-shadow` both do it, and
  the blur radius is irrelevant (12px costs the same as 40px). It is why the carousel's cast
  shadow is a plain gradient on a fixed-size, transform-scaled layer, and why the hover glow
  is `visibility:hidden` rather than merely `opacity:0` when idle. Measure against a
  **no-effect control** before believing any of it, see the comments in `index.html`.
- **The studio paints before its data arrives.** `__main()` awaits five JSON fetches, so
  whatever the *stylesheet* says is what the visitor sees first. The views used to default to
  `display:block`, so the first paint was Home + Projects + Team stacked (6872px in an 872px
  viewport) and then collapsed. If you add a view, start it hidden.
- **Jotform's API returns deleted submissions** with `status: DELETED`. Deleting a bad
  submission does *not* protect a workflow that reads the API - you must filter on status.
  A single junk submission once poisoned the intake for three days.
- **A crashing workflow can freeze its own cursor.** The intake stored "last processed id" in
  static data; when the code threw, the id never advanced, so it retried the same poison
  submission forever - 720 errors a day, silently, because there was no alerting. That is why
  the alerting above exists.
- **n8n `import:workflow` deactivates a workflow.** Re-activate it after importing.
- **Don't paste large code into the n8n UI editor** - it has mangled a paste before. Use the
  n8n CLI (`export:workflow` / `import:workflow`), which is byte-exact.
- **Never disable the native Jotform → HubSpot / Calendar integrations.** They are the pipeline.

---

## Where the private details live

This repo is public, so the specifics that would only help someone poking at the setup are
kept **out of it**:

- **Secrets** (SMTP, API keys) - only in n8n's encrypted credential store and Supabase's own
  dashboard. Never in git.
- **Exact host/port of the n8n box, the alert email address, internal-only RPC names** - in
  `OPERATIONS_PRIVATE.md`, kept on the studio machine **outside this repo** (and on the NAS).

If you are an AI assistant working on this and need those details, ask the owner for the
private file. Do not reconstruct them into this repo.

## Local preview

The site fetches JSON at runtime, so `file://` will not work:

```
python3 -m http.server 8080
# http://localhost:8080
```


## Colour: unassigned renders WHITE (no hidden fallbacks)

Every colour on the site comes from Pages CMS -> Color Looks. There are deliberately
NO hardcoded fallback colours in the code. If a colour is missing - a blank field, or
a "Linked color look" that does not match a real look - the thing renders **white**.

That is on purpose. A hardcoded fallback would paper over a broken link and make the
system look like it worked when it did not. It would also be a lie for any future
film, which has no "original" to fall back to. White = unassigned. Go fix the link.

Where colour now comes from:
- Films: Projects -> Linked color look -> a `film` look (accent / main / tint).
- Rentals categories: Rentals -> Categories -> Linked color look -> a `basics` look.
- Event banner: Site Settings -> Event Banner -> Linked color look.
The Color Looks page shows what uses each look and flags broken links in red.

### For the record: what the site rendered BEFORE this system existed
Kept as history only. These are NOT fallbacks and are NOT in the code any more.

| Film | accent | wash 1 | wash 2 | kicker | tagline |
|---|---|---|---|---|---|
| Geri-Action | `#ffd21f` | `rgba(255,90,106,.30)` | - | = accent | `#ffd9a0` |
| Revelations | `#ff5230` | `rgba(255,82,48,.34)` | `rgba(255,210,122,.18)` | `#ffd27a` | `#ffd9c0`, italic |
| Invalid Opinion | `#74b3ff` | `rgba(80,150,255,.30)` | - | = accent | inherited |

Rentals categories were `Camera #EA4335`, `Lighting #FF9900`, `Grip #8b5cf6`,
`Electric #FBBC04`, `Sound Packages #34A853`.
