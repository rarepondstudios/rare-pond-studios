# Rare Pond Studios, System Handoff & Architecture

> **Purpose.** This is a full knowledge-transfer document so a fresh chat can pick up the
> Rare Pond / Jack Carlsen web project cleanly, review what's been built, tidy it, and
> continue polishing + building out the **jackcarlsen** site.
>
> **Read `OPERATIONS.md` first, it is the canonical operations manual** (access, pipelines,
> rentals, Supabase RLS, the "things that have bitten us" list). Then `README.md`,
> `STILLS.md`, `CUSTOM_PAGES.md`, and `tools/ROTATE-GITHUB-PAT.md`. THIS file is the
> **session supplement**: the current data-model snapshot (post field-type + credits work)
> plus the specific mistakes made this session so they aren't repeated. Where this file and
> `OPERATIONS.md` disagree, trust the live system, then `OPERATIONS.md`.
>
> **Status:** this file **IS committed** to the (PUBLIC) GitHub repo, so keep it public-safe,
> architecture, file paths and CMS field names only, **never tokens or credentials**. It is the
> running handoff note the next chat reads first.
>
> Last updated: 2026-08-09 (**the media pipeline standard: WebP + srcset on BTS both sites,
> adaptive video with a companion manifest, masters never degraded**, see 0.0.-33 and
> SITE-TEMPLATE.md; **full-setup review: orphan media cleaned out of both repos, the JC
> mirror stops copying bts/, stale n8n pipeline docs corrected**, see 0.0.-32; **the maintenance
> switch is on each page's own screen and a page
> cannot exist without one, enforced by a test**, see 0.0.-31; jackcarlsen.com reaches full parity
> with the template, see 0.0.-30;
> page-access register + shared cover engine on both sites; eyebrow is production-only and JC has
> its own colour-look page from a
> SHARED master, see 0.0.-29. **The CMS is now built to a written standard, `SITE-TEMPLATE.md`,
> which must be updated in the same commit as any standard section**, see 0.0.-28. Privacy email
> wired into both privacy policies, two dead variables
> removed, and the Florida mailing address is CORRECT alongside California governing law, see
> 0.0.-27. Pages CMS drops empty fields on save, and any renderer over its JSON
> must treat missing and blank alike, see 0.0.-26. **Pages CMS: sign in as `Jackjrrc` for BOTH
> sites**, see 0.0.-25.
> Em-dash scrub finished in the Pages CMS strings and the mailing address split off from the legal
> jurisdiction in 0.0.-24. Terms + Privacy on both sites now edited in Pages CMS with shared
> variables in 0.0.-23).

---

## 0. LATEST SESSION (2026-08-22), READ THIS FIRST

### 0.0.-55 HOME #about ANIM: FIX SAFARI SCROLL "LINE" UNDER THE PALETTE (canvas GPU-layer tear) (2026-08-22)

Jack's OBS recording still showed a hard horizontal line under the palette at the start of the anim.
Diagnosed from the recording + isolation tests in real Safari (via osascript + screencapture). `index.html`
CSS only.

- **NOT the frames.** Re-verified every WebP frame is pixel-clean (alpha=0 on all four edges, no line in
  the art). Chrome renders the whole thing clean. The line is SAFARI-ONLY and only during SCROLL.
- **Root cause: a WebKit compositor tear on the animated canvas's GPU layer.** The recording's line is a
  hard horizontal seam through the pond with the content BELOW it offset from above - the signature of an
  async-scroll layer tear. The `#about` canvas is repainted every rAF (so Safari promotes it to its own
  layer) AND it carried `filter:drop-shadow(...)`, which forces an extra filtered layer buffer that
  Safari re-tiles mid-scroll -> the seam. (Static / non-scrolling renders are clean, which is why earlier
  frame-edge fixes in 0.0.-51/-52 did not touch it.)
- **Fix (two parts, CSS):** (1) moved `filter:drop-shadow` OFF the `<canvas>` - it now lives only on the
  static fallback `img.rpColor` (no-JS / reduced-motion), which never animates. The animated logo keeps
  its depth from the frame art + the bubble. (2) gave the canvas a STABLE atomic GPU layer
  (`transform:translateZ(0);backface-visibility:hidden`) so Safari moves it in lockstep with the page
  during scroll instead of re-tiling/tearing it.
- Verified in Chrome (Playwright): anim still plays, canvas `filter:none`, layer promoted, logo renders
  correctly, 0 console errors. jackcarlsen untouched.
- HONEST CAVEAT: the tear is a TRANSIENT async-scroll compositor artifact. Scripted scrolling
  (Playwright / osascript key events) does not drive Safari's async scrolling like a real trackpad, so it
  could not be reproduced deterministically in an automated harness - the recording is the definitive
  "before". The fix is the standard WebKit remedy for this class of bug and is verified non-regressive;
  Jack to confirm on his Safari with a hard refresh + a fresh scroll. If it somehow persists, next levers:
  drop `will-change`-inducing repaints by only redrawing on frame change (already the case), or render the
  logo shadow into the frames instead of CSS.

Commit: rp `3436cea`.

### 0.0.-54 HOME #about ORBITS: BIGGER + COLOURED GRADIENT EDGE FROM PROJECT COLOUR LOOK (2026-08-22)

Per Jack. Part 1 = bigger + coloured edge (`index.html`). Part 2 = the SELECTION control, now shipped:
Jack chose the Pages CMS route (try it, may revisit). See the note at the end.

- **Bigger bubbles.** `ORB_SPEC` sizes bumped ~1.25x (58-90 -> 72-112). Positions still scale to the
  live bubble radius, so they track every viewport.
- **Coloured gradient edge instead of the white line.** The old `.orbi::before` was a hard 1.5px white
  ring. Replaced with a soft COLOURED rim: a conic-gradient sweep of the source project's colour-look
  colours, radial-masked to the outer ~22% so it fades inward into the photo (no crisp line), plus a
  coloured outer glow on `.orbi` (color-mix of the look colours). Each orbit's `--oc1/2/3` are set in
  `buildOrbits` by deriving the project from the still's path (`/media/projects/<key>/...`) ->
  `projects.json` colourLook -> `LOOKS_BY_KEY`. No data change: the project key is already in the path.
- Verified headless desktop + mobile: geri stills read red/blue (#e0455f/#4f77ff), revelations
  white/gold (#ffffff/#bd9661), invalid blue/indigo (#3f9bea/#6360e1); sizes 72-112 desktop / 50-78
  mobile; 0 console errors. jackcarlsen untouched.

SOURCE OF THE ORBIT PHOTOS (confirmed): they already come from the projects' OWN stills folders.
`ABOUT_ORBS = SITE.orbits` (data/site.json), a list of `/media/projects/<key>/stills/*.jpg` paths that
point at the same files the project pages use (no duplicate copies). Today that list is edited in Pages
CMS ("About-logo floating images", a paste-the-path string list). In NocoDB, a project's `stills` is a
single text field of paths (projects_sync.py: `toArr(r.get("stills"))`), NOT per-still rows - so there
is no natural per-image toggle there. DONE (Jack chose Pages CMS, will revisit if awkward to use): the
`orbits` field in `.pages.yml` (Site Settings -> "About-logo floating images") is now
`type: image, list: true` instead of a raw string list - click + and pick each still from the media
browser (browse to media/projects/<film>/stills/). It stores the same `/media/...` path, so the site
JS (`ABOUT_ORBS = SITE.orbits`) and the colour-edge derivation are unchanged, and the existing paths in
site.json render as pre-selected. Media resolves via the top-of-file `media: {input: media, output:
/media}`. Limitation: Pages CMS browses the whole media library folder tree; it cannot show a filtered
"just this film's stills" dropdown - but the folders are already per-film so you navigate straight in.
(Alternative considered: NocoDB - rejected as less consistent because the orbit is a cross-project
home-page curation, not a property of any one project, and stills are not rows there. For per-film
control later, add a field on the project record + export it in projects_sync.py.)

Commit: rp `e8dd23e`.

### 0.0.-53 HOME #about ORBITS NOW EMERGE IN SYNC WITH THE LOGO ANIMATION (2026-08-22)

Per Jack: have the film-still orbit bubbles come out in time with the logo animation. `index.html` only.

- **Orbits are now driven by the logo-anim progress, not by scroll.** Previously `buildOrbits` had its
  own scroll listener computing an emergence progress from the section's viewport position (independent
  of the duck/wordmark playback). Now `buildOrbits` exposes `ABOUT_SET_ORBITS(p)` (a shared hook) and
  the logo-anim rAF loop calls it every frame with the SAME progress it uses for the logo
  (`curF/(N-1)` while playing; `(fadeFrom/(N-1))*(1-fadeK)` while dissolving). So the bubbles emerge in
  lockstep with the logo and retract as it dissolves back to the palette; each orbit keeps its own
  delay+ease for natural stagger.
- **Net performance win:** the orbits' separate scroll+rAF loop is removed. There is now ONE loop (the
  logo-anim loop), which only runs during a play or a crossfade and stops itself on arrival, so orbits
  cost nothing when idle. `setP` dedupes and a resize handler repositions + re-applies current progress.
- **Fallbacks:** on reduced-motion, or if the animation can't load (no canvas / manifest / fetch
  fails), the orbits are revealed (op=1) so they are never stuck hidden.
- Verified headless desktop + mobile: orbit avg-opacity sits at 0 at the palette, ramps 0->1 in step
  with the logo playback (0.21,0.39,0.60,0.76,0.88,0.96,1...), reaches 1 when the logo finishes, and
  returns to 0 when scrolled >80% out (desktop; mobile keeps them out at its top-peek, as before).
  0 console errors. jackcarlsen untouched.

Commit: rp `4206b61`.

### 0.0.-52 HOME #about DUCK ANIM: 24FPS + CACHE-BUSTER (STALE FRAMES WERE HIDING THE 0.0.-51 FIX) (2026-08-22)

Follow-up to 0.0.-51: Jack still saw the edge-crop lines and it looked low-FPS. Two causes, both fixed
(`bts-automation/home_logo_anim_frames.py` + `index.html` + regenerated `media/brand/home-logo-anim/*`).

- **Stale cache was hiding the 0.0.-51 edge fix.** The 0.0.-51 frames were clean on disk (verified alpha=0
  on all edges) but `/media/*` caches hard for a week (`_headers`) and the frames have stable filenames,
  and the manifest was fetched with `cache:'force-cache'` — so returning visitors kept the OLD (edge-line)
  manifest + frames. Fix follows the site's existing `?h=<content-hash>` media convention: the extractor
  now writes a `rev` (md5 of the whole frame set) into `manifest.json`, `index.html` fetches the manifest
  with `cache:'no-cache'` (revalidate the ~250-byte file) and appends `?h=<rev>` to every frame URL. A
  regenerated set gets fresh URLs; an unchanged set stays cached. (rev this build: `de1394b861`.)
- **Low FPS fixed.** Playback was 48 frames over 3.88s = ~12fps (choppy). `N_FRAMES` 48 -> 94 = one frame
  per source frame in [13..106] = the source's own ~24fps, no resampling. To keep memory/bytes sane with
  2x the frames, `OUT_WIDTH` 540 -> 480 (still >= the on-page ~340-460 CSS render size; aspect unchanged
  at 1.4192 so bubble positioning is identical). Set: 94 frames, 2.68 MB total (deferred load, ~61 MB
  decoded), q90.
- Verified headless desktop + mobile: all 94 frames alpha=0 on every edge, 94 frame requests each carry
  `?h=de1394b861`, manifest revalidates, 0 console errors, playback advances ~24fps at normal speed. The
  0.0.-51 behaviour (palette always visible, forward on entry, fade-to-palette on exit, no reverse) is
  unchanged. jackcarlsen untouched.
- Perf note: frames are deferred (requestIdleCallback) so they never block first paint; decoded memory
  ~61 MB (was ~39 MB at 48x540). If a low-end-mobile issue ever appears, drop OUT_WIDTH or N_FRAMES.

Commit: rp `1c0f45b`; bts `d81c104`.

### 0.0.-51 HOME #about DUCK ANIM: NORMAL SPEED, EDGE-CLIP FIX, PALETTE-ALWAYS + FADE-RESET (2026-08-22)

Four fixes to the home animation (per Jack). Touches `bts-automation/home_logo_anim_frames.py` (frame
extraction) + `index.html` (playback) + regenerated `media/brand/home-logo-anim/*` (frames + manifest).
The master .mov is NOT touched.

- **Normal speed.** Playback was ~1.05s (about 4x too fast). The frame extractor now writes `fps`
  (23.976) and `duration_ms` (the real-time span of the published frames) into `manifest.json`, and the
  site plays at that duration. With the new trim the full play is ~3.88s = true source speed.
- **Line-artifact root cause + fix.** The crop box equalled the artwork's TIGHT alpha bbox, so the blue
  pond ("palette") on the bottom-left and the "Rare Pond" wordmark on the right sat flush on the frame
  edges and got sliced into hard 1px lines (LANCZOS resize sharpened them). Confirmed via a magenta
  composite: content at alpha 255 touched x=0 / x=539 / y=413. Fix: the crop is now the FULL extent of
  everything shown plus a 32px transparent `MARGIN` on left/right/bottom, so anti-aliased edges fall off
  to alpha 0 inside the frame. Verified new frames: alpha=0 on all four edges. Also bumped WebP quality
  78 -> 90 (the pond gradient banded at 78).
- **Palette always visible (no fade-in).** Source frames 1-12 are the palette fading in from nothing;
  `SRC_START` moved 1 -> 13 so frame 1 already shows the fully-formed blue palette. This is a trim of
  where playback STARTS, not an edit to the master.
- **Fade-to-palette on scroll-away instead of reverse.** New playback model in `index.html`: the palette
  is always visible; scrolling the bubble into view (>=45% visible) plays FORWARD once at normal speed;
  scrolling until the bubble is >80% out of view (<20% visible) CROSSFADES back to just the palette and
  resets, so the next scroll-in re-plays forward. It never plays in reverse. rAF loop runs only during a
  play or a crossfade.
- Note (mobile): on a 390px viewport the bubble peeks ~34% above the fold at the page TOP, so the
  reset does not fire by scrolling to the very top there (it is not >80% out); the replay still works
  once the bubble is genuinely scrolled off (e.g. off the top toward the page bottom) and back. Desktop
  resets at the top as expected.
- Verified headless desktop (1440) + mobile (390) via canvas-checksum sampling + screenshots: ~3.88s
  normal-speed forward, no edge clipping (wordmark + palette intact), palette always shown, dissolve to
  palette on exit, forward replay on re-entry (not reverse), 0 console errors. jackcarlsen untouched.

Commit: rp `a1ff8c7`; bts `9a535b0`.

### 0.0.-50 HOME #about DUCK ANIM: TRIGGER-PLAYED (TIME-BASED), NOT SCROLL-SCRUBBED (2026-08-22)

Per Jack: the scroll-scrubbed playback looked odd (frame parked on the messy 3D->2D handoff, and it
stuttered with scroll speed). Reworked the `#about` canvas animation in `index.html` so scroll only
TRIGGERS it; playback is time-based.

- **Trigger, not scrub.** A cheap rAF-throttled scroll check reads the bubble slot's viewport
  position. Cross below 0.68vh -> target = last frame (play forward); cross above 0.82vh -> target =
  frame 0 (play reverse). The 0.68-0.82 dead zone is hysteresis so jitter never flip-flops direction.
- **Smooth time-based loop.** `curF` (float frame) advances toward `target` by ELAPSED TIME
  (`SPD = (N-1)/1050`, ~1.05s full play), `dt` capped at 50ms so a background tab / long frame can
  never leap across the handoff frames. It always runs to a clean end frame, so it never parks on the
  ugly 3D->2D transition and never stutters with scroll speed.
- **Zero idle cost.** The rAF loop starts only when a play begins and stops itself on arrival
  (`raf=0`). Sitting on or scrolling past the section costs nothing. Verified: two post-settle canvas
  samples are byte-identical (loop stopped).
- **Reverse works.** Scrolling back up plays the whole thing backwards to the first frame.
- On load the frame is SEEDED to match the current scroll position (finished logo if already in view,
  else frame 0) with no auto-play. Reduced-motion still keeps the static logo (outer guard unchanged);
  frame preload/decode pipeline unchanged.
- Verified headless desktop (1440) + mobile (390) via canvas-checksum sampling: forward advances over
  time with scroll HELD static then settles on the finished logo; reverse returns to the start frame;
  loop idles; 0 console errors. jackcarlsen.com untouched.

Commit: rp `b4bd81b`.

### 0.0.-49 HOME #about ORBIT BUBBLES + ANIM TIMING POLISH (2026-08-22)

Three refinements to the home #about section on top of 0.0.-48, all in `index.html` only.

- **Orbit film-still bubbles now emerge from behind the logo bubble.** They start at opacity 0 and
  scale 0 at the bubble centre and animate outward on scroll. Rewrote the orbit CSS to drive
  transform+opacity from a per-orbit `--op` (was a single shared `--p`), and set `.orbits`
  `z-index:2` so they render in front of the translucent bubble (were behind, hard to read).
- **They end AT / just outside the bubble exterior.** `buildOrbits` now computes each orbit's
  position and size from the bubble's LIVE radius in `place()` (`R = slot width / 2`, final radius
  `R * rf` with `rf` ~1.00-1.16), so orbits track the bubble on every viewport and sit on/just past
  the edge (verified dist/R 1.00-1.16 when fully out). Removed the mobile `.orbits{scale(.70)}`
  override, which used to shrink them back INSIDE the bubble on phones.
- **More natural variance.** New `ORB_SPEC` table gives each of the 7 orbits its own final angle +
  radius (path), size, emerge delay + ease (speed), and a `--spin` so it curves out rather than moving
  straight (staggered emergence verified: opacities fan out 0.00-0.43 mid-scroll).
- **Scroll animation starts later.** The logo-anim progress window changed from
  `(vh*1.05 - c)/(vh*0.62)` to `(vh*0.78 - c)/(vh*0.52)`, so the duck bounce begins once the bubble
  is well into view and the whole animation plays within the visible window (was almost finished by
  the time it was fully on screen).
- Verified headless desktop (1440) + mobile (390): orbits start hidden, emerge to the edge readable
  with size/speed/path variance, anim delayed; no console errors. jackcarlsen.com untouched.

Commit: rp `2505e6e`.

### 0.0.-48 HOME LOGO BUBBLE: CSS-RECREATED BRAND BUBBLE, GLOW COLOUR VIA PAGES CMS (2026-08-22)

Iteration on the home #about animation. The plain white plate was removed (0.0.-46) which left the
colour logo's blue wordmark hard to read on the dark section. Per Jack: recreate the brand SOAP BUBBLE
(Sticker Overlays `RP_Bubble`) and hold the animation inside it, using the bubble's inner light to
separate the logo from the background; and recreate the LOOK in CSS so the outer-glow colour is
adjustable in Pages CMS.

- **Bubble is 100% CSS** on `.about-anim-slot` (circular): soft light interior (readability), a
  coloured rim ring (conic gradient), an outer glow, and a top-right specular highlight. No image
  asset (so nothing to stage; the source-of-truth rule is not involved).
- **Glow/rim colour is a colour look, editable in Pages CMS.** New `homeBubble` in `data/site.json`
  (`colorLook` default "signature", `enabled`) and a matching Pages CMS section in `.pages.yml`
  ("🫧 Home logo bubble"). JS resolves the look via `LOOKS_BY_KEY` and sets `--bub-c1/2/3` on the
  slot; CSS defaults to signature so it is right with no JS. `enabled:false` -> `.no-bubble` (logo
  sits bare).
- **Animation contained inside the bubble**, larger (max-width 460 desktop / 320 mobile). The logo
  lives in an in-flow `.about-anim-inner` wrapper so the canvas scales by the frame's intrinsic ratio
  and cannot squish (fixes the earlier squish). Note: the slot needs a definite width, so
  `.about-logo`/`.about-bubble` are `width:100%` (mobile grid uses justify-items:center, which would
  otherwise shrink them to zero and the bubble/logo vanish).
- Verified headless desktop + mobile: bubble renders, wordmark readable, duck bounce contained,
  canvas ratio 1.304 (no squish), no console errors. jackcarlsen.com untouched.

Commit: rp `df708c9`.

### 0.0.-47 WEBSITE SOURCE-OF-TRUTH RULE ENFORCED: SYNC READS ONLY FROM `Website Repository/` (2026-08-22)

Correction to 0.0.-45/-46. Those wired the media duck, the home animation, and the RP studio logos to
read masters **directly from the raw brand kit** (`Rare Pond V3/Rare Pond Brand Kit/...`), which is
OUTSIDE the `Website Repository/` staging folder. Per the rule (every website asset must come from a
sorted subfolder inside `Website Repository/`, never the raw kit), that was wrong. Now fixed:

- **Staged the masters into `Website Repository/`** (sorted duplicates, on Synology): the neon media
  duck at `Rare Pond Brand (Web)/Logos/duck-media.png`, and the home-hero animation at a new
  `Rare Pond Brand (Web)/Animations/RP_Anim-1_Short_Studios_NO-BG_16x9.mov`. The 4 studio logo masters
  were already staged in `Rare Pond Brand (Web)/Logos/`.
- **`brand_media_sync.py`**: removed the `KIT/` read path entirely (masters now resolve ONLY under
  `Website Repository/`); manifest re-merged so RP studio logos + the media duck read from
  `Rare Pond Brand (Web)/Logos/`. **`home_logo_anim_frames.py`**: `SRC` now points at the staged
  `Animations/` `.mov`.
- **No visual change of note:** re-published logos verified same dimensions; rare-pond-color, filled,
  and the media duck are byte-identical to the previous build; duck-mark/duck-white differ ~2.6-3.2/255
  (edge anti-aliasing only). The home-anim frames regenerated byte-identical.
- **jackcarlsen.com untouched** (jc=0; its masters and pointers unchanged). Brand-kit masters NOT
  modified.
- **Documented the rule** so future sessions follow it: a "Website source-of-truth rule" section at
  the top of `bts-automation/MEDIA-SPEC.md` and in `OPERATIONS.md`, plus enforcement comments in both
  sync scripts, and as **rule 8** in `AI_System_Context/START-HERE.md` (the master; heading now reads
  "eight rules that cause real damage").

Commits: rp `c6fa697`, bts `efaadeb`.

### 0.0.-46 HOME ANIM: FULL-DUCK BOUNCE (NO CLIP) + SMOOTHER LOAD; RP STUDIO LOGOS SOURCED FROM THE KIT (2026-08-22)

Follow-ups to 0.0.-45 (same day).

