# Rare Pond Studios — System Handoff & Architecture

> **Purpose.** This is a full knowledge-transfer document so a fresh chat can pick up the
> Rare Pond / Jack Carlsen web project cleanly, review what's been built, tidy it, and
> continue polishing + building out the **jackcarlsen** site.
>
> **Read `OPERATIONS.md` first — it is the canonical operations manual** (access, pipelines,
> rentals, Supabase RLS, the "things that have bitten us" list). Then `README.md`,
> `STILLS.md`, `CUSTOM_PAGES.md`, and `tools/ROTATE-GITHUB-PAT.md`. THIS file is the
> **session supplement**: the current data-model snapshot (post field-type + credits work)
> plus the specific mistakes made this session so they aren't repeated. Where this file and
> `OPERATIONS.md` disagree, trust the live system, then `OPERATIONS.md`.
>
> **Status:** this file **IS committed** to the (PUBLIC) GitHub repo, so keep it public-safe —
> architecture, file paths and CMS field names only, **never tokens or credentials**. It is the
> running handoff note the next chat reads first.
>
> Last updated: 2026-08-05.

---

## 0. LATEST SESSION (2026-08-05) — READ THIS FIRST

This session touched the **three-site chrome** (studio `/`, rentals `/rentals`, media `/media`)
— header, footer, cross-site nav, and the event banner. Everything below is **live on
`www.rarepond.com`** and verified in-browser. Four things were worked on; three are fully done,
one (the apex redirect) needs a manual DNS action nobody in a code session can perform.

### 0.1 Single source of truth for header + footer links (`site.json → nav`)
- There used to be **two** places that defined page links: `site.json → header.navTeam/navProjects/navContact`
  (header) and `site.json → footer.links` (footer). They could drift. **Both are gone.**
- There is now ONE list: **`data/site.json → nav`** (array of `{label, go?, href?, header?}`).
  - Items with `header:true` (Our Team, Projects, Contact) render in each site's **header nav**.
  - Every item renders in each site's **footer**.
  - `go` = in-site SPA target (team/projects/contact); `href` = link to another site (`/`, `/media`, `/rentals`).
- Consumers (all read the same list):
  - **Studio** `index.html`: header/hamburger labels set by matching `data-go`/`data-contact` to `nav`
    (search `NAVLIST` / `navLabelByGo`); footer rendered from `SITE.nav` (search `fnav`).
  - **Rentals** `rentals/index.html`: header `.hnav` labels + footer `.rfoot .flinks` both from `site.nav`
    (search `const NAV=`).
  - **Media** `media/index.html`: header `.mnav` labels + footer `.mfoot .flinks` both from `site.json → nav`
    (search `var NAV=`).
- CMS: `.pages.yml` now exposes ONE **"Navigation"** list (with a "Show in header" checkbox). The old
  `navTeam/navProjects/navContact` fields and the footer-links editor were removed.
- **Rule for the next bot:** never re-hardcode a nav label in the HTML. Edit `site.json → nav`.

### 0.2 Media footer brought to full parity
- The media footer previously lacked the tagline + social icons the other two footers have.
- Fixed by adding the shared **`rp-footer`** class (styles live in `assets/chrome.css`) plus a `.tag`,
  a `.fsoc` socials row (`#mFootSoc`, filled from `socials.json`), and switching its links to `site.json → nav`.
- Media footer now matches studio/rentals: wordmark → tagline → socials → link row → copyright.

### 0.3 Media footer "harsh line" — FIXED (but see 0.5 about why the user may still see it)
- The line was **not inside the footer**. It was the boundary between the media **`.cta`** section
  (which has a full-bleed photo background, "Start a conversation") and the footer below it. The photo
  ended in a hard edge against the footer water.
- Fix (in `media/index.html` inline CSS):
  1. `.cta .scrim` now fades the photo down to a **solid `#06122b` band** across its bottom ~20%.
  2. `.mfoot` background top is a **solid `#06122b`** block (0→40%), matching the CTA bottom, with the blue
     tint + caustics only starting well below the join. `.mfoot-water` mask holds fully transparent for the
     top ~22%.
  3. `.mfoot { margin-top:-80px; padding-top:270px }` — the footer is pulled up so its **opaque dark top
     paints OVER** the section boundary; there is no adjacent element edge left to render a hairline.
- Verified at 5× zoom on www: the join is uniform dark → caustics, **no line**.
- `--base` on media = `#06122b` = the page/body background. Keep any future dark values consistent with it.

### 0.4 Media event-banner parity (was completely missing)
- The event banner is a **shared engine**: `assets/looks.js` renders `data/site.json → eventBanner`
  (`{enabled,title,buttonText,buttonLink,colorLook,gradientStyle}`) into a `#rp-eventbanner-mount` div.
  `assets/banner-reserve.js` (in `<head>`, no defer) reserves its height before first paint. The banner
  CSS is injected by `looks.js` (`bannerCssOnce`), colour comes from a `colorlooks.json` look.
- Media had **none** of this. Added to `media/index.html`: the `#rp-eventbanner-mount` div (right after
  `</header>`), `banner-reserve.js` in `<head>`, `looks.js` before `</body>`, `--header-h:86px` on `:root`
  (78px at ≤780px), and **bumped `.mhdr` z-index 60 → 100** so the dark header sits ABOVE the banner
  (`z-index:90`) and the banner peeks out below it, exactly like studio/rentals.
- The banner is driven entirely by `site.json → eventBanner` (same source for all three sites), so toggling
  it in Pages CMS now affects media too. It is currently `enabled:false` (its normal state); verified it
  renders correctly on media by temporarily flipping it true during this session, then reverted.
- `.pages.yml` banner group label updated to "(all sites - studio + rentals + media)".

### 0.5 Apex redirect `rarepond.com/media` → 404  (NOT fixed — needs a manual DNS change)
- **Symptom:** `www.rarepond.com/media` = 200 (correct, current). Bare `rarepond.com/media` = **404**.
  `rarepond.com/` (root only) 301s to www.
- **Root cause:** DNS for `rarepond.com` is at **GoDaddy** (nameservers `ns61/62.domaincontrol.com`).
  The apex A records point at GoDaddy's **domain-forwarding** IPs (`3.33.251.168`, `15.197.225.128`),
  which 301 the root to www but **404 every deep path**. `www` is a CNAME to `rare-pond-studios.pages.dev`
  (Cloudflare Pages) and works. The repo's `_redirects` already has the correct
  `https://rarepond.com/* → https://www.rarepond.com/:splat 301` rule, but it **can never fire** because
  apex requests never reach Cloudflare Pages — they hit GoDaddy forwarding instead.
- **This is why the user kept seeing "no change" / "the footer is still the same":** they were viewing the
  **apex** (`rarepond.com/media`), which serves a stale/cached/forwarded response, NOT the live Cloudflare
  content on `www`. Always verify fixes on **`https://www.rarepond.com/...`**, and tell the user to view www
  (hard-refresh) until the apex is repointed.
