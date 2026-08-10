# STREAMLINE ROADMAP, the next session's mission

> **Audience:** the next AI session taking a FRESH look at this codebase.
> **Mission (Jack, 2026-08-06):** without breaking any current feature or behaviour,
> streamline the sites so every RECURRING element (header, footer, transitions, lightbox,
> popups) runs off ONE internal code engine with per-site config (info / images / links
> swapped, framework identical), so a future site can be stood up by writing config, not
> code. Then do a deep-dive sweep for anything else to optimize, unify, and clean up.
> **Read first:** HANDOFF.md §0 (all of it), OPERATIONS.md. Public repo, no secrets here.

## 1. Ground rules (non-negotiable)

- DO NOT regress the cursor/keyboard engine (assets/cursor.js). It is shared, mature, and
  every behaviour in it exists because of a specific reported bug (HANDOFF 0.0.-1..-15
  documents each root cause). Change it only with the harness green.
- Test harness lives at ~/bts-automation/_headless (headless Chrome + Firefox via
  puppeteer). Run the v12/v14/v15/v16 suites plus targeted tests after every change batch.
  Mobile emulation (390px touch + 820px iPad) for anything visual.
- Two repos, one master pattern: shared masters live in ~/bts-automation (cursor.js,
  social_ui.js, contact.js/css) and are copied into BOTH repos' assets/. Keep that pattern
  for every new shared engine; note the sync is manual (cp) except social_ui's launchd job.
- Never measure on-screen geometry with window.innerWidth/innerHeight, use
  documentElement.clientWidth/Height (classic-scrollbar bug, HANDOFF 0.0.-14).
- Docs ritual after each batch: HANDOFF §0 entry, SSOT change log, journal append.

## 2. THE UNIFICATION TARGETS (the core of the mission)

### 2.1 Footers, FOUR divergent implementations (worst offender)
| Site/page | Implementation |
|---|---|
| rarepond.com (studio) | `<template id="footerTpl">` cloned into `[data-footer]` (index.html) |
| /media | static `.mfoot` markup in media/index.html |
| /rentals | static `.rfoot` markup in rentals/index.html |
| jackcarlsen.com | `footerHTML()` JS builder (index.html) |

Symptom of the drift: the media wordmark hitbox bug (a flex anchor filling the whole
footer row, fixed 2026-08-06, but only THERE; the class of bug survives elsewhere).
TARGET: one shared `footer.js` engine (bts-automation master, synced like social_ui)
rendering from a per-site config object: logo(s), tagline, nav links, socials source,
copyright, and the accessibility line (currently duplicated by hand in FIVE places).
Delete all four bespoke implementations once parity is pixel-verified per site.

### 2.2 Headers, same story
Studio has its own hamburger menu; /media has `.mhdr`+`.mnav`; /rentals its own header;
JC its own. xnav.js (shared) already handles the cross-site chips + a standardized
collapse rule (burger when header overflows OR page-nav breakpoint-hidden OR ≤720px,
added 2026-08-06 as a band-aid ACROSS implementations). TARGET: one header engine,
config-driven (brand block, page-nav links, chips, socials), with the collapse rule
inside it. The v20 fix means the burger logic is already centralized, the markup isn't.

### 2.3 Inline boot snippets, duplicated per document with drift risk
Every HTML document carries hand-pasted copies of: the pageveil styles+logic, the #xwipe
cross-site wipe, the `__xw` pre-paint snippet, the `#rpt=` transition-handoff pre-paint,
the SAME-PAGE NAV click handler, and outgoingFade. They MUST run pre-paint (that's why
they're inline), but they should be stamped from one source (tiny build/stamp script in
tools/, or one canonical snippet file each doc includes verbatim with a version marker) so
an edit lands everywhere. Today an edit means find-and-fix N copies.

### 2.4 Lightboxes, two near-identical implementations
RP index and JC index each build the same lightbox (open/close, prev/next with
data-kb-dir, top-left X, look-var copying, kb integration). TARGET: one shared
lightbox.js consuming a config (caption/CTA optional per site). Same for the reel viewer.