**1. Home #about animation: the bounce no longer clips the duck.** `home_logo_anim_frames.py` now crops
each frame to the held-logo WIDTH and pond BOTTOM but extends the TOP up to the bounce peak, so the
whole duck is always in-frame. On the page the logo lives in a new `.about-anim-slot`; the canvas is
absolutely positioned, full-width and BOTTOM-aligned to the slot, with `.about-bubble{overflow:visible}`,
so the settled logo lands on exactly the static logo's box (unchanged size/position) while the duck's
bounce spills ABOVE the white bubble. Canvas `width/height` + `aspect-ratio` are read from
`manifest.json`, so a re-generated animation of any size just works with no CSS/JS change.

**2. Scroll-in lag fixed.** Frames are now loaded AND decoded off the main thread via `img.decode()`
(instead of decoding lazily on first paint), and the whole preload is deferred to `requestIdleCallback`
so it never competes with initial page load. Draws are rAF-throttled and only fire when the frame index
changes. Verified in headless Chrome at 1280 and 390 wide: full duck through the bounce, held logo box
identical (330x213 desktop), no console errors. Frame set is 48x 540px alpha WebP, ~1.3 MB.

**3. RP studio logos now publish from the standardized brand kit.** `brand_media_sync.py` MANIFEST split:
rarepond.com's `rare-pond-color`, `duck-mark`, `duck-white`, `duck-mark-filled` now source from
`KIT/Rare Pond V3/.../Static Graphics/{Full Name Logos/RP_Full-Logo_Studios_COLOR, Duck Only Logos/
RP_Logo_Duck_{COLOR,WHITE,FILLED}}.png`. Verified before publishing: same output dimensions and visually
identical to the previous Website-Repository copies (rare-pond-color + filled pixel-diff 0.0/255; color
+ white ducks ~2.6-3.2/255 = edge anti-aliasing only, same art). Editing a studio logo in the kit now
auto-publishes to rarepond.com. **jackcarlsen.com outputs still source from the Website-Repository
masters** (unchanged; migrate from the mini when JC is in scope). Brand-kit masters were NOT modified.

Commits: rp `8215f7a`, bts `e83e1c6` (explicit paths; bts state files from parallel jobs preserved via
autostash). Rentals + jackcarlsen.com untouched.

### 0.0.-45 MEDIA-PAGE NEON DUCK + SCROLL-SCRUBBED HOME LOGO; STANDARDIZED BRAND KIT WIRED IN (2026-08-22)

Two brand-asset changes on rarepond.com (studio + media only; Rentals and jackcarlsen.com untouched).

**1. /media page now uses the Media Exclusive neon duck.** The media header and footer duck swapped
from the generic `media/logos/duck-white.webp` to a new `media/logos/duck-media.webp` (the neon,
gradient-white "Media Exclusive" duck, which matches the media page's neon aesthetic). It is published
by `brand_media_sync.py` from the standardized brand kit, not a hand-placed file, so it self-heals.
To support kit-sourced masters, `brand_media_sync.py` gained a **`KIT/` master-key prefix**: a key
starting `KIT/` resolves against the brand-kit root (`Current_Brand_Assets/`) instead of the
`Website Repository/` root; un-prefixed keys behave exactly as before. New manifest entry:
`KIT/Rare Pond V3/Rare Pond Brand Kit/Static Graphics/Duck Only Logos/Media Exclusive/RP_Logo_Duck_Media_GRADIENT_WHITE.png`
-> `media/logos/duck-media.webp` (rp, maxw 640). Fixed CSS sizes (header 60px, footer 50px) mean the
swap does not change layout.

**2. Home #about "Worlds worth escaping into" logo is now scroll-scrubbed.** The static color logo in
the about bubble is replaced by a `<canvas>` that scrubs a 48-frame alpha-WebP sequence to page
scroll: the duck drops into the pond and "Rare Pond Studios" draws in, ending on the finished color
logo. Frames live in `media/brand/home-logo-anim/` (+ `manifest.json`) and are generated by
`bts-automation/home_logo_anim_frames.py` from the brand-kit master
`Rare Pond V3/.../Animated Graphics/RP Anim 1/Anim-1_Short/RP_Anim-1_Short_Studios_NO-BG_16x9.mov`
(ProRes 4444 alpha). Frames are cropped to the HELD-logo bbox, whose aspect (1.905) matches the static
logo (1.902), so the bubble keeps its exact size. Progressive enhancement: the static `img.rpColor`
stays for no-JS, `prefers-reduced-motion`, or if the frames fail to load; the canvas is only revealed
(`.anim-on`) once all frames are ready, so the bubble never flashes empty. Verified in headless Chrome:
no console errors, bubble box unchanged (330x213), scrubbing works, media header/footer render clean.

**3. Audit + plan (not executed).** Verified the site's current logo art is the SAME as the
standardized brand kit (color logo + filled duck pixel-diff 0.0/255; white/color ducks ~1.5/255
compression noise; social icons byte-identical), at identical trimmed aspects. Because
`brand_media_sync.py` trims transparent padding and scales to a fixed width, the site can be repointed
to read the studio logos directly from the standardized kit with **zero visual change** (a source-of-
truth consolidation, not a visual fix). Full per-asset mapping + a proof-before-publish verify gate are
in the migration plan delivered to Jack; awaiting his go before repointing the 4 studio logo masters.

Commits: rp `f885ed2`, bts `bebf54c`. Staged explicit paths only (parallel sessions were mid-write on
bts state files; those were left to their owners via autostash).

### 0.0.-44 TIKTOK ADDED + PER-ACCOUNT SOCIAL ON/OFF SWITCHES IN PAGES CMS (2026-08-20)

**@rarepondstudios on TikTok is now a Rare Pond social account**, showing in the header, footer and
Contact popup alongside YouTube/Instagram/LinkedIn/Facebook, and edited the same way as the others:
it is a row in the NocoDB `socials` table (base pn8kzophvbwxtt7, table id ma4lkbfxa7xa6ot), so
`socials_sync.py` publishes it into `data/socials.json` on the usual 5-min `--publish` cycle. Its
branded look is a new `tiktok` row in the NocoDB `color_looks` table (c1 #25F4EE, c2 #000000, c3
#FE2C55, icon `/media/brand/social/tiktok.png`), mirrored into `data/colorlooks.json` by
`colorlooks_sync.py`. The header/footer icon comes from the real TikTok logo already in
`data/platforms.json`, and `assets/chrome.css` gained a `data-net="tiktok"` hover gradient. The logo
`media/brand/social/tiktok.png` (1080x1080, alpha, matches the other social logos) was added to the repo.

**Each social account now has a UNIVERSAL on/off switch, edited in Pages CMS, not NocoDB.** New file
`data/social-switches.json` holds one `{label, enabled}` row per account; Pages CMS section
**Social accounts** (`.pages.yml` -> `socialswitches`) is a per-account "Show on the site" toggle.
The toggle is applied AT THE SOURCE, not per page: `socials_sync.py` writes ONLY switched-on accounts
into `data/socials.json`, so every surface that reads that file honours the switch with no per-page
code: the studio header/footer AND its contact popup, the Media section (`/media`), the Rentals
section (`/rentals`), the shared contact popup (`assets/contact.js`), and the legal-page footers.
`socials_sync.py` also maintains `social-switches.json` for sites whose `sites.json` flags carry
`socials_switches:true` (rarepond only): it lists every account, defaults a new account on, and
PRESERVES the existing `enabled` value so a Pages CMS toggle is never clobbered by the 5-min sync.
Effect lands on the next sync, so allow a few minutes after saving. WHY a separate file and not a
NocoDB `enabled` column: the `socials` table is in Supabase and its schema is read-only in NocoDB, so
a new column was not possible without unlocking the source; Jack chose to manage the switch on the
GitHub/CMS side instead.

> Correction to a first pass: the switch was initially wired only into the studio SPA (a `__d[11]`
> frontend filter), so Media, Rentals and the contact popup ignored it, and the Rentals header used a
> hardcoded icon map (yt/ig/li/fb only) that showed no TikTok icon. Fixed by moving the filter into
> `socials_sync.py` (pre-filtered `socials.json`, universal) and pointing `rentals/index.html` at the
> shared `RP_SOCIAL_ICONS` (assets/socials.js, which has every platform incl. TikTok), matching how
> `media/index.html` already renders. The stale hardcoded `SOCLINKS` render in `rentals/assets/app.js`
> was removed. Verified live with TikTok switched OFF: it is absent from the studio header + contact
> popup, Media, and Rentals (no broken icon slot).

### 0.0.-43 CONTACT POPUP: CLICK-TO-COPY EMAIL ADDRESSES (2026-08-11)

**The Contact popup can now show click-to-copy email addresses under the social bubbles.** A new
repeatable CMS field, `Contact Popup -> Click-to-copy emails` (`emails` in `data/contact.json`, each
row `{label, address}`, label optional), drives them. `assets/contact.js` renders each address as a
button in the right-hand socials column, below the bubbles: a copy icon and a "Click to copy" hint
show up front so nobody copies by accident, and on click the address is written to the clipboard, the
icon flips to a check, and the hint reads "Copied" (auto-reverts after ~1.9s, with an `aria-live`
status for screen readers). Uses `navigator.clipboard` with an `execCommand('copy')` textarea
fallback. Styles appended to `assets/contact.css` (`.cbubbles`, `.rpc-email`, `.rpe-*`). The popup is
shared by studio, rentals and media, so this is live on all three. Seeded with one address,
`contact@rarepond.com` (label General); edit or add more in Pages CMS under Contact Popup, or empty
the list to hide it. Verified headless with Playwright: the pre-click affordance is present, the click
copies the exact address to the clipboard, and the copied state shows then reverts. No exporter or
NocoDB change; `contact.json` is CMS-edited, not generated.

### 0.0.-42 RENTALS UNITS GET A "UNIT ID" COLUMN (formula), NAMES LEFT ALONE (2026-08-11)

**Each unit now shows a Unit ID of the form `<item_id>-<unit_number>`** (e.g. `1025-1`, `1025-2`)
in its own dedicated column on the NocoDB units table, alongside the existing model name. The Unit
ID column is a **NocoDB formula** (`CONCAT({item_id},'-',{unit_number})`), so it is always correct,
needs no backfill, and auto-fills for any new unit; nothing writes it. The items tab likewise has
an **Item ID** formula column (`{id}`) so an item's id reads clearly next to its name. The rentals database was
already fully unit-level: each `bookings.unit_id` is one physical unit, `reserve_order()` assigns
an available unit and skips any that are `in_repair` or already booked, a GiST no-overlap
constraint and `rp_booking_validate()` prevent double-booking, and `damage_events` flip a unit's
`condition_status`. No Supabase schema change (the Supabase source is schema read-only in NocoDB;
the formula is a NocoDB virtual column), no availability, pricing, or site-code change.

> Note for history: a first pass wrongly overwrote each unit's `name` (the model label) with the
> Unit ID. The names were restored from the NocoDB audit log (`nc_audit_v2.old_data`) and the Unit
> ID moved to the formula column above. The transient `ensure_unit_ids()` edit to
> `rentals_units_sync.py` was reverted; that script is back to qty-reconcile only.

### 0.0.-41 CLOSE-OUT: BUBBLE WEBP ON BOTH SITES, HEALTH PAGE NAMES ITS OFF-MINI ALARMS, REEL HANDBOOK FILED (2026-08-10)

**Bubble images on BOTH sites now serve WebP companions.** `bubbleSet()` adds
`<name>-800.webp 800w, <name>-1200.webp 1200w` srcset with the inline onerror JPG self-heal
(same pattern as the poster tiles and the -720 reel sources); 12 companions generated one-shot
(6 bubbles x2 sizes, cwebp q85, the -1200 is the full-size master width, never upscaled).
Wired here on the carousel side/featured cards AND the projects-grid bubbles, and on JC's hero
bubbles. Verified headless (zero console errors, both sites) and the full pre-deploy suites are
green (the near-cap vfx-reel warning is the known 0.0.-39 item). Companion generation still
belongs in the exporters, tracked in roadmap 3a's status block.

**The Automation Health page now names its own watchdogs.** Its header explains that the page
can only update while the mini is alive, and points at the two off-mini alarms: the hourly
Claude "Mini heartbeat check" (push + email at 3h stale) and the NAS-side
`nas_heartbeat_check.sh` for DSM Task Scheduler (no AI involved, installs in ~5 min, steps in
the script header).

**The Hi-Res Reel System Handbook has a proper home:** moved from ~/Downloads to
`bts-automation/REEL-SYSTEM-HANDBOOK.md` (git-tracked, and mirrored hourly into the context
folder's project-docs alongside MEDIA-SPEC, so future reel sessions find it without knowing to
look in Downloads).

### 0.0.-40 GERI'S SLOW-STARTING BACKGROUND: THE 1080p ROLLOUT MADE THE REELS 4-5x HEAVIER; BUDGETED ENCODES + ADAPTIVE VIDEO ON RP (2026-08-10)

**Root cause.** Jack reported the geri-action background reel often not playing (film page
bg + projects-bubble hover) until "a while", while invalid-opinion felt fine and the home
preview always worked. Not a code bug: the 2026-08-09 1080p reel rollout re-encoded the web
reels from the 4K masters at CRF 19, which multiplied them 4-5x (geri 2.6 -> 14.5 MiB at
4.8 Mbps for a 24s loop; invalid 3.0 -> 12.2 MiB at 6.2 Mbps for 15.8s). Every RP consumer
of these files is LAZY (`preload="none"` + data-src, reveal only when frames arrive), so
first play waits on that download; the home preview "wins" only because syncFocusVideo
gives the featured card its src early, so it buffers before Jack looks. Geri read as the
broken one because it is the longest reel (most absolute bytes) and the film he opens most.

**Fix 1, the files themselves (source + pipeline, no repo one-offs).** `reel_ingest.py`
now budgets the web encode: CRF ladder 19 -> 21 -> 23 until the file averages <= ~3.5 Mbps
(muted ambient loops; CRF 23 is the quality floor for the budget, only the 25 MiB cap can
push further). Verified transparent before shipping: side-by-side frames (live-action, dark
low-light, animation) and SSIM ~0.990 vs the shipped CRF 19 for both films. The pipeline
itself regenerated the sources: geri landed at CRF 21 = 9.3 MiB (3.1 Mbps), invalid at
CRF 23 = 6.8 MiB (3.5 Mbps); `projects_media_sync` republished both + NocoDB fields.

**Fix 2, adaptive video extended to rarepond (SITE-TEMPLATE standard, JC parity).**
`video_variants.py` VDIRS now includes `media/projects/*/video`, and `projects_media_sync`
runs it and stages `data/video-variants.json`. RP index.html gained the manifest fetch
(`__d[10]`), `V_SMALL`, `vsrc()` (companion on small screens / Save-Data, original
everywhere else) and the RP-only `psrc()` (hover PREVIEWS always take the -720 companion:
side cards and grid bubbles render a few hundred px wide, so 720p is beyond-retina there
and the preview starts ~3x sooner). Wiring: `.bubble-vid`/`.side-vid` = psrc,
`.u-vid`/`.focus-vid` = vsrc, plus JC's capture-phase -720 error fallback. Measured DOM:
bubbles + side cards ask for the 5.5 MiB companions, desktop film bg keeps the 9.3 MiB
original, phone film bg gets the companion, featured card unchanged.

**Two traps paid for, do not repeat:**
1. NEVER regenerate a web reel by MOVING the old one away: `reel_ingest._key()` infers the
   film key from the existing `*-reel-web.mp4` name and falls back to the FOLDER slug, so
   with the file gone it minted `geriaction-reel-web.mp4` / `invalid_opinion-reel-web.mp4`,
   the sync published those as new videos and repointed NocoDB at them. Repaired same
   session (sources renamed back, strays git-rm'd, NocoDB repointed, manifest rebuilt). To
   force a regen, touch the MASTER in High Resolution Versions instead.
2. `shutil.copy2` preserves the SOURCE mtime, which can predate an existing -720 companion
   and mask a republish from video_variants' mtime staleness check (the companions stayed
   derived from the old encodes). `projects_media_sync` now `os.utime()`s the published
   copy; the stale companions were regenerated from the new encodes.

**Status of the other films:** JC-native heroClips already had companions + V_SMALL, their
project pages preload=auto behind the 0.0.-37B crossfade, and every one now passes back
through the ambient budget the next time its master changes; nothing else on RP has a
focus video. vfx-reel remains the known 0.0.-39 near-cap warning.

### 0.0.-39 THE 25 MiB DEPLOY-FAILURE CLASS IS NOW UNREPEATABLE: DEPLOY MONITORING + SIZE GATES (2026-08-10)

Follow-up to 0.0.-37D. That incident had two halves: an oversized file (guarded in
reel_ingest since) and the BLINDNESS, 8 straight failed Cloudflare Pages deploys that
nobody saw for a day because a failed deploy is silent (the push looks fine, the site
keeps serving the previous build). Both halves are now closed.

**1. Automation Health watches the deploys.** New `bts-automation/deploy_status_check.py`,
called by `automation_health_launchd.py` every 15 min run: reads the LATEST main commit's
"Cloudflare Pages" check run for BOTH site repos via the GitHub API (read-only, tokens from
the existing askpass helpers) and renders a first "Site deploys" section on the Automation
Health page. GREEN = deployed (or still building within 15 min of the push); RED = the
check run concluded failure, is still running past 15 min, or never appeared 15 min after
the push, with a copy-paste fix block that names the commit, links the Cloudflare check
run, and points at `node tools/check-asset-sizes.mjs` + 0.0.-37D as the first move.
Verified against history: the eight Aug 9 failures (1556f0e through 839a5cf, 50b2ef9)
all classify RED failure; d168013 and the current heads classify GREEN success.
**TRAP for anyone scripting the GitHub API here:** the askpass helpers return the PASSWORD
only when the prompt contains "Password"; any other prompt returns the USERNAME, the API
answers `Bad credentials`, and a naive `.get("check_runs", [])` reads that error as "no
check runs". deploy_status_check treats a `message` payload as an error, never as empty.

**2. Nothing oversized can reach a site repo quietly any more.** Three layers:
- `tools/check-asset-sizes.mjs` in BOTH repos: scans every git-tracked file, WARN over
  24 MiB, FAIL (exit 1) over 25 MiB (the Pages per-file cap). Chained into the end of
  `tools/check-media-refs.mjs` on both repos, so the habitual pre-deploy command runs it
  automatically; also runs standalone. Warnings never fail the run, so the legacy
  `media/reels/vfx-reel.mp4` (26,138,907 bytes, 75 KB UNDER the cap, awaiting the
  portfolio-reel rebuild) warns without blocking unrelated commits. Do not re-encode it.
- `media_ingest.deployable_asset()`: shared publish-time gate, REFUSES (loudly, in the
  job log) any file over the cap and warns in the 24-25 MiB band. Wired into every
  exporter copy path that can put a big file into a repo: the jc_native_media_sync reel
  publish, the projects_media_sync video publish, and the jc_projects_sync media mirror.
  A refused reel leaves the repo's existing deployable clip and the NocoDB field alone.
- `reel_ingest.py` (since 0.0.-37D) already re-encodes with a CRF ladder until the web
  reel fits, so the normal pipeline never produces an oversized file in the first place.
Tested: a scratch git repo with a fake 26 MiB file fails the tool (exit 1) and a 24.5 MiB
file only warns; `deployable_asset` refuses the preserved 45 MiB Remember Me original and
passes the shipped 16.4 MiB re-encode; all three exporters dry-run clean after the wiring.

**Also verified end to end this session (all green):** three repos in sync with origin;
latest commits on both site repos show Cloudflare Pages SUCCESS; live spot checks pass
(clips byte-exact vs repo, 14-companion video-variants.json, BTS webp on both sites, the
0.0.-37 stills + notilt + pj-bg fade all live); Automation Health page fresh with zero
red across all sections including the new deploys section.

### 0.0.-38 ROUND 3: SELF-HOSTED FONTS BOTH SITES, POSTER WEBP TILES ON JC, DELETION-SAFETY SYSTEM (2026-08-09)

**Google Fonts is gone from both sites.** Every page (index, media, rentals, legal, admin,
maintenance; 14 files across the two repos) now loads `/assets/fonts/fonts.css`: the same
families, weights and swap behavior the pages always had, served same-origin (66 woff2 faces
here, 31 on JC; a browser fetches only the subsets a page renders). Removes ~0.8s of
render-blocking cross-origin chain on mobile with zero visual change. The admin colorlooks
MASTER in bts-automation was changed the same way so `socialuisync` cannot revert it, and both
repos' fonts.css carry the union of families because that shared page skins per host.
`_headers` caches `/assets/fonts/*` immutable for a year.

**JC poster tiles serve 800w WebP.** All 16 posters got a `<name>-800.webp` companion (about
80% smaller; tiles render at 200-320 CSS px, so 800w keeps 2.5x+ density and desktop quality is
unchanged; og:image and the full JPGs untouched). The renderer adds srcset via `vposterSet()`
with an inline onerror that strips srcset, so a future poster dropped WITHOUT a companion
self-heals to its JPG, the same pattern as the -720 reel sources. Poster derivation should
still join the pipeline (roadmap 3a) so future drops auto-optimize.

**Verified before push:** headless Chrome against both repos served locally: zero console
errors, Poppins/Heebo loading from the local files, wall tiles serving the -800.webp. Bubble
srcset and the RP carousel reel companion are deliberately NOT in this pass: both live in files
the parallel session is editing tonight, and per the roadmap ground rules they get the harness.

**Deletion safety, after two review mislabels:** `03-file-map.md` gained a "Before you call
something junk" section (reference-grep checklist, misleading-names table, Trash-never-rm), and
`!ACTIVE` marker files now sit inside `website-emergency-backups` (the live weekly backup
target) and `local-ai-hub` (hosts the live card_service). New `07-relocation-and-recovery.md`
covers power loss, mini-down alerting (the Claude scheduled task now, plus
`bts-automation/nas_heartbeat_check.sh` ready for DSM as the AI-independent replacement) and
the moving-homes checklist; START-HERE points at it.

### 0.0.-37 FOCUS STILLS AT FULL RES + BG-VIDEO CROSSFADE ON JC + WATCH EMBED STOPS TILTING (2026-08-10)

**A. The "one still renders smaller" report (Geri-Action, Invalid Opinion) was the LIGHTBOX,
not the grid.** Grid tiles were always identical (16/9 aspect-ratio box + object-fit cover,
measured identical on every film, both sites). But `.lightbox img` sizes to the image's natural
resolution, so the FOCUS still, the only one whose data-full pointed at a small file, opened
visibly smaller than its 2560/2048 siblings. Three separate causes, all fixed:
1. `invalid_opinion-focus` was genuinely low-res: its Focus Image source is only 1500px wide, so
   the sync's ladder capped at [800] and the "-1600.jpg" was actually 1500x844. Re-pulled the
   frame from the ProRes master on the NAS per STILLS.md (`.../Invalid Opinion Skit/Cuts/Invalid
   Opinion COMPLETE.mov`, 3840x2160, coarse 1s scan + wide refine matched t=37.429s at distance
   3.49; decoded with in_range=tv:in_color_matrix=bt709; tone-matched per channel to the old
   still, residual 3.68). New 800/1600/2560 webp + true 1600 jpg + 1000 base, both repos.
2. `revelations-focus` capped at [800,1600] although its source is the native-2K 2048px
   rev-earth-1: the sync LADDER (800/1600/2560) has no 2048 rung, so a 2K film silently loses
   its top width. Generated the 2048 webp from the same source and registered it, matching the
   film's other stills.
3. jackcarlsen's `data/stills-hd.json` (hand-maintained; the sync only writes the RP copy and
   `jc_projects_sync` mirrors media, not this file) was missing ALL THREE focus entries, so JC
   rendered them as plain 1000px `<img>`s. Added the three entries; also added the missing
   `.still picture{...}` parity rule to JC CSS.
   Every tile in every film's Stills grid now opens its film's max width on both sites (verified
   per tile with Playwright). KNOWN leftovers, pre-existing and left alone: JC-native films with
   mixed still widths (synesthesia 4x2560+1792, no master exists; the_animator 3x2560+2x1920;
   vantage_point ~1080s) only differ in the lightbox on very large screens.
   **Drift note:** the Focus Image SOURCE folder still holds the 1500px invalid-focus.jpg (pull
   only by convention, not overwritten). The sync will not clobber the repo derivatives (it only
   republishes when `<base>-1600.webp` is missing), but if those repo files are ever removed it
   would regenerate an [800] ladder from that 1500px source; the graded 3840px master frame from
   this session was left at /tmp/rp/invalid_focus_graded.png for Jack to drop into Focus Image
   if he wants the folder to be the true source again (a session /tmp, so re-derive per STILLS.md
   if it is gone: master path + t above).

**B. jackcarlsen project-page background video no longer pops in.** `renderProjectPage` built
`.pj-bg` as a bare `<video ... poster=still>`: the poster hard-cuts to the first video frame the
moment playback starts. Now the still paints as a real `<img>` UNDER the video, the video starts
at opacity 0 and fades in over .8s only once `canplay`/`playing` fires (same reveal-when-ready
pattern as RP's .focus-vid and the JC hero); on error nothing reveals and the still simply
stays. CSS: `.pj-bg video/img` are absolutely stacked, `.pj-bg video.ready{opacity:1}`.
Considered and NOT built: a colour-look splash cover over the page while the video buffers,
rejected as heavier than the problem; described in the session report if Jack still sees a
jarring moment on slow connections.

**C. The watch embed no longer shifts under the cursor (both sites).** The shared cursor engine
perspective-tilts any hovered interactive element toward the mouse (cursor.js tilt block), and
the YouTube/Vimeo click-to-load facade button qualified, so the big frame rotated while the
cursor's hug outline stayed on the untransformed rect: the "glow outline stops hugging the
iframe" glitch. Fix is the engine's own opt-out convention, `data-cursor="notilt"`, added to the
`.yt-facade` / `.vim-facade` buttons in BOTH repos' renderWatch. No cursor.js change, so no
version bump and no social_ui_sync republish; nothing else's cursor behaviour changed (outline
morph still applies to the facade, only the tilt is gone). After the click the facade becomes an
iframe, which the engine never tilted.

**D. Found while verifying live: EVERY jackcarlsen deploy since Aug 9 16:32 PT had failed.**
The live site was frozen on a day-old build (GitHub check runs: Cloudflare Pages "failure" on
every push since 1556f0e). Cause: the Remember Me web reel rebuilt that afternoon came out at
45.2 MiB (CRF 19 on 14.6s of grain-heavy 1920x1014), and **Cloudflare Pages hard-rejects any
single asset over 25 MiB, which fails the WHOLE deployment**, so every later push (catalogue
syncs, fonts, this session's fixes) never went live. Fix: re-encoded the web reel FROM its
hi-res master (never from the web file) stepping CRF until it fit: CRF 23 = 16.4 MiB, visually
in line with the other clips; replaced both the Project Video source file and the repo's
media/clips/rememberme.mp4, regenerated the -720 companion, pushed, deploy went green.
`reel_ingest.py` now has that size guard built in (starts at CRF 19, steps up only if the
output would break the 25 MiB cap, logs when it does; committed to bts-automation). The
oversized original is at /tmp/rp/rememberme-reel-web.OVERSIZED.mp4 for this session only; the
hi-res master is untouched. Related: media/reels/vfx-reel.mp4 is 26,138,907 bytes, 75 KB UNDER
the cap; the next rebuild that nudges it over will freeze deploys the same way, and it has no
hi-res master yet (handbook: portfolio reels await masters), so watch it.

### 0.0.-36 ROUND 2: HEARTBEAT ALERT, MEDIA-SOURCE WATCHDOG, SELF-HEALING SIZES, TWO SITE TEMPLATES (2026-08-09)

**The mini can now say it is down.** A Claude scheduled task ("Mini heartbeat check", hourly)
reads the Google Drive mirror's SYSTEMS-MAP.md modifiedTime; 3+ hours stale (mini, Synology
backup task, NAS or Cloud Sync dead) sends Jack a push + email. Every other alert runs ON the
mini, so this is the first alarm that survives the mini going dark.

**New launchd job `com.rarepond.mediasource`** (every 15 min, through run_with_access.js after
the bare-python TCC trap was confirmed live under launchd): goes RED on Automation Health when
the Website Repository media source is unreachable, the state where every media sync idles as
"skipping safely" while showing green, and it remounts /Volumes/RarePondNAS from the keychain by
hostname (RarePondNAS.local, so it survives moving to a new network). Verified green under
launchd.

**Sizes heal themselves now.** 03-file-map.md's sizes table + disk line are a generated block
(`bts-automation/context_sizes_block.py`, hourly via aicontextdocs, values rounded so the block
only rewrites on a real change). Rule added to INSTRUCTIONS-FOR-AI: sizes and disk figures are
never hand-typed anywhere in the context folder.

**Two site templates, both kept current.** `SITE-TEMPLATE.md` (a site inside this system) now
points at the new **`SITE-TEMPLATE-STANDALONE.md`**: the full playbook for a separate client
site on their own free-tier accounts with no always-on machine (content model without NocoDB,
media without the pipeline including a GitHub Actions option, remote-support model, cost table).
The keep-in-step rule is written into both.

**Also:** contacts-photoprep repointed to the FDA node@20 build (verified exit 0, 177 avatars);
`ai_context_docs_sync.py` now mirrors SITE-TEMPLATE.md, SITE-TEMPLATE-STANDALONE.md and
bts-automation/MEDIA-SPEC.md into the context folder (SITE-TEMPLATE's header claimed hourly
bridging that was never actually wired); MEDIA-SPEC's three "Project Repository" mentions
conformed to the on-disk name, Website Repository; STREAMLINE-ROADMAP gained §3a with measured
Lighthouse targets; bloat purge per Jack's approval (Blender bake caches + .blend1 saves, the
LM-era home logs, three loose one-off scripts, Review Stills; about 1 GB, all recoverable from
the Trash).