- **The fix (requires the owner's GoDaddy + Cloudflare accounts — cannot be done from a code session):**
  1. In **Cloudflare Pages** → the `rare-pond-studios` project → *Custom domains* → add `rarepond.com` (apex).
  2. Repoint the apex at Cloudflare. Cleanest is to **move `rarepond.com`'s DNS to Cloudflare** (change the
     nameservers at GoDaddy to the Cloudflare-assigned pair), then Cloudflare adds the CNAME-flattened apex
     record automatically. (Apex can't be a plain CNAME at GoDaddy, which is why forwarding was used.)
  3. Once apex resolves to Pages, the existing `_redirects` rule makes `rarepond.com/media` **301 → www**
     automatically. Delete the GoDaddy forwarding record.
  - **Decision needed from the owner:** they said the URL "should just be `rarepond.com/media`, not the extra
    stuff" — i.e. they may want the **apex to be canonical (no `www`)**. If so, AFTER the apex is confirmed
    serving Pages, flip `_redirects` to redirect `www → apex` instead of `apex → www`. **Do NOT flip it
    before the apex DNS is live** — doing so would 301 the working `www` site into the currently-404ing apex
    and take the whole site down.

### 0.6 Deploy + verify recipe used this session (unchanged)
```
cd /Users/rarepondstudios/rp_site_work
export GIT_ASKPASS=/Users/rarepondstudios/bts-automation/askpass_rp.sh GIT_TERMINAL_PROMPT=0
git add <specific files>            # NEVER add tools/_devserve.py (local dev server, must stay untracked)
git commit -q -m "..."
git -c rebase.autoStash=true pull --rebase origin main
git -c credential.helper= push origin main
```
Local preview: `tools/_devserve.py` on `127.0.0.1:8799` mirrors the Cloudflare `_redirects`
(static-first, `/media`→`/media/`, `/rentals`→`/rentals/`). Verify on www after the ~1–2 min Pages build.

### 0.7 Footer wordmark unified across all three sites
- All three footers now use a **typed wordmark** (duck mark + Kaushan "Rare Pond" + Heebo uppercase site
  name), replacing the old baked-in `rare-pond-color.webp` logo IMAGE on studio/rentals.
- Shared style lives once in **`assets/chrome.css` → `.rp-footer .fwm`** (`.fwm` wrapper, `.fwm img`,
  `.fwm-txt`, `.fwm-rare` = Kaushan name, `.fwm-sub` = uppercase site name). Markup pattern:
  `<a class="fwm"><img><span class="fwm-txt"><span class="fwm-rare">Rare Pond</span><span class="fwm-sub">Studios</span></span></a>`.
  - **Studio** (`index.html` `#footerTpl`): `duck-mark.webp` (COLOUR duck) + "Rare Pond" + "Studios".
  - **Rentals** (`rentals/index.html` footer): `duck-mark.webp` (COLOUR duck) + "Rare Pond" + "Rentals".
  - **Media** keeps its OWN inline `.wm` treatment (`media/index.html`): `duck-white.webp` (WHITE duck) +
    "Rare Pond" + "Media". (Jack liked the media one, so it was left as the reference look.)
- **Sub-text colour:** the gradient is **media-only** (media's `.wm-sub` carries `.grad`). Studio/rentals
  `.fwm-sub` is **plain white**, and inverts to dark `#0c2c57` on the studio's **light** footer scenes
  (`.rp-footer.footer-light`, i.e. Team / Projects views).
- **Alignment:** all three are **left-justified** (media's `.wm .wm-txt` was switched from centred to
  `align-items:flex-start; text-align:left` to match studio/rentals). The wordmark block itself stays
  centred in the footer.
- Kaushan Script + Heebo are already loaded on all three sites, so no font changes were needed.

### 0.8 FULL-SYSTEM QC PROTOCOL — run this whole thing in the next chat
> **Scope:** a top-to-bottom quality-control pass over the ENTIRE system, not just the chrome:
> all websites + sub-sites, the generated data (source-of-truth) JSON, the host-side backend
> exporters + their launchd jobs, the databases, and Pages CMS. Read **`OPERATIONS.md` first**
> (canonical ops manual — pipelines, n8n/NocoDB access, Supabase, "things that have bitten us").
> Work top-down A→E. This QC is **read-only** — do not change anything unless you find a defect
> and the owner asks you to fix it.

**System map (what you are QC-ing):**
- **4 front-ends.** Rare Pond = studio `/` + rentals `/rentals` + media `/media` (ONE repo
  `rarepondstudios/rare-pond-studios`, host `www.rarepond.com`). Jack Carlsen = `jackcarlsen-website`
  (SEPARATE repo `Jackjrrc/jackcarlsen-website`, host `jackcarlsen.com`) with its OWN
  `assets/`, `data/`, `.pages.yml`, `functions/`, `_redirects` — independent of Rare Pond's chrome.
- **Generated data** = each repo's `data/*.json`, built by host exporters from the DB and committed.
- **Backend** = Python exporter scripts in `~/bts-automation/*.py`, each on a `com.rarepond.*` launchd
  job, plus n8n workflows. **Source of truth = NocoDB over Supabase Postgres** (schema `rp`).
- **CMS** = Pages CMS driven by each repo's `.pages.yml`; it edits ONLY the hand-authored JSON fields.
- **GOLDEN RULE:** rendered/generated JSON (`projects.json`, `rentals.json`, `socials.json`,
  `colorlooks.json`, `platforms.json`, `team.json`, `bts.json`, `stills-hd.json`, …) is DB-generated —
  **never hand-edit it.** Only these are hand/CMS-edited: `site.json` (hero/about/header/**nav**/footer/
  **eventBanner**/sectionHeadings), `contact.json`, `media.json` (media page copy + navBlurb), and the
  JC equivalents. Verify nobody hand-edited a generated file (`git log -- data/<file>` should show the
  exporter/n8n as author, not a manual commit).

**A. FRONT-END QC — all four sites (on the LIVE hosts, NOT the bare apex).**
Rare Pond: do it on `https://www.rarepond.com`, `/rentals`, `/media` (the bare apex `rarepond.com`
404s deep paths until the DNS fix in 0.5 — never QC there). For EACH of the three RP sub-sites confirm:
  1. **Header nav** = Our Team · Projects · Contact, labels from `site.json → nav` (rename one there → it
     changes in header AND footer on all three).
  2. **Cross-site nav** chips Media · Studio · Rentals in the SAME fixed slots; current site = the
     non-clickable "you are here" chip; clicking a sibling plays the directional wipe and lands cleanly
     (test all hops, including back-to-studio).
  3. **Footer** in order: typed wordmark (COLOUR duck on studio/rentals, WHITE duck on media) →
     "Let's Make Something Amazing..." tagline → 4 social pills → link row (Our Team · Projects · Studio ·
     Media · Rentals · Contact) → copyright. Sub-text white EXCEPT media (gradient). Left-justified.
  4. **Footer "Contact" link** opens the shared contact modal (must NOT scroll/navigate).
  5. **Contact modal** opens from header, footer AND the page CTA; HubSpot form renders inside; brand
     social bubbles show beside it.
  6. **Media only** — footer/CTA join has NO hard line (photo fades to `#06122b`, caustics bloom below;
     `.mfoot` has `margin-top:-80px`).
  7. **Event banner** — temporarily set `data/site.json → eventBanner.enabled:true`, confirm it renders on
     ALL THREE below the header (header z-index > banner). **Set it back to `false`** after.
  8. **Studio light scenes** (Team / Projects) — footer inverts: wordmark text, tagline, links go dark + stay readable.
  9. **No console errors**; **0 broken images** (the studio `.lightbox` empty-src `<img>` is a benign
     on-demand placeholder — ignore that one).
  - *Automation tip:* studio home carousel eats wheel events and `scrollingElement.scrollTop` is ignored —
    use `window.scrollTo({top, behavior:'instant'})`; on media the BODY is the scroll container.
Jack Carlsen: do it on `https://jackcarlsen.com` (and confirm its own apex/www + `_redirects` behave —
check its DNS separately). Its chrome is INDEPENDENT, so run an equivalent pass in its own terms: header/
nav, footer, socials, **projects/film catalogue renders from its `projects.json`**, any contact path,
no console errors, 0 broken images. Do NOT assume Rare Pond changes propagated here.

**B. DATA / SOURCE-OF-TRUTH QC — both repos' `data/*.json`.**
  - Every `data/*.json` parses (`python3 -m json.tool <file> >/dev/null`).
  - GENERATED files are fresh + agree with the DB: spot-check a few `projects.json` / `rentals.json` /
    `socials.json` / `colorlooks.json` records against NocoDB (see OPERATIONS.md for how to reach it).
  - HAND-EDITED files intact + valid: `site.json` (nav/footer/hero/eventBanner), `contact.json`, `media.json`.
  - Golden-rule audit: no manual commits to generated files.

**C. BACKEND / PIPELINE QC — host Mac Mini (`~/bts-automation`).**
  - **Fastest path — the health monitor.** `automation_health_launchd.py` (job `com.rarepond.pyhealthmon`,
    every 15 min) writes THREE ClickUp pages in one doc: **"Automation Health"** (n8n workflows),
    **"Automation Health — Python Jobs (launchd)"** (the site/data exporters), and **"Automation Health —
    Local AI & System (launchd)"** (model-router, card-service, contacts-photoprep, imessage-reader — the
    non-site infra). Each is sorted failures-first with a copy-paste fix block per red. Read those; all
    green = everything last ran OK. The launchd site/data page is driven by the `JOBS` registry in that
    script and the infra page by `INFRA_JOBS`; add any new `com.rarepond.*` job to the right list or it
    won't be tracked.
  - **Direct check:** `launchctl list | grep rarepond` — 2nd column is the last exit code (0 = OK,
    non-zero = failed). Tail the offending job's logs in `~/bts-automation/<job>.log` and
    `<job>.launchd.err.log`.
  - **Exporters that MUST be healthy** (job → script): `rpprojsync`→`projects_sync.py`,
    `jcprojsync`→`jc_projects_sync.py`, `colorlooksync`→`colorlooks_sync.py`,
    `colorlooksfolders`→`colorlooks_folders_sync.py`, `socialssync`→`socials_sync.py`,
    `socialuisync`→`social_ui_sync.py`, `platformssync`→`platforms_export.py`,
    `brandmediasync`→`brand_media_sync.py`, `rentalsunitssync`→`rentals_units_sync.py`,
    `projmediasync`/`projfoldersync`, `btssync`/`rpbtssync`, `jcnativemediasync`.
  - **n8n alerts:** `rpalertmail01` + `rpwatchdog01` are the failure/silence email safety net — confirm
    both enabled (do NOT delete; they are not part of the inventory).
  - **SYNCED-FILE TRAP:** `assets/social_ui.js` has a master at `~/bts-automation/social_ui.js`; they must
    be **byte-identical** or `socialuisync` reverts the repo copy. `diff` them; if you ever edit one, edit BOTH.
  - **Databases:** confirm NocoDB + Supabase reachable (OPERATIONS.md §"How to actually reach n8n / NocoDB"
    and §"Supabase"). Respect the DB-permissions rule in OPERATIONS.md.

**D. PAGES CMS QC — both repos.**
  - `.pages.yml` is valid YAML (`python3 -c "import yaml;yaml.safe_load(open('.pages.yml'))"`); every field
    group maps to a real key in its data JSON. RP: the single **"Navigation"** list, **"Event banner (all
    sites)"**, and Footer (no links sub-field) resolve.
  - Round-trip: a CMS edit to `site.json` (e.g. a nav label) shows on all three RP sites; a JC CMS edit
    shows on jackcarlsen.com.
  - Reminder: socials / projects / rentals / color-looks are DB-managed and were REMOVED from the CMS — the
    CMS should only expose hand-edited fields.

