# jackcarlsen.com, Build Brief (Jack's spec)

The target design for the combined jackcarlsen.com. Read alongside `HANDOFF.md` (infra +
data model + gotchas) and `JACKCARLSEN-ROADMAP.md` (shared-platform strategy). This file is
the **desired new layout**; the current Wix site is captured separately via the Wix connector
(site id `a7f0f9a8-3869-4ff6-929e-c5042e928e05`) as the build chat's first step.

**Concept:** marry the *personal-portfolio* content/branding of the current (Wix)
jackcarlsen.com with the *project system + interactive carousel* of rarepond.com, rebuilt on
the rarepond stack (static Cloudflare Pages SPA, film data from the shared NocoDB DB via
`sites: jackcarlsen`). Discipline framing (Director / Cinematographer / Gaffer / VFX) comes
from the `roles` field.

---

## Homepage layout, top to bottom

### 1. Hero, interactive showreel + synced project selector  *(the signature new piece)*
- **Top:** a large "video" view that plays footage from Jack's work. It is **not one
  pre-rendered reel**, it's a dynamic player that cycles through the featured projects' clips,
  one at a time.
- **Below it:** a **smaller version of the rarepond bubble carousel**. The bubble that's
  active corresponds to the project whose footage is currently playing above. As the showreel
  cycles, the carousel toggles to match; the user can also **click a bubble to jump** the
  player to that project's clip.
- **Call to action:** when a clip catches someone's eye, a button on it takes them to **that
  project's page**, the same project-page route/behavior as rarepond (slugified title).
- **Which projects appear here** is controlled per-project by a **jackcarlsen "front-page
  carousel" toggle** (separate from rarepond's `rp_in_carousel`, and separate from the poster
  wall below, see §4 data model).
- **Performance is a hard requirement** (Jack called this out): don't mount many simultaneous
  `<video>`s. Suggested approach, one (or two, for crossfade) muted/inline/looping video
  element(s), swap `src`/poster on selection, lazy-load, preload only the next clip, pause
  offscreen. Respect the rarepond perf traps (see `OPERATIONS.md`: blur/box-shadow re-raster;
  `prefers-reduced-motion`).

### 2. About, "who is Jack"
- The section with **Jack's face/photo** and a bio/intro about him (Director + Cinematographer
  + Gaffer + VFX; LA/Burbank; LMU BFA; the "I love crafting worlds…" statement). Résumé link.
  Pull current copy from Wix; headshots from the brand kit (`HANDOFF.md` §15.3).

### 3. "What I've Been Working On", auto-scrolling POSTER wall
- A horizontally **auto-scrolling carousel of film POSTERS** (portrait poster aspect ratio,
  **not** the square bubbles, reuse the carousel mechanics but with poster tiles).
- Populated from the projects DB, controlled by a **separate jackcarlsen "work wall" toggle**,
  independent of the hero carousel toggle in §1. (So Jack can put a project in the hero reel,
  the poster wall, both, or neither.)
- Poster tiles presumably link to the project page too (confirm).

### 4. BTS collage, auto-scrolling behind-the-scenes photos  *(jackcarlsen-only, NOT in NocoDB)*
- An automatically-scrolling **collage of curated BTS photos**, brought over from the current
  Wix site.
- **Storage:** its own media folder in the jackcarlsen repo (e.g. `/media/bts/`), managed via
  **Pages CMS / Cloudflare Pages only**, deliberately NOT a NocoDB/database thing (it's
  personal to this one site).
- **Editability:** Jack must be able to **add/remove BTS photos** and have the collage update.
  A `data/bts.json` (or CMS list) drives it; the front-end must **auto-compensate for any
  number of photos and keep a seamless infinite loop** (no visible seam/jump), e.g. duplicate
  the strip and animate `translateX` over a duration derived from the real strip width, works
  for arbitrary counts/aspect ratios.

---

## Data-model implications (proposed, for the build chat to finalize with Jack)

The current DB has rarepond-scoped flat columns (`rp_color_look`, `rp_bubble_glow`,
`rp_in_carousel`). jackcarlsen needs its own presentation flags/media, extending that same
flat, site-prefixed pattern (this is the "per-site differentiation" work flagged in
`HANDOFF.md` §15.1):

| New/needed field | Purpose | Notes |
|---|---|---|
| `jc_in_carousel` (bool) | Show in the **hero showreel + bubble selector** (§1) | Separate from `rp_in_carousel`. |
| `jc_in_workwall` (bool) | Show in the **"What I've Been Working On" poster wall** (§3) | Independent of `jc_in_carousel`. |
| `poster_image` (path) | The **portrait poster** for the work wall (§3) | New media field; square `bubble_image` won't do. Could be shared across sites. |
| `hero_clip` (path) | Short **looping clip** for the hero player (§1) | Decide: new field vs reuse `focus_video`. Wants a short seamless loop, not the full reel. |
| (maybe) `jc_color_look` | Per-site colour look if jackcarlsen should differ | Only if §HANDOFF 15.1 per-site look is wanted. |