### 0.0.-35 REEL QC PASS: THREE 1080p WEB REELS WERE WRONG AND WERE REBUILT (2026-08-10)

**Glitch QC of all 16 re-encoded 1080p web reels against the archived 720p edits of record**
(`bts-automation/backups/webreels_720_20260809/`), shot-boundary comparison plus frame-accurate
content alignment plus visual contact sheets. 13 reels verified clean. Three had real defects in
their High Resolution Versions masters, which the 2026-08-09 web re-encode had faithfully copied
to the live sites:

**The Animator:** opening shot had a burned-in timecode overlay and wrong focus (pulled from the
timecoded film master instead of `Bobb Lands VFX (V4).mov`, which is actually TWO shots with a
hidden jump cut at 1.8s), and the final shot froze on its last ~0.5s. **Revision:** shot 2 missed
its first ~0.5s (the blue-paper action); deeper finding, the entire original reel was cut from
`Revision Cut V2 (June 7 2024) COLOR.mov`, not the Color Class Cut, so the reel was rebuilt from
V2 and the opening letter macro is now TRUE 1080 instead of a 720 upscale. **Remember Me:** shot 1
in-point ~3 frames late and one cut landed 3 frames early. All three hi-res masters rebuilt
frame-exactly (verified zero misalignment against the 720p edits of record), web reels re-encoded
per MEDIA-SPEC (1920-wide, CRF 19, slow, 30fps CFR, muted, faststart) and dropped into each film's
`Project Video/`; the sync pipeline published them automatically. FCPXMLs for those three films
regenerated with the corrected sources. Defective files stashed in `/tmp/reelqc/replaced/` (temp).

**Also:** the 6 films that were missing FCPXMLs in their `High Resolution Versions/` folders
(Incoherent, Lights Up, Parting Piece, Spotlight ABAY, The Duckling, Vantage Point) now have
frame-verified ones there. Older draft copies still sit in each film's `Project Video/` root with
slightly wrong durations; superseded, Jack may want them removed. Handbook section 3 and Changelog
updated. Websites were not touched by hand.

### 0.0.-34 FULL-REVIEW PASS: CMS DESCRIPTIONS TIGHTENED, STALE SWITCH POINTERS FIXED, NODE PINNED (2026-08-09)

**Pages CMS descriptions shortened with no information removed.** The longest `description:`
strings in BOTH repos' `.pages.yml` (15 lines here, 8 on jackcarlsen) were rewritten to carry the
same facts in fewer words. YAML validated, em-dash grep clean, field structure untouched, so the
CMS shows the same screens with shorter help text.

**Three descriptions pointed at a screen that no longer exists.** JC's Projects note and its
maintenance text still said 'SITE SETTINGS -> PAGE ACCESS', and this repo's Projects note said the
Projects switch lives in Site Settings. The register was removed in 0.0.-31; every switch sits at
the top of its own page's screen, and the descriptions now say so.

**The Automation Health registry text was compressed the same way**
(`bts-automation/automation_health_launchd.py`, the five long INFRA descriptions). Monitor run by
hand afterwards: exit 0, ClickUp publish HTTP 200.

**Future-proofing: `brew pin node@20`.** 21 launchd plists exec
`/opt/homebrew/Cellar/node@20/20.20.2/bin/node`, a versioned path a routine `brew upgrade`
deletes, which would take all 21 jobs down at once INCLUDING the health monitor (stale-green, not
red). Pinned, so an upgrade is now a deliberate act; migrating the plists and the TCC grant is a
planned job for whenever node@20 is bumped on purpose.

**Security tidy:** `~/nocodb-r2.env` (NocoDB R2 storage keys, wired into the container env) was
world-readable, now chmod 600.

Full pass detail (docs accuracy, bloat rundown, power-loss and future-proofing audits, template
readiness) is in the context-folder journal entry for 2026-08-09 and the report handed to Jack.

### 0.0.-33 THE MEDIA PIPELINE STANDARD: MASTERS NEVER DEGRADE, THE SITE ADAPTS (2026-08-09)

**The standard is now written down in `SITE-TEMPLATE.md` ("The media pipeline standard") and
enforced by the pipeline**, closing the gap between what Jack believed (everything auto-converts
to WebP) and what was true (stills and brand images did; BTS was JPG-only; video published
byte-for-byte).

**Images: BTS joins the WebP + srcset standard on both sites.** `rp_bts_sync.py` now emits q90
WebP beside every grid and lightbox JPG (`srcW`/`fullW` in `bts.json`); `bts_sync.py` emits
800w + 1600w WebP for the JC collage (`srcW8`/`srcW`). Renderers on both sites serve them via
`srcset` with the JPG kept as universal fallback, and the JC collage passes each tile's exact
CSS width as `sizes`, so a phone pulls only the density it shows. Masters untouched (Synology +
the 45-day ingest buffer); a pipeline-version marker in each sync's state sig forced the one
rebuild.

**Video: adaptive without quality loss.** New shared master `video_variants.py` (called by
`jc_native_media_sync` every run) guarantees a CRF-19 720p companion for any reel/clip taller
than 720p, a poster for every reel, and writes `data/video-variants.json`, the manifest the
site's new `vsrc()` helper reads, so a phone never requests a companion that does not exist.
**Measured before building: all current reels and clips are ALREADY 720p at ~1.2 Mbps**, so no
companion exists today and desktop always streams the original; the standard is future-proofing
for the day a 1080p reel is dropped. The real mobile wins shipped in the renderer: the landing
reels now carry their poster JPGs (they were only used on role pages before), and an
IntersectionObserver pauses off-viewport landing reels, which changes nothing visually (they
stack on phones, two of three are always off-screen) and cuts mobile video streaming to a
third. A capture-phase error handler swaps any failing `-720` source back to the original.

**Found while wiring it: `jc_native_media_sync.py` never imported `_rp_gitlock`** although
`git_sync_down`/`git_push` use it. Every scheduled run has silently skipped its pull
("pull skipped: name '_rp_gitlock' is not defined") and the first run that actually needed to
publish would have crashed. Import added; the sync now pulls and publishes correctly.

**Also standing in the sync logs, needs Jack:** the Synology folder "Stolen Heart" carries BTS
images but matches no project title in NocoDB, so those photos publish nowhere (bts_sync logs
it every run). Rename the folder to a project title or move the photos to the Unsorted pool.

### 0.0.-32 FULL-SETUP REVIEW: ORPHAN MEDIA CLEANED OUT, STALE DOCS CORRECTED (2026-08-09)

**Media that nothing referenced is gone from both repos.** Here: three pre-reorg leftovers
stranded by the 808926b move into stills/ subfolders (geri-split.jpg, revelations-earth.jpg,
invalid-focus.jpg) and one duplicate gear-logo upload (g_638b0b68a0746c1e.png). On jackcarlsen:
the mirrored `media/projects/<key>/bts/` copies (~45 MB no JC page ever read, including three
stale renamed generations of every geri/rev photo), the retired buriedtreasure clip and poster
(its DB row exists with `on_jackcarlsen` off; native media re-ingests from Synology if it
returns), the `_letterboxed_orig` scratch folder, and logo-uncropped-backup.png. All recoverable
from git history. **The JC mirror no longer copies bts/:** `jc_projects_sync.py` skips that
subfolder because JC renders BTS from `/media/bts/` via `bts_sync.py`. Verified by a live sync
run after the deletion: nothing re-copied.

**Verified NOT orphans, deliberately left alone.** `rentals/media/gear/*` is referenced by the
RENTALS array baked into `rentals/assets/app.js` (relative `media/gear/` paths resolve under
`/rentals/`, so a naive repo grep undercounts). `media/email/rentals-header.png` is embedded in
the Rental Quote Request Jotform email template (confirmed via the Jotform API). Flagged for
Jack, untouched: two Pages CMS uploads at media root (20260723_104418.jpeg,
RP_V3_Simple-Logo-White_FULL-CANVAS-1.png), the three duck-mark PNG variants (possible external
hotlinks), JC's headshot-circle.png, and JC's three reel poster JPGs.

**Smoke test fixed and green.** `tools/smoke-test.mjs` still demanded
`/media/stills/invalid-orbit.jpg`, deleted by the 808926b reorg; it now checks the
invalid_opinion focus still. Full suite green on both repos afterwards (smoke, media-refs,
page-switches, slugs, projects validator, maintenance, both admin gates).

**Docs corrected.** Section 1's diagram and section 6 no longer present the retired n8n projects
workflow as live (superseded note added; OPERATIONS.md was already right). Media-page copy: the
doubled "isn't just" construction smoothed in `data/media.json` AND the baked fallback in
`media/index.html` (they must stay in step). Stale `rp_media/index.html` path in media.json
`_note` corrected. JC `site.json` typo "Lets" fixed to "Let's". Live after deploy: all pages 200,
both admin gates 401, removed files 404, mailing address served on both hosts.

### 0.0.-31 THE SWITCH LIVES ON EACH PAGE'S OWN SCREEN, AND A PAGE CANNOT EXIST WITHOUT ONE (2026-08-09)

**I built the wrong shape first and Jack caught it.** He asked for a switch at the top of every
page's screen. I built a central `Page access` register in Site Settings instead, then removed the
per-section switches that already existed, so opening Rentals Sub Site showed no switch at all.
The register had one genuine merit, that a new page inherited the control by adding a row, and I
let that outweigh the instruction. **Corrected: the switch is now the FIRST field on each page's
own screen, which is where you already are when you want to close that page.**

**The register's merit is preserved without the register, by deriving the wiring.** A data file
that declares a `route` IS a page. `bts-automation/page_index_sync.py` scans the data files and
generates `data/page-index.json`, the route to file map the engine reads, so **a page screen added
later is wired in automatically**. The index deliberately holds the MAPPING ONLY, never the switch
value: Pages CMS writes the value into the page's own file, so a copy in a generated index would
be stale between the save and the next sync, and a stale copy of a safety switch is worse than no
copy at all.

**`tools/check-page-switches.mjs` turns the guarantee into a failing test** rather than a
convention someone has to remember. It fails when a file declares a route with no switch, when a
declared route is missing from the index, when a switch is unreachable from any CMS screen, and,
the one that actually bites, **when the index still lists a route nothing declares any more**: a
stale row sends the engine to read a switch that is gone, absent reads as OPEN, and a closed page
silently reopens. **Both failure modes were confirmed to FAIL the check before it was trusted**,
by deleting a switch and by faking a renamed route.

**Where the switches are now.** RP: Home (Site Settings), Media Sub Site, Rentals Sub Site,
Projects, Team, plus each custom page on its own screen. JC: Home and Portfolios. Site Settings on
both also holds `siteOpen`, the whole-site switch, which beats every individual one so an
emergency is one flip rather than a tour. `page-index.json` is generated and must not be edited.

### 0.0.-30 JC GETS THE TWO TEMPLATES ITS DESIGN CAN SHOW, AND FULL PARITY (2026-08-09)

**jackcarlsen.com now has the shared text-template mechanism**, `data/section-templates.json`
plus `projVars`/`fillVars` in `index.html`, the same as RP. **It gets TWO templates, not four.**
`cardEyebrowTemplate` drives the small line ABOVE the title in the home preview; a new
`gridCaptionTemplate` drives a new line UNDER it. RP's other two, the project-page eyebrow and the
grid caption, have nowhere to land on JC: its project pages have no eyebrow row and it has no
bubble grid. **Two CMS boxes that changed nothing would be worse than none**, so the count is per
site and the Projects screen says so.

**The caption defaults to `{tagline}`, deliberately not `{kicker}`.** The kicker is already on
screen directly above it, so defaulting to the obvious value would have printed the same sentence
twice. Tagline is set on all 19 JC films and appears nowhere else in that overlay.

**A template that fills to nothing renders NO element.** The caption is `hidden` when empty, with
`[hidden]{display:none}` so it cannot be overridden by the flex layout, and the film title stays
plain text wherever a film has no logo, which is most of them on JC. Verified live locally:
Revision shows kicker `Surrealist drama short film`, plain-text title, caption
`Some stories aren't meant for you.`, no JS errors.

**`SITE-TEMPLATE.md` now has a full parity table with no gaps**, and a section explaining that the
template count is per site rather than fixed at four.

**Loose end closed the same day: RP had TWO switches per page for a while.** Adding the register
did not remove the older per-section switches, so Projects, Team and Rentals each had one in the
register and one on their own screen, either of which would close the page. Both were live, so it
was not broken, it was confusing, which is worse in a control you reach for in a hurry. The three
old fields are gone from the CMS. The middleware still honours the keys as a silent fallback, so
an old `false` sitting in a data file cannot strand a page with no visible way to reopen it, but
nothing writes them any more and the register is the only switch. RP's suite still passes.

### 0.0.-29 THE EYEBROW IS PRODUCTION-ONLY, AND JC HAS ITS OWN COLOUR-LOOK PAGE (2026-08-09)

**The project-page eyebrow is now `{production}` alone**, on both sites. It was
`{production} · {released}`, which repeated a year already shown elsewhere on the page. More
importantly the element is now **omitted rather than emptied** when it fills to nothing: a film
with no production company renders no `.u-top` at all, instead of an empty span holding open the
row. Verified against live data: Geri-Action and Revelations both read `Rare Pond Studios`, no
year, no JS errors.

**jackcarlsen.com has its own colour-look page, and it CANNOT drift from Rare Pond's.** The
obvious approach, copying the 614-line `admin/colorlooks.html` into the second repo, would have
created exactly the failure Jack asked to avoid: two files that diverge the moment one is edited.
Instead it is now a **shared master**, `bts-automation/admin_colorlooks.html`, published to both
repos by `social_ui_sync.py` alongside `cursor.js` and `legal-render.js`. **One file, two skins**,
chosen from the hostname at load, with the pages.dev preview domains matched too so a preview
deploy is not branded as the wrong site. An unknown host falls through to the Rare Pond skin
rather than rendering unstyled. Everything the page fetches was already site-relative, so on JC it
reads JC's own data with no change.

**JC now has the `/admin/` password gate**, which it did not before. Same design as RP's, and
deliberately the same shape so the two read alike: a PREFIX rule rather than a filename list, so
anything dropped into `/admin/` is locked from its first deploy and the default is locked rather
than exposed. **Different credentials from Rare Pond, at Jack's instruction: username
`jackattack2227` and its own `COLORLOOKS_PASSWORD` secret** on the jackcarlsen-website Pages
project, which Jack has created.

**`tools/test-admin-gate.mjs` is new on JC and covers the cases that matter**, which are the ones
where it must NOT serve: no secret configured (503, not open), no credentials, wrong password,
**Rare Pond's username rejected**, and the encoded-slash bypass. That last is not theoretical:
Cloudflare's asset layer decodes `%2F` when it locates a file, so a gate testing the raw path
lets `/admin%2Fcolorlooks` through. It also asserts the pre-existing `/media` 404 rule still runs,
because the gate was inserted in front of it. 15 assertions, all passing.

**The preview URL and username live in `bts-automation/sites.json`, not in `colorlooks.json`.**
That file is GENERATED by `colorlooks_sync.py` from `flags.colorlooks_header`, so editing it
directly would have been overwritten at the next sync. Both sites confirmed still publishing the
same 32 looks from the same NocoDB table.

### 0.0.-28 THE CMS IS NOW BUILT TO A WRITTEN STANDARD: `SITE-TEMPLATE.md` (2026-08-09)

**New file: `SITE-TEMPLATE.md`, and it is LIVE, not a snapshot.** It defines what a site built on
this system has: the standard Pages CMS sidebar and its order, the naming rules, the read-only
field convention, which assets are shared masters, which data files are generated versus edited,
and a parity table showing exactly where each site stands against it. **Changing a standard
section on either site means changing this file in the same commit.** It bridges hourly into the
context folder, so a cloud session can read it with no device access.