**E. INFRA QC.**
  - Both Cloudflare Pages projects' latest deploy succeeded (~1–2 min after push).
  - **KNOWN ISSUE (see 0.5):** bare apex `rarepond.com` 404s deep paths (GoDaddy forwarding, not Cloudflare).
    Needs the DNS move; QC Rare Pond on `www`. Check whether jackcarlsen.com has the same apex/www quirk.
  - Deploy recipe = 0.6 (never commit `tools/_devserve.py`).

**Deliverable of the QC pass:** a short pass/fail report per layer (A–E) with any defect + file/line/job,
and — only if the owner approves — the fixes. Nothing above should be changed silently.

---

## 1. TL;DR — how the whole thing fits together

```
                    ┌─────────────────────────────────────────────────────┐
                    │  SOURCE OF TRUTH FOR THE FILM CATALOGUE              │
                    │  Supabase Postgres  (schema `rp`, table `projects`) │
                    │  edited by a human through NocoDB                   │
                    └───────────────┬─────────────────────────────────────┘
                                    │  every 5 min (server-side schedule)
                                    ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  n8n workflow "Projects: DB to site (rarepond)"              │
        │  Get rows → Build projects.json → diff → commit to GitHub    │
        └───────────────┬──────────────────────────────────────────────┘
                        │  git commit to  rarepondstudios/rare-pond-studios (main)
                        ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  GitHub repo  →  Cloudflare Pages  (static build ~1–2 min)   │
        │  Site = index.html SPA that fetches /data/*.json at runtime  │
        └───────────────┬──────────────────────────────────────────────┘
                        ▼
                 www.rarepond.com   (and eventually  jackcarlsen.com)

  EVERYTHING ELSE on the site (site copy, team, rentals, colour looks, custom pages,
  maintenance covers, form field types) is edited in Pages CMS, which commits the
  matching data/*.json straight to the same GitHub repo.
```

Two editing surfaces, one repo:
- **Projects (films)** → **NocoDB** (→ Supabase → n8n → repo). *Never* edited by hand in the repo.
- **Everything else** → **Pages CMS** (edits `data/*.json` directly in the repo).

---

## 2. Infrastructure & hosts

| Thing | Where | Notes |
|---|---|---|
| Studio site | `www.rarepond.com` | Cloudflare Pages, static, from GitHub `main`. Build ~1–2 min. |
| Repo | `github.com/rarepondstudios/rare-pond-studios` (branch `main`) | **PUBLIC**. Never put secrets/passwords in it or in Pages CMS. |
| Local repo clone | `/Users/rarepondstudios/rp_site_work` | On the always-on **Mac Mini**. Synced across machines + Google Drive via **Synology NAS DS1422+**. |
| NAS (on-device, Finder) | direct network mount | **READ-ONLY** — pull assets only. To *write*, go through Google Drive. |
| NocoDB | Docker container `nocodb` (`nocodb/nocodb:latest`) at `http://localhost:8080` | UI over the external Supabase Postgres. |
| n8n | Docker container `n8n` (`n8nio/n8n:latest`) at `http://localhost:5678` | Automations. Server-side schedules run headless regardless of browser login. |
| Supabase Postgres | hosted, project ref `gnifidmyahtzydwvaegj` | Two schemas in play: `rp` (studio: projects) and `public` (rentals DB). Role `postgres` bypasses RLS. |
| Pages CMS | `app.pagescms.org/rarepondstudios/rare-pond-studios/main` | Edits `data/*.json`, commits to GitHub. |