### 2.5 Color-look variable naming, needs one convention
Current zoo: `--g1/2/3` (JC scopes + RP raw), `--gg1/2/3` (RP glow layers), `--h1/2/3`
(RP hover-look), `--fg1/2/3` (RP universes), `--c1/2/3` (contact bubbles). cursor.js
lookRead() resolves them in a documented precedence (see its comments) and RP maps
--gg from --g/--h in CSS. TARGET: pick ONE scheme (suggest: keep --g1/2/3 as the scope
look + --h1/2/3 as hover variant), migrate the rest, and update cursor.js + every glow
layer together. This is the highest-risk unification, do it LAST, harness-heavy, and
keep the old names resolving during a transition period.

### 2.6 Already-shared engines (the model to copy)
cursor.js (cursor + keyboard + a11y toggle), social_ui.js (socials + transition
handoff), contact.js/css (contact modal), crew-form (form popup), xnav.js (chips +
collapse). The footer/header/lightbox work should look exactly like these when done.

## 3. Deep-dive sweep candidates (after the unifications)

- Dead code: leftover selectors from removed features (e.g. any `.kbring`/`.ckbring`
  remnants, superseded rules in media/rentals CSS), unused images, stale tools/ scripts.
- index.html size: the studio document is ~2400+ lines of inline CSS/JS. Consider
  extracting stable blocks (carousel, universes, projects grid) into assets/ files,
  measure paint impact first; the inline-first choices were deliberate for first paint.
- Duplicate SAME-PAGE NAV / scroll-lock / esc-handling code paths between popups.
- Image pipeline: confirm every grid/carousel/orbit image has width/height or aspect
  ratio, loading=lazy where offscreen, and no oversized sources on mobile.
- The "what we do" orbit section REDO (Jack will call for it): design notes in HANDOFF
  0.0.-15, size the orbit relative to the plate (percent-based, not the ABOUT_ORB_POS
  px table); consider z-ordering emerged bubbles above the plate; keep the scroll-tied
  --p progress mechanic.
- Cross-browser: Firefox harness exists (ff1.mjs). Safari remains untested, manual pass
  on Jack's devices, or add safaridriver if feasible.
- Pending owner items (unchanged): apex DNS cutover to Cloudflare (bare rarepond.com
  deep links 404 at the old forwarder, share www links until then); CSP report-only;
  branch protection.

## 3a. Measured targets (Lighthouse mobile, 2026-08-09, run from the mini)

rarepond.com: perf 55, LCP 11.7s, CLS 0.164, 12.3 MB transferred.
jackcarlsen.com: perf 45, LCP 14.1s, TBT 1.4s, 15.7 MB transferred.
Desktop is comfortable on both; the cost is mobile bytes. Sources, largest first:

- JC posters: 19 hand-dropped JPGs at 450-870 KB each, no WebP/srcset derivatives
  (~3.3 MB recoverable on a phone). Wire poster derivatives into the exporters so a NEW
  poster drop auto-optimizes with no workflow change.
- RP home carousel streams `media/projects/geri_action/video/geri-action-reel.mp4` (10 MB) on
  every device. JC's landing reels got the 720p companion + poster + IntersectionObserver pause
  in HANDOFF 0.0.-33; give the RP carousel the same vsrc() treatment.
- Bubble JPGs served full-size into small slots on BOTH sites (e.g. geri-bubble.jpg, 370 KB).
  Add srcset derivatives like stills/BTS already have.
- Google Fonts is render-blocking ~0.8s on both sites: self-host the woff2 files with
  font-display so paint does not wait on fonts.googleapis.com.
- RP mobile CLS (0.164) comes from carousel imagery without reserved aspect-ratio space.

Rule for all of it, per the media standard: never degrade a master, desktop keeps streaming the
original; derive and select per screen, and make every derivation automatic on drop so Jack's
workflow does not change.

## 4. Definition of done for the streamline pass

1. One shared engine each for footer, header, lightbox (+ reel), with per-site config;
   bespoke copies deleted; pixel/behaviour parity confirmed per site in the harness
   (desktop + 390px + 820px, Chrome + Firefox).
2. Inline boot snippets stamped from one source with a version marker per document.
3. Full harness suite green, live-verified on both domains after deploy (curl markers),
   and a real-browser check through the Chrome extension bridge (catches scrollbar-class
   environment bugs the headless harness cannot).
4. HANDOFF §0 entry + SSOT + journal updated; this file updated with what shipped and
   what remains.