**Sidebar renamed and reordered on rarepond.com.** Sub sites now sit together directly under Site
Settings and are labelled as places: `Media Sub Site`, `Rentals Sub Site`. `Contact popup (all
sites)` became `Contact Popup`, because which sites use it is a fact for the description, not the
label. `Legal Pages (Terms + Privacy)` became `Legal Terms + Privacy` on both sites. Order is now
Site Settings, the two sub sites, Projects, Team, Custom Pages, Contact Popup, Form Input Types,
Color Looks, Maintenance Cover, Legal Terms + Privacy. jackcarlsen.com follows the same order for
the sections it has.

**Reordered as TEXT BLOCKS, never by re-dumping parsed YAML** (`bts-automation/_pagesyml.py`).
Re-dumping would have reformatted several hundred hand-written flow-style field lines and dropped
every comment, producing a diff nobody could review. Proved it: both files were parsed before and
after and every entry is byte-identical apart from the four labels that were meant to change.

**THE READ-ONLY FIELD CONVENTION, now written down and enforced.** Pages CMS has no notice
element, so explanatory text rides on a `readonly` field. Two kinds, never mixed. **Explaining
something: the box is EMPTY and every word lives in `description`**, so an empty box is the cue
that there is nothing to type. **Displaying a value to read or copy** (a URL, a username, where a
password is kept): the value stays and the description explains it. `imageSpecs` and `varsKey` had
the same text in both, a condensed copy in the box and the full version underneath, so a reader
had to compare two blocks of prose to learn they matched. Both boxes emptied.

**`Projects`: the NocoDB explainer moved to the top**, next to the other read-only note, instead
of sitting under the four template fields where it read like a footnote.

**Form Input Types is now on jackcarlsen.com**, with the explainer and no forms, because JC has no
custom forms yet. The description states the rule: a new custom form gets its fields added to that
screen at the same time it is built, and the Contact popup is not edited there because it is a
HubSpot form.

**Three gaps are deliberately still open, and `SITE-TEMPLATE.md` names them** rather than pretending
parity: Maintenance Cover and Projects on JC, and JC's own Color Looks page. **A CMS section whose
switches do nothing is worse than a missing one**, because it looks like a control, so none of the
three was added ahead of its machinery. The Projects one has a real design question inside it: JC
project pages have kicker, tagline and logline but no eyebrow line and no grid caption, so two of
RP's four templates have nowhere to land on JC.

### 0.0.-27 PRIVACY EMAIL WIRED IN, TWO DEAD VARIABLES REMOVED, AND WHY THE ADDRESS IS IN FLORIDA (2026-08-09)

**`[privacyEmail]` was set on both sites and used in zero places.** `privacy@rarepond.com` existed
while both privacy policies still sent people to `contact@rarepond.com`. Now wired into the two
spots in each policy that give an address: the "Reviewing, changing, or deleting your information"
section, and the contact block at the end. **The Terms page keeps `[contactEmail]`**, because its
closing block is ordinary business contact, not a privacy request. Verified live: `/terms` links
`mailto:contact@`, `/privacy` links `mailto:privacy@`, on both sites.

**No fallback between the two, on purpose.** A blank `[privacyEmail]` shows the amber placeholder
rather than quietly using the contact address. The policy promises a reply within a reasonable
time, so silently substituting would hide that the promised route was never set up. Same reasoning
as 0.0.-26: a blank must be visible.

**`[siteName]` and `[phone]` deleted.** Both were unused. `siteName` duplicated `businessName` on
both sites; `phone` was blank. `Your own variables` covers a one-off like a phone number now, so a
permanently present optional slot bought nothing but a field to scroll past. Twelve fixed
variables remain. `businessName` and `ownerName` stay separate, because on rarepond.com they
genuinely differ and both appear in the copy.

**THE ADDRESS IS IN FLORIDA AND THAT IS CORRECT. DO NOT "FIX" IT.** The mailing address is
`2338 Immokalee Road Suite 210, Naples, Florida 34110`, while the documents say the business is
based in the Los Angeles / Burbank, California area, set governing law to California, and put
venue in Los Angeles County. **The business is still in LA; Florida is only where post goes.**
Confirmed by Jack 2026-08-09. This is exactly what the 0.0.-24 split of postal address from legal
jurisdiction was built for. To a fresh reader the two look inconsistent, which is why it is
written down here: they describe two different facts and both are right.

### 0.0.-26 PAGES CMS DROPS EMPTY FIELDS ON SAVE. ANY RENDERER READING ITS JSON MUST EXPECT A MISSING KEY (2026-08-09)

**Found by diffing what Pages CMS wrote back** after the first real save of `data/legal.json`.
The structure survived intact, 13 and 12 sections, all four top-level keys. But `phone` (saved as
an empty string) and `custom` (an empty list) were **gone from the file entirely**. Pages CMS does
not write an empty value, it omits the field.

**Why that was a real bug and not a curiosity.** `legal-render.js` decided between "show the amber
`[... to be added]` chip" and "leave the brackets alone as typed" by testing whether the key was
present in the data. Blank meant chip; absent meant literal. Since the CMS turns *cleared* into
*absent*, clearing a referenced field would have printed the raw text `[mailingZip]` onto the live
legal page instead of the amber chip. **That is exactly the silent-blank failure the amber chip
exists to prevent, arriving through a side door.**

**Fix:** a name is treated as a variable if it is in the data **or** in the renderer's `LABELS`
map of fixed variables, so blank and missing behave identically. A bracketed word that is neither
is still left exactly as typed. Custom variables are unaffected: their `{name, value}` object
keeps its `name` when the value is emptied, so the object is not empty and survives the save.

**Proved by simulating it**, not by reasoning about it: both `mailingStreet` and `mailingZip` keys
were deleted from `legal.json` and the page re-rendered. Before the fix it leaked raw tokens;
after, it shows `[street address to be added]` and `[ZIP code to be added]` as amber chips with no
raw tokens on the page.

**Generalise this.** Any future surface that renders a Pages CMS JSON file must treat "field
missing" and "field blank" as the same state. Do not use key presence as a signal for anything.

### 0.0.-25 PAGES CMS: SIGN IN AS `Jackjrrc`, AND WHY THE WRONG ACCOUNT LOOKS LIKE A BROKEN APP (2026-08-09)

**Symptom:** editing any page in Pages CMS on rarepond.com loads fine, then Save throws
`Resource not accessible by integration - .../repos/contents#create-or-update-file-contents`.

**Cause: signed into Pages CMS as the wrong GitHub account.** The two sites sit under two
accounts. `rarepondstudios/rare-pond-studios` is public; `Jackjrrc/jackcarlsen-website` is
private. `Jackjrrc` had only **read** on the Rare Pond repo, and the only collaborator with push
was `rarepondstudios`.

**The reason this is confusing rather than obvious: the Rare Pond repo is PUBLIC.** A read-only
session can fetch `.pages.yml` and every data file, so the CMS renders the whole edit form
perfectly and gives no hint anything is wrong. Push access is needed for exactly one operation,
the commit, so the failure lands on Save and nowhere else. **A form that loads proves nothing
about whether you can save it.**

**Fix, applied 2026-08-09: `Jackjrrc` was granted WRITE on `rare-pond-studios`.** That makes it
the only login with write on both repos, so **sign into Pages CMS as `Jackjrrc` for both sites**.
The grant is deliberately **one-way**: `rarepondstudios` was NOT given access to
`jackcarlsen-website`, so the private repo keeps its single-collaborator surface. The cost of
that choice is that `rarepondstudios` can save rarepond.com only, which is fine because there is
now one account that does everything.

**This is unrelated to git on the mini**, which has its own answer to the same two-account split:
`gh` serves `rarepondstudios`, and `jackcarlsen-website` is pinned to the `Jackjrrc` credential
through the osxkeychain helper (session 23, after that repo failed to push silently for 13
hours). Same root cause, two different surfaces, two different fixes. Do not "simplify" one into
the other.

**Diagnostic that settles it in one command**, rather than going through GitHub App settings:

```
gh api repos/rarepondstudios/rare-pond-studios/collaborators/<user>/permission --jq .permission
```

Also worth checking before blaming permissions: `gh api repos/<owner>/<repo>/rulesets` and
`.../branches/main/protection`. Both were empty here, which is what pointed at the account.

### 0.0.-24 EM-DASH SCRUB FINISHED, AND THE ADDRESS SPLIT OFF FROM THE JURISDICTION (2026-08-08)

**The 2026-08-07 scrub never reached the Pages CMS strings.** Site copy, `index.html` and every
`.md` in both repos were clean. `.pages.yml` was not: **50 em dashes** across the two files, all
inside the `label:` and `description:` text Jack reads inside the CMS. Plus 8 more in two
`_headers` comments, both `tools/check-media-refs.mjs` headers, and three console strings in
`jackcarlsen-website/tools/validate-projects.mjs`. All 58 are gone. **A repo-wide sweep of both
repos now returns nothing outside binary media files.**

**Replaced case by case, not by blanket swap**, because an em dash does three different jobs in
these strings: a label separator wants a colon (`"Brand: line 1"`), an aside wants a comma, and
two sentences bolted together want a full stop and a capital. A single global replace would have
read wrong in roughly a third of them. `~/bts-automation/_scrub_emdash_pagesyml.py` holds every
pair explicitly, asserts each needle is found the exact expected number of times, and **refuses
to write anything at all** if one count is off or if a single em dash is left uncovered.

**Proof it changed nothing functional:** both files were parsed before and after, every `label`
and `description` stripped out, and the remaining schema compared. Identical. The only values
that differ, 26 in RP and 14 in JC, are all `label` or `description`. Pages CMS behaviour, field
names, types, patterns and defaults are untouched. Repo test suites pass.

**Separately: the mailing address now carries its own city and state.** The contact block used to
read `[mailingAddress], [city], [state]`, and `[state]` ALSO drove the Governing law section and
the `"[state] residents"` heading in the privacy policy. Same value today, two different facts.
**Moving the postal address would have silently rewritten which state's law the documents claim
to run under.** The address is now `[mailingStreet]` / `[mailingCity]` / `[mailingState]` /
`[mailingZip]`, and `[state]` and `[county]` mean only the governing law and the venue. `[city]`
is gone; use `[mailingCity]`, or `[region]` for the "based in the ... area" phrase.

The ZIP renders after the state with a **space, not a comma**, the way an address is actually
written: `Burbank, California 91502`. A blank ZIP shows the amber chip like any other value. A
document that should carry no ZIP at all drops `[mailingZip]` from its contact block in the CMS
rather than emptying the field, which keeps the "a blank is visible" rule intact everywhere.

Verified by setting the address to Portland, Oregon on a scratch copy: the contact line moved,
Governing law stayed California, and the CCPA heading stayed "California residents". Then with a
full address filled in: `1234 Somewhere Ave, Suite 5, Burbank, California 91502`, zero amber
chips left on the page.

### 0.0.-23 TERMS + PRIVACY MOVED INTO PAGES CMS, WITH VARIABLES (2026-08-08)

**The four legal pages are no longer hand-written HTML.** `terms/index.html` and
`privacy/index.html` on BOTH sites are now shells: site chrome, then an empty
`<main data-legal="terms">` (or `"privacy"`). Everything inside it is drawn at load from
`data/legal.json` by `assets/legal-render.js`. Jack edits both documents in Pages CMS under
**Legal Pages (Terms + Privacy)**, one entry per site, and a save is live in about a minute. No
exporter, no build step, no launchd job.

**The point of the change was the values that repeat.** The contact email, the mailing address,
the city, the state, the county and the domain each appeared in several places across the four
pages, so changing one meant a code edit in four files and a real chance of missing one. They are
now VARIABLES, set once at the top of the CMS page under Shared values, and referenced in body
text as `[contactEmail]`, `[mailingAddress]` and so on. There is a `Your own variables` list too:
name one `bookingEmail` and `[bookingEmail]` works everywhere immediately, no code change. A
readonly key at the top of the CMS page lists every variable that exists.

**An unfilled variable is visible, not silent.** A variable with no value renders as the amber
`[... to be added]` chip rather than disappearing, which is exactly how the mailing address reads
today. That was deliberate: a blank that renders as nothing turns "Mailing address: X, Burbank,
California" into a finished-looking sentence that is quietly wrong. **This also means the open
mailing-address item is now a one-field fix in Pages CMS on each site, not a code change.**

**Section numbering is generated.** Headings are typed without numbers and the renderer numbers
them in order, so dragging, adding or deleting a section renumbers the rest. `numberSections` can
turn it off per document. A section with no heading and no content is skipped rather than
rendered, so a half-written one can never reach a visitor. Same rule as the maintenance cover.

**Block types inside a section:** `paragraph`, `subheading`, `list`, `note` (the highlighted
callout), `card` (the bordered box) and `table` (the two-column third-party table). Body text
takes a small whitelist of inline tags: `<strong> <em> <b> <i> <u> <code> <small> <sup> <sub>
<br> <nobr>` and `<a href="...">`. Everything else is escaped and shown literally, so nothing
typed into the CMS can break the page or inject anything. Plain email and `https://` addresses
become links by themselves, which is why no body text contains a hand-written `mailto:`.

**`assets/legal-render.js` IS NOT EDITABLE IN THIS REPO.** Master is
`~/bts-automation/legal_render.js`, published to both repos by `social_ui_sync.py`, exactly like
`cursor.js`, `contact.js`, `contact.css` and `social_ui.js` (see 0.0.-22 for what happens if you
forget). Edit the master, commit `bts-automation`, then
`python3 ~/bts-automation/social_ui_sync.py --publish`.

**Verified, not assumed.** `~/bts-automation/_verify_legal_pages.mjs` renders each new page in
Chromium, pulls the visible text out of `<main>`, and diffs it word-for-word against the
pre-change file (kept in `~/bts-automation/_legal_before/`). All four came back character-for-
character identical, with no JS errors, the same links, the same mailto targets and the same
amber placeholder. Re-run it after any change to the renderer. Live checked afterwards: all four
URLs 200, correct titles, 13/12/11/12 numbered sections.

**One deliberate visual change:** the contact details at the end of `rarepond.com/terms` and
`jackcarlsen.com/terms` now sit in the same bordered card the privacy pages already used. The
terms pages previously used bare paragraphs with inline margins. The two documents now match.

### 0.0.-22 THE CAROUSEL HUG-OUTLINE GLITCH, AND WHY IT CAME BACK (2026-08-08)

From Jack's OBS recording (`~/Movies/2026-08-08 12-05-20.mov`). Click a side bubble on the home
carousel and **follow it with the mouse** as it expands into the featured slot: the hard hug
outline draws itself around the card. Click and move the pointer away and it never appears. That
asymmetry is the whole bug, and it is why the glow-only pass (0.0.-14, v19) looked complete.

**Cause: the engine inferred "this object is glow-only" from its SHAPE.** `hoverSpecial` was set
for big circles (`%`-radius >= 45 and >= 64px). `.cbub` is `border-radius:50%` in the side slots
and passes; `.citem.feat .cbub` morphs to `13%/20%` and stops passing. Same element, same intent,
different radius. So the treatment flipped mid-animation and the `.rpc-bord` band appeared on a
surface that was never meant to carry one.

**Two things kept it hidden.** The pointer has to LAND on the card after it has grown (a fresh
`applyHover`); staying still or leaving re-uses the cached special state. And `.citem.feat` is
`clamp(360px,69vw,1010px)`, which sits ABOVE the engine's 62%-of-viewport oversize cutoff on a
narrow window (never engaged at all) and drops below it once the 1010px clamp takes over, **so
the bug only existed above roughly 1760px of viewport width.** A single-width check would have
missed it entirely.

**Fix: the markup states the intent instead of the engine guessing at it.**
`data-cursor~="nohug"` is never outlined, at any radius, in any slot, at any window size, and it
is exempt from the oversize cutoff for the same reason (nothing that never morphs can become a
screen-sized blob). Carried by the home carousel items (`.citem`) and the Projects grid bubbles
(`.bubble`); the grid ones are circles today and are unchanged in behaviour, the token is what
keeps them that way if their shape ever moves.

**`nohug` keeps the ring's own glow rather than fading it.** That is the one way it differs from
`glow`/`special`, and it is deliberate: the FOCUS-vs-ENTER rule (0.0.-13, v18) reads a lit ring as
"clicking ENTERS this", and the featured card does open its project. Only elements the existing
rules left as a HUG reach the new branch, so the side bubbles (focus-only) and the grid bubbles
(auto-circle) keep fading exactly as before. Jack chose this over the fully-faded option.

**Keyboard is untouched by design.** `keepGlow` is mouse-only, `kbnative` still takes its own
branch, and `nohug` additionally blocks the kb path that CONFORMS a special back into a hug
outline. Verified live: arrows select and rotate the carousel, Enter opens the project, no errors.

**THE PART THAT MATTERS FOR NEXT TIME: `assets/cursor.js` IS NOT EDITABLE IN THIS REPO.** It is a
shared module whose master is `~/bts-automation/cursor.js`, published to BOTH site repos by
`social_ui_sync.py`. The first attempt at this fix edited the repo copy, pushed it, and the sync
job silently reverted it in the very next commit (`chore(shared): sync shared UI modules from
master`). Same applies to `contact.js`, `contact.css` and `social_ui.js`. **Edit the master,
commit `bts-automation`, then run `python3 ~/bts-automation/social_ui_sync.py --publish`**, which
copies into both repos and pushes both. Commits: master `7389918`, RP markup + test `757da64`.

**Regression guard: `tools/test-bubble-glow-only.mjs`.** Sweeps 1280 to 2200px, drives the exact
recorded gesture, and asserts the things a lazy fix would break: nav links still get their
outline, side bubbles still fade, the featured card still glows, keyboard still selects and
activates. Confirmed it FAILS on the old markup (6 failures, all at >= 1760px) and passes on the
new, locally and against live www. Run it with `BASE=https://www.rarepond.com` to check the
deployed site, or against `tools/serve-like-cloudflare.mjs` on :8899 for local.

### 0.0.-21 RENTALS: ORDER TOTALS NOW REACH HUBSPOT + `status` HIDDEN IN NOCODB (2026-08-08)

**The bug, stated plainly: HubSpot only ever knew the price from the original web submission.**
`rp_recompute_order()` rebuilds `orders.total_price` from the real `bookings` rows on every change
and always did so correctly. But the n8n workflow `Rental DB → HubSpot Stage Push`
(`cjav2Eobu0LZR70p`) PATCHed exactly one property, `dealstage`. Nothing wrote `amount`, ever. So
edit gear in NocoDB after the deal exists and Supabase reprices while HubSpot keeps the old figure
silently and forever. **HubSpot is the side invoices are raised from, so this could overcharge a
client.** Confirmed by the 2026-08-07 test: HubSpot $88.00 against Supabase $48.00, and $48.00 was
the correct number.

**The fix mirrors the stage dirty-flag pattern exactly, so there is one mechanism to understand,
not two.** `hs_last_synced` already tracked the last stage label pushed; new column
`orders.hs_last_price` tracks the last amount pushed.

- `orders_pending_hs_push()` now also returns a row when
  `total_price is distinct from hs_last_price`, and hands back a ready-made `hs_properties` jsonb.
- `mark_hs_pushed()` now clears both flags.
- The n8n PATCH body is now just `={{ JSON.stringify({ properties: $json.hs_properties }) }}`, so
  the JSON is assembled in SQL where it can be tested, not in an n8n expression.
- SQL lives in `bts-automation/migrations/20260808_hs_price_push.sql`. No backfill was needed: every
  existing order has `total_price` NULL, and the price branch requires NOT NULL, so applying it
  queued zero pushes.

**TRAP, and it bit during this very migration.** `DROP` + `CREATE FUNCTION` in Supabase's `public`
schema does NOT come back locked down. Supabase ships `ALTER DEFAULT PRIVILEGES` granting EXECUTE
to `anon` and `authenticated` on every new function, and those are direct grants, so
`revoke ... from public` does not remove them. `orders_pending_hs_push()` was briefly executable by
the published anon key, which would have leaked deal ids, stages and prices for every order. Caught
and closed in the same session. **Any CREATE FUNCTION here must be followed by
`revoke all on function ... from anon, authenticated, public`.** The 2026-08-07 table-grant lockdown
protects tables; this is the function-level equivalent and it re-opens itself on every rebuild.
Audited afterwards: only `catalog_availability()` is intentionally anon-executable. The trigger
functions `rp_sync_accessory_ids` and `rp_sync_member_ids` still carry anon/authenticated EXECUTE,
which is harmless because PostgREST will not expose a `trigger`-returning function, but they are
inconsistent with the lockdown and worth tidying.

**`bookings.status` is now hidden in NocoDB and unchanged in Postgres.** The audit that settles the
question left open by 0.0.-19a: `status` is inert as a decision input (every row is `confirmed`,
nothing can produce `held`, so all four predicates that read it are permanently true) but it is
structurally load-bearing. It appears in the `WHERE` predicate of the `bookings_no_overlap` EXCLUDE
constraint and its GiST index, in `catalog_availability()`, `reserve_order()` and
`rp_booking_validate()`, and in the `UPDATE OF` list of `rp_booking_validate_trg`. No view or
generated column touches it. **Dropping the column would therefore mean dropping and rebuilding the
live double-booking guard for zero user-visible gain**, so it stays. Only the NocoDB grid column
was hidden (view `vw3my5yphqklbbgq`, view-column `ncazu38nrqxn09dc`, `show=false`), which matches
how `id`, `order_id` and `unit_id` were already handled on that table. The SingleSelect options and
the `confirmed` default were verified intact afterwards. Note this is a *view* column change, so
the 0.0.-19a `colOptions` wipe trap does not apply.

**n8n gotcha worth keeping.** `n8n import:workflow` deactivates the workflow it imports, and a
running n8n instance can overwrite the import. Worse, verifying by copying only `database.sqlite`
out of the container reads stale data, because recent writes sit in `database.sqlite-wal`. Copy all
three files (`.sqlite`, `-wal`, `-shm`) or you will chase a change that already landed. Verified
after: 11 of 11 workflows active, new body live, two clean runs, zero errors.

*Verification:* the whole add/remove/reprice/requeue cycle was exercised against the live database
inside a transaction that was rolled back, so n8n never observed it. $42.00 for two units, $40.00
after removing the $1 unit, requeued at $42.00 when it was added back with no stage change. Backups:
`bts-automation/backups/n8n_20260808/`.

### 0.0.-20 RENTALS: THE 2026-08-07 TEST BOOKING SCRUBBED FROM ALL SIX SURFACES (2026-08-08)

A live end-to-end test of the rentals funnel on 2026-08-07 (project name "Jack you are a Cutie")
left real records in every downstream system. All of it is now removed. **The rentals database
holds zero bookings and seven orders as a result, and that is correct, not data loss.** Section
0.0.-19a below describes "booking 50, order 33, SHAPE Tripod #1" as the last `held` row: that row
WAS this test booking, so the claim there is now historical.

**What one test submission produced, and where it had to be deleted from:**