Both containers run on the Mac Mini. To operate them from a session, use the **Desktop
Commander** MCP (host shell): e.g. `docker restart nocodb`, `git` in the repo. The
sandbox `workspace bash` **cannot** reach `localhost:8080/5678` (different machine), but
it *can* reach the repo mount and the public internet.

> **Access & security (per `OPERATIONS.md`).** `localhost:8080/5678` are correct **only on
> the Mac Mini itself** (loopback). n8n + NocoDB are bound to **loopback + Tailscale only** —
> deliberately NOT reachable over home Wi-Fi or the public internet. Never run
> `tailscale funnel` on them and never rebind to `0.0.0.0`. Exact host/port, the alert email,
> and internal RPC names live **outside the public repo** — in ClickUp → "Remote Access Cheat
> Sheet" and `~/rp_site_private/REMOTE_ACCESS.md` / `OPERATIONS_PRIVATE.md` on the Mac Mini
> (and NAS). Ask the owner for the private file; never reconstruct secrets into the repo.

---

## 3. Repo layout (top level)

```
index.html            ← the entire studio SPA (inline CSS + JS). Big single file.
maintenance.html      ← "back soon" cover shown when a page is toggled closed.
rentals/              ← the rentals sub-site.
admin/                ← password-protected tools (e.g. admin/preview.html). Gated by functions/_middleware.js.
assets/               ← shared JS (e.g. socials.js).
functions/
  _middleware.js      ← Cloudflare Pages Function: HTTP basic-auth over /admin/*.
  api/client-error.js ← production JS error beacon endpoint.
data/                 ← ALL site content as JSON (see §4). Edited in Pages CMS, except projects.json.
media/                ← images/video. projects/{invalid,rev,geri}, logos, team, site, email.
tools/                ← dev/QA scripts (see §9). Node .mjs.
_headers, _redirects  ← Cloudflare Pages config (HSTS, caching, redirects).
robots.txt, sitemap.xml
README.md, OPERATIONS.md, CUSTOM_PAGES.md, STILLS.md  ← existing docs. READ THESE.
package.json, tools/  ← test/QA harness.
```

---

## 4. Data files (`data/*.json`)

| File | What | Edited in |
|---|---|---|
| `projects.json` | The film catalogue (array under `projects`). | **GENERATED by n8n from NocoDB.** Never hand-edit. |
| `site.json` | Global site copy: hero, about, socials, header, section headings, footer, HubSpot form ids, event banner, `projectsPublicAccess`. | Pages CMS → "Site Settings" |
| `section-templates.json` | Shared `{variable}` templates for project text lines (eyebrow, card eyebrow, card logline, grid caption). | Pages CMS → "Projects" |
| `colorlooks.json` | Named colour "looks" (3 colours + where each is used). Films/rentals/banner point at a look by ID. | Pages CMS → "Color Looks" |
| `team.json` | Team members + per-person portfolio links + page public toggle. | Pages CMS → "Team" |
| `rentals.json` | Rentals page copy, gear categories (IDs must match rentals DB), logos, cart labels. | Pages CMS → "Rentals page" |
| `form-fields.json` | Input `type` per field for the rental/crew forms. | Pages CMS → "Form input types" |
| `maintenance.json` | Random "back soon" messages/images for closed pages. | Pages CMS → "Maintenance Cover" |
| `pages.json` | Custom pages (slug, blocks, nav toggles, per-page public switch). | Pages CMS → "Custom Pages" |
| `stills-hd.json` | HD stills manifest (responsive srcset source). | Generated/managed by the stills pipeline (see `STILLS.md`). |

---

## 5. The projects data model (source of truth)

**Supabase Postgres**, schema `rp`, table `projects`. Edited via **NocoDB**
(base `pn8kzophvbwxtt7`, table `m765vzpp8kve3wc`). Every underlying column is Postgres
`text` (or number/checkbox); there are **no array/jsonb columns anymore** — multi-value
fields are plain text, one entry per line.

### Columns & the field-type convention

**Rule Jack set:** *if a field can hold multiple entries → `LongText` (big box, press
Enter for each new entry). If it only ever holds one → `SingleLineText`.*

| Column | NocoDB type | Meaning / convention |
|---|---|---|
| `id` | (uuid PK) | Auto-generates. Never set it by hand. |
| `key` | LongText* | **Required.** Short internal id, e.g. `invalid`, `rev`, `geri`. Used as the site's SECTIONS key + theme class. Must be unique. |
| `title` | LongText* | **Required.** Display name. **The site URL = slugified title** (e.g. "Invalid Opinion" → `/invalidopinion`, "Geri-Action" → `/geriaction`). |
| `year` | Number | Release year (optional). |
| `kicker` | LongText* | Small line above title. |
| `tagline` | LongText* | One-line tagline. |
| `blurb` | LongText* | Short description (carousel bubble + card). |
| `page_logline` | LongText* | Long paragraph on the film page. **HTML allowed** (`<b>`, `<i>`). |
| `credits` | LongText | **NEW FORMAT — one credit per line, `Role: Name(s)`** (see §7). |
| `bubble_image` | SingleLineText | Carousel bubble image path. |
| `title_logo` | SingleLineText | Title logo PNG. Empty → site falls back to a text `<h2>` title. |
| `focus_bg` | SingleLineText | Film-page background image. |
| `focus_video` | SingleLineText | Reel video path (optional). |
| `stills` | LongText | One image path per line. |
| `sites` | LongText | **Which sites show this project. Must include `rarepond` to appear on the studio site.** One per line. This is the multi-site key (see §11). |
| `roles` | LongText | Jack's roles on the film, one per line. **Note: currently NOT exported to the site JSON** — stored for internal/other use only. |
| `genre` | LongText | One genre per line → renders as chips. |
| `production` | SingleLineText | Production company. |
| `status` | SingleLineText | e.g. "Released", "In Post-Production". Drives the "availability" line when there's no watch link. |
| `watch` | LongText | Paste a YouTube and/or Vimeo link, one per line. **Site auto-detects platform** per link (play button + click-to-load embed). |
| `social_links` | LongText | One social URL per line. **Site auto-detects the network** for the icon (ig/yt/tiktok/x/fb/threads/vimeo/li/web) and gives each a coloured hover glow. Only exported when present. |
| `rp_color_look` | SingleLineText | Links to a look in `colorlooks.json` by ID (e.g. `signature`, `invalid`, `rainbow`). Export default is `signature`. |
| `rp_bubble_glow` | Checkbox | Bubble glow on/off. |
| `rp_in_carousel` | Checkbox | Show in the home carousel. |
| `placeholder` | Checkbox | `true` = "coming soon" style card (the `more` row is the example). |
| `sort_order` | Number | Order in carousel/grid. |
| `created_at` / `updated_at` | DateTime | Auto. |