Everything else (title, roles, genre, watch, credits, blurb, stills, focus bg, etc.) is shared
from the existing schema. Confirm exact names against live NocoDB before coding.

---

## Assets to source before/while building
- **Hero clips:** short, seamless, muted loop clips per featured project, exported from NAS
  masters (`/Volumes/RarePondNAS/Current Projects/...`). Keep them small/optimized (web).
- **Posters:** portrait poster art per film (the ones on the current Wix "What I've Been
  Working On"). Grab via the Wix media pull; originals may be on the NAS / brand kit.
- **BTS photos:** the curated set from the current Wix site → new `/media/bts/` folder.
- **Brand/headshots/résumé/logo:** paths in `HANDOFF.md` §15.3.

---

## Open decisions to settle with Jack before the full run
1. **Nav / other pages:** does jackcarlsen keep discipline sub-pages (Directing /
   Cinematography / Visual Effects / Skills / Contact) like Wix, or is it a single long
   homepage + project pages? (The `roles` field can drive discipline filtering either way.)
2. **Hero clip source & format** (new `hero_clip` field vs reuse `focus_video`; who exports the
   loops).
3. **Per-site colour look**, same palette as rarepond, or jackcarlsen-specific.
4. **Poster tiles link target** (project page? external? nothing).
5. **Export mechanism** for jackcarlsen's `projects.json` (2nd n8n workflow vs GitHub Action in
   the personal repo, `HANDOFF.md` §15.5). Recommend the Action for clean separation.
6. **Contact form** (Wix form → what? HubSpot like rarepond, or a simple mailto/Formspree).

---

## Pre-build checklist (supersedes HANDOFF §15.5 where they overlap)
1. Build chat step 1: **Wix connector pull** → inventory current pages, content, media, fonts,
   colours (site id above).
2. **Add the new DB fields** (table above) in NocoDB; set `sites += jackcarlsen`, fill `roles`,
   and the two new toggles for the relevant projects; attach posters + hero clips.
3. **Create `/media/bts/`** and drop the curated BTS photos; decide the `bts.json` / CMS shape.
4. Decide the **export mechanism** and wire it (jackcarlsen `projects.json`).
5. Settle the **open decisions** above.
6. Hand the build chat: `HANDOFF.md` + `OPERATIONS.md` + `JACKCARLSEN-ROADMAP.md` + **this
   brief** + asset paths.

---

## DECIDED (Jack's answers to the open questions)

### Header / navigation
- **Logo/name top-left → Home** (same behavior as rarepond).
- Nav items: **About** (scrolls to the about-me section on the home page) · **Projects**
  (→ the dedicated Projects page below) · **Contact** (scrolls to the contact form at the
  bottom of the home page).
- **Social icons in the header** (same as rarepond).

### Projects page (dedicated), discipline portfolio
- Behaves like rarepond's Projects page, **plus discipline sorting**.
- **Top of the page: three Reels**, Directing Reel, Cinematography Reel, VFX Reel. The
  **selected** discipline's reel is highlighted with a **glow and shown full-size**; the other
  two stay interactable but are **slightly smaller** to focus attention. **Default = Director.**
  Selecting a different discipline **animates the focus/glow moving** from the old reel to the
  new one, and re-populates the project list below.
- **Sort buttons:** All · Director · Cinematography · Visual Effects.
  - **All:** every film.
  - **Director:** Director credits.
  - **Cinematography:** Cinematographer projects, then a **labeled divider**, then Gaffer projects.
  - **Visual Effects:** VFX Supervisor projects, then a **labeled divider**, then VFX Artist
    projects. Title/intro-animation credits count as VFX (e.g. *The Hearts That Bleed And Bloom*).
- Clicking a listed project opens its **project page** (same as rarepond), with a **back button
  top-left**. Same behavior as clicking a project on the home page.
- Implementation note: the role→category placement + sub-ordering is **front-end logic driven
  by each project's `roles` values** (see mapping table below).

### Contact
- Header **Contact** scrolls to a **contact form at the bottom of the home page**, styled like
  rarepond's and **wired to HubSpot**.