| Surface | Artifact | Method |
|---|---|---|
| Supabase | `orders` id 33, `bookings` 50/52/53/54/55 | `DELETE` via `_rp_db.py` |
| HubSpot | deal `340542685883` "Rental: Jack you are a Cutie", $88, Start Invoice Sent | `DELETE /crm/v3/objects/deals` |
| Google Calendar | `Rental Pickup:` 08-12 + `Rental Return:` 08-13 on studio@ | Calendar API |
| Jotform | submission `6619607544216970356` on Rental Quote Request (`261817432074052`) | `DELETE /submission` |
| Gmail | the rentals@ notification thread | moved to Trash |
| n8n | ~60 execution logs referencing the deal | left to self-prune |

**DELETION ORDER IS NOT OPTIONAL. Delete the HubSpot deal FIRST.** `orders.source` is `hubspot`
and the active n8n workflow `HubSpot → Rental DB Sync` (`Gazw7lunDNNd9HO2`) recreates the Supabase
order from the deal on a schedule. Clearing Supabase while the deal still exists just puts the row
back a few minutes later. Verified clean twice, with a sync window in between.

**The contact was NOT test data and was deliberately left alone.** The test used Karina Salerno
(kvsalerno@gmail.com), a real HubSpot contact since 2026-04-23 and QuickBooks customer 122. Only
her deal count changed, 3 to 2. No confirmation email ever reached her; the only mail generated was
the internal Jotform notification to rentals@. No QuickBooks invoice was created despite the deal
sitting in "Start Invoice Sent", so that stage label is decoration in the same way `held` was.

**Two anomalies this exposed. BOTH were diagnosed on 2026-08-08 and only one was a bug.
See 0.0.-21 above for the resolution; the paragraph below is kept because the symptom is what
a future session will notice first.**

1. **The totals disagreed across the funnel.** HubSpot recorded $88.00, Supabase recorded $48.00
   for the same order. REAL BUG, now fixed: Supabase was right and HubSpot was stale.
2. **Only five bookings existed for six submitted units**, with `51` missing from the id sequence,
   matching the Aputure INFINIBAR PB6. NOT a bug: that booking was deliberately deleted in NocoDB
   during the same test session. `rp_recompute_order()` correctly repriced the order afterwards.

*Rollback:* `bts-automation/backups/testorder_cutie_backup_20260808.json` holds the full `orders`
and `bookings` rows plus the raw Jotform submission. The HubSpot deal is in the portal's recycling
bin for 90 days. Calendar events and the Gmail thread are recoverable from Trash for 30 days.

*If you test the funnel again,* use an obviously fake contact rather than a real one, and expect to
clean six surfaces, not one.

### 0.0.-19 RENTALS: `held` STATUS RETIRED + ANON DB GRANTS LOCKED DOWN + WEEKLY SCHEMA SNAPSHOT (2026-08-07)

Three related things, all in one session. The `held` audit is what exposed the other two.

**PUBLIC DB PERMISSIONS WERE WIDE OPEN AT THE GRANT LEVEL (fixed).** The July RPC audit tightened
function EXECUTE but never looked at *table* grants. `anon` and `authenticated` held
`SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` on all six rentals tables
(`items`, `units`, `bookings`, `orders`, `damage_events`, `item_accessories`). Row-level security
was the only thing standing between the published anon key and truncating the bookings table.
Verified what the browser actually needs: exactly `GET /rest/v1/items` and
`POST /rest/v1/rpc/catalog_availability`, nothing else, in either repo. So:

```sql
revoke all on table public.bookings, public.orders, public.damage_events,
                   public.units, public.item_accessories
  from anon, authenticated, public;
revoke all on table public.items from anon, authenticated, public;
grant select on table public.items to anon, authenticated;
```

`anon` now holds `SELECT` on `items` and nothing else. Verified live before and after: items 365,
availability rows 77, identical. `/rest/v1/bookings`, `/orders` and `/units` now return
`401 42501 permission denied` to the anon key instead of relying on RLS. **RLS is still on and
still correct, this is the second lock, not a replacement.** If a future feature needs the browser
to read another table, grant `SELECT` on that one table only, never the whole set.

**WEEKLY SCHEMA SNAPSHOT (new job).** `bts-automation/schema_snapshot.py`, launchd
`com.rarepond.schemasnapshot`, Mondays 04:20, registered in the ClickUp Automation Health doc.
Reads the live database and writes structure only (tables, constraints, indexes, triggers,
function bodies, enums, RLS, grants; no rows, no secrets) to
`bts-automation/backups/schema/rentals_schema_LATEST.md` plus a dated copy, keeping 12. It also
mirrors into `AI_System_Context/project-docs/rentals_schema_LATEST.md`, so any future session can
read the true schema from the Google Drive mirror with no device access. It exists because
`Desktop/Archived Backups/rentals-build-archive/migrations/` had quietly stopped being true:
`rp_booking_validate()`, a live double-booking guard, runs in production with no migration for it.
Anything changed in the Supabase SQL editor never reaches a file, so the record now refreshes
itself instead of depending on someone remembering. Credentials for it live in
`~/.config/rarepond/rentals_db.json` (mode 600), read via the new shared `bts-automation/_rp_db.py`.

**STILL OPEN, NEEDS JACK:** the Supabase database password is stored unencrypted in
`~/nocodb-data/noco.db`. Rotating it needs the Supabase dashboard, and NocoDB's connection
encryption needs the container recreated with a key that must never be lost. Both were left for a
session where Jack can watch the rentals page. See the journal entry for the exact steps.

### 0.0.-19a THE `held` BOOKING STATUS, WHY IT WAS DECORATION (2026-08-07)

`bookings.status` was a two-value Postgres enum (`booking_status = 'held' | 'confirmed'`). The
phase-1 design intended a two-tier system where `held` was tentative and only `confirmed` counted
against availability. Phase 4 (2026-07-06) never implemented that split: it wrote
`status in ('held','confirmed')` into every consumer, so the two values became functionally
identical. A full live audit of the Supabase database on 2026-08-07 confirmed there is no code
path anywhere in which they differ.

Everything that reads `bookings.status`, and what it does with it:

| Where | Behaviour |
|---|---|
| `catalog_availability()` | `status in ('held','confirmed')`, both block |
| `reserve_order()` | `status in ('held','confirmed')`, both block |
| `rp_booking_validate()` trigger | `status in ('held','confirmed')`, both block |
| `bookings_no_overlap` constraint + GiST index | `WHERE status = ANY(ARRAY['held','confirmed'])` |
| `on_order_stage()`, `rp_order_reserve_sync()` | delete by `order_id`, status-blind |
| `on_damage_event()` | its `status` is `damage_events.status`, unrelated |
| `hubspot_sync_order()` | its `'held'` is a JSON response key, unrelated |

No view, matview, RLS policy, check constraint or generated column references the value.

**What changed.** The one remaining `held` row (booking 50, order 33, SHAPE Tripod #1,
2026-08-12 to 2026-08-13) was set to `confirmed`, and `held` was removed from the NocoDB
single-select options for `bookings.status`, so it can no longer be picked in the UI. Verified:
`catalog_availability('2026-08-12','2026-08-13')` returns byte-identical results before and after
(77 items, same four blocked), all constraints/triggers/functions intact, all 5 bookings
`confirmed`.

**What deliberately did NOT change.** The Postgres enum still contains the label `held`, because
Postgres has no `ALTER TYPE ... DROP VALUE` and removing it would mean rebuilding the type and
re-pointing the exclusion constraint, its index, and three functions on a live database for zero
user-visible gain. Nothing can produce the value any more: the column default is `confirmed`,
`reserve_order()` inserts `confirmed`, n8n never writes it, and the UI no longer offers it. If the
tentative tier is ever wanted, drop `'held'` out of `catalog_availability()` only (keeping it in
`bookings_no_overlap`) so a held row stops hiding gear from the public catalogue while still
preventing a double-book.

**The mental model, stated plainly:** a booking row IS the hold. Availability keys off the row
existing, not off its status. Status was decoration.

*Rollback:* `bts-automation/backups/bookings_status_backup_20260807_220955.json` (rows + column
meta) and `bts-automation/backups/noco.db.bak_beforeheldremoval_20260807_221140`.

*Note for whoever edits NocoDB select options next:* PATCHing `colOptions` on an enum-backed
SingleSelect via the NocoDB REST API wipes ALL options rather than the one you removed. The
working method is to stop the container, edit `nc_col_select_options_v2` in
`~/nocodb-data/noco.db` directly, and restart.

### 0.0.-18 LEGAL-PAGE CHROME + JC CONTACT POPUP + AI-BLOCKS + EM-DASH SCRUB (2026-08-07)

Committed on the mini, pushed by Jack (cloud/VM cannot push either repo; both push from the mini).

- **Legal pages rebuilt on the REAL site chrome.** RP /terms/ + /privacy/ now carry the Rare Pond
  Media muted dark header, the shared footer (socials.js from site.json), and the pond caustics
  behind the content (new shared `assets/legal.css`). JC /terms/ + /privacy/ carry the JC header
  (logo + nav + socials) and footer (tagline, socials, links, copyright) from its own data (new
  shared `assets/legal.css` + `assets/legal.js`, inline social-icon set incl. IMDb). A no-AI-training
  clause was added to the acceptable-use section of both Terms.
- **Rentals packages cursor.** The Packages hug gets breathing room (`data-cursor-pad="10"`) and the
  box icon now sits INSIDE the hug, to the left of the "Packages" label.
- **JC contact: popup button, not an inline form.** The duplicate inline HubSpot form on the JC page
  is gone; the contact section now shows a "Get in touch" button (`.rpc-cta` + `data-contact`) that
  opens the shared Contact popup, exactly like RP. HubSpot no longer loads on the JC page at all
  until the popup opens (or cookies are accepted), which also removes the last browse-time tracker.
  The social bubbles stay. (Leftover unused `.contact-grid`/`.form-card` CSS is harmless.)
- **AI-scraping policy.** robots.txt on BOTH sites now blocks the known AI/LLM crawlers and dataset
  scrapers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Google-Extended,
  Applebot-Extended, CCBot, PerplexityBot, Bytespider, Amazonbot, Meta-ExternalAgent, Diffbot,
  cohere-ai, YouBot, AI2Bot, ImagesiftBot, etc.); normal search indexing is untouched. The Terms
  acceptable-use clause also forbids using the content to train ML/AI systems. POLICY: this site's
  content is not licensed for AI/LLM training or automated dataset scraping. Keep these robots.txt
  rules and the Terms clause in place; do not remove them.
- **Site-wide em-dash scrub (aesthetic).** Every em dash was removed across docs, code comments,
  CMS/config, and site copy in BOTH repos AND the bts-automation masters (spaced -> comma,
  appositives -> parens, line-end -> comma, bare -> hyphen). No functional em dash existed (audited:
  the only literal em dashes were UI "no value" placeholders and the 404 title, handled by hand).
  The 4 shared masters (contact.js/contact.css/social_ui.js/cursor.js) stay byte-identical across
  bts-automation + both repos. All JS parses, all JSON valid, all .py compile. node_modules and
  historical backups were deliberately excluded. AI-writing tells were reviewed; Jack's own copy
  (e.g. the media.json "body") was left as-is per instruction.


### 0.0.-17 SECURITY + BACKUP FIXES (QC follow-up, 2026-08-06), no cursor change

All pushed + live-verified on RP + JC. From the full-system QC pass:

- **ADMIN AUTH BYPASS (fixed).** `/admin%2Fcolorlooks` (URL-encoded slash) served the internal
  tools with NO password: Cloudflare decodes `%2F` to LOCATE the asset, but the middleware tested
  the still-encoded pathname, so `isProtected()` never matched `/admin/`. It now
  `decodeURIComponent`s (and defuses `%252F`) before the prefix test; 4 encoded-slash cases added
  to `tools/test-colorlooks-gate.mjs` (all green). Live: encoded path now 401.
- **/media CACHE-POISON (fixed), and a HARD LESSON.** A missing `/media/...` file fell through to
  the SPA (`/* /index.html 200`) and the `/media/* 7-day` cache rule cached that wrong HTML at the
  image URL. **DO NOT fix this with a root `404.html`:** a root `404.html` HIJACKS the SPA `/*`
  catch-all on Cloudflare Pages and 404'd EVERY film/projects/team route (caught + rolled back
  within minutes this session). `_redirects` has no 404 action either (only a 200 rewrite). The
  working fix lives in `functions/_middleware.js`: for a `/media/` FILE path, resolve the pipeline
  and if it came back `text/html` the real file is missing -> return a real 404 (`no-store`). Real
  images resolve to `image/*` and pass through (cache header preserved -- verified).
  **jackcarlsen.com got its FIRST Pages Function** for the identical fix.
- **Error beacon** (`functions/api/client-error.js`) now drops non-same-origin POSTs first
  (cross-site spam). A per-IP throttle would need a KV/DO binding (not configured).
- **Weekly backup was NOT stalled** (the QC report's "Jul 11" looked at the wrong dir). It writes
  to `~/Desktop/Archived Backups` (mounted `/backups` in the n8n container); last scheduled run
  Aug 2, plus a fresh run triggered Aug 6. The health monitor false-flagged it because this
  workflow's successful executions aren't recorded in n8n; `automation_health_launchd.py` now
  judges it by actual backup-FILE freshness (`_backup_freshness_h()`) and shows the truth (green,
  and would catch a real missing/stale-files failure).

- **Privacy policy (NEW):** static `/privacy/` page on BOTH sites (served as a directory index
  like /rentals//media/), footer-linked via `site.json -> nav` (RP, footer-only) and
  `site.json -> footer.links` (JC). CalOPPA-shaped; contact contact@rarepond.com; mailing address is
  a marked placeholder for Jack. RP c264c18, JC 09511d4. TODO next pass: Terms of Use + gate HubSpot
  cookies behind consent (CIPA).

RULE for every future site: never drop a root `404.html` into a Pages SPA repo -- do missing-asset
404s in the middleware. Commits: RP f4ed193->9d2b528, JC 3eff23c->5efe065.

> **NEXT SESSION: read `STREAMLINE-ROADMAP.md` before touching anything.** Jack's standing
> order for the next pass is a fresh-eyes streamline: every recurring element (header,
> footer, transitions, lightbox) unified into one config-driven engine per element, plus a
> deep-dive cleanup sweep, without breaking current behaviour. The roadmap file carries
> the full inventory, guardrails, and definition of done.

### 0.0.-16 SMALL FIXES + THE ROADMAP, v21

- **Media footer wordmark hitbox:** the `.wm` anchor is a flex element, so it laid out as
  a FULL-ROW block, the cursor reacted to it from the far edges of the footer. Now
  inline-flex (hitbox = visual). This is a drift symptom of four bespoke footers, see the
  roadmap.
- **"More to come" keyboard parity:** kb selection (`.rpc-kbsel`) now joins the
  :hover/.rp-tap selectors for the placeholder's rainbow glow/edge + duck-mark reveal,
  keyboard users get the same reaction as mouse hover and mobile tap.
- **`STREAMLINE-ROADMAP.md` added** (committed, public-safe): the next session's mission
  brief, unification targets (4 footers, 4 headers, duplicated inline boot snippets, twin
  lightboxes, the look-var naming zoo), the already-shared engines to model on, the sweep
  candidates, guardrails, and the definition of done.

### 0.0.-15 MOBILE PASS, v20

From Jack's phone screenshots/recording:

- **Footer a11y widget on touch devices:** cursor.js exits early on touch (`pointer:fine`
  gate), so the footer accessibility line rendered as a RAW UNSTYLED div on phones. The
  touch/reduced-motion exit path now injects the widget's styling + toggle wiring before
  returning: hidden entirely `<=700px` (phones, nothing to advertise), styled and
  functional on iPads and up (they take keyboards/trackpads; the switch persists the pref).
  LESSON: anything cursor.js styles that exists in static markup must also be styled on the
  no-engine path.
- **STANDARD HEADER COLLAPSE (xnav.js):** the burger now appears when (a) the header
  actually overflows, (b) the page-nav (.hnav/.mnav) has been hidden by a breakpoint, its
  links must reappear in the burger, never vanish (the media page lost Team/Projects/
  Contact from 720-1040px and showed uncollapsed chips on phones), or (c) width <=720px.
  Applies to every current and future sub-site using the shared header cluster.
- **Crew form X** now straddles the popup's top-left corner (-12,-12; the backdrop's 40px
  padding keeps it on-screen) instead of sitting inside where it covered the title.
- **"More to come" tap reaction:** the touch hover-neutralizer block (`@media(hover:none)`
  it kills sticky hover on purpose) also killed any tap feedback on the placeholder.
  A tap now adds `.rp-tap` for 1.4s, whose rules OUTRANK the neutralizers: rainbow
  glow/edge + the RP mark reveal.
- **What-we-do orbit bubbles (PREP for the section redo):** mobile orbit scale was .58,
  the whole px-table orbit collapsed inside the white logo plate so the bubbles never
  emerged on scroll. Bumped to .70 as a mitigation. REAL fix for the redo: size the orbit
  ring relative to the plate (percent/viewport-based positions, not the fixed
  ABOUT_ORB_POS px table), and consider z-ordering emerged bubbles above the plate.

### 0.0.-14 THE SCROLLBAR BUG (rentals truly solved) + GLOW-ONLY BUBBLES, cursor v19

- **RENTALS KEYBOARD, ACTUAL ROOT CAUSE, CLASSIC SCROLLBARS.** Reproduced at last in
  Jack's own Chrome (via the browser bridge): `window.__rpcModal` reported "cartp" with the
  cart CLOSED. His Mac renders ALWAYS-VISIBLE scrollbars (measured
  `innerWidth - clientWidth = 15`). Fixed elements lay out against the LAYOUT viewport
  (clientWidth), so the cart drawer parked at `translateX(100%)` sits at clientWidth,
  15px INSIDE innerWidth, and the engine's visibility check (which used innerWidth)
  counted the closed drawer as an open popup: keyboard whitelisted to an off-screen cart =
  totally dead, while real popups (later in DOM) still worked. Headless Chrome uses 0px
  overlay scrollbars, which is why it never reproduced; incognito shares the OS setting,
  which is why incognito failed too; the Windows Firefox window happened to have no
  vertical scrollbar. FIX: all popup-visibility and horizontal-reachability checks now use
  `document.documentElement.clientWidth/Height`. Verified fixed IN JACK'S BROWSER
  (modal null, selections landing). RULE: never use innerWidth for on-screen geometry,
  classic scrollbars exist on most Windows machines and any macOS with "always show".
- **First arrow press always lands:** with the pointer parked on an element and no
  candidate in the pressed direction (mouse on the cart FAB, pressing down), the press now
  falls through to nearest-candidate activation instead of silently doing nothing.
- **Rentals cursor tint REMOVED** (Jack: hurts visibility): the engine no longer reads
  `--cc/--ccg` at all; category colour stays in the tabline/cards. renderTabs no longer
  sets a body-level look.
- **RP bubbles/cards: kb indicator is the STANDARD GLOW only.** The v16 ring bands
  (.kbring on projects bubbles, .ckbring on home cards) are deleted; the `.rpc-kbsel`
  mirrors (halo ::before, .glow/.cglow, scale, caption) are the whole indicator. The hard
  hug outline remains for buttons/controls. Per-site creative choice stays possible:
  `data-cursor="kbnative"` + that site's `.rpc-kbsel` CSS decide outline vs glow-only.
- **CROSS-BROWSER TESTING NOW IN THE HARNESS:** Firefox 152 runs headless via
  puppeteer-core webDriverBiDi (`_headless/ff1.mjs`); local FF verifies boot, @property,
  color-mix, special fade and look adoption all working. If a browser-specific report
  comes in, run the same test file against both engines. (Safari has no comparable
  automation path installed; untested.) Stale-cache caveat applies to FF too, Jack's
  Windows FF likely served an old cached cursor.js (hard-refresh before comparing).

### 0.0.-13 STALE-STATE FIXES + THE RENTALS MYSTERY SOLVED, cursor v18

Deep-dive on Jack's keyboard-overlay OBS recordings. Root causes, all verified in the
headless harness before shipping:

- **Colour only refreshed on re-hover:** the look poll skipped whenever something was
  hovered, so the ring kept the ENGAGEMENT-time colours while the element's own look
  changed under it (the home carousel swapping which project is featured; hover-look var
  transitions). The poll now re-resolves the hovered/selected element every ~200ms,
  colour follows the element, not the moment of engagement.
- **Keyboard showed signature colours on RP bubbles:** the project colour on the home/
  projects bubbles lives in the HOVER-look vars (`--h1/2/3`), swapped in by a `:hover`-only
  rule. `.rpc-kbsel` (the kb mirror of :hover) now joins those selectors, so kb selection
  swaps the bubble's own glow AND the adopting cursor to the project look. Verified:
  kb-selecting Geri-Action turns --gg1, the ring, and the .kbring band geri-pink.
- **Bob desync (the halo stopped following):** `body.swiping` pauses the bob on
  .cbub/.cglow/::before DURING carousel rotations, the v16 `.ckbring` was not in that
  pause list, so every rotation advanced it ~700ms relative to the card. One rotation =
  permanent phase drift. It's in the list now; getAnimations() shows identical currentTime
  after any number of rotations. LESSON for future bob layers: any new layer that bobs
  must join the body.swiping pause list.
- **Ghost outline after leaving a project:** two stacked causes. (1) The idle sleep could
  stop the rAF loop while a hug was active, freezing every watchdog; the loop now only
  sleeps in the free-ring state. (2) Mouse hugs never re-validated their element, leaving
  a universe swaps the section under a stationary pointer, no pointerout fires, and the
  fixed back button kept its rect while invisible. Mouse hugs now get the same staleness
  probe as kb (disconnected or covered ⇒ release). Ghost gone in <600ms.
- **THE RENTALS "still broken" MYSTERY:** the OBS video shows the rentals tab running OLD
  code (cart X on the left before v17 shipped that, pre-v17 cart-drawer modal leak
  symptoms). Jack keeps MANY PINNED Rare Pond tabs, a pinned tab never reloads, so no
  deploy ever reaches it. Live rentals verified working (fresh sessions, every popup
  open/close cycle, kb + section tint). OPERATIONAL NOTE: after a deploy, pinned tabs must
  be manually reloaded (Cmd+R) before retesting; `window.__rpcModal` +
  `window.__rpcTick` in DevTools console identify a stale/stuck engine instantly.
- **Back-button text occlusion (geri page): NOT reproduced** locally or live at several
  scrolls/viewports. Defensive fix shipped: `.back` z-index 180 → 900 (above every
  universe layer; popups/lightboxes live far higher). If it recurs on Jack's machine, grab
  `document.elementFromPoint` at the button centre in the console, that names the
  occluder immediately.

### 0.0.-12 LOOK COVERAGE + X-STANDARD + FOCUS RULE, cursor v17

From Jack's OBS retest (frames verified):

- **Look coverage gaps closed.** RP project pages (universes) use `--fg1/2/3`, the engine
  now reads them, so the cursor tints INSIDE a project. Lightboxes are appended to <body>
  (outside any look scope), so both sites' `openLB` (and JC's reel viewer) now COPY the
  source element's computed look vars onto the lightbox, the cursor tints on the ‹ › X
  buttons of the photo viewer. Precedence fix: `--cc` (rentals section) is resolved BEFORE
  `--g1`, because rentals page chrome later sets a signature `--g1` page-wide which was
  shadowing the section color.