\* prose/multi fields are `LongText` so the big-box + Enter editing works.

> **Three sites are envisioned** (per `OPERATIONS.md`): `rarepond`, `jackcarlsen`, and
> `Corporate`. A row can belong to any combination via `sites` (one per line); removing/adding
> a site name never loses the row or its settings. **Per-site visual differentiation is
> currently limited:** the old per-site JSON was flattened to single `rp_color_look` /
> `rp_bubble_glow` / `rp_in_carousel` columns, so a project shows the **same colour look on
> every site it appears on**. If jackcarlsen needs a different look/behaviour per site for the
> same film, that's a design gap to solve (e.g. re-introduce per-site overrides).
>
> **Colour rule (`OPERATIONS.md`): there are NO hardcoded fallback colours.** An unassigned or
> broken `rp_color_look` renders **WHITE** on purpose (so broken links are visible, not
> papered over). The Color Looks preview page flags broken links in red.

### The exported site-JSON shape (what n8n writes into `projects.json`)

Per project object (camelCase, only some columns pass through):
```
key, colorLook, bubbleGlow, inCarousel, title, placeholder,
bubbleImage, titleLogo, focusBg, focusVideo,
kicker, tagline, production, status, year,
pageLogline, genre[], watch, stills[], credits, blurb
```
Not emitted: `roles`, `sites` (internal filter only), `social_links` (only when set),
`rp_*` prefixes are renamed (`rp_color_look`→`colorLook`, etc.).

---

## 6. The n8n export pipeline

**Workflow:** "▶️ Projects: DB to site (rarepond)", id `tAlPhnGm5crTfnrM`.
**Trigger:** Manual + **Schedule every 5 min** (server-side; runs headless even when no
browser is logged in).

**Nodes (in order):**
1. **Get projects** — Postgres SELECT from `rp.projects`.
2. **GitHub: read current `data/projects.json`**.
3. **Build projects.json** — a Code node. Filters to rows where `sites` includes
   `rarepond`, maps each DB row → the site-JSON shape above, and uses a robust `toArr()`
   helper that accepts Postgres arrays **or** JSON **or** newline-text (migration-proof).
   `credits` is passed through **raw** (the website does the formatting). `colorLook`
   defaults to `signature`.
4. **Changed?** — IF node doing a semantic diff (only proceeds if the JSON actually changed).
5. **GitHub: commit** `data/projects.json` → triggers a Cloudflare build.

So: **edit a row in NocoDB → within ~5 min it's committed → ~1–2 min later it's live.**
A brand-new row propagates automatically with no other steps (proven with a test project).

**Other automations that exist** (not the focus here, but part of the ecosystem):
- Rentals intake: **Jotform → HubSpot → Supabase** (bookings/orders sync, overlap guard).
- **Error-alert email** (error-trigger workflow) + a **silence watchdog** (alerts if the
  scheduler goes quiet). SMTP credential configured in n8n. Note: an n8n **error workflow must
  itself be ACTIVE** or it silently does nothing (n8n 2.x) — test it by causing a real failure.

> **Recurring trap — the GitHub PAT expires.** n8n commits `projects.json` using a GitHub
> Personal Access Token that has an expiry date. When it lapses, the projects export
> **silently stops** (edits stop reaching the site). A desktop reminder fires ~8 days before;
> the full rotation procedure is `tools/ROTATE-GITHUB-PAT.md`. If "my NocoDB edit isn't going
> live," check this first.
>
> **Editing n8n workflows:** don't paste large code into the n8n UI editor (it has mangled a
> paste before). Prefer the n8n CLI `export:workflow` / `import:workflow` (byte-exact), and
> **re-activate** the workflow after `import:workflow` (import deactivates it).

---

## 7. Credits system (recently rebuilt)

**Principle:** NocoDB stays a clean data repository; the **website** does the formatting.

**In NocoDB (`credits` field):** plain text, one credit per line:
```
Created By: Jack Carlsen
Starring: Iago Lashua - Nick Wittcoff
Cinematography: Jash Shah
Sound: Jacob Gensheimer
```
- Everything **before the first `:`** = the **role** → rendered **bold** by the site.
- Everything **after** = the **name(s)** → rendered exactly as typed.
- Press Enter to add another credit. Separate multiple names however you like (`A - B`).
- A line **with no colon** renders as a **plain, non-bold line** (useful for an affiliation
  line, but watch out — see the cleanup note below).

**On the site (`renderCredits()` in `index.html`, near the watch/social render helpers):**
- If a credit still contains HTML tags → render verbatim (back-compat for legacy/one-off HTML).
- Else split each line on the first `:` → `<b>role</b> names`, joined with `<br>`.
- `{variables}` are supported per line; output is HTML-escaped.

> **CLEANUP NOTE for the next chat:** as of this writing Invalid Opinion's first credit line
> is `Writer & Director Jack Carlsen` (Jack edited it) — **no colon**, so it renders
> *un-bolded* while the other lines are bold. If that's unintended, add the colon:
> `Writer & Director: Jack Carlsen`. Worth a quick pass over all films for colon consistency.

---

## 8. Source-of-truth model (important — don't reintroduce dual editing)

- **Films = NocoDB only.** The Pages CMS "Projects" screen is deliberately **not** a
  per-project editor. It holds (a) the four shared `{variable}` text templates and (b) a
  read-only pointer note saying "the film list is in NocoDB." Do **not** wire NocoDB rows
  into per-project Pages CMS entries — that would recreate two places to edit the same
  thing, which we intentionally removed.
- **Templating:** `section-templates.json` holds shared templates (eyebrow, card eyebrow,
  card logline, grid caption). `index.html` fills them per film with `fillVars`/`projVars`.
  Available vars: `{title} {year} {production} {status} {released} {kicker} {tagline}
  {genre} {blurb}`. Empty vars (and a dangling separator like a stray " · ") are dropped.
- **Live preview:** `rarepond.com/admin/preview` (password-protected) renders any template
  against a real film using the *same* fill logic as the site. Keep it in sync with
  `index.html` if you change the fill logic.

---

## 9. index.html (the SPA) — how it renders

- Single file, inline CSS + JS. Fetches `/data/*.json` at runtime.
- **Routing:** home `/`; film pages by slugified title (`/invalidopinion`, `/geriaction`,
  `/revelations`); `/projects`, `/team`, `/contact`; custom pages `/<slug>`; `/rentals`
  (sub-site); `/admin/preview`.