### Color looks
- The **color-look system carries over** to jackcarlsen (it must exist there).
- **Palettes are shared in content** between the two sites, **except `signature`**, which on
  jackcarlsen follows the **jackcarlsen** colour scheme (not rarepond's).
- **Hero-clip-favored-over-still** (poster as the fallback) carries over from rarepond.
- **Bonus goal:** have the two sites **share one canonical color-look system** (single source
  auto-mirrored to both, matches the `colorlooks.json` auto-transfer idea in
  `JACKCARLSEN-ROADMAP.md`).

### Role → discipline-category mapping (Projects page)
| `roles` value | Category | Sub-order |
|---|---|---|
| Director | Director |, |
| Animation Director | Director *(confirm (used on Pity Party intro)* |) |
| Cinematographer | Cinematography | top |
| Gaffer | Cinematography | after divider |
| VFX Supervisor | Visual Effects | top |
| VFX Artist | Visual Effects | after divider |
| Title/Intro Animation | Visual Effects | with the VFX-Artist tier *(confirm)* |

---

## jackcarlsen project roster to ADD (source: NAS `Archived Projects`)
`01_My Film Projects` = Jack's own; `02_Other People's Film Projects` + `03_Comissions` =
others' films / VFX-for-hire. Each folder has assets (film, posters, info); supplement with
online research for high-res posters + details.

| # | Title | Jack's role(s) | Notes |
|---|---|---|---|
| 1 | Revision | Director, VFX Artist | Jack's own film |
| 2 | LoveBug | VFX Supervisor, VFX Artist | |
| 3 | Miss Fortune | VFX Supervisor, VFX Artist | |
| 4 | The Animator | VFX Supervisor, VFX Artist | |
| 5 | The Time I Found Buried Treasure | VFX Supervisor, VFX Artist | **Jack provided a treasure-map poster to use** |
| 6 | Hero's Journey | Gaffer | short film, dir. Stan Alger |
| 7 | Remember Me | Cinematographer | |
| 8 | Pity Party | Animation Director (intro sequence) | by McCrystal |
| 9 | Eddie's Order | VFX Supervisor / VFX Artist | |
| 10 | The Hearts That Bleed And Bloom | Title-intro animation (counts as VFX) | |
| 11 | Synesthesia | Cinematographer (Episode 1) | series |

**Status:** rows are created in NocoDB tagged `sites: jackcarlsen` with `roles` set (skeleton).
**Still needs a focused enrichment pass:** per-film `blurb`/`year`/`production`/full `credits`,
`poster_image`, `hero_clip`, and stills, pulled from the NAS folders (locate each under the
nested `01/02/03` archive) + online research. Save Jack's Buried-Treasure poster into
`/media/posters/`.


---

## SESSION LOG, data enrichment is DONE (2026-07-16)
A separate focused chat enriched all 11 `sites: jackcarlsen` project rows in NocoDB. Full
per-film detail (found vs. missing) is in **`JACKCARLSEN-ENRICHMENT-REPORT.md`** (same folder).
Summary for the build chat:
- All 11 rows now have `year`, `production`, `status`, `kicker`, `tagline`, `blurb`,
  `page_logline` (HTML `<i>` on titles), `credits` (one `Role: Name(s)` per line), `genre`
  (one per line), and `stills` where real stills existed. `sites` left as `jackcarlsen` only.
- Assets saved into `jackcarlsen-website/media/` (sRGB JPEG, <600 KB): the REAL Buried-Treasure
  poster `media/posters/buriedtreasure.jpg`; frame-grab **placeholder** posters for the other 10
  at `media/posters/<key>.jpg` (swap for real portrait key art when available); real stills at
  `media/projects/<key>/still*.jpg`.
- The four new columns (`poster_image`, `hero_clip`, `jc_in_carousel`, `jc_in_workwall`) were
  deliberately NOT created, this brief still owns them. Their staged paths, suggested
  carousel/work-wall picks, and per-film hero-clip **source masters on the NAS** are listed in the
  report. Add the columns (schema-change ON → add → OFF per HANDOFF §11) and wire them.
- `watch`: **LoveBug is done** (Prime Video link). The other 10 still need links (Jack will paste
  his YouTube/Vimeo URLs, or supply as found).

## SCOPE ADDITION, `watch` must support major streaming services, not just YouTube/Vimeo
Rarepond's current watch handling (`parseWatchLinks()` / `buildWatch()` / `renderWatch()` in
`index.html`, ~lines 1340–1415, sharing `_wEsc()`) auto-detects **YouTube and Vimeo per line** and
renders a click-to-load **embed** (play button → iframe). For jackcarlsen, carry that over AND
extend it:

1. **Keep the YouTube + Vimeo click-to-load embed behavior**, and explicitly **verify Vimeo
   works** on jackcarlsen (Jack asked to be sure it's set up, same as YouTube: play button →
   lazy iframe, not mounted until clicked).
2. **Add recognition for major streaming / VOD services.** These CANNOT be iframe-embedded, so for
   them render a **branded external "Watch on X" button** (opens in a new tab,
   `rel="noopener noreferrer"`), styled like the existing platform buttons, one per link,
   auto-detected from the URL host:
   - Amazon Prime Video, hosts `amazon.com` (a `/dp/` or `/gp/video/` path) and `primevideo.com`
   - Netflix, `netflix.com`
   - Hulu, `hulu.com`
   - Disney+, `disneyplus.com`
   - Max / HBO Max, `max.com`, `hbomax.com`
   - Apple TV+, `tv.apple.com`
   - Peacock, `peacocktv.com`
   - Paramount+, `paramountplus.com`
   - Fallback: any other `http(s)` link → a generic **"Watch"** external button (never break).
3. Give each service its **own icon + brand-colour hover glow**, mirroring the social auto-detect
   pattern (`detectNet()` / `renderSocials()`) that already assigns per-network colours/glows.
4. Keep `watch` as a single `LongText` field (one URL per line); the **front-end decides per link**
   whether to embed (YouTube/Vimeo) or show an external button (everything else) based on host.
5. **First test case already in the DB:** LoveBug's `watch` = its Prime Video URL, use it to build
   and verify the Amazon "Watch on Prime Video" button.

Respect the rarepond perf + zero-downtime rules (OPERATIONS.md / HANDOFF §11): lazy-load embeds,
don't mount iframes until clicked, `prefers-reduced-motion`, and keep the parser back-compat (an
unknown host renders the safe external button rather than throwing).

---

## BUILD SESSION LOG, v1 BUILT AND LIVE (2026-07-16)
The build chat executed this brief end to end. Live at https://jackcarlsen-website.pages.dev
(domain still on Wix; repoint at launch). Wix capture notes: `JACKCARLSEN-WIX-CAPTURE.md`.

DONE:
- NocoDB: the 4 new columns created (schema-change ON→add→OFF) and populated on all 11 rows
  (poster_image=/media/posters/<key>.jpg, hero_clip=/media/clips/<key>.mp4, jc_in_workwall=all,
  jc_in_carousel=the 6 suggested picks). pityparty title_logo set. rarepond rows untouched.
- Assets in the personal repo: 11 posters (REAL key art swapped in for lovebug/missfortune/
  theanimator from Wix full-res), 11 hero loop clips cut from the NAS masters (8s, 720p, muted),
  3 discipline reels in /media/reels/ (NOTE: no dedicated Directing Reel export existed on the
  NAS, the 2025 Full Reel Slideshow is standing in; swap when Jack exports one),
  10 BTS photos + data/bts.json, brand logo/headshot/résumé, purple bg-wires background.
- Pipeline: GitHub Action `.github/workflows/export-projects.yml` every 15 min, Supabase
  read-only → data/projects.json (sites=jackcarlsen, exports roles + the jc fields) → validator
  gate → commit-on-change; mirrors canonical colorlooks.json from the rarepond repo with the
  jackcarlsen `signature` (purple #a359ee) kept via data/colorlooks-overrides.json.
  *** NEEDS ONE SECRET FROM JACK: repo Settings→Secrets→Actions→DATABASE_URL (read-only
  Supabase Postgres connection string). Until then the export step skips and the committed
  seed (generated this session from NocoDB) keeps serving. Workflow verified green.
- SPA per this brief: hero showreel (2-video crossfade, preload-next-only, offscreen pause,
  reduced-motion → posters) + synced bubble selector; About; auto-scrolling poster work wall;
  seamless BTS collage (any photo count); HubSpot contact (REUSING rarepond's form id per Jack,
  swap in site.json→hubspot when a jackcarlsen form exists); Projects page with 3 reels +
  animated focus/glow + All/Director/Cinematography/VFX sorting incl. labeled Gaffer / VFX
  Artist dividers; project pages (heroClip bg → still → poster fallbacks); watch system extended:
  YouTube AND Vimeo click-to-load embeds (Vimeo id parsing verified incl. manage/videos links)
  + branded "Watch on X" external buttons for Prime/Netflix/Hulu/Disney+/Max/AppleTV+/Peacock/
  Paramount+ + generic fallback (LoveBug Prime button verified live); color-look system with
  shared palettes; Rare Pond cross-link bubble; _headers/_redirects/robots.

STILL FOR JACK (non-blocking): DATABASE_URL secret; watch links for the other 10 films;
optional real Directing Reel; verify enrichment-flagged years/directors/loglines; real portrait
key art for the 8 frame-grab placeholder posters; jackcarlsen HubSpot form; DNS cutover at launch.