- **Gradient fixed in screen space.** The velocity stretch ROTATES the ring element, which
  spun the conic gradient with it, mouse shakes read as the colours flipping (the smoothed
  angle jumps ~pi on direction reversals). The gradient's from-angle now counter-rotates
  (`--rpc-spin`), so the colour band never moves while the oval turns.
- **WHITE-SQUARE glitch:** kb-select then mouse-away left the element focused after
  `.rpc-kbsel` (which suppresses the UA outline) was removed, Chrome's native focus
  RECTANGLE appeared. The engine now blurs the element when its selection class is removed.
- **FOCUS-vs-ENTER RULE (the cursor's meaning):** ring glow present over an element =
  "clicking ENTERS this". Elements whose click only brings them to the FOREGROUND lose the
  ring glow (faded, object reacts instead): opt in with `data-cursor~="focus"`, and
  AUTOMATIC for off-centre options of click-mode carousels, future focus-click elements
  inherit it with no wiring.
- **POPUP X STANDARD: TOP-LEFT.** Every popup's close X now lives in/just outside the TOP-
  LEFT corner: RP+JC lightbox .lb-close, JC reel viewer, shared contact .rpc-close (master
  contact.css), crew form .rpc-x, rentals .dpx (item menu + request form; the dp back
  button moved beside it at left:60px), cart header X (order:-1), and the DATE-PICKER popup
  (#dpop) (which previously had NO X at all) got one (#dpopx). Any new popup follows
  this rule.
- **Rentals kb hardening + diagnostics:** kbVis needs a popup ≥12px inside the viewport
  (sub-pixel translateX(100%) rounding can never count a closed drawer as "open"), and
  `window.__rpcModal` breadcrumb reports what the engine considers the open modal (check it
  first if "keyboard dead on the page, fine in popups" ever comes back). Full state sweep
  (open/close dates, item menu, cart, contact) keeps kb + section tint working.

### 0.0.-11 COLOR-LOOK CURSOR + A11Y TOGGLE + RENTALS KB FIX, cursor v16

Seven-item batch from Jack's notes:

- **COLOR-LOOK ADOPTION (mouse + keyboard, all sites).** The ring's gradients now read
  registered props `--rpc-a/b/c` (smoothly transitioned). The engine retargets them to the
  color look of whatever the pointer or kb selection is over or INSIDE: it resolves
  `--gg1/2/3` (RP), `--g1/2/3` (JC scopes + raw RP), `--c1/2/3` (social/contact bubbles),
  `--cc`/`--ccg` (rentals) on the element, inherited vars, so anywhere inside an open
  project section resolves that section's look. Values equal to the page baseline (captured
  synchronously at script load into `window.__rpcLookBase`, before site JS runs) do NOT
  count; leaving a look scope restores the site colors. Rentals sets the active category's
  color on `<body>` (renderTabs), so the cursor tints per SECTION there too.
- **LOGOS ALWAYS ON TOP of selection indicators (`data-cursor="kbnative"` generalized to
  non-specials).** Home carousel citems now render their own kb ring: `.ckbring`, a 3px
  conic band in the PROJECT's look just outside the visible edge, mirroring .cbub's radius
  morph and bob, at z 2 under the film logo (z 11). Popups/lightboxes still cover
  everything (they are page content stacked above). Projects-page `.kbring` rebuilt the
  same way: color-look band ON the bubble edge (inset -3px), not the old oversized white
  halo.
- **RENTALS KB DEAD-END FIXED (framework rule).** The cart drawer hides by sliding
  off-screen right (transform), its buttons kept real rects and the kb engaged them: the
  selection flew off bottom-right and dead-ended (the red flashes were the cart's
  quote-warning arrows). Two new candidate rules in the engine: (1) anything inside a
  `[data-kb-modal]` container is only reachable while THAT container is the open modal,
  closed popups/drawers are never candidates; (2) horizontally off-screen elements are
  never candidates (the page never pans sideways by design).
- **FOOTER ACCESSIBILITY LINE + DYNAMIC-CURSOR TOGGLE (all pages, both sites).** Markup:
  `.rpc-a11y` ("This site is keyboard accessible, try it out!" + "Use cool dynamic mouse:"
  with `<button data-rpc-toggle role="switch">`). Styling + wiring live in cursor.js so
  every future site gets the identical widget. Toggling off removes html.rpc-on (native
  cursor + native focus return), hides the engine, disables its key/pointer handling, and
  persists in localStorage("rpCursorOff"); the switch is a real button, so it stays
  keyboard-operable with the engine off.

### 0.0.-10 EDGE-TRUE OUTLINE + ARROW BOUNCE + FLOATING FOLLOW, cursor v15

Three visual fixes from Jack's retest:

- **Outline ON the edge, not inside it.** The 3px .rpc-bord gradient band is drawn INSIDE
  the ring box, so an exact-size box put the visible line slightly WITHIN the button. The
  hug box now grows by one band-width per side (+6px total, radius +3): the band's inner
  edge sits exactly on the element's rim.
- **Lightbox arrows: the selection BOUNCES with paging.** The lightbox's ‹ › buttons carry
  `data-kb-dir="-1"/"1"` (both sites, the annotation rule for any paging modal). When the
  page's own handler consumes ←/→ (defaultPrevented), the engine no longer ignores the
  press: inside an open modal it lands the halo on the matching data-kb-dir control, so
  toggling photos visibly bounces the selection between the two arrows. Plus a modal cone
  fallback in kbMove: with only corner controls (‹ › X), a directional press that the ~65°
  cone rejects retries nearest-in-direction, ↑ now always reaches the close X from either
  arrow.
- **Outline follows FLOATING (bobbing) surfaces.** Bob keyframes run on INNER layers
  (.cbub / .bubble-inner / .xb-core) while the anchor the engine hugs stays still, the
  outline sat frozen next to the bobbing visual. `findBox()` picks the visible surface:
  the deepest INFINITE-animated descendant covering the anchor's box (finished one-shot
  entrance animations don't count; noscan layers skipped), and the ring's per-frame easing
  rides it (harness: bob range 10.06px, ring range 10px, max error 0.07px). Two supporting
  fixes: the idle sleep never engages while hugging a floating surface (the ease-in-out
  bob's zero-velocity dwell at the extremes used to trip the 90-frame idle threshold and
  FREEZE the loop mid-bob), and the RP projects .kbring (site-drawn, kbnative) now carries
  the same bob animation/phase as .bubble-inner so it floats with its bubble.

### 0.0.-9 MODAL KEYBOARD TRAP, cursor v14 (FRAMEWORK RULE)

The v10 occlusion probe was not a real focus trap: it only rejected candidates whose CENTRE
was covered on-screen, so kb could still reach roughly-off-screen background elements while
a lightbox was open, and a selection on an AUTO-DRIFTING strip (permanently "in motion")
was exempt from the release watchdog, its glow lingered under the opened photo. Replaced
with an explicit modal whitelist:

- **THE RULE (every popup, every future site):** the OUTERMOST container of any popup that
  owns the screen, image lightbox, reel viewer, contact modal, rental item menu / cart /
  request form / date picker, carries **`data-kb-modal`**. While one is visible, keyboard
  candidates are ONLY its own controls (its prev/next arrows, its close X, its form fields).
  Nothing behind it is selectable, haloed, or scrollable-to. Topmost (last visible in DOM)
  wins when several stack; "visible" requires on-screen intersection, so a drawer slid away
  by transform does not count as open.
- **Safety net for forgotten annotations:** any FIXED overlay covering >=55% of the viewport
  at z-index >= 10 is trapped automatically (heuristic in `kbModal()`).
- **Stale-selection release, twice over:** at KEY-TIME (a press with a modal open and the
  selection outside it drops the selection first, then that same press engages the popup's
  nearest control) and in the WATCHDOG (modal check now runs even while motion tracking is
  active, the auto-drift exemption is gone).
- Annotated: RP .lightbox; JC .lightbox + .reel-lb; shared contact .rpc-backdrop
  (master contact.js); rentals #dp, #cartp, #reqpop, #dpop. Harness: JC lightbox, stale
  strip glow released on open, 6-arrow hammer never left the modal, ArrowRight paged the
  photo; RP contact + rentals menu trapped; v9/v12/v13 regressions clean.

### 0.0.-8 FULL-SITE KEYBOARD QA, cursor v13

Full kb sweep of both sites plus four targeted fixes from Jack's checklist:

- **`SELKB` (kb-only stops).** kb navigation now scans `SEL + ',[tabindex="0"]'`, so an
  element can be a keyboard stop without becoming a mouse-cursor target. New `kbSkip()`:
  `data-cursor="off"` elements stay kb-reachable when they carry `role="button"` or
  `tabindex="0"` (mouse ring still ignores them). This is the pattern for "selectable by
  keyboard, plain for mouse".
- **Ring BEHIND the logo (`data-cursor="kbnative"`).** New token: kb engagement of a
  special keeps it special (engine ring stays faded) and the SITE renders the indicator
  via the `.rpc-kbsel` class. RP project bubbles use it, a `.kbring` div (z-index 5)
  sits UNDER `.bubble-logo` (z 7), so the selection ring draws behind the logo art.
  Verified: kbring opacity 1, engine ring faded, logo overlaps ring in screenshot.
- **"More to come" placeholder selectable:** gets `tabindex="0"` + aria-label; any future
  placeholder bubble is kb-reachable automatically via SELKB.
- **Rentals item menus kb-openable:** cards are `role="button" tabindex="0"
  data-cursor="off"`, kbSkip's role allowance makes them kb stops; `.card.rpc-kbsel`
  CSS mirrors the hover lift/glow. Enter opens the item menu (.dp show) and arrows then
  select only the menu's own controls (occlusion filter holds, no background cards).
- **Expanded-view trap re-verified** (no background-grid selection while a film section
  is open) and JC regression re-run: 95-press jog stress, 0 offscreen samples (bigJog
  events are the strip's own loop-wrap teleports; selection stays in box).

### 0.0.-7 WRAP-PROOF JOG STEPPING, cursor v12

Jog strips "freaked out" after enough presses (page-scale jumps, selector off-screen,
opposite-direction mashing to recover). Root cause: the infinite strips TELEPORT their DOM
nodes by half a track at the loop seam; the kb selection was pinned to a node, so a wrap
carried it off-screen and each further press jogged by the huge stale dx. `kbJogStep` is
now wrap-proof: reference point is clamped into the strip's box; candidates only within
box ± 1.5×width (loop duplicates excluded); "lost" states re-engage the nearest in-box
candidate WITHOUT jogging; per-press jog need capped at one item width; plus tick-level
recovery (teleport >150px/frame, and a periodic out-of-box probe every 6 frames). Jogging
routes through `CustomEvent "rpc-kb-jog"` which JC's `wireNav` binds to `mq.jog(px)`.
Stress: 22 presses each direction + rapid-fire on WALL and BTS, 0 offscreen samples.

### 0.0.-6 OUTLINE = VISIBLE EDGE, cursor v11

- The RP home outline mismatch (OBS 19-04-10): the hug's radius scan could be driven by the
  DECORATIVE oval layers behind the card (.cdrop cast-shadow, .cglow halo) and was computed
  only once at engage, a side circle's 50% stuck while the card grew into a rounded rect
  (.cbub morphs 50% → 13%/20% over .6s). Fixes: `data-cursor="noscan"` on .cdrop/.cglow in
  the citem template (the layers are intentional visuals and stay); cursor.js `scanShape()`
  (noscan-aware, captures elliptical two-axis %-radii "13% / 20%"), re-run every 2 frames
  while the hugged element is in motion and once on settle; and applyHover re-enters when
  KEYBOARD takes over a mouse-hovered special (previously early-returned, leaving the ring
  detached/faded through the ride). Harness: ring radius follows the live morph and the
  settled ring matches .cbub's computed radius exactly (0px size/centre error).
- NOTE: the "still persists" kb recordings (19:02–19:04) predate the v10 edge deploy
  (~19:05), v10 behaviour re-verified locally; ask for a hard-refresh retest.

### 0.0.-5 POPUP FOCUS TRAP + JOG-STRIP STEPPING, cursor v10

From three OBS recordings (kb selecting through/behind popups; JC strips misbehaving on kb):

- **Occlusion filter (kbCandidates):** every candidate's centre is probed with
  `elementFromPoint`, anything covered by an unrelated element (an open popup, lightbox,
  menu) is not selectable and never gets a halo THROUGH the overlay. Only the overlay's own
  visible controls stay in play.
- **KB occlusion watchdog (tick, every 12 frames):** if the current kb selection becomes
  covered (Enter opened a lightbox over it), the hug is released immediately, the ring
  can never keep shining through an overlay.
- **Lightbox arrows own the keys:** both sites' lightbox keydown handlers now call
  `preventDefault()` on Arrow keys. cursor.js is deferred (registers after the inline
  handlers) and already skips `defaultPrevented` events, so while a photo viewer is open,
  arrows page photos ONLY, no background spatial nav. Verified: Enter on a BTS shot →
  viewer opens, hug releases, ArrowRight changes photo only, ArrowDown selects the
  viewer's own CTA (nothing behind it).
- **TWO CAROUSEL TYPES formalized.** (1) click-mode (RP home): arrow onto a side option →
  it rotates to centre with the selection riding (v9). (2) jog strips (JC wall/BTS,
  `data-kb-carousel="<navId>"`): horizontal arrows step ONE ITEM AT A TIME, new
  `kbJogStep` picks the adjacent option (same-row biased for the 2-row mosaic; the strip's
  Prev/Next chrome is excluded from horizontal steps) and, if it sits outside the strip's
  visible box, dispatches `rpc-kb-jog {px}` so the site marquee shifts JUST enough to
  reveal it (wireNav binds it to `mq.jog`). Selection always stays on screen; the hug
  rides the shift via motion tracking. Full-page skip: ArrowUp to the strip's arrow
  button, then Enter / left / right pages a full view (keydown special-case on
  `[data-dir]` buttons whose parent nav id is referenced by a data-kb-carousel).
  Old behavior (page-jog + reseek that let the selection go off screen / land on the
  arrows) is gone; jog-mode kbAdvance remains only as a fallback.

### 0.0.-4 CAROUSEL RIDE, cursor v9 (element-motion tracking + selection rides rotation)

Root cause of the "connector warps during navigation" OBS recording: while the hug is attached
to a carousel item that is itself moving/resizing (RP home rotation, .5–.6s transforms), the
ring's own 0.22s width/height CSS transition restarted every frame → rubbery outline shapes
that conformed to nothing. Fixes (cursor master, both repos):

- **ELEMENT-MOTION TRACKING:** per-frame rect diff on the hugged element; while it moves the
  ring gets `.tracking` (size transitions off) + near-zero easing (.85), the outline is GLUED
  to the element. When it settles, transitions return and the hug shape is re-scanned via a
  same-element applyHover (radius/pads for the grown card). Sleep guard covers trackN.
- **Selection RIDES click-mode carousels:** kb arrow onto an OFF-CENTRE option in a
  `data-kb-carousel="click"` container both selects it AND clicks it (rotates it to centre);
  the selection + hug travel WITH the element (same DOM node, layout() swaps slot classes).
  A CENTRED option is never auto-clicked (that would open the project); Enter activates it.
  kbAdvance click-mode no longer reseeks to a different item, it kb-engages the ridden
  element (kbsel glow, focus, hover parity). Off-centre test = |item centre − container
  centre| > 18% of container width.
- Harness (`_headless/v9btest.mjs`): ride via edge push and via kbMove both keep the chosen
  pk selected into the feat slot; ≤34px centre error across 56+ tracked frames; settled ring
  fits the 883px feat card exactly. Release-travel + xcur regressions green.

### 0.0.-3 LATE-NIGHT VISUAL-FIX BATCH, cursor v8 · kb accessibility · cross-site handoff

Five recorded glitches fixed (cursor master + shared social_ui.js + both sites' markup):

1. **No sideways page pan on kb selection.** kbEngage's scrollIntoView could pan horizontally
   when selecting the RP home bubbles that DESIGNEDLY sit part-offscreen, replaced with a
   vertical-only scrollBy reveal (horizontal travel belongs to the carousels via kbAdvance).
2. **JC wall posters: no cursor tilt** (`data-cursor="notilt"` in the wtile template, the
   perspective warp fought the marquee). **KB HOVER PARITY** (cursor.js): the kb selection now
   dispatches synthetic pointer/mouse enter+leave events (isTrusted=false; our own delegated
   listeners skip untrusted events), so everything sites tie to real hover, JC wall reels,
   RP bubble reels, marquee pausing, reacts to keyboard selection exactly like a mouse hover;
   released on kb hand-back/disengage. Site CSS also mirrors hover for kb (`.wtile.rpc-kbsel`,
   `.bts-slot img.rpc-kbsel`).
3. **JC BTS strip is kb-controllable**: `.bts-shot` imgs now `role="button" tabindex="0"`
   (they were invisible to the engine, cursor:zoom-in, no SEL match); arrows travel the strip,
   edge presses jog it via the existing `data-kb-carousel="btsNav"`, Enter opens the lightbox.
4. **Arrow keys activate kb nav with NO hover prerequisite** (accessibility): first arrow press
   selects the candidate nearest the pointer's last position (viewport centre fallback), trying
   nearest-first past oversized rejects; the next real mouse move hands control back.
5. **Cross-site wipe handoff (JC ⇄ RP)**: a held same-tab transport now carries its click
   origin + gradient colours in the destination URL hash (`#rpt=x%|y%|c1|c2|c3`, sessionStorage
   can't cross origins). Each document's new pre-paint snippet paints the same gradient before
   first paint (`window.__RPT`), and shared social_ui.js `arrivalRetract()` retracts it to the
   carried click point (centre fallback, colours validated, hash stripped via replaceState,
   1.8s safety, reduced-motion instant). No more hard cut between the sites.

### 0.0.-2 NIGHT BATCH, cursor v6→v7.1 · keyboard spatial nav · xcur chip (2026-08-05 late)

Cursor master `bts-automation/cursor.js` (synced to both repos) evolved v6→v7.1:

- **v6:** page-transition fade fixed (painted-frame start + computed-opacity safety); specials
  (bubbles/rentals tabs) = ring COLOR fades out as the object's own glow fades in (`.faded`);
  faint contrast ghost ring at the dot while hugging (`.rpc-mini`, mix-blend difference, .6).
- **v7:** ring 50px (+15%), blur 1.3px; `a[data-net]` default hug pad 5; KEYBOARD SPATIAL NAV,
  arrows move the hug/selection from a hover context, Enter activates; kb engagement of specials
  conforms (bubbles → circle, logos → rounded rect 16/6) with `.rpc-kbsel` mirroring the site's
  own hover glow (UA outline suppressed); carousel end-push via `data-kb-carousel` ("click" = RP
  #stage rotate; nav-id = JC wall/BTS jog buttons) with reseek retries. Two engine bugs fixed:
  synthetic mousemove no longer cancels kb mode (>3px real movement required), and tilt is
  hands-off for ANY transform-positioned element (a baked inline matrix pinned carousel items).
- **v7.1 (this entry):** HUG-RELEASE TRAVEL, on hug→free the outline glides from the element to
  the dot (travT eased ~14 frames, matching the .22s size shrink); the containment clamp and
  stretch-rotate are suspended mid-travel. Kills the "outline snaps centered on the dot then
  shrinks" glitch that read as expansion AWAY from the button (confirmed frame-by-frame from an
  OBS capture, then harness-verified: monotone travel, zero backtrack).

**xcur chip (RP only):** the blued-out "you are here" cross-site chip is now clickable,
`assets/xnav.js` section 3 (all three surfaces): smooth scroll to top + `__samePageHome()` +
Escape dispatch; `chrome.css` gives `.xcur` cursor:pointer (hug engages) + role/tabindex/Enter.

### 0.0.-1 EVENING BATCH, scroll fix · shared contact popup · thoughts system

1. **SPA nav lands at the top instantly.** `html{scroll-behavior:smooth}` animated the scroll
   reset on view switches ("lands at bottom, scrolls up"). `__instTop()` (behavior:'instant')
   now used by `showView()` + pinTopOnLoad, mirrors JC's `__instScroll`. NOTE for future work:
   any programmatic scroll reset on these pages must use the instant helpers, never bare scrollTo.
2. **Contact popup is a SHARED module.** Masters `bts-automation/contact.js` + `contact.css`,
   published by `social_ui_sync.py` to BOTH repos. jackcarlsen.com now opens the same popup from
   every Contact control (`data-contact`), configured by its own `data/contact.json` (+ Pages CMS
   "Contact popup" group in the JC repo).
3. **Thoughts buttons on project pages.** NocoDB projects: `rp_thoughts`/`jc_thoughts` (text) +
   NEW `rp_show_thoughts`/`jc_show_thoughts` (checkboxes). Exporters emit
   `rpShowThoughts`/`jcShowThoughts`. RP film pages render "Hear our thoughts" (`.u-thoughts`),
   JC renders "What I did" (`.pj-thoughts`), below the logline, above the genres; fluid
   grid-template-rows 0fr↔1fr expand/collapse; left-justified pre-wrap text. Button shows only
   when the toggle is ON and the text is non-empty. Workflow: type in NocoDB → tick the box →
   live within the exporter cadence.
4. New reusable headless QC harness on the mini: `bts-automation/_headless/` (puppeteer-core +
   installed Chrome, run against the loopback dev servers).

### 0.0.0 NEWEST, Custom cursor system + interaction batch (2026-08-04 night PT; v3–v5 2026-08-05)

**Cursor v5 + interaction batch (2026-08-05 afternoon).** RP + JC, all verified in a Playwright
harness and live:
- **Fluid hover reactions:** element tilt/scale now EASES in (progress spring) and eases back out
  after leave (release queue `relEls`), no more pop to full size. Re-hover mid-shrink resumes
  from current progress.
- **Dot containment:** the centre dot can never exit the ring, the ring's lag is clamped against
  its own rotated/squashed ellipse each frame.
- **Hug border v2:** thicker 3px band that carries the page's colour-look gradient
  (`.rpc-bord`, conic c1→c2→c3, xor-mask border technique; works at any border-radius).
- **`data-cursor` is now a TOKEN LIST** (e.g. `"special notilt"`); tokens: off / link / glow /
  special / notilt. New: **`data-cursor-pad="N"`** = hug outline forms N px away from the element
  (used on all footer nav links, pad 6). New: special elements with `--cursor-tint` / `--tc` /
  `--cc` TINT the free ring to that colour (rentals category tabs = colour-merge, no outline).
- **Rentals:** category tabs `special notilt` (ring tints + merges with the category glow); item
  cards + package cards `data-cursor="off"` (native colored-glow hover only; the controls inside
  hug their own hitboxes).
- **Footer nav consistency:** every SPA footer link now renders a real `href` (cursor needs
  `a[href]`; Our Team / Projects were unlit before) across RP studio builder + static template,
  media builder (also fixed `/#go` → real `/team`-style paths) + static row, rentals static row,
  JC builder.
- **"See our work" button** next to "Learn who we are" on the studio home → `/projects`
  (`.about-ctas` flex row).
- **Media hero seam fix:** the hero scrim now dissolves to full base opacity before the section
  edge (long fade), no hard line when scrolling off the top.
- **Unified radial transport:** `social_ui.js` exports **`window.__rpTransport({x,y,c1,c2,c3,
  href,sameTab,hold})`**, ONE implementation of the click-origin radial-gradient wipe. The JC
  "go to Rare Pond" bubble now rides it (held cover through same-tab navigation; old `.xtransport`
  CSS/JS retired); social icons use the same core. bfcache pageshow cleanup lives in social_ui.js.
- **Orbit bubbles + media-site images are pasteable PATHS:** Pages CMS fields (`site.orbits`,
  `mediasite hero/showcase/sections/cta images`) are now string fields, paste a `/media/...`
  path straight from the NocoDB stills/BTS attribute; front-ends normalize (full URL → path,
  missing leading slash added). No duplicate image uploads.

**Cursor v4 (2026-08-05 midday), hover model rework + pop fix.** Three rules now govern hover:
1. **Ordinary interactive elements** (buttons/links/cards): the outline is ATTACHED to the element,
   exact box, exact radius, zero magnetic drift, and the ELEMENT warps in perspective toward the
   mouse (±6/7°, composited on its computed base transform so transform-positioned elements never
   jump; verified in a Playwright harness).
2. **SPECIAL objects never get the ring outline**, the ring stays the free ring and the OBJECT
   reacts. Auto-detected: large circular targets (% radius ≥45, ≥64px, project bubbles, carousel
   side circles, JC hbubs). Explicit: `data-cursor="glow"` (wordmarks, kept for back-compat) or
   `data-cursor="special"`. If the element natively drives its own tilt (defines `--tiltx`, RP
   bubbles do), the cursor is HANDS-OFF (no double-tilt); otherwise the cursor tilts it and scales
   it slightly (1.05, wordmarks 1.08). Small circles (social icons) keep the outline.
3. **Pop fix:** the free oval's orientation now takes the shortest path modulo π (ellipse symmetry;
   raw atan2 smoothing was the "pops in unnatural directions" glitch), pointer deltas are clamped,
   and `wake()` resyncs the previous-pointer so a sleeping loop can't wake into a giant stale delta.
   The old glowmode HALO skin is gone (wordmarks now scale+tilt instead).

**Cursor v3 (2026-08-05 morning):** the FREE state is now a **44px open ring**, a solid
conic-gradient band (c1→c2→c3) at the rim with a clear empty gap to the 5px contrast dot, same
silhouette as the loading orbit (which grew to 38px to match). The old radial glow-falloff orb is
gone from the free state; the ring band glows outward + inward via box-shadow (removed while
hovering/morphed). `data-cursor="glow"` targets (wordmarks) still get the SOFT halo, glowmode
overrides the ring mask back to the radial gradient. Squash/stretch is much stronger
(`k = min(speed*.034, .72)`): fast mouse = clear oval along the travel direction, spring-relaxes
to a circle at rest. All in the master `bts-automation/cursor.js`; published + committed to both
repos. Also 2026-08-05: security headers added to both repos' `_headers`
(X-Frame-Options SAMEORIGIN + Permissions-Policy deny), see SSOT change log.

Four features shipped across ALL FOUR surfaces (studio/rentals/media/JC), RP `81130b8` + JC `a245da2`:
- **Shared custom cursor engine, `assets/cursor.js`** (master `bts-automation/cursor.js`, published to
  BOTH repos by `social_ui_sync.py` / launchd `socialuisync`, same pipeline as `social_ui.js`).
  Soft gradient-falloff circle + 1:1 tracking dot replaces the mouse on desktop (fine pointers only;
  auto-off on touch + reduced-motion). Subtle velocity stretch; **iPadOS-style morph**: hovering ANY
  interactive element makes the ring hug that element's border box + border-radius; a white orbiting
  arc with a trail replaces the ring while a long transition covers the page (xwipe, social transport,
  JC transport, load veil, pointer position carries across navigations via sessionStorage `__rpcpos`).
  **CMS control:** Pages CMS → Site Settings → "Custom cursor" → per sub-site `enabled` + `colorLook`
  (site.json → `cursor.studio/rentals/media`; JC: `cursor` top-level; default = signature, so JC is
  automatically purple).
  **⚠️ RULES FOR FUTURE WORK (the standardized part):** interactivity is AUTO-detected, any
  `a[href]/button/[role=button]/form control/summary`, OR anything whose computed style is
  `cursor:pointer`, morphs automatically. A NEW button/link/card needs NOTHING for the cursor to
  adhere; just style it normally (`cursor:pointer` if it isn't a native control). Opt-outs/ins:
  `data-cursor="off"` (never morph on this element), `data-cursor="link"` (force morph). Text fields
  keep the native I-beam by design. Manual loading state: `window.__cursorLoading(true|false)`.
  Elements larger than ~62% of a viewport axis never morph (size guard).
- **Same-page nav = scroll to top.** Clicking the wordmark or any nav/footer link that points at the
  page you are already on now smooth-scrolls to the top instead of re-running a transition or
  reloading, implemented as one capture-phase inline snippet ("SAME-PAGE NAV") in each document's
  <head>, registered before the SPA/fade/wipe handlers. Links with a #hash or data-contact/net/wipe
  are untouched; cross-page nav behaves exactly as before.
- **Social/watch transport gradient now radiates from the CLICK POINT** (`social_ui.js` master): the
  radial gradient's centre = the same `--scx/--scy` the clip circle grows from (real click coords,
  falling back to the icon centre for keyboard activations), the wipe always blooms out of the
  click, innermost colour = the icon's own c1, no hard cut.
- **Speed lines de-uniformed** (`assets/xwipe.js`): 11 layers with near-prime tile widths
  (701–1409px), uneven row heights and per-layer phases, parallel but no visible repeat.
- All verified locally (devserve + JC :8801) and live: morph on nav pills/chips/cards, purple cursor
  on JC, loader auto-engages during wipes, same-page scroll-top on all four, zero console errors.

**Cursor v2 (same night, Jack's feedback pass, RP `f2620f0`, JC `808652f`):**
- **Hug tightened** (+4px/+2px radius, was +10/+5). **Between-buttons flash fixed**: a 120ms
  hover-out grace makes adjacent targets morph DIRECTLY into each other (verified against Jack's
  screen recording, the old 1–2 frame shrink-to-circle blink is gone).
- **Perspective tilt:** the hovered element itself tilts subtly toward the pointer (like the home
  bubbles), skipped automatically for elements with inline JS-driven transforms; opt out with
  `data-cursor="notilt"`.
- **Glow mode** (`data-cursor="glow"`, applied to every header + footer wordmark on all four
  surfaces): irregular/logo targets get a soft halo + tilt instead of a box. Rentals' same-page
  home click now ALSO resets to the "Select a Date" tab (`window.__samePageHome` hook in app.js).
- **Circular targets** (project bubbles etc.): the ring reads the border-radius of the element OR
  its near-full-size descendants (the rounding usually lives on an inner wrapper), % radius ⇒
  a true encompassing circle, never a box.
- **Dot = auto-contrast** (white with `mix-blend-mode:difference`, black on light, white on dark;
  the #rp-cursor wrapper is `display:contents` so the blend reaches the page, do NOT give it a
  position/z-index or the blend breaks). **Springier squash/stretch** (spring + damping, more
  travel). **Liquid-glass**: 2px backdrop-blur under the free orb only (off while morphed/loading).
- **Forms/iframes (HubSpot/Jotform):** the cursor HANDS OFF, unmorph + fade the moment the
  pointer crosses into an embed, watchdog (elementFromPoint every ~18 frames) catches missed
  crossings, so the ring can never park at a form's edge; reappears on the first move outside.
  NOTE: a cross-origin iframe can never receive the custom cursor or site CSS, full design-language
  forms would need native rendering via the HubSpot Forms API behind a Pages Function (needs a
  HubSpot token; proposed, not built). The embed workflow (paste a form id, it populates) is unchanged.
- **Robustness:** the rAF loop is try/finally self-healing (an exception can never kill it;
  first error lands on `window.__rpcErr`, heartbeat on `window.__rpcTick`); loop sleeps when the
  tab is hidden or idle (this is why an automated/background tab sees it frame-step, real users
  don't). **Touch:** any touchstart hides the cursor instantly; it never intercepts clicks, so
  mobile/hybrid input is untouched.
- **Stale-shell fix:** `_headers` in BOTH repos now force revalidation on the HTML entry points
  (`/`, `/media`, `/rentals`, `/index.html`), this is what made the media page appear to "not have"
  new features after a deploy (browser reused a cached shell). On RP the /media page paths DETACH
  the `/media/*` 7-day rule first (`! Cache-Control`) because Cloudflare concatenates same-name
  headers instead of overriding.

### 0.0 Full-system QC pass + cleanup batch (2026-08-04 late PT)
The §0.8 full-system QC was run top-to-bottom (all 4 front-ends in-browser, data JSON, git
authorship, launchd/n8n health, CMS config, DNS). Full report: the "Claude for Website" project
doc `qc-report-2026-08-04.md`. Results: everything green except the items fixed below.
- **jackcarlsen.com apex DNS is CUT OVER and LIVE**, apex + www both serve the new Cloudflare
  Pages site (the Wix era is over). Ignore any older "JC apex still on Wix" notes (§15.2 updated,
  SSOT updated). `www.jackcarlsen.com` now 301s to the apex (canonical) via its `_redirects`.
- **rarepond.com apex is STILL on GoDaddy forwarding** (deep paths 404), see 0.5, unchanged, owner
  DNS action pending.
- **Fixed (this repo):** `site.json → orbits[]` referenced the deleted `invalid-orbit.jpg` (one
  orbit bubble rendered empty; the SPA rewrite masked it as HTTP-200 HTML) → now `invalid-5.jpg`.
  `eventBanner.buttonLink` `/#rentals` → `/rentals`. `_headers` gained the `/media/*` 7-day cache
  rule (safe: exporters `?h=` cache-bust). `sitemap.xml` now includes `/media` + the three film
  pages. **New QA tool `tools/check-media-refs.mjs`** (both repos) verifies every `/media/...`
  path referenced in `data/*.json` exists on disk, run it before/after content work; it catches
  the broken-image class that status codes can't (SPA rewrite returns 200 for missing files).
- **Fixed (JC repo):** `_redirects` www→apex 301; `sitemap.xml` created (robots.txt pointed at a
  non-existent one); same `check-media-refs.mjs` added.
- **Fixed (backend):** `automation_health_launchd.py` n8n yellow-flag is now cadence-aware
  (`SCHEDULE_GRACE_H`), the weekly backup no longer shows 🟡 "no runs in 24h" six days a week.
- **NOTE:** both sitemaps are static and list film pages, when films are added/renamed, update
  them (or fold sitemap generation into the projects exporters, flagged as a future improvement).
- **(Same session, later) JC www→apex 301 NOW LIVE, but NOT via `_redirects`.** Both JC hostnames
  were already attached as Pages custom domains, yet the host-scoped `_redirects` line never fired,
  **Cloudflare Pages does not reliably apply full-URL (host-scoped) `_redirects` sources.** The
  working fix is a **zone Redirect Rule** (Cloudflare dash → jackcarlsen.com → Rules → "Redirect
  from WWW to root" template, 301, query preserved), deployed + verified live. ⚠️ **This means
  RP's apex→www `_redirects` line will likely ALSO not fire after the rarepond DNS cutover**, plan
  to add the mirror zone Redirect Rule ("root to WWW", or reverse if apex becomes canonical) in the
  Cloudflare dashboard at cutover time. The `_redirects` host lines stay as harmless documentation.
- **(Same session, later) Cross-site wipe SPEED LINES shipped** (`assets/xwipe.js`, commit
  `a635c89`). The Studio↔Rentals↔Media gradient wipe now carries subtle parallel motion streaks
  drifting in the sweep direction (L/R), injected entirely by the shared engine, **no per-page
  markup/CSS was added**. Seamlessness contract: the lines animate ONLY while the panel is moving
  and their opacity keyframes start AND end at 0, so at the cross-document handoff (panel at rest,
  covering) both pages show a line-free panel, the cut stays invisible with no cross-page
  animation-phase sync needed. They inherit `#xwipe`'s edge mask (streaks feather with the panel
  edges) and are disabled under reduced-motion. Verified locally (devserve) + live on www: both
  directions, clean landings, zero console errors.

---

Previous session (2026-08-05 UTC / 08-04 PT) touched the **three-site chrome** (studio `/`, rentals `/rentals`, media `/media`)
header, footer, cross-site nav, and the event banner. Everything below is **live on
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

### 0.3 Media footer "harsh line", FIXED (but see 0.5 about why the user may still see it)
- The line was **not inside the footer**. It was the boundary between the media **`.cta`** section
  (which has a full-bleed photo background, "Start a conversation") and the footer below it. The photo
  ended in a hard edge against the footer water.
- Fix (in `media/index.html` inline CSS):
  1. `.cta .scrim` now fades the photo down to a **solid `#06122b` band** across its bottom ~20%.
  2. `.mfoot` background top is a **solid `#06122b`** block (0→40%), matching the CTA bottom, with the blue
     tint + caustics only starting well below the join. `.mfoot-water` mask holds fully transparent for the
     top ~22%.
  3. `.mfoot { margin-top:-80px; padding-top:270px }`, the footer is pulled up so its **opaque dark top
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

### 0.5 Apex redirect `rarepond.com/media` → 404  (NOT fixed, needs a manual DNS change)
- **Symptom:** `www.rarepond.com/media` = 200 (correct, current). Bare `rarepond.com/media` = **404**.
  `rarepond.com/` (root only) 301s to www.
- **Root cause:** DNS for `rarepond.com` is at **GoDaddy** (nameservers `ns61/62.domaincontrol.com`).
  The apex A records point at GoDaddy's **domain-forwarding** IPs (`3.33.251.168`, `15.197.225.128`),
  which 301 the root to www but **404 every deep path**. `www` is a CNAME to `rare-pond-studios.pages.dev`
  (Cloudflare Pages) and works. The repo's `_redirects` already has the correct
  `https://rarepond.com/* → https://www.rarepond.com/:splat 301` rule, but it **can never fire** because
  apex requests never reach Cloudflare Pages, they hit GoDaddy forwarding instead.
- **This is why the user kept seeing "no change" / "the footer is still the same":** they were viewing the
  **apex** (`rarepond.com/media`), which serves a stale/cached/forwarded response, NOT the live Cloudflare
  content on `www`. Always verify fixes on **`https://www.rarepond.com/...`**, and tell the user to view www
  (hard-refresh) until the apex is repointed.
- **The fix (requires the owner's GoDaddy + Cloudflare accounts, cannot be done from a code session):**
  1. In **Cloudflare Pages** → the `rare-pond-studios` project → *Custom domains* → add `rarepond.com` (apex).
  2. Repoint the apex at Cloudflare. Cleanest is to **move `rarepond.com`'s DNS to Cloudflare** (change the
     nameservers at GoDaddy to the Cloudflare-assigned pair), then Cloudflare adds the CNAME-flattened apex
     record automatically. (Apex can't be a plain CNAME at GoDaddy, which is why forwarding was used.)
  3. Once apex resolves to Pages, the existing `_redirects` rule makes `rarepond.com/media` **301 → www**
     automatically. Delete the GoDaddy forwarding record.
  - **Decision needed from the owner:** they said the URL "should just be `rarepond.com/media`, not the extra
    stuff", i.e. they may want the **apex to be canonical (no `www`)**. If so, AFTER the apex is confirmed
    serving Pages, flip `_redirects` to redirect `www → apex` instead of `apex → www`. **Do NOT flip it
    before the apex DNS is live**, doing so would 301 the working `www` site into the currently-404ing apex
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

### 0.8 FULL-SYSTEM QC PROTOCOL, run this whole thing in the next chat
> **Scope:** a top-to-bottom quality-control pass over the ENTIRE system, not just the chrome:
> all websites + sub-sites, the generated data (source-of-truth) JSON, the host-side backend
> exporters + their launchd jobs, the databases, and Pages CMS. Read **`OPERATIONS.md` first**
> (canonical ops manual, pipelines, n8n/NocoDB access, Supabase, "things that have bitten us").
> Work top-down A→E. This QC is **read-only**, do not change anything unless you find a defect
> and the owner asks you to fix it.

**System map (what you are QC-ing):**
- **4 front-ends.** Rare Pond = studio `/` + rentals `/rentals` + media `/media` (ONE repo
  `rarepondstudios/rare-pond-studios`, host `www.rarepond.com`). Jack Carlsen = `jackcarlsen-website`
  (SEPARATE repo `Jackjrrc/jackcarlsen-website`, host `jackcarlsen.com`) with its OWN
  `assets/`, `data/`, `.pages.yml`, `functions/`, `_redirects`, independent of Rare Pond's chrome.
- **Generated data** = each repo's `data/*.json`, built by host exporters from the DB and committed.
- **Backend** = Python exporter scripts in `~/bts-automation/*.py`, each on a `com.rarepond.*` launchd
  job, plus n8n workflows. **Source of truth = NocoDB over Supabase Postgres** (schema `rp`).
- **CMS** = Pages CMS driven by each repo's `.pages.yml`; it edits ONLY the hand-authored JSON fields.
- **GOLDEN RULE:** rendered/generated JSON (`projects.json`, `rentals.json`, `socials.json`,
  `colorlooks.json`, `platforms.json`, `team.json`, `bts.json`, `stills-hd.json`, …) is DB-generated,
  **never hand-edit it.** Only these are hand/CMS-edited: `site.json` (hero/about/header/**nav**/footer/
  **eventBanner**/sectionHeadings), `contact.json`, `media.json` (media page copy + navBlurb), and the
  JC equivalents. Verify nobody hand-edited a generated file (`git log -- data/<file>` should show the
  exporter/n8n as author, not a manual commit).

**A. FRONT-END QC, all four sites (on the LIVE hosts, NOT the bare apex).**
Rare Pond: do it on `https://www.rarepond.com`, `/rentals`, `/media` (the bare apex `rarepond.com`
404s deep paths until the DNS fix in 0.5, never QC there). For EACH of the three RP sub-sites confirm:
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
  6. **Media only**, footer/CTA join has NO hard line (photo fades to `#06122b`, caustics bloom below;
     `.mfoot` has `margin-top:-80px`).
  7. **Event banner**, temporarily set `data/site.json → eventBanner.enabled:true`, confirm it renders on
     ALL THREE below the header (header z-index > banner). **Set it back to `false`** after.
  8. **Studio light scenes** (Team / Projects), footer inverts: wordmark text, tagline, links go dark + stay readable.
  9. **No console errors**; **0 broken images** (the studio `.lightbox` empty-src `<img>` is a benign
     on-demand placeholder, ignore that one).
  - *Automation tip:* studio home carousel eats wheel events and `scrollingElement.scrollTop` is ignored,
    use `window.scrollTo({top, behavior:'instant'})`; on media the BODY is the scroll container.
Jack Carlsen: do it on `https://jackcarlsen.com` (and confirm its own apex/www + `_redirects` behave,
check its DNS separately). Its chrome is INDEPENDENT, so run an equivalent pass in its own terms: header/
nav, footer, socials, **projects/film catalogue renders from its `projects.json`**, any contact path,
no console errors, 0 broken images. Do NOT assume Rare Pond changes propagated here.

**B. DATA / SOURCE-OF-TRUTH QC, both repos' `data/*.json`.**
  - Every `data/*.json` parses (`python3 -m json.tool <file> >/dev/null`).
  - GENERATED files are fresh + agree with the DB: spot-check a few `projects.json` / `rentals.json` /
    `socials.json` / `colorlooks.json` records against NocoDB (see OPERATIONS.md for how to reach it).
  - HAND-EDITED files intact + valid: `site.json` (nav/footer/hero/eventBanner), `contact.json`, `media.json`.
  - Golden-rule audit: no manual commits to generated files.

**C. BACKEND / PIPELINE QC, host Mac Mini (`~/bts-automation`).**
  - **Fastest path, the health monitor.** `automation_health_launchd.py` (job `com.rarepond.pyhealthmon`,
    every 15 min) writes **ONE** ClickUp page, **"Automation Health"** (doc `2kyde6jc-1234`), with three
    sections: **Websites** (site/data exporters, from the `JOBS` registry), **Local AI & System**
    (model-router, card-service, contacts-photoprep, imessage-reader, from `INFRA_JOBS`), and **n8n
    workflows** (read live from the n8n DB). Each section is sorted worst-first with a copy-paste fix block
    under any red; all green = everything last ran OK. Add any new `com.rarepond.*` job to `JOBS` or
    `INFRA_JOBS` or it won't be tracked. (History: it used to write 3 separate pages and, on transient API
    errors, `publish()` re-created pages, the doc had accumulated 8 duplicates. Consolidated to one page +
    dedup-hardened `find_page`/`publish` on 2026-08-05, and the 7 dup/legacy pages were deleted.)
  - **Direct check:** `launchctl list | grep rarepond`, 2nd column is the last exit code (0 = OK,
    non-zero = failed). Tail the offending job's logs in `~/bts-automation/<job>.log` and
    `<job>.launchd.err.log`.
  - **Exporters that MUST be healthy** (job → script): `rpprojsync`→`projects_sync.py`,
    `jcprojsync`→`jc_projects_sync.py`, `colorlooksync`→`colorlooks_sync.py`,
    `colorlooksfolders`→`colorlooks_folders_sync.py`, `socialssync`→`socials_sync.py`,
    `socialuisync`→`social_ui_sync.py`, `platformssync`→`platforms_export.py`,
    `brandmediasync`→`brand_media_sync.py`, `rentalsunitssync`→`rentals_units_sync.py`,
    `projmediasync`/`projfoldersync`, `btssync`/`rpbtssync`, `jcnativemediasync`.
  - **n8n alerts:** `rpalertmail01` + `rpwatchdog01` are the failure/silence email safety net, confirm
    both enabled (do NOT delete; they are not part of the inventory).
  - **SYNCED-FILE TRAP:** `assets/social_ui.js` has a master at `~/bts-automation/social_ui.js`; they must
    be **byte-identical** or `socialuisync` reverts the repo copy. `diff` them; if you ever edit one, edit BOTH.
  - **Databases:** confirm NocoDB + Supabase reachable (OPERATIONS.md §"How to actually reach n8n / NocoDB"
    and §"Supabase"). Respect the DB-permissions rule in OPERATIONS.md.

**D. PAGES CMS QC, both repos.**
  - `.pages.yml` is valid YAML (`python3 -c "import yaml;yaml.safe_load(open('.pages.yml'))"`); every field
    group maps to a real key in its data JSON. RP: the single **"Navigation"** list, **"Event banner (all
    sites)"**, and Footer (no links sub-field) resolve.
  - Round-trip: a CMS edit to `site.json` (e.g. a nav label) shows on all three RP sites; a JC CMS edit
    shows on jackcarlsen.com.
  - Reminder: socials / projects / rentals / color-looks are DB-managed and were REMOVED from the CMS, the
    CMS should only expose hand-edited fields.

**E. INFRA QC.**
  - Both Cloudflare Pages projects' latest deploy succeeded (~1–2 min after push).
  - **KNOWN ISSUE (see 0.5):** bare apex `rarepond.com` 404s deep paths (GoDaddy forwarding, not Cloudflare).
    Needs the DNS move; QC Rare Pond on `www`. Check whether jackcarlsen.com has the same apex/www quirk.
  - Deploy recipe = 0.6 (never commit `tools/_devserve.py`).

**Deliverable of the QC pass:** a short pass/fail report per layer (A–E) with any defect + file/line/job,
and (only if the owner approves) the fixes. Nothing above should be changed silently.

---

## 1. TL;DR, how the whole thing fits together

```
                    ┌─────────────────────────────────────────────────────┐
                    │  SOURCE OF TRUTH FOR THE FILM CATALOGUE              │
                    │  Supabase Postgres  (schema `rp`, table `projects`) │
                    │  edited by a human through NocoDB                   │
                    └───────────────┬─────────────────────────────────────┘
                                    │  every 5 min (server-side schedule)
                                    ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  Python exporter projects_sync.py (com.rarepond.rpprojsync)  │
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
- **Projects (films)** → **NocoDB** (→ Supabase → Python exporter → repo). *Never* edited by hand in the repo.
- **Everything else** → **Pages CMS** (edits `data/*.json` directly in the repo).

---

## 2. Infrastructure & hosts

| Thing | Where | Notes |
|---|---|---|
| Studio site | `www.rarepond.com` | Cloudflare Pages, static, from GitHub `main`. Build ~1–2 min. |
| Repo | `github.com/rarepondstudios/rare-pond-studios` (branch `main`) | **PUBLIC**. Never put secrets/passwords in it or in Pages CMS. |
| Local repo clone | `/Users/rarepondstudios/rp_site_work` | On the always-on **Mac Mini**. Synced across machines + Google Drive via **Synology NAS DS1422+**. |
| NAS (on-device, Finder) | direct network mount | **READ-ONLY**, pull assets only. To *write*, go through Google Drive. |
| NocoDB | Docker container `nocodb` (`nocodb/nocodb:latest`) at `http://localhost:8080` | UI over the external Supabase Postgres. |
| n8n | Docker container `n8n` (`n8nio/n8n:latest`) at `http://localhost:5678` | Automations. Server-side schedules run headless regardless of browser login. |
| Supabase Postgres | hosted, project ref `gnifidmyahtzydwvaegj` | Two schemas in play: `rp` (studio: projects) and `public` (rentals DB). Role `postgres` bypasses RLS. |
| Pages CMS | `app.pagescms.org/rarepondstudios/rare-pond-studios/main` | Edits `data/*.json`, commits to GitHub. |

Both containers run on the Mac Mini. To operate them from a session, use the **Desktop
Commander** MCP (host shell): e.g. `docker restart nocodb`, `git` in the repo. The
sandbox `workspace bash` **cannot** reach `localhost:8080/5678` (different machine), but
it *can* reach the repo mount and the public internet.

> **Access & security (per `OPERATIONS.md`).** `localhost:8080/5678` are correct **only on
> the Mac Mini itself** (loopback). n8n + NocoDB are bound to **loopback + Tailscale only**,
> deliberately NOT reachable over home Wi-Fi or the public internet. Never run
> `tailscale funnel` on them and never rebind to `0.0.0.0`. Exact host/port, the alert email,
> and internal RPC names live **outside the public repo**, in ClickUp → "How To Remote Access" and `~/rp_site_private/REMOTE_ACCESS.md` / `OPERATIONS_PRIVATE.md` on the Mac Mini
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
`text` (or number/checkbox); there are **no array/jsonb columns anymore**, multi-value
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
| `credits` | LongText | **NEW FORMAT, one credit per line, `Role: Name(s)`** (see §7). |
| `bubble_image` | SingleLineText | Carousel bubble image path. |
| `title_logo` | SingleLineText | Title logo PNG. Empty → site falls back to a text `<h2>` title. |
| `focus_bg` | SingleLineText | Film-page background image. |
| `focus_video` | SingleLineText | Reel video path (optional). |
| `stills` | LongText | One image path per line. |
| `sites` | LongText | **Which sites show this project. Must include `rarepond` to appear on the studio site.** One per line. This is the multi-site key (see §11). |
| `roles` | LongText | Jack's roles on the film, one per line. **Note: currently NOT exported to the site JSON**, stored for internal/other use only. |
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

> **SUPERSEDED (verified 2026-08-09).** The projects export moved from n8n to the Python
> exporter `projects_sync.py` on launchd `com.rarepond.rpprojsync` on 2026-08-03
> (`jc_projects_sync.py` / `com.rarepond.jcprojsync` for jackcarlsen). The workflow described
> below no longer exists in n8n; the current pipeline is documented in OPERATIONS.md,
> "The projects pipeline". This section is kept for history because the node-by-node logic
> (filtering, `toArr()`, semantic diff) carried over into the exporter.

**Workflow:** "▶️ Projects: DB to site (rarepond)", id `tAlPhnGm5crTfnrM`.
**Trigger:** Manual + **Schedule every 5 min** (server-side; runs headless even when no
browser is logged in).

**Nodes (in order):**
1. **Get projects**, Postgres SELECT from `rp.projects`.
2. **GitHub: read current `data/projects.json`**.
3. **Build projects.json**, a Code node. Filters to rows where `sites` includes
   `rarepond`, maps each DB row → the site-JSON shape above, and uses a robust `toArr()`
   helper that accepts Postgres arrays **or** JSON **or** newline-text (migration-proof).
   `credits` is passed through **raw** (the website does the formatting). `colorLook`
   defaults to `signature`.
4. **Changed?**, IF node doing a semantic diff (only proceeds if the JSON actually changed).
5. **GitHub: commit** `data/projects.json` → triggers a Cloudflare build.

So: **edit a row in NocoDB → within ~5 min it's committed → ~1–2 min later it's live.**
A brand-new row propagates automatically with no other steps (proven with a test project).

**Other automations that exist** (not the focus here, but part of the ecosystem):
- Rentals intake: **Jotform → HubSpot → Supabase** (bookings/orders sync, overlap guard).
- **Error-alert email** (error-trigger workflow) + a **silence watchdog** (alerts if the
  scheduler goes quiet). SMTP credential configured in n8n. Note: an n8n **error workflow must
  itself be ACTIVE** or it silently does nothing (n8n 2.x), test it by causing a real failure.

> **Recurring trap, the GitHub PAT expires.** n8n commits `projects.json` using a GitHub
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
  line, but watch out, see the cleanup note below).

**On the site (`renderCredits()` in `index.html`, near the watch/social render helpers):**
- If a credit still contains HTML tags → render verbatim (back-compat for legacy/one-off HTML).
- Else split each line on the first `:` → `<b>role</b> names`, joined with `<br>`.
- `{variables}` are supported per line; output is HTML-escaped.

> **CLEANUP NOTE for the next chat:** as of this writing Invalid Opinion's first credit line
> is `Writer & Director Jack Carlsen` (Jack edited it), **no colon**, so it renders
> *un-bolded* while the other lines are bold. If that's unintended, add the colon:
> `Writer & Director: Jack Carlsen`. Worth a quick pass over all films for colon consistency.

---

## 8. Source-of-truth model (important, don't reintroduce dual editing)

- **Films = NocoDB only.** The Pages CMS "Projects" screen is deliberately **not** a
  per-project editor. It holds (a) the four shared `{variable}` text templates and (b) a
  read-only pointer note saying "the film list is in NocoDB." Do **not** wire NocoDB rows
  into per-project Pages CMS entries, that would recreate two places to edit the same
  thing, which we intentionally removed.
- **Templating:** `section-templates.json` holds shared templates (eyebrow, card eyebrow,
  card logline, grid caption). `index.html` fills them per film with `fillVars`/`projVars`.
  Available vars: `{title} {year} {production} {status} {released} {kicker} {tagline}
  {genre} {blurb}`. Empty vars (and a dangling separator like a stray " · ") are dropped.
- **Live preview:** `rarepond.com/admin/preview` (password-protected) renders any template
  against a real film using the *same* fill logic as the site. Keep it in sync with
  `index.html` if you change the fill logic.

---

## 9. index.html (the SPA), how it renders

- Single file, inline CSS + JS. Fetches `/data/*.json` at runtime.
- **Routing:** home `/`; film pages by slugified title (`/invalidopinion`, `/geriaction`,
  `/revelations`); `/projects`, `/team`, `/contact`; custom pages `/<slug>`; `/rentals`
  (sub-site); `/admin/preview`.
- **`SECTIONS`** map is built from `projects.json` (keyed by each project's `key`).
- **Key render helpers** (all near each other, ~lines 1340–1415):
  - `buildWatch()` / `parseWatchLinks()` / `renderWatch()`, one `watch` field, per-line
    YouTube/Vimeo auto-detect; falls back to the `status` line when no link.
  - `detectNet()` / `renderSocials()`, social auto-detect + coloured hover glow.
  - `renderCredits()`, the credits parser (§7).
  - `fillVars()` / `projVars()` / `EYEBROW_TPL`, the `{variable}` templating engine.
- **Escaping helper:** `_wEsc()` (shared by watch/social/credits).

**tools/ (QA):** `validate-projects.mjs`, `smoke-test.mjs`, `check-slugs.mjs` (regenerates
the reserved-slug blocklist for custom pages, run `node tools/check-slugs.mjs --write`
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
| **Supabase RLS** | Public anon key may execute **only** `catalog_availability`. `SECURITY DEFINER` funcs are dangerous, audit after every migration. | `OPERATIONS.md` |
| **Admin auth** | `/admin/*` (preview, colour-looks preview, page directory) gated by HTTP basic auth in `functions/_middleware.js`. Creds via Safari autofill, never in repo. |, |
| **Security/SEO** | `_headers` (HSTS, no-cache on `/data/*`), `_redirects` (SPA rewrites), `robots.txt`, `sitemap.xml`, favicon/apple-touch-icon, `functions/api/client-error.js` error beacon. |, |

---

## 10. The jackcarlsen build-out (next big step)

**The goal (from Jack):** build a **combined jackcarlsen.com** that fuses the *style and build
of rarepond.com* with the *style and build of the current jackcarlsen.com*.

**Current jackcarlsen.com = a Wix site** (`meta-generator: Wix.com Website Builder`). It is
Jack's **personal portfolio**, not a studio site:
- Positioning: "Jack Carlsen | Film Director", Director (Live Action + Animation),
  Cinematographer, Gaffer, VFX Artist/Supervisor. LA / Burbank. BFA Film & TV, LMU.
- Structure: **portfolio collections split by discipline**, Directing, Cinematography,
  Visual Effects (Wix "portfolio-collections/..."), plus a Skills/Software section, an
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
- The **`sites` field** is the multi-site switch, tag films with `jackcarlsen` and a parallel
  export (a second n8n workflow, or a parameterised Build node) writes a jackcarlsen
  `projects.json`. `Corporate` is a third planned site.
- **`roles`** (currently stored but NOT exported) is the natural driver for jackcarlsen's
  **discipline collections** (Director / Cinematographer / VFX / Gaffer). Wiring `roles` into
  the jackcarlsen export + grouping by role is likely a core task.

**Open questions to settle with Jack before building:**
1. Own repo/Cloudflare project for jackcarlsen, or share this repo (route/folder)?
2. Same film DB and asset library, or does jackcarlsen need non-film portfolio pieces
   (cinematography reels, VFX shots) as their own DB rows / a new content type?
3. Per-site look differentiation (see §5 gap), should a film look different on jackcarlsen?
4. Migrate content off Wix manually or scrape/export it first?

**Also planned:** bulk-add many more project entries from info Jack provides, and connect to
the **NAS** to pull additional info/assets (media lives under `/media/...`; NAS on-device mount
is **read-only**, writes go via Google Drive). When bulk-adding: each row needs a unique
`key`, a `title`, `sites` including the target site(s), `placeholder` off, and images under
`/media/projects/<key>/...` (mind the image specs in `.pages.yml` / `STILLS.md`).

---

## 11. Operational gotchas & fixes (hard-won, read before touching NocoDB/n8n)

- **NocoDB "Allow Schema Change"**: normally **OFF** (`is_schema_readonly = 1`). Turn it ON
  *only* to change a field's **type** (uidt). Editing **descriptions** and **row data**
  works fine with it OFF. Turn it back OFF when done.
  - Source flags via API: `GET/PATCH /api/v2/meta/bases/pn8kzophvbwxtt7/sources/<sourceId>`;
    set `is_schema_readonly: true` to lock, `false` to allow.
- **NocoDB API calls hang?** A stuck/orphaned `ALTER` transaction is holding a Postgres
  lock and everything queues behind it. **Fix: `docker restart nocodb`** (drops its
  connections → Postgres rolls back the orphaned txn → locks release). Then retry.
  - When changing types that trigger a real `ALTER` (e.g. SpecificDBType/JSON → LongText),
    give the request a generous timeout and let it **complete**, aborting early orphans a
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

### Mistakes made THIS session, do NOT repeat

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
  store to a `window` var and read it in a **separate** call.
- **Build newline values with `String.fromCharCode(10)`** in browser JS / find-replace to avoid
  backslash-escaping surprises.
- **`raw.githubusercontent.com` and the live site cache.** After an n8n commit, a bare curl may
  show stale JSON for a bit, trust `git pull` / a cache-busting `?_=timestamp`.
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
  isn't immutable fails as a generated column, use a trigger instead (and remember to remove
  the trigger once the need is gone).

### Cross-reference

`OPERATIONS.md` → "Things that have bitten us" covers the site/rentals traps (Cloudflare 308 on
`/foo.html`, blur/box-shadow re-raster perf trap, first-paint-before-data, Jotform DELETED
submissions, frozen intake cursor, don't disable native Jotform integrations). Read it before
touching the SPA, the rentals pipeline, or Supabase functions (RLS / `SECURITY DEFINER` audit).

---

## 12. Current live state (2026-07-16)

- 3 films + 1 placeholder in the catalogue:
  - `geri`, Geri-Action (`/geriaction`)
  - `rev`, Revelations (`/revelations`)
  - `invalid`, Invalid Opinion (`/invalidopinion`)
  - `more`, "More to come…" (placeholder)
- All field **types** conformed to the single-vs-multi rule; "Allow Schema Change" is OFF.
- **Credits** migrated to the new `Role: Names` format on all films and rendering live.
  (Jack removed the "Loyola Marymount University" line himself; and reworded Invalid's first
  line, see the colon cleanup note in §7.)
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

## 14. Appendix, IDs & endpoints

- Repo: `github.com/rarepondstudios/rare-pond-studios` (branch `main`).
- Supabase project ref: `gnifidmyahtzydwvaegj` (schema `rp`, table `projects`).
- NocoDB: `http://localhost:8080`, base `pn8kzophvbwxtt7`, table `m765vzpp8kve3wc`.
  - Token: `POST /api/v1/auth/token/refresh` (credentials: include) → use as `xc-auth` header.
  - Records: `GET/POST/PATCH/DELETE /api/v2/tables/m765vzpp8kve3wc/records`.
  - Columns/meta: `/api/v2/meta/tables/m765vzpp8kve3wc`, `/api/v2/meta/columns/<id>`.
- n8n: `http://localhost:5678`, projects workflow id `tAlPhnGm5crTfnrM`.
- Containers on the Mac Mini: `nocodb`, `n8n` (both `docker restart`-able via Desktop Commander).
- Existing docs to read next: `README.md`, `OPERATIONS.md`, `CUSTOM_PAGES.md`, `STILLS.md`.

---

## 15. jackcarlsen.com, build kickoff (infra is READY)

**Goal:** build the *combined* jackcarlsen.com, the aesthetic/assets of the current
(Wix) personal portfolio, rebuilt on the **same custom stack as rarepond** (static Cloudflare
Pages SPA, film data from the shared NocoDB/Supabase DB via the `sites` field), with a Pages
CMS behind it for the non-DB copy.

### 15.1 READ THIS FIRST: the existing plan
`JACKCARLSEN-ROADMAP.md` (in this folder, next to HANDOFF.md) is **Roadmap v2** from a prior
session, the full strategy: shared DB as source of truth for 3 sites (rarepond / jackcarlsen /
corporate), render-agnostic data model, **role-based filtering** for jackcarlsen's discipline
collections, per-site presentation overrides, and a feature-carryover matrix. **Read it.**

`JACKCARLSEN-BRIEF.md` (same folder) is the **desired new homepage layout** Jack specified:
the interactive hero showreel + synced bubble selector, About, the auto-scrolling **poster
wall** ("What I've Been Working On"), and the CMS-managed **BTS collage**, plus the new DB
fields those require (`jc_in_carousel`, `jc_in_workwall`, `poster_image`, `hero_clip`).
**Read it too, it's the build spec.**

> **Reconcile the roadmap against what actually shipped (it's ahead of reality in places):**
> - The roadmap proposes a nested `perSite` object (`perSite.jackcarlsen.colorLook`,
>   `renderStyle`, `featured`, …). **The shipped DB flattened per-site flags to single columns**
>   (`rp_color_look`, `rp_bubble_glow`, `rp_in_carousel`), so **per-site differentiation is NOT
>   built yet**. If jackcarlsen needs a different look/render than rarepond for the same film,
>   that's real work (re-introduce per-site overrides). Decide with Jack.
> - The roadmap lists fields since removed/renamed (`subtitle`, `cardLogline`, `disciplines`,
>   `chips`→`genre`). **Trust §5 of THIS doc / the live NocoDB schema for current field names.**

### 15.2 Infrastructure, DONE and verified live
- **GitHub:** `github.com/Jackjrrc/jackcarlsen-website` (Jack's **personal** account, private).
  A `gh auth login` credential for `Jackjrrc` (scopes `repo`,`workflow`) is in the Mac keychain,
  so host-side `git push` works.
  - **Dual-account gotcha:** this Mac's `gh` keyring now holds **two** accounts, `Jackjrrc`
    (personal) and `rarepondstudios` (studio). `git push` uses the **active** one.
    `rarepondstudios` is the default active account (needed for the rare-pond repo). **To push to
    the jackcarlsen repo, first run `gh auth switch --user Jackjrrc`**, push, then
    `gh auth switch --user rarepondstudios` to restore the default. Pushing to the wrong repo
    with the wrong active account fails with a 403.
- **Cloudflare:** a **separate personal Cloudflare account** (accounts@jackcarlsen.com,
  acct id `c8bba86c59f46ac9e4421e25c86ca077`) with a **Pages** project `jackcarlsen-website`
  connected to the repo. **It is Pages, not Workers**, required for `_headers`, `_redirects`,
  and Pages Functions (`/admin` auth), exactly like rarepond.
- **Live URL:** **https://jackcarlsen.com** (apex, canonical, DNS cut over 2026-08-04; the
  `.pages.dev` URL still works as the deployment host). **Auto-deploy on push to `main`** is wired.
- **Local clone:** `/Users/rarepondstudios/jackcarlsen-website` (scaffold: placeholder
  `index.html`, `README.md`, `.gitignore`, `data/projects.json` = `{"projects":[]}`).
- **Domain:** ✅ **CUT OVER (2026-08-04):** `jackcarlsen.com` (apex, canonical) + `www` now resolve
  to the Cloudflare Pages project and serve the new site; www 301s to the apex via `_redirects`.
  The old Wix site is fully retired.

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
- **Current Wix site content/media source:** https://www.jackcarlsen.com (Wix, JS-rendered;
  media served from `static.wixstatic.com`). See 15.5.

> NAS mount can drop; if `/Volumes/RarePondNAS` is missing, ask Jack to reconnect it in Finder.
> Confirm the exact per-film subfolders before referencing paths, names above are the top level.

### 15.4 Current Wix site, snapshot (verify by deep-dive, see 15.5)
"Jack Carlsen | Film Director", LA/Burbank; Director (Live Action + Animation),
Cinematographer, Gaffer, VFX Artist/Supervisor; BFA Film & TV, LMU. Nav: **Portfolio,
Directing, Cinematography, Visual Effects, Skills, Contact** (portfolio split by discipline).
Has an About/bio, a résumé PDF link, a "What I've Been Working On" image grid, and social
links (YouTube @RarePondStudio, Vimeo /zytopian, Instagram @jackjrrc, LinkedIn). Footer:
"Let's Make Something Amazing…". Fonts/colors: pull from Wix (see below).

### 15.5 Pre-build checklist (do before the single-run build chat)
1. **Tag the DB:** in NocoDB, add `jackcarlsen` to `sites` for every project/piece that belongs
   on the personal site, and fill each row's **`roles`** (Director / Cinematographer / VFX /
   Gaffer), that drives the discipline collections. Add any non-film portfolio rows.
2. **Decide the export path** for jackcarlsen's `projects.json`: a **2nd n8n workflow** (filter
   `sites` includes `jackcarlsen`, commit to this repo, needs a GitHub token for the personal
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
- **Wix MCP connector, CONNECTED & WORKING** (verified this session). `ListWixSites` returns
  the site **"Jack Carlsen Website"**, **site id `a7f0f9a8-3869-4ff6-929e-c5042e928e05`**.
  Use `CallWixSiteAPI` (after `WixREADME` / `SearchWixRESTDocumentation` to get endpoints) to
  pull the page list, each page's content, the media library, and site Design (fonts/colors).
  This is the cheapest, most complete route, **recommended as the build chat's first step**
  (fresh context), rather than a screenshot crawl.
- Fallback: `web_fetch` each public page (`/vfxartist`, `/portfolio-collections/directing-portfolio`,
  `/portfolio-collections/cinematography-portfolio`, `/portfolio-collections/visual-effects-portfolio`)
  for readable copy, but it can't see the media library, fonts, or colors like the API can.
- Last resort: guided editor walk-through (Design/Theme + Media Manager), slow, screenshot-heavy.
```