- **`SECTIONS`** map is built from `projects.json` (keyed by each project's `key`).
- **Key render helpers** (all near each other, ~lines 1340–1415):
  - `buildWatch()` / `parseWatchLinks()` / `renderWatch()` — one `watch` field, per-line
    YouTube/Vimeo auto-detect; falls back to the `status` line when no link.
  - `detectNet()` / `renderSocials()` — social auto-detect + coloured hover glow.
  - `renderCredits()` — the credits parser (§7).
  - `fillVars()` / `projVars()` / `EYEBROW_TPL` — the `{variable}` templating engine.
- **Escaping helper:** `_wEsc()` (shared by watch/social/credits).

**tools/ (QA):** `validate-projects.mjs`, `smoke-test.mjs`, `check-slugs.mjs` (regenerates
the reserved-slug blocklist for custom pages — run `node tools/check-slugs.mjs --write`
after adding/renaming a film), `serve-like-cloudflare.mjs` (local preview),
`test-colorlooks-gate.mjs`, `test-maintenance.mjs`, `chrome-snapshot.mjs`.
Local preview: `python3 -m http.server 8080` (the site fetches JSON at runtime, so `file://`
won't work).

### Other subsystems (each has depth beyond this doc)

| Subsystem | What / where | Canonical doc |
|---|---|---|
| **Stills pipeline** | Extract film frames → grade → sharpness-check → responsive AVIF/WebP/JPEG srcset → `stills-hd.json`. Real traps (colour range, no upscaling). | `STILLS.md` |
| **Custom pages** | CMS-driven block page builder (`data/pages.json`, drag-to-reorder blocks). Adding a block type = 2 edits. | `CUSTOM_PAGES.md` |
| **Maintenance covers** | Per-page "back soon" cover decided at the **edge** in `functions/_middleware.js`; random message from `data/maintenance.json`; **fails OPEN**. | `OPERATIONS.md` |
| **Colour looks** | `data/colorlooks.json`; kinds: `basics` / `special` / `category` / `film`. Films/rentals/banner point at a look by ID; unassigned = WHITE. | `.pages.yml` + `OPERATIONS.md` |
| **Rentals ecosystem** | `rentals/` sub-site + Jotform→HubSpot→Supabase bookings (native Jotform integrations do the writes; n8n syncs). Server-side inclusive pricing. | `OPERATIONS.md` |
| **Supabase RLS** | Public anon key may execute **only** `catalog_availability`. `SECURITY DEFINER` funcs are dangerous — audit after every migration. | `OPERATIONS.md` |
| **Admin auth** | `/admin/*` (preview, colour-looks preview, page directory) gated by HTTP basic auth in `functions/_middleware.js`. Creds via Safari autofill, never in repo. | — |
| **Security/SEO** | `_headers` (HSTS, no-cache on `/data/*`), `_redirects` (SPA rewrites), `robots.txt`, `sitemap.xml`, favicon/apple-touch-icon, `functions/api/client-error.js` error beacon. | — |

---

## 10. The jackcarlsen build-out (next big step)

**The goal (from Jack):** build a **combined jackcarlsen.com** that fuses the *style and build
of rarepond.com* with the *style and build of the current jackcarlsen.com*.

**Current jackcarlsen.com = a Wix site** (`meta-generator: Wix.com Website Builder`). It is
Jack's **personal portfolio**, not a studio site:
- Positioning: "Jack Carlsen | Film Director" — Director (Live Action + Animation),
  Cinematographer, Gaffer, VFX Artist/Supervisor. LA / Burbank. BFA Film & TV, LMU.
- Structure: **portfolio collections split by discipline** — Directing, Cinematography,
  Visual Effects (Wix "portfolio-collections/...") — plus a Skills/Software section, an
  About/bio, a resume PDF, an image-grid "What I've Been Working On", and Contact.
- Socials: YouTube (@RarePondStudio), Vimeo (zytopian), Instagram (jackjrrc), LinkedIn.
- Footer echoes Rare Pond's "Let's Make Something Amazing…".

**rarepond.com** = the custom-coded, Cloudflare-Pages SPA documented in this file: cinematic
"escapist worlds / pond bubbles", NocoDB-driven film catalogue, colour-look system.

**So the combined build most likely means:** move jackcarlsen **off Wix** onto the same
custom stack as rarepond (Cloudflare Pages SPA + the shared NocoDB project database via the
`sites` field), keeping jackcarlsen's *personal-portfolio* IA (discipline collections, resume,
about/skills) but rendered in the Rare Pond visual language + build system.

**How the existing architecture already supports it:**
- The **`sites` field** is the multi-site switch — tag films with `jackcarlsen` and a parallel
  export (a second n8n workflow, or a parameterised Build node) writes a jackcarlsen
  `projects.json`. `Corporate` is a third planned site.
- **`roles`** (currently stored but NOT exported) is the natural driver for jackcarlsen's
  **discipline collections** (Director / Cinematographer / VFX / Gaffer). Wiring `roles` into
  the jackcarlsen export + grouping by role is likely a core task.

**Open questions to settle with Jack before building:**
1. Own repo/Cloudflare project for jackcarlsen, or share this repo (route/folder)?
2. Same film DB and asset library, or does jackcarlsen need non-film portfolio pieces
   (cinematography reels, VFX shots) as their own DB rows / a new content type?
3. Per-site look differentiation (see §5 gap) — should a film look different on jackcarlsen?
4. Migrate content off Wix manually or scrape/export it first?

**Also planned:** bulk-add many more project entries from info Jack provides, and connect to
the **NAS** to pull additional info/assets (media lives under `/media/...`; NAS on-device mount
is **read-only** — writes go via Google Drive). When bulk-adding: each row needs a unique
`key`, a `title`, `sites` including the target site(s), `placeholder` off, and images under
`/media/projects/<key>/...` (mind the image specs in `.pages.yml` / `STILLS.md`).

---

## 11. Operational gotchas & fixes (hard-won — read before touching NocoDB/n8n)

- **NocoDB "Allow Schema Change"**: normally **OFF** (`is_schema_readonly = 1`). Turn it ON
  *only* to change a field's **type** (uidt). Editing **descriptions** and **row data**
  works fine with it OFF. Turn it back OFF when done.
  - Source flags via API: `GET/PATCH /api/v2/meta/bases/pn8kzophvbwxtt7/sources/<sourceId>`;
    set `is_schema_readonly: true` to lock, `false` to allow.
- **NocoDB API calls hang?** A stuck/orphaned `ALTER` transaction is holding a Postgres
  lock and everything queues behind it. **Fix: `docker restart nocodb`** (drops its
  connections → Postgres rolls back the orphaned txn → locks release). Then retry.
  - When changing types that trigger a real `ALTER` (e.g. SpecificDBType/JSON → LongText),
    give the request a generous timeout and let it **complete** — aborting early orphans a
    lock and cascades into the next call.
- **n8n browser login expires** periodically → the **manual** "Execute workflow" button
  returns *Unauthorized*. The **scheduled** (server-side) runs are unaffected and keep
  committing. To run manually, re-sign-in to n8n at `localhost:5678`.
- **Propagation latency:** NocoDB edit → up to 5 min (schedule) → GitHub commit → 1–2 min
  Cloudflare build. Don't expect instant.
- **Local repo can be stale:** n8n commits `projects.json` straight to GitHub, so
  `/Users/rarepondstudios/rp_site_work` falls behind. **`git pull` before editing**, and do
  git ops host-side (Desktop Commander), clearing `.git/index.lock` if a previous run died.
- **GitHub raw + CDN caching:** `raw.githubusercontent.com` and the live site can serve a
  cached older copy for a bit. Trust `git pull` / a cache-busting query param over a bare curl.
- **Browser-tool output filter:** tool results can't contain URLs/tokens/base64/cookie data.
  When scripting NocoDB/n8n via the browser, store results in a `window.__x` var and read
  back only booleans/lengths/counts, or strip URLs before returning.
- **This repo is PUBLIC.** Never put passwords/keys/tokens in the repo or in Pages CMS.

### Mistakes made THIS session — do NOT repeat

- **Don't change NocoDB field *types* with "Allow Schema Change" OFF.** The PATCH returns 200
  but silently no-ops. Turn schema-change ON, change types, turn it back OFF. (Descriptions +
  row data are fine with it OFF.)
- **Don't abort an `ALTER`-triggering NocoDB PATCH early.** SpecificDBType/JSON→LongText does a
  real Postgres `ALTER`; a premature client timeout orphans the transaction, which keeps its
  lock and cascades into every subsequent call (they all hang). Give it a long timeout and let
  it finish. If things are already hung → `docker restart nocodb` to clear, then retry singly.
- **`fillVars()` collapses whitespace** (`\s{2,}` → single space), which **destroys newlines**.
  Never run it on multi-line text (credits/stills). Split into lines FIRST, then `fillVars`
  each line. This is exactly why `renderCredits` parses per-line.
- **Zero-downtime rule:** when changing a data shape, make the site read BOTH old and new
  shapes (a back-compat branch), deploy the site FIRST, then migrate the data. That's why
  `renderCredits` has the "contains HTML → render verbatim" guard and why the watch merge kept
  a fallback until the DB cut over.
- **When scripting NocoDB/n8n through the browser tool:** results containing URLs/tokens/
  base64/cookie data are BLOCKED. Store results in `window.__x` and read back only
  booleans/lengths/counts, or strip URLs. Also: an `async` IIFE returns `{}` (pending promise)
  — store to a `window` var and read it in a **separate** call.
- **Build newline values with `String.fromCharCode(10)`** in browser JS / find-replace to avoid
  backslash-escaping surprises.
- **`raw.githubusercontent.com` and the live site cache.** After an n8n commit, a bare curl may
  show stale JSON for a bit — trust `git pull` / a cache-busting `?_=timestamp`.
- **The local repo clone drifts.** n8n commits `projects.json` straight to GitHub, so
  `/Users/rarepondstudios/rp_site_work` is often behind origin. **`git pull` before editing**;
  clear `.git/index.lock` if a prior host-side git op died mid-run.

### Historical Postgres traps hit during the data migrations (for future schema work)

- **GIN index blocks `ALTER COLUMN … TYPE`** (error `42704 … gin`). Had to
  `DROP INDEX IF EXISTS rp.projects_<col>_idx;` before altering, then recreate if needed.
- **`ALTER … USING` can't contain a subquery** (`0A000 cannot use subquery in transform
  expression`). Pattern that worked: add a temp column, `UPDATE` it with the subquery, drop the
  old column, rename temp → original.
- **A generated column expression must be immutable** (`42P17`). A cross-column derivation that
  isn't immutable fails as a generated column — use a trigger instead (and remember to remove
  the trigger once the need is gone).

### Cross-reference

`OPERATIONS.md` → "Things that have bitten us" covers the site/rentals traps (Cloudflare 308 on
`/foo.html`, blur/box-shadow re-raster perf trap, first-paint-before-data, Jotform DELETED
submissions, frozen intake cursor, don't disable native Jotform integrations). Read it before
touching the SPA, the rentals pipeline, or Supabase functions (RLS / `SECURITY DEFINER` audit).

---

## 12. Current live state (2026-07-16)

- 3 films + 1 placeholder in the catalogue:
  - `geri` — Geri-Action (`/geriaction`)
  - `rev` — Revelations (`/revelations`)
  - `invalid` — Invalid Opinion (`/invalidopinion`)
  - `more` — "More to come…" (placeholder)
- All field **types** conformed to the single-vs-multi rule; "Allow Schema Change" is OFF.
- **Credits** migrated to the new `Role: Names` format on all films and rendering live.
  (Jack removed the "Loyola Marymount University" line himself; and reworded Invalid's first
  line — see the colon cleanup note in §7.)
- `watch` is a single auto-detecting field; social buttons have per-network hover glow.
- No leftover dead code for the retired `watchYoutube`/`watchVimeo` split; obsolete
  `tools/phase0-projects.sql` and `tools/projects-schema.md` scaffolds were removed.
- The end-to-end "new NocoDB row → live site" automation was tested and verified, then the
  test row was deleted.

---

## 13. Suggested next steps for the new chat

1. **Quick hygiene pass:** verify credits colon-consistency across all films; re-read live
   `projects.json` and each film page; run `tools/validate-projects.mjs` + `smoke-test.mjs`.
2. **Confirm the jackcarlsen plan with Jack** (shared repo vs separate; which projects get
   `sites: jackcarlsen`), then design the second export + front-end (§10).
3. **Bulk-add projects** from Jack's info + NAS assets: define a clean intake (row template,
   image placement under `/media/projects/<key>/`, required fields), possibly a helper.
4. **Polish** the studio site as directed.

---

## 14. Appendix — IDs & endpoints

- Repo: `github.com/rarepondstudios/rare-pond-studios` (branch `main`).
- Supabase project ref: `gnifidmyahtzydwvaegj` (schema `rp`, table `projects`).
- NocoDB: `http://localhost:8080` — base `pn8kzophvbwxtt7`, table `m765vzpp8kve3wc`.
  - Token: `POST /api/v1/auth/token/refresh` (credentials: include) → use as `xc-auth` header.
  - Records: `GET/POST/PATCH/DELETE /api/v2/tables/m765vzpp8kve3wc/records`.
  - Columns/meta: `/api/v2/meta/tables/m765vzpp8kve3wc`, `/api/v2/meta/columns/<id>`.
- n8n: `http://localhost:5678` — projects workflow id `tAlPhnGm5crTfnrM`.
- Containers on the Mac Mini: `nocodb`, `n8n` (both `docker restart`-able via Desktop Commander).
- Existing docs to read next: `README.md`, `OPERATIONS.md`, `CUSTOM_PAGES.md`, `STILLS.md`.

---

## 15. jackcarlsen.com — build kickoff (infra is READY)

**Goal:** build the *combined* jackcarlsen.com — the aesthetic/assets of the current
(Wix) personal portfolio, rebuilt on the **same custom stack as rarepond** (static Cloudflare
Pages SPA, film data from the shared NocoDB/Supabase DB via the `sites` field), with a Pages
CMS behind it for the non-DB copy.

### 15.1 READ THIS FIRST: the existing plan
`JACKCARLSEN-ROADMAP.md` (in this folder, next to HANDOFF.md) is **Roadmap v2** from a prior
session — the full strategy: shared DB as source of truth for 3 sites (rarepond / jackcarlsen /
corporate), render-agnostic data model, **role-based filtering** for jackcarlsen's discipline
collections, per-site presentation overrides, and a feature-carryover matrix. **Read it.**

`JACKCARLSEN-BRIEF.md` (same folder) is the **desired new homepage layout** Jack specified:
the interactive hero showreel + synced bubble selector, About, the auto-scrolling **poster
wall** ("What I've Been Working On"), and the CMS-managed **BTS collage** — plus the new DB
fields those require (`jc_in_carousel`, `jc_in_workwall`, `poster_image`, `hero_clip`).
**Read it too — it's the build spec.**

> **Reconcile the roadmap against what actually shipped (it's ahead of reality in places):**
> - The roadmap proposes a nested `perSite` object (`perSite.jackcarlsen.colorLook`,
>   `renderStyle`, `featured`, …). **The shipped DB flattened per-site flags to single columns**
>   (`rp_color_look`, `rp_bubble_glow`, `rp_in_carousel`) — so **per-site differentiation is NOT
>   built yet**. If jackcarlsen needs a different look/render than rarepond for the same film,
>   that's real work (re-introduce per-site overrides). Decide with Jack.
> - The roadmap lists fields since removed/renamed (`subtitle`, `cardLogline`, `disciplines`,
>   `chips`→`genre`). **Trust §5 of THIS doc / the live NocoDB schema for current field names.**

### 15.2 Infrastructure — DONE and verified live
- **GitHub:** `github.com/Jackjrrc/jackcarlsen-website` (Jack's **personal** account, private).
  A `gh auth login` credential for `Jackjrrc` (scopes `repo`,`workflow`) is in the Mac keychain,
  so host-side `git push` works.
  - **Dual-account gotcha:** this Mac's `gh` keyring now holds **two** accounts — `Jackjrrc`
    (personal) and `rarepondstudios` (studio). `git push` uses the **active** one.
    `rarepondstudios` is the default active account (needed for the rare-pond repo). **To push to
    the jackcarlsen repo, first run `gh auth switch --user Jackjrrc`**, push, then
    `gh auth switch --user rarepondstudios` to restore the default. Pushing to the wrong repo
    with the wrong active account fails with a 403.
- **Cloudflare:** a **separate personal Cloudflare account** (accounts@jackcarlsen.com,
  acct id `c8bba86c59f46ac9e4421e25c86ca077`) with a **Pages** project `jackcarlsen-website`
  connected to the repo. **It is Pages, not Workers** — required for `_headers`, `_redirects`,
  and Pages Functions (`/admin` auth), exactly like rarepond.
- **Live URL:** https://jackcarlsen-website.pages.dev (serving the scaffold placeholder).
  **Auto-deploy on push to `main`** is wired.
- **Local clone:** `/Users/rarepondstudios/jackcarlsen-website` (scaffold: placeholder
  `index.html`, `README.md`, `.gitignore`, `data/projects.json` = `{"projects":[]}`).
- **Domain:** `jackcarlsen.com` is still the **live Wix site** — leave it. Repoint to Cloudflare
  only at launch (custom domain in the Pages project, DNS in the new Cloudflare account).

### 15.3 Asset locations on THIS Mac (the next chat runs here too)
- **NAS (read-only on-device; write via Google Drive):** `/Volumes/RarePondNAS/`
  → `Current Projects/` (`Geri-ACTION Film`, `Geri-ACTION Series`, `[Camp-Dillo]_VFX`,
  `RP Project Template`, …), `Archived Projects/`, `Project Wide Files/`,
  `Revelations Nino Drive Copy/`. Film masters / stills sources live here.
- **Jack's brand kit (iCloud):**
  `~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Current Brand Assets/Jack Carlsen V3/`
  - `Exports/Logos/` → `Jack Carlsen Logo v1.png`, `…v2.png`, `…v3.png`, `V3 Banner.png`
  - `Portrait Photos/` → headshots: `DSC07443.jpeg`, `Photoshoot JC V3_001.png`,
    `Circle Cutout Profile Photo (Blue-Purple/Rainbow).png`, PSDs
  - also `Exports/{Backgrounds,Overlays,Transitions}/`, `After Effects/` (brand animation),
    `On-Set Photos/`, `Sound Assets/`
- **Résumé:** `~/Documents/Claude/Projects/Jack's Job Search/Jack Carlsen Resume 2026.pdf`
  (+ `.docx`).
- **Current Wix site content/media source:** https://www.jackcarlsen.com (Wix — JS-rendered;
  media served from `static.wixstatic.com`). See 15.5.

> NAS mount can drop; if `/Volumes/RarePondNAS` is missing, ask Jack to reconnect it in Finder.
> Confirm the exact per-film subfolders before referencing paths — names above are the top level.

### 15.4 Current Wix site — snapshot (verify by deep-dive, see 15.5)
"Jack Carlsen | Film Director" — LA/Burbank; Director (Live Action + Animation),
Cinematographer, Gaffer, VFX Artist/Supervisor; BFA Film & TV, LMU. Nav: **Portfolio,
Directing, Cinematography, Visual Effects, Skills, Contact** (portfolio split by discipline).
Has an About/bio, a résumé PDF link, a "What I've Been Working On" image grid, and social
links (YouTube @RarePondStudio, Vimeo /zytopian, Instagram @jackjrrc, LinkedIn). Footer:
"Let's Make Something Amazing…". Fonts/colors: pull from Wix (see below).

### 15.5 Pre-build checklist (do before the single-run build chat)
1. **Tag the DB:** in NocoDB, add `jackcarlsen` to `sites` for every project/piece that belongs
   on the personal site, and fill each row's **`roles`** (Director / Cinematographer / VFX /
   Gaffer) — that drives the discipline collections. Add any non-film portfolio rows.
2. **Decide the export path** for jackcarlsen's `projects.json`: a **2nd n8n workflow** (filter
   `sites` includes `jackcarlsen`, commit to this repo — needs a GitHub token for the personal
   repo added to n8n) **or** a **GitHub Action in the personal repo** that reads Supabase
   read-only and self-builds (keeps the studio n8n out of the personal repo; the `workflow`
   token scope is already granted). Recommend the GitHub Action for clean separation.
3. **Decide per-site look** (15.1 reconciliation): same look as rarepond, or build per-site
   overrides.
4. **Assets:** gather the brand kit + headshots + résumé + chosen portfolio media into the repo
   under `/media/...` (mirror rarepond's layout). Capture Wix **fonts + color palette**.
5. **Wix deep-dive** (15.6) → a content/IA/media inventory so nothing is lost in migration.
6. **One-page brief:** pages/IA, must-keep Wix elements, tone, priorities.
7. Hand the new chat: `HANDOFF.md` + `OPERATIONS.md` + `JACKCARLSEN-ROADMAP.md` + the brief +
   the asset paths above.

### 15.6 Capturing the current Wix site
Get an authoritative map of the existing jackcarlsen.com before rebuilding:
- **Wix MCP connector — CONNECTED & WORKING** (verified this session). `ListWixSites` returns
  the site **"Jack Carlsen Website"**, **site id `a7f0f9a8-3869-4ff6-929e-c5042e928e05`**.
  Use `CallWixSiteAPI` (after `WixREADME` / `SearchWixRESTDocumentation` to get endpoints) to
  pull the page list, each page's content, the media library, and site Design (fonts/colors).
  This is the cheapest, most complete route — **recommended as the build chat's first step**
  (fresh context), rather than a screenshot crawl.
- Fallback: `web_fetch` each public page (`/vfxartist`, `/portfolio-collections/directing-portfolio`,
  `/portfolio-collections/cinematography-portfolio`, `/portfolio-collections/visual-effects-portfolio`)
  for readable copy — but it can't see the media library, fonts, or colors like the API can.
- Last resort: guided editor walk-through (Design/Theme + Media Manager) — slow, screenshot-heavy.
```
