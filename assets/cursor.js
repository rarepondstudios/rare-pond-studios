/* ============================================================================
   Rare Pond / Jack Carlsen — SHARED custom cursor  (assets/cursor.js)
   ----------------------------------------------------------------------------
   ONE source of truth for BOTH sites. Master lives in bts-automation/cursor.js
   and is published to each repo's assets/cursor.js by social_ui_sync.py
   (launchd com.rarepond.socialuisync). Edit the master, both sites update.

   WHAT IT IS
   A glowing gradient RING that replaces the mouse (desktop / fine pointers
   only), with a small dot that tracks the real pointer position 1:1:
     - FREE: a 50px open ring (clear gap between the centre dot and the band,
       same silhouette as the loading orbit but solid) trails the dot with
       smoothing and squashes/stretches into an oval along the direction of
       fast movement — relaxing back to a circle at rest.
     - HOVER (iPadOS-style): over ordinary interactive elements (buttons, links,
       cards) the ring snaps DIRECTLY onto the element's border box + radius (no
       offset drift — the outline is attached to the edges) while the element
       itself warps in perspective toward the mouse. SPECIAL objects — project
       bubbles / large circular instances, plus wordmarks tagged
       data-cursor="glow"/"special" — never get the ring outline: the ring's
       colour FADES OUT (glow "transfers" to the object) while the OBJECT reacts
       (its own native glow/tilt if it has one, else cursor-driven tilt+scale),
       and fades back in on leave. While ANY element is engaged, a faint
       auto-contrast ghost ring (60% dot opacity) marks the pointer position.
     - KEYBOARD: from a hover context, arrow keys move the selection spatially
       between interactive elements (the hug/reaction travels), Enter activates;
       the first real mouse move hands control back to the pointer.
     - LOADING: while a long transition covers the page (cross-site wipe, social
       transport, JC transport, the initial load veil) the circle is replaced by
       a WHITE orbiting arc with a trail around the dot; it restores after.

   STANDARDIZED INTERACTIVE DETECTION (future-proof — new buttons "just work"):
   an element is interactive if it matches the SEL list (a[href], button, form
   controls, [role=button], summary, [data-cursor="link"]) OR any of its first 5
   ancestors computes cursor:pointer. Opt out per element: data-cursor="off".
   Text fields keep the native I-beam (the ring dims instead of morphing).
   Oversized targets (bigger than ~60% of the viewport axis) never morph, so a
   full-bleed link can't become a screen-sized blob.

   CMS CONTROL (per site / sub-site, data/site.json → cursor):
     Rare Pond: cursor.studio / cursor.rentals / cursor.media (surface = path)
     Jack Carlsen: cursor at the top level.
     Each: { enabled: true|false, colorLook: "<look key or name>" } —
     colours come from that look's c1/c2/c3 in data/colorlooks.json (default =
     the site's own "signature" look, so JC is automatically purple).

   PERFORMANCE CONTRACT: 3 tiny fixed elements, transform-driven, one rAF loop
   that pauses when the tab is hidden or the mouse has been idle; no filters,
   no per-frame layout except one getBoundingClientRect while morph-hovering.
   Disabled entirely on touch/coarse pointers and under prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__rpCursor) return;
  window.__rpCursor = true;

  var FINE = false, RM = false;
  try {
    FINE = window.matchMedia && matchMedia("(pointer:fine)").matches;
    RM = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  } catch (e) {}
  if (!FINE || RM) return;

  /* ---- which sub-site is this? (rarepond serves three surfaces from one repo) */
  function surface() {
    var p = location.pathname || "/";
    if (p.indexOf("/rentals") === 0) return "rentals";
    if (p.indexOf("/media") === 0) return "media";
    return "studio";
  }

  /* ---- colour helpers ---------------------------------------------------- */
  function rgba(hex, a) {
    var h = (hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return "rgba(63,107,255," + a + ")";
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  /* ---- config + colours, then boot --------------------------------------- */
  var COL = { c1: "#3f6bff", c2: "#9b5cff", c3: "#56c8ff" };
  function j(u) { return fetch(u).then(function (r) { return r.json(); }).catch(function () { return null; }); }
  Promise.all([j("/data/site.json"), j("/data/colorlooks.json")]).then(function (res) {
    var site = res[0] || {}, cl = res[1] || {};
    var c = site.cursor || {};
    var mine = c[surface()] || ((c.enabled !== undefined || c.colorLook) ? c : {});
    if (mine.enabled === false) return;
    var want = (mine.colorLook || "signature").toLowerCase();
    var looks = cl.looks || [];
    var pick = null, sig = null;
    for (var i = 0; i < looks.length; i++) {
      var k = (looks[i].key || "").toLowerCase(), nm = (looks[i].name || "").toLowerCase();
      if (k === "signature") sig = looks[i];
      if (k === want || nm === want) pick = looks[i];
    }
    pick = pick || sig;
    if (pick) COL = { c1: pick.c1 || COL.c1, c2: pick.c2 || COL.c2, c3: pick.c3 || COL.c3 };
    boot();
  });

  /* ---- boot --------------------------------------------------------------- */
  function boot() {
    var css =
      "html.rpc-on,html.rpc-on *{cursor:none!important}" +
      /* text fields keep the native I-beam so typing still feels right */
      "html.rpc-on textarea,html.rpc-on [contenteditable=''],html.rpc-on [contenteditable='true']," +
      "html.rpc-on input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]){cursor:text!important}" +
      /* display:contents: the wrapper must NOT create a stacking context, so the dot's
         mix-blend-mode can blend against the PAGE (auto black/white contrast). */
      "#rp-cursor{display:contents}" +
      ".rpc-ring{position:fixed;left:0;top:0;width:50px;height:50px;border-radius:50%;z-index:2147483644;pointer-events:none;opacity:0;will-change:transform;" +
      "-webkit-backdrop-filter:blur(1.3px) saturate(1.2);backdrop-filter:blur(1.3px) saturate(1.2);" +   /* liquid-glass: subtle distortion under the orb */
      "box-shadow:0 0 14px -3px " + rgba(COL.c1, .55) + ",inset 0 0 9px -3px " + rgba(COL.c2, .40) + ";" +   /* the ring band GLOWS both outward and inward */
      "transition:width .22s cubic-bezier(.3,.9,.3,1),height .22s cubic-bezier(.3,.9,.3,1),border-radius .22s cubic-bezier(.3,.9,.3,1),opacity .16s ease}" +
      /* tracking = the hugged ELEMENT itself is in motion (carousel rotation) — the ring is
         glued to it per-frame, so its own size transitions must not fight the element's */
      ".rpc-ring.tracking{transition:opacity .16s ease}" +
      "#rp-cursor.on .rpc-ring{opacity:1}" +
      /* SPECIAL objects (category tabs / bubbles / wordmarks): the ring's colour FADES OUT as the
         object's own glow fades in — the glow visibly "transfers" to the object — leaving only the
         faint ghost ring (.rpc-mini) at the pointer. Fades back in when the pointer leaves. */
      "#rp-cursor.on .rpc-ring.faded{opacity:0}" +
      ".rpc-ring.hover,.rpc-ring.faded{-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none}" +   /* no blur / free-ring glow once snapped to an element */
      /* two stacked skins that crossfade: glowing open ring (free) vs hug-fill (hover) */
      ".rpc-glow,.rpc-fill{position:absolute;inset:0;border-radius:inherit;transition:opacity .18s ease}" +
      /* FREE state: an OPEN RING — solid gradient band at the rim (loader silhouette, not animated),
         clear empty gap between the band and the centre dot. Band = feathered radial mask. */
      ".rpc-glow{background:conic-gradient(from 210deg," + rgba(COL.c1, .95) + "," + rgba(COL.c2, .95) + "," + rgba(COL.c3, .95) + "," + rgba(COL.c1, .95) + ");" +
      "-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 6.5px),#000 calc(100% - 4px),#000 calc(100% - 2px),transparent calc(100% - .25px));" +
      "mask:radial-gradient(farthest-side,transparent calc(100% - 6.5px),#000 calc(100% - 4px),#000 calc(100% - 2px),transparent calc(100% - .25px))}" +
      ".rpc-fill{opacity:0;background:" + rgba(COL.c1, .10) + ";box-shadow:0 0 18px -4px " + rgba(COL.c2, .55) + "}" +
      /* hug BORDER: a 3px band that inherits the page's colour-look gradient. The xor-mask
         (content-box vs full box) leaves only the border band visible at any border-radius. */
      ".rpc-bord{position:absolute;inset:0;border-radius:inherit;opacity:0;transition:opacity .18s ease;padding:3px;" +
      "background:conic-gradient(from 140deg," + COL.c1 + "," + COL.c2 + "," + COL.c3 + "," + COL.c1 + ");" +
      "-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;" +
      "mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}" +
      ".rpc-ring.hover .rpc-glow{opacity:0}.rpc-ring.hover .rpc-fill{opacity:1}.rpc-ring.hover .rpc-bord{opacity:1}" +
      "#rp-cursor.on .rpc-ring.textish{opacity:.3}" +
      ".rpc-dot{position:fixed;left:0;top:0;width:5px;height:5px;border-radius:50%;z-index:2147483646;pointer-events:none;opacity:0;will-change:transform;" +
      "background:#fff;mix-blend-mode:difference;transition:opacity .15s ease}" +   /* difference vs the page = always contrasts (white on dark, black on light) */
      "#rp-cursor.on .rpc-dot{opacity:1}" +
      /* while the ring is HUGGING an element, a faint ghost ring stays at the dot marking where
         the circle collapses back to. Same auto-contrast treatment as the dot (difference blend),
         60% of the dot's opacity; fades away when the hug releases and the coloured ring returns. */
      ".rpc-mini{position:fixed;left:0;top:0;width:50px;height:50px;border-radius:50%;z-index:2147483646;pointer-events:none;opacity:0;will-change:transform;" +
      "border:1.5px solid #fff;mix-blend-mode:difference;transition:opacity .2s ease}" +
      "#rp-cursor.on.hugging .rpc-mini{opacity:.6}" +
      /* keyboard-engaged element: our hug IS the focus indicator — kill the browser's default
         (square/irregular) focus outline on that element only. */
      ".rpc-kbsel{outline:none!important}.rpc-kbsel:focus,.rpc-kbsel:focus-visible{outline:none!important}" +
      ".rpc-loader{position:fixed;left:0;top:0;width:44px;height:44px;border-radius:50%;z-index:2147483645;pointer-events:none;opacity:0;will-change:transform;" +
      "background:conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,.14) 200deg,rgba(255,255,255,.95) 345deg,rgba(255,255,255,0) 350deg);" +
      "-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px));" +
      "mask:radial-gradient(farthest-side,transparent calc(100% - 2.5px),#000 calc(100% - 2px));" +
      "animation:rpc-spin .8s linear infinite;transition:opacity .18s ease}" +
      "#rp-cursor.loading .rpc-loader{opacity:1}#rp-cursor.loading .rpc-ring{opacity:0}" +
      "@keyframes rpc-spin{from{transform:var(--rpc-lt,translate(-50%,-50%)) rotate(0deg)}to{transform:var(--rpc-lt,translate(-50%,-50%)) rotate(360deg)}}";
    var st = document.createElement("style");
    st.id = "rp-cursor-css";
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);

    var root = document.createElement("div");
    root.id = "rp-cursor";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = '<div class="rpc-ring"><div class="rpc-glow"></div><div class="rpc-fill"></div><div class="rpc-bord"></div></div><div class="rpc-loader"></div><div class="rpc-mini"></div><div class="rpc-dot"></div>';
    document.body.appendChild(root);
    document.documentElement.classList.add("rpc-on");

    var ring = root.querySelector(".rpc-ring"),
        dot = root.querySelector(".rpc-dot"),
        mini = root.querySelector(".rpc-mini"),
        ldr = root.querySelector(".rpc-loader");

    /* ---- state ---- */
    var mx = -100, my = -100;          // real pointer
    var rx = -100, ry = -100;          // smoothed ring centre
    var pmx = -100, pmy = -100;        // previous pointer (velocity)
    var kS = 0, kV = 0, angS = 0;      // springy stretch (value + velocity) + angle
    var hoverEl = null, hoverRad = 14, hoverPct = false, hoverRadY = 0, hoverSpecial = false, hoverPad = 0, textish = false;
    var tiltEl = null, tiltOrig = "", tiltBase = "", tiltScale = 1;  // tilted element, its original inline transform, its computed base matrix, extra scale
    var tiltP = 0, tiltNx = 0, tiltNy = 0;  // ease-in progress + last tilt direction (for the ease-out)
    var relEls = [];                   // elements easing BACK to rest after hover-off (fluid shrink)
    /* RELEASE TRAVEL: on hug→free the outline must TRAVEL from the button to the dot while it
       shrinks (0.22s CSS size transition), never snap centered on the dot first — a snap makes
       the still-large outline appear to expand AWAY from the button (the "glitch"). While
       travT>0 the ring centre is eased from the release point to the live pointer, and the
       containment clamp + velocity stretch are suspended so nothing can yank it off the path. */
    var travT = 0, travX = 0, travY = 0;
    /* ELEMENT-MOTION TRACKING: >0 while the hugged element itself is moving/resizing (a
       carousel rotation carrying the selection to centre). The ring is glued to it —
       no easing lag, no CSS size transition — so the outline conforms every frame. */
    var trackN = 0;
    var hoverAttrSp = false, hoverKb = false;   // last applyHover args, for the settled-size re-scan
    var clearT = null;                 // hover-out grace timer (kills the between-buttons flash)
    var shown = false, loading = false, loadSince = 0, down = false;
    var idleFrames = 0, running = false, frame = 0;
    var kbActive = false;              // keyboard spatial-nav owns the selection until the mouse moves
    var kbSelEl = null;                // element carrying .rpc-kbsel (site CSS mirrors its hover glow; UA outline suppressed)

    function show() { if (!shown) { shown = true; root.classList.add("on"); } }
    function hide() { if (shown) { shown = false; root.classList.remove("on"); } }

    /* ---- pointer tracking ---- */
    addEventListener("mousemove", function (e) {
      /* REAL movement hands control back to the pointer. Chrome also fires a SYNTHETIC
         mousemove (same coordinates) whenever content shifts under a stationary cursor —
         e.g. a carousel rotating — which must NOT cancel an active keyboard selection. */
      if (kbActive && (Math.abs(e.clientX - mx) > 3 || Math.abs(e.clientY - my) > 3)) { kbActive = false; kbSynth(null); }
      mx = e.clientX; my = e.clientY;
      show(); wake();
    }, { passive: true });
    document.addEventListener("mouseleave", hide);
    addEventListener("blur", hide);
    /* hybrid devices (touchscreen laptops): a finger tap must never fight the custom cursor —
       hide it on touch and let the tap behave 100% natively (we never intercept clicks anyway). */
    addEventListener("touchstart", function () { applyHover(null, false); hide(); }, { passive: true });
    addEventListener("mousedown", function () { down = true; wake(); }, { passive: true });
    addEventListener("mouseup", function () { down = false; wake(); }, { passive: true });

    /* ---- standardized interactive detection ---- */
    var SEL = "a[href],button,[role='button'],input,select,textarea,label,summary,[data-cursor~='link'],[onclick]";
    /* data-cursor is a space-separated token list — e.g. data-cursor="special notilt" */
    function dcHas(el, word) {
      var v = "";
      try { v = el.getAttribute("data-cursor") || ""; } catch (_) {}
      return (" " + v + " ").indexOf(" " + word + " ") > -1;
    }
    var TEXT_RE = /^(text|search|email|url|password|tel|number|date|time|datetime-local|month|week)$/i;
    function isTextField(el) {
      var t = el.tagName;
      if (t === "TEXTAREA") return true;
      if (t === "INPUT") { var ty = el.getAttribute("type") || "text"; return TEXT_RE.test(ty); }
      if (el.isContentEditable) return true;
      return false;
    }
    document.addEventListener("pointerover", function (e) {
      if (e.isTrusted === false) return;  /* our own kb-parity synthetic hover events must never loop back */
      if (kbActive) return;            /* scrolling under a stationary mouse fires pointerover — don't let it steal a keyboard selection */
      var t = e.target;
      if (!t || t.nodeType !== 1) { queueClear(false); return; }
      /* Cross-origin embeds (HubSpot / Jotform forms) own the pointer — the browser stops
         reporting the mouse inside them, so the custom cursor HANDS OFF: unmorph + fade out
         immediately (never parks at the edge), native cursor takes over inside the form,
         and ours fades back in on the first move outside. A watchdog in tick() catches the
         cases where the crossing event never fires. */
      if (t.tagName === "IFRAME" || t.tagName === "OBJECT" || t.tagName === "EMBED") { applyHover(null, false); hide(); return; }
      var el = null;
      try { el = t.closest(SEL); } catch (_) {}
      if (!el) {
        /* fallback: anything styled cursor:pointer counts — future components auto-adhere */
        var n = t, i = 0;
        while (n && n.nodeType === 1 && i < 5) {
          try { if (getComputedStyle(n).cursor === "pointer") { el = n; break; } } catch (_) { break; }
          n = n.parentElement; i++;
        }
      }
      if (el && dcHas(el, "off")) el = null;
      var txt = false;
      if (el && isTextField(el)) { txt = true; el = null; }
      var attrSp = false;
      if (el) {
        attrSp = dcHas(el, "glow") || dcHas(el, "special");   /* "glow" kept for back-compat markup */
        var r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || (!attrSp && (r.width > innerWidth * .62 || r.height > innerHeight * .62))) el = null;
      }
      if (el) applyHover(el, txt, attrSp); else queueClear(txt);
      wake();
    }, true);

    /* Hover-out GRACE: when the pointer leaves one target, wait ~120ms before relaxing to the
       circle. Crossing the small gap between two adjacent buttons then morphs DIRECTLY from
       one rectangle to the next — no shrink-to-circle blink in between. */
    function queueClear(txt) {
      textish = !!txt;
      ring.classList.toggle("textish", textish);
      if (!hoverEl || clearT) return;
      clearT = setTimeout(function () { clearT = null; applyHover(null, textish); }, 120);
    }
    function releaseTilt() {
      /* fluid shrink-out: the element eases back to rest over ~12 frames instead of popping */
      if (!tiltEl) return;
      if (tiltP > .04) {
        relEls.push({ el: tiltEl, orig: tiltOrig, base: tiltBase, scale: tiltScale, p: tiltP, nx: tiltNx, ny: tiltNy });
        if (relEls.length > 3) { var old = relEls.shift(); try { old.el.style.transform = old.orig; } catch (_) {} }
      } else { try { tiltEl.style.transform = tiltOrig; } catch (_) {} }
      tiltEl = null; tiltP = 0;
    }
    /* HUG SHAPE SCAN: strongest border-radius among the element and its near-full-size
       descendants (2 levels) — the visible rounding often lives on an inner card (project
       bubble > circular image). Layers marked data-cursor~="noscan" (decorative cast-shadow /
       glow OVALS sitting behind the visible surface, e.g. the RP carousel's .cdrop/.cglow)
       never drive the outline: the outline must parallel the VISIBLE edge, not a backdrop.
       Elliptical %-radii ("13% 20%") are captured on both axes for an exact match, and the
       scan is re-run while a hugged element is in motion so an animated border-radius
       (.cbub's 50% → 13%/20% morph) is followed frame by frame. */
    function scanShape(el) {
      var best = { px: 0, pct: false, py: 0 }, rr = null;
      try { rr = el.getBoundingClientRect(); } catch (_) {}
      function takeRad(node) {
        if (dcHas(node, "noscan")) return;
        try {
          var raw = getComputedStyle(node).borderTopLeftRadius || "";
          var parts = raw.split(/\s+/);
          var v = parseFloat(parts[0]) || 0, p = raw.indexOf("%") > -1;
          if (p) {
            if (v >= best.px) best.py = parseFloat(parts[1]) || v;
            best.px = Math.max(best.px, v);
            best.pct = true;
          } else if (!best.pct && v > best.px) best.px = v;
        } catch (_) {}
      }
      takeRad(el);
      if (rr && rr.width) {
        var kids = el.children, i, j, k, kr;
        for (i = 0; i < kids.length && i < 6; i++) {
          k = kids[i];
          if (dcHas(k, "noscan")) continue;
          try { kr = k.getBoundingClientRect(); } catch (_) { continue; }
          if (kr.width >= rr.width * .8 && kr.height >= rr.height * .8) takeRad(k);
          var gk = k.children;
          for (j = 0; j < gk.length && j < 6; j++) {
            if (dcHas(gk[j], "noscan")) continue;
            try { var gr = gk[j].getBoundingClientRect(); if (gr.width >= rr.width * .8 && gr.height >= rr.height * .8) takeRad(gk[j]); } catch (_) {}
          }
        }
      }
      hoverRad = best.px;
      hoverPct = best.pct;
      hoverRadY = best.pct ? best.py : 0;
      return { best: best, rr: rr };
    }
    function applyHover(el, txt, attrSp, kb) {
      if (clearT) { clearTimeout(clearT); clearT = null; }
      textish = !!txt;
      ring.classList.toggle("textish", textish);
      if (el === hoverEl && !!kb === hoverKb) return;   /* re-enter when kb takes over a mouse hover: specials convert to a conforming kb hug */
      releaseTilt();
      if (kbSelEl && kbSelEl !== el) { try { kbSelEl.classList.remove("rpc-kbsel"); } catch (_) {} kbSelEl = null; }
      /* hug → free: start the release travel from the outline's CURRENT centre (the element),
         so the shrinking outline glides back to the dot. Specials were already at the pointer. */
      if (!el && hoverEl && !hoverSpecial) { travT = 1; travX = rx; travY = ry; }
      else if (el) travT = 0;
      hoverEl = el;
      hoverSpecial = false;
      hoverPad = 0;
      hoverAttrSp = !!attrSp; hoverKb = !!kb;
      trackN = 0; try { ring.classList.remove("tracking"); } catch (_) {}
      if (el) {
        var sres = scanShape(el);
        var best = sres.best, rr = sres.rr;
        /* SPECIAL objects never get the ring outline — the object reacts instead.
           Auto: any large circular target (project bubbles / carousel side circles / JC hbubs;
           % radius ≥45 and ≥64px). Explicit: data-cursor="glow" (wordmarks) or "special".
           Force the outline back on a big circle if ever needed: data-cursor="link" + a
           non-% radius, or ask — small circles (social icons) keep the outline. */
        hoverSpecial = !!attrSp || (best.pct && best.px >= 45 && rr && rr.width >= 64 && rr.height >= 64);
        /* KEYBOARD engagement: the hug IS the focus indicator, so specials hug too — the shape
           CONFORMS (bubbles → encompassing circle via the %-radius scan; irregular logos → a
           consistent rounded rectangle with breathing room) instead of the browser's square
           outline, and the object's own selection glow is mirrored via .rpc-kbsel site CSS. */
        if (kb && hoverSpecial) {
          if (dcHas(el, "kbnative")) {
            /* kbnative: the OBJECT renders its own keyboard indicator (a site layer shown by
               .rpc-kbsel, e.g. the RP project bubbles' .kbring sitting BENEATH their logo) —
               the engine's fixed-layer ring would paint OVER page chrome like logos, so it
               stays faded exactly like a mouse-hovered special. */
          } else {
            hoverSpecial = false;
            if (!best.pct) { hoverRad = 16; hoverPad = 6; hoverRadY = 0; }
          }
        }
        /* Engaged states — in BOTH the glow reads as "transferred" to the object, and the faint
           ghost ring (.rpc-mini) marks the pointer:
           - ordinary elements: ring MORPHS onto the element ("hover" hug)
           - special elements (mouse): ring keeps its shape but its colour FADES OUT ("faded")
             while the object's own glow/reaction fades in; it fades back in on leave. */
        ring.classList.toggle("hover", !hoverSpecial);
        ring.classList.toggle("faded", hoverSpecial);
        root.classList.add("hugging");
        hoverPad = hoverPad || parseFloat(el.getAttribute("data-cursor-pad")) || 0;   /* extra breathing room around the hug (footer nav links) */
        /* social icons (a[data-net], every site) get default breathing room so their circles
           never read tighter than the rest of the hug outlines */
        if (!hoverPad) { try { if (el.matches && el.matches("a[data-net]")) hoverPad = 5; } catch (_) {} }
        /* ELEMENT REACTION (like the home-page bubbles): perspective tilt toward the mouse.
           Ownership rules: if the element natively drives its own tilt (defines --tiltx —
           the RP bubbles do, in CSS or via their pointermove handlers), the cursor stays
           hands-off so the two never fight. If it's inline-transform-driven by other JS,
           also hands-off. Otherwise the cursor tilts it, COMPOSITING on top of the element's
           computed base transform (so transform-positioned elements never jump), and specials
           additionally scale up slightly. Opt out: data-cursor="notilt". */
        if (!dcHas(el, "notilt") && !kb) {   /* keyboard has no pointer to tilt toward — site .rpc-kbsel CSS provides the reaction */
          /* if this element was mid-ease-out (re-entered quickly), adopt it back with its
             progress + its ORIGINAL base/orig (its current inline transform is our own). */
          var fromRel = null, ri;
          for (ri = relEls.length - 1; ri >= 0; ri--) {
            if (relEls[ri].el === el) { fromRel = relEls[ri]; relEls.splice(ri, 1); }
          }
          if (fromRel || !(el.style.transform || "").length) {
            var native = "";
            try { native = (getComputedStyle(el).getPropertyValue("--tiltx") || "").trim(); } catch (_) {}
            var bm = "";
            try { bm = getComputedStyle(el).transform || ""; } catch (_) {}
            if (!native && (fromRel || !bm || bm === "none")) {
              /* transform-POSITIONED elements (carousel items etc.) are hands-off: their
                 stylesheet transform can change while engaged (a rotation shifting them), and a
                 baked inline matrix would PIN them at the old spot. Their own hover CSS reacts. */
              tiltEl = el;
              tiltP = fromRel ? fromRel.p : 0;
              tiltOrig = fromRel ? fromRel.orig : (el.style.transform || "");
              tiltBase = fromRel ? fromRel.base : "";
              tiltScale = hoverSpecial ? (attrSp ? 1.08 : 1.05) : 1;
            } else if (fromRel) { try { el.style.transform = fromRel.orig; } catch (_) {} }
          }
        }
      } else {
        ring.classList.remove("hover");
        ring.classList.remove("faded");
        root.classList.remove("hugging");
        if (kbSynthEl) kbSynth(null);   /* full disengage (Escape / iframe / touch): release the synthetic hover too */
      }
    }
    function setHover(el, txt) { applyHover(el, txt, false); }   /* back-compat internal alias */

    /* ---- KEYBOARD SPATIAL NAVIGATION -------------------------------------------------
       Engages from a hover context: with the pointer over an interactive element (stills
       grid, buttons, bubbles...), the ARROW KEYS move the selection to the nearest
       interactive element in that direction — the hug outline / object reaction travels
       with it — and ENTER activates it. The selected element also receives real focus
       (accessibility + native Enter on links/buttons). The first genuine mouse move hands
       control back to the pointer. Arrows scroll the page normally when no element is
       engaged; typing in text fields is never intercepted. */
    /* KB HOVER PARITY: sites tie real behaviour (preview-reel play/pause on the JC wall and the
       RP bubbles, marquee pausing, tilt resets) to genuine hover EVENTS on the element — so the
       keyboard selection mirrors them with synthetic enter/leave events. They are untrusted
       (isTrusted=false) and our own delegated listeners skip those, so nothing loops back. */
    var kbSynthEl = null;
    function kbFire(el, type, bub) {
      try {
        var r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent(type, { bubbles: !!bub, cancelable: true, view: window,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      } catch (_) {}
    }
    function kbSynth(el) {
      if (kbSynthEl === el) return;
      if (kbSynthEl) { kbFire(kbSynthEl, "pointerleave", false); kbFire(kbSynthEl, "mouseout", true); kbFire(kbSynthEl, "mouseleave", false); }
      kbSynthEl = el;
      if (el) { kbFire(el, "pointerover", true); kbFire(el, "pointerenter", false); kbFire(el, "mouseover", true); kbFire(el, "mouseenter", false); }
    }
    /* Keyboard candidates are broader than mouse targets:
       - [tabindex="0"] joins in (kb-only stops like the RP "More to come" bubble — the mouse
         detector still ignores them unless they match SEL / cursor:pointer);
       - data-cursor="off" only excludes kb when the element is NOT explicitly interactive:
         an "off" element carrying role=button/tabindex (rentals item cards — the mouse hug is
         deliberately off, the card glows natively) must still be reachable and Enter-able. */
    var SELKB = SEL + ',[tabindex="0"]';
    function kbSkip(el) {
      if (isTextField(el)) return true;
      if (!dcHas(el, "off")) return false;
      return !(el.getAttribute("role") === "button" || el.getAttribute("tabindex") === "0");
    }
    function kbCandidates() {
      var els = document.querySelectorAll(SELKB), out = [], i, el, r, cs;
      for (i = 0; i < els.length; i++) {
        el = els[i];
        if (el === hoverEl || kbSkip(el)) continue;
        try { r = el.getBoundingClientRect(); } catch (_) { continue; }
        if (r.width < 4 || r.height < 4) continue;
        if (r.bottom < -60 || r.top > innerHeight + 60 || r.right < -60 || r.left > innerWidth + 60) continue;   /* roughly on screen */
        try { cs = getComputedStyle(el); } catch (_) { continue; }
        if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
        /* OCCLUSION: an option sitting BEHIND an open popup/lightbox/menu must be neither
           selectable nor haloed THROUGH the overlay — probe the stacking order at its centre.
           Only what is actually on top (the element itself, its own children, or an ancestor
           wrapper) keeps it eligible; anything else covering it removes it from play. */
        try {
          var px2 = r.left + r.width / 2, py2 = r.top + r.height / 2;
          if (px2 >= 0 && py2 >= 0 && px2 <= innerWidth && py2 <= innerHeight) {
            var ov = document.elementFromPoint(px2, py2);
            if (ov && ov !== el && !el.contains(ov) && !ov.contains(el)) continue;
          }
        } catch (_) {}
        out.push({ el: el, r: r });
      }
      return out;
    }
    function kbEngage(el) {
      var attrSp = dcHas(el, "glow") || dcHas(el, "special");
      var r; try { r = el.getBoundingClientRect(); } catch (_) { return false; }
      if (r.width < 4 || r.height < 4 || (!attrSp && (r.width > innerWidth * .62 || r.height > innerHeight * .62))) return false;
      applyHover(el, false, attrSp, true);
      try { el.classList.add("rpc-kbsel"); kbSelEl = el; } catch (_) {}
      try { el.focus({ preventScroll: true }); } catch (_) {}
      /* VERTICAL-only reveal scroll. scrollIntoView could also pan HORIZONTALLY, which shifted
         the whole page sideways when selecting elements DESIGNED to sit partly off-screen (the
         RP home edge bubbles) and exposed the background's edge. Sideways travel is the
         carousels' own job (kbAdvance rotates/jogs them); the page itself never pans. */
      try {
        var vr = el.getBoundingClientRect(), dyv = 0;
        if (vr.top < 70) dyv = vr.top - 70;
        else if (vr.bottom > innerHeight - 40) dyv = vr.bottom - (innerHeight - 40);
        if (dyv) window.scrollBy({ top: dyv, left: 0, behavior: "smooth" });
      } catch (_) {}
      kbSynth(el);   /* hover parity: preview reels etc. react to the kb selection like a hover */
      show(); wake();
      return true;
    }
    /* JOG-STRIP ONE-BY-ONE (JC wall / BTS type): horizontal arrows walk the strip ITEM BY ITEM.
       If the next option in line sits (partly) outside the strip's visible box, the strip is
       shifted by JUST enough to reveal it (custom event "rpc-kb-jog", handled by the site's
       marquee) — the selection is always on screen and rides the slide (motion tracking).
       The strip's own Prev/Next chrome never steals a horizontal step; it is reached with
       the UP arrow, where Enter / left / right page a full view at a time. */
    function kbJogStep(car, navId, dx, cx, cy) {
      var nav = document.getElementById(navId);
      var cb; try { cb = car.getBoundingClientRect(); } catch (_) { return false; }
      var pad = 14;
      /* WRAP / OVERSHOOT RECOVERY: looped strips are DOUBLED content — when the marquee
         position wraps, every element teleports by half the track in a single frame, and
         rapid presses measure mid-flight rects. So the current selection's coordinates are
         never trusted beyond the strip's visible box: the step's reference point is the
         selection CLAMPED into the box, candidates are only options in/near the box (far-off
         loop duplicates can never be picked), and a "lost" selection (teleported outside)
         re-engages the nearest on-screen option first — the selector is always back on
         screen after ONE press, never a march across the page. */
      var hr = null; try { hr = hoverEl ? hoverEl.getBoundingClientRect() : null; } catch (_) {}
      var hcx = hr ? hr.left + hr.width / 2 : cx;
      var lost = !dx || !hr || hcx < cb.left - (hr.width || 60) || hcx > cb.right + (hr.width || 60);
      var refX = Math.max(cb.left + pad, Math.min(cb.right - pad, hcx));
      var els = car.querySelectorAll(SELKB), cand = null, bs = Infinity, i, e2, r2;
      for (i = 0; i < els.length; i++) {
        e2 = els[i];
        if ((!lost && e2 === hoverEl) || kbSkip(e2) || (nav && nav.contains(e2))) continue;
        try { r2 = e2.getBoundingClientRect(); } catch (_) { continue; }
        if (r2.width < 4 || r2.height < 4) continue;
        var ecx = r2.left + r2.width / 2;
        if (ecx < cb.left - r2.width * 1.5 || ecx > cb.right + r2.width * 1.5) continue;   /* in/near the box only */
        var vy = Math.abs(r2.top + r2.height / 2 - cy) * 2.5;   /* stay in the same ROW (2-row mosaics) */
        if (lost) {
          var d0 = Math.abs(ecx - refX) + vy;
          if (d0 < bs) { bs = d0; cand = { el: e2, r: r2 }; }
        } else {
          var fx = (ecx - refX) * dx;
          if (fx < 8) continue;                     /* must lie in the pressed direction */
          var sc = fx + vy;
          if (sc < bs) { bs = sc; cand = { el: e2, r: r2 }; }
        }
      }
      if (!cand) return false;
      if (!lost) {
        /* reveal it before selecting: shift the strip only as far as needed — and a single
           step is CAPPED at ~one option's width, so no measurement glitch can ever inflate
           it into a page-sized jump */
        try {
          var need = 0;
          if (dx > 0 && cand.r.right > cb.right - pad) need = cand.r.right - (cb.right - pad);
          else if (dx < 0 && cand.r.left < cb.left + pad) need = cand.r.left - (cb.left + pad);
          var cap = cand.r.width + 60;
          if (need > cap) need = cap; else if (need < -cap) need = -cap;
          if (need) car.dispatchEvent(new CustomEvent("rpc-kb-jog", { detail: { px: need } }));
        } catch (_) {}
      }
      return kbEngage(cand.el);
    }
    function kbMove(dx, dy) {
      if (!hoverEl) return false;
      var cr; try { cr = hoverEl.getBoundingClientRect(); } catch (_) { return false; }
      var cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      /* horizontal moves INSIDE a carousel stay inside it (its Prev/Next chrome and outside
         elements don't steal the step) — reaching the edge falls through to kbAdvance, which
         pushes the carousel so the next option shifts into place. Vertical moves exit freely. */
      var car = dx ? (hoverEl.closest && hoverEl.closest("[data-kb-carousel]")) : null;
      if (car) {
        var cmode = car.getAttribute("data-kb-carousel") || "click";
        if (cmode !== "click") return kbJogStep(car, cmode, dx, cx, cy);   /* jog strips: strictly one item at a time */
      }
      var best = null, bs = Infinity;
      kbCandidates().forEach(function (c) {
        if (car && !car.contains(c.el)) return;
        var x = c.r.left + c.r.width / 2, y = c.r.top + c.r.height / 2;
        var vx = x - cx, vy = y - cy;
        var fwd = vx * dx + vy * dy;                       /* progress along the pressed direction */
        if (fwd < 8) return;                               /* must actually lie in that direction */
        var ortho = Math.abs(vx * dy) + Math.abs(vy * dx); /* sideways offset */
        if (ortho > fwd * 2.2) return;                     /* stay inside a ~65° cone */
        var score = fwd + ortho * 2;                       /* nearest, preferring in-line targets */
        if (score < bs) { bs = score; best = c; }
      });
      window.__rpcKb = { at: "kbMove", car: !!car, best: best ? String(best.el.className || best.el.tagName).slice(0, 40) : null };   /* QC breadcrumb */
      if (!best) return false;
      var ok = kbEngage(best.el);
      /* CLICK-mode carousels (RP home): choosing an OFF-CENTRE option also ROTATES it into the
         centre — the selection + hug RIDE the moving element (element-motion tracking glues the
         outline to it), so "arrow right onto Geri-Action" ends with Geri-Action centred and
         still selected. A CENTRED option is never clicked — that would ACTIVATE it (open it). */
      if (ok && dx && car && (car.getAttribute("data-kb-carousel") || "click") === "click") {
        try {
          var cb = car.getBoundingClientRect(), eb = best.el.getBoundingClientRect();
          if (Math.abs((eb.left + eb.width / 2) - (cb.left + cb.width / 2)) > cb.width * .18) best.el.click();
        } catch (_) {}
      }
      return ok;
    }
    /* CAROUSEL PUSH: arrowing past the last visible option advances the carousel itself so the
       next option shifts into place, then the selection lands on it. A container opts in with
       data-kb-carousel: "click" = clicking the edge item advances (RP home carousel rotates on
       side-item click); any other value = the id of a jog-nav whose buttons carry data-dir
       (-1 | 1), e.g. the JC wall/BTS strips. */
    function kbAdvance(dx) {
      if (!hoverEl || !dx) return false;
      var car = hoverEl.closest && hoverEl.closest("[data-kb-carousel]");
      if (!car) return false;
      var mode = car.getAttribute("data-kb-carousel") || "click";
      /* re-seek with retries: the shifted option may still be travelling (transform transitions
         run ~.5–.7s), so a single early probe can miss it mid-flight */
      function reseek(delay) {
        var tries = 0;
        (function att() { tries++; if (kbMove(dx, 0)) return; if (tries < 4) setTimeout(att, 320); })();
      }
      if (mode === "click") {
        /* the selection RIDES the rotation: click the (off-centre) selection so it rotates to
           the centre and STAYS selected — no reseek to a different item. A centred selection
           is never clicked here (that would activate/open it). */
        try {
          var cb2 = car.getBoundingClientRect(), eb2 = hoverEl.getBoundingClientRect();
          if (Math.abs((eb2.left + eb2.width / 2) - (cb2.left + cb2.width / 2)) <= cb2.width * .18) return false;
          hoverEl.click();
          kbEngage(hoverEl);   /* the selection was a mouse hover until now — take kb ownership (kbsel glow, focus, hover parity) so it visibly rides */
        } catch (_) { return false; }
        return true;
      }
      var nav = document.getElementById(mode);
      if (!nav) return false;
      var target = null;
      nav.querySelectorAll("button").forEach(function (bt) {
        var d = +(bt.dataset.dir || 0);
        if ((dx > 0 && d > 0) || (dx < 0 && d < 0)) target = bt;
      });
      if (!target) return false;
      try { target.click(); } catch (_) { return false; }
      setTimeout(function () { reseek(); }, 400);
      return true;
    }
    addEventListener("keydown", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      var t = e.target;
      if (t && t.nodeType === 1 && (isTextField(t) || t.isContentEditable)) return;   /* typing owns the keys */
      if (e.key === "Enter" && kbActive && hoverEl) {
        /* natively-activating elements handle Enter themselves once focused — only click the rest */
        var tg = hoverEl.tagName;
        var nativeAct = (tg === "A" && hoverEl.hasAttribute("href")) || tg === "BUTTON" || tg === "INPUT" || tg === "SELECT" || tg === "SUMMARY";
        if (!(nativeAct && document.activeElement === hoverEl)) { try { hoverEl.click(); } catch (_) {} e.preventDefault(); }
        return;
      }
      var dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      var dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      if (!dx && !dy) return;
      /* ON a jog-strip's Prev/Next arrow: left/right (or Enter, natively) pages the strip a
         FULL view in that direction — the deliberate "skip a whole page" gesture. */
      if (dx && kbActive && hoverEl && hoverEl.dataset && hoverEl.dataset.dir) {
        var pnav = hoverEl.parentElement;
        if (pnav && pnav.id && document.querySelector('[data-kb-carousel="' + pnav.id + '"]')) {
          var tbt = null;
          pnav.querySelectorAll("button").forEach(function (bb) {
            var dd = +(bb.dataset.dir || 0);
            if ((dx > 0 && dd > 0) || (dx < 0 && dd < 0)) tbt = bb;
          });
          if (tbt) { try { tbt.click(); } catch (_) {} kbEngage(tbt); e.preventDefault(); return; }
        }
      }
      if (!hoverEl) {
        /* ACCESSIBILITY: no hover prerequisite — the FIRST arrow press engages the nav by
           selecting the candidate nearest the pointer's last known position (viewport centre
           if the mouse hasn't been seen yet). The next real mouse move hands control back. */
        var sx = mx >= 0 ? mx : innerWidth / 2, sy = my >= 0 ? my : innerHeight / 2;
        var cands = kbCandidates().map(function (c) {
          var nx = c.r.left + c.r.width / 2 - sx, ny = c.r.top + c.r.height / 2 - sy;
          return { el: c.el, d: nx * nx + ny * ny };
        }).sort(function (a, b2) { return a.d - b2.d; });
        /* nearest first, but keep trying — the closest match can be an OVERSIZED wrapper
           kbEngage refuses (>62% viewport), and one refusal must not kill the activation */
        for (var ci = 0; ci < cands.length && ci < 8; ci++) {
          if (kbEngage(cands[ci].el)) { kbActive = true; e.preventDefault(); break; }
        }
        return;
      }
      if (kbMove(dx, dy)) { kbActive = true; e.preventDefault(); }
      else if (dx && kbAdvance(dx)) { kbActive = true; e.preventDefault(); }
    });

    /* ---- loading detection (cheap, every ~12 frames + 250ms engage grace) ---- */
    window.__cursorLoading = function (v) { window.__cursorLoadingFlag = !!v; wake(); };
    function overlayUp() {
      if (window.__cursorLoadingFlag) return true;
      var de = document.documentElement;
      if (de.classList.contains("xw-cover") || de.classList.contains("xw-active")) return true;
      if (document.querySelector(".rp-soctransport")) return true;
      var xt = document.querySelector(".xtransport");
      if (xt) { try { var cs = getComputedStyle(xt); if (cs.display !== "none" && parseFloat(cs.opacity) > .2) return true; } catch (_) {} }
      var pv = document.getElementById("pageveil");
      if (pv && !pv.classList.contains("pv-gone")) {
        try { if (parseFloat(getComputedStyle(pv).opacity) > .5) return true; } catch (_) {}
      }
      return false;
    }
    function pollLoading(now) {
      var up = overlayUp();
      if (up) {
        if (!loadSince) loadSince = now;
        if (!loading && now - loadSince > 250) { loading = true; root.classList.add("loading"); }
      } else {
        loadSince = 0;
        if (loading) { loading = false; root.classList.remove("loading"); }
      }
    }

    /* ---- the one rAF loop ---- */
    /* Wrapped in try/finally: a one-off exception (e.g. a hovered element getting replaced
       mid-frame by the SPA) can NEVER kill the loop — worst case that frame is skipped, the
       error is captured on window.__rpcErr, and the next frame heals. */
    function tick(now) {
      var keep = true;
      try { tickBody(now); } catch (e) { if (!window.__rpcErr) window.__rpcErr = (e && e.message) || String(e); applyHover(null, false); }
      finally {
        window.__rpcTick = frame;
        keep = !(idleFrames > 90 || document.hidden);
        running = keep;
        if (keep) requestAnimationFrame(tick);
      }
    }
    function tickBody(now) {
      frame++;
      if (frame % 12 === 0) pollLoading(now);
      /* iframe WATCHDOG: if the pointer has stopped reporting and it last sat over an embed
         (contact/rental forms), fade out so the ring can never park at the form's edge. */
      if (frame % 18 === 0 && shown && !loading) {
        try {
          var under = document.elementFromPoint(mx, my);
          if (under && (under.tagName === "IFRAME" || under.tagName === "OBJECT" || under.tagName === "EMBED")) { applyHover(null, false); hide(); }
        } catch (_) {}
      }
      /* KB OCCLUSION WATCHDOG: a popup/lightbox can open OVER the keyboard selection (Enter on
         a photo) — the hug and its glow must never keep shining THROUGH the overlay. If the
         selection's centre is now covered by an unrelated element, release the hug; the next
         arrow press re-engages among the overlay's own (visible) controls. */
      if (frame % 12 === 6 && kbActive && hoverEl && trackN <= 0) {
        try {
          var hr2 = hoverEl.getBoundingClientRect();
          var hx2 = hr2.left + hr2.width / 2, hy2 = hr2.top + hr2.height / 2;
          if (hx2 >= 0 && hy2 >= 0 && hx2 <= innerWidth && hy2 <= innerHeight) {
            var ov2 = document.elementFromPoint(hx2, hy2);
            if (ov2 && ov2 !== hoverEl && !hoverEl.contains(ov2) && !ov2.contains(hoverEl)) applyHover(null, false);
          }
        } catch (_) {}
      }

      /* springy velocity stretch (from real pointer deltas) — bouncy, liquid.
         Fast mouse pulls the ring into a clear OVAL along the travel direction; the spring
         relaxes it back to a perfect circle when the mouse stops. */
      var dxm = mx - pmx, dym = my - pmy;
      pmx = mx; pmy = my;
      var sp = Math.min(Math.sqrt(dxm * dxm + dym * dym), 70);  /* clamp: an OS pointer teleport can't detonate the oval */
      var k = Math.min(sp * .034, .72);
      kV += (k - kS) * .3;               /* spring toward target stretch */
      kV *= .78;                          /* damping = a little overshoot/bounce */
      kS = Math.max(0, Math.min(.72, kS + kV));
      /* orientation: an ellipse is 180°-symmetric, so take the SHORTEST path modulo π.
         (The old raw-atan2 smoothing spun the long way around on direction reversals —
         that was the "pops in unnatural directions" glitch.) Ignore micro-jitter (<2px). */
      if (sp > 2) {
        var a = Math.atan2(dym, dxm), dA = a - angS;
        while (dA > 1.5707963) dA -= 3.14159265;
        while (dA < -1.5707963) dA += 3.14159265;
        angS += dA * .28;
      }

      /* ring target */
      var tx, ty, tw, th, tr;
      if (hoverEl) {
        var r;
        try { r = hoverEl.getBoundingClientRect(); } catch (_) { r = null; }
        if (!r || !r.width) { applyHover(null, false); tx = mx; ty = my; tw = 50; th = 50; tr = "50%"; }
        else {
          var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          if (hoverSpecial) {
            /* special objects: the ring never outlines them — it stays the free ring
               following the pointer; the OBJECT is what reacts (below). */
            tx = mx; ty = my; tw = 50; th = 50; tr = "50%";
          } else {
            /* ELEMENT-MOTION TRACKING: a carousel rotation moves/resizes the hugged element
               while the ring's own 0.22s size transition restarts every frame — the outline
               warped into shapes that conformed to nothing. While the element is in motion
               the ring is GLUED to it (transitions off, near-zero lag); once it settles the
               transitions return and the hug shape is re-scanned for the grown card. */
            var pR = hoverEl.__rpcR;
            /* LOOP-WRAP TELEPORT: a looped strip's wrap moves elements by HALF THE TRACK in one
               frame — the selection must snap to its on-screen equivalent immediately instead
               of riding off into the void (kbJogStep with dx=0 = lost-recovery: re-engage the
               nearest option inside the strip's visible box). */
            if (kbActive) {
              var doRecover = !!(pR && (Math.abs(pR.x - r.left) > 150 || Math.abs(pR.y - r.top) > 150));
              var jcar = null, jmode = null;
              if (doRecover || frame % 6 === 0) {
                jcar = hoverEl.closest && hoverEl.closest("[data-kb-carousel]");
                jmode = jcar ? (jcar.getAttribute("data-kb-carousel") || "click") : null;
                if (jcar && jmode !== "click" && !doRecover) {
                  /* periodic drift probe: easing overshoot can also carry the selection out */
                  try {
                    var jcb = jcar.getBoundingClientRect(), jc = r.left + r.width / 2;
                    if (jc < jcb.left - r.width || jc > jcb.right + r.width) doRecover = true;
                  } catch (_) {}
                }
              }
              if (doRecover && jcar && jmode !== "click" &&
                  kbJogStep(jcar, jmode, 0, r.left + r.width / 2, r.top + r.height / 2)) {
                window.__rpcWrap = (window.__rpcWrap || 0) + 1;   /* QC breadcrumb */
                try { r = hoverEl.getBoundingClientRect(); } catch (_) {}
                cx = r.left + r.width / 2; cy = r.top + r.height / 2;
                pR = null;
              }
            }
            var elMoving = !!(pR && (Math.abs(pR.x - r.left) > .8 || Math.abs(pR.y - r.top) > .8 ||
                                     Math.abs(pR.w - r.width) > .8 || Math.abs(pR.h - r.height) > .8));
            hoverEl.__rpcR = { x: r.left, y: r.top, w: r.width, h: r.height };
            if (elMoving) {
              trackN = 8; ring.classList.add("tracking");
              /* the visible surface's border-radius can be MORPHING too (.cbub 50% → 13%/20%
                 over .6s) — follow it live so the outline parallels the visible edge exactly */
              if (frame % 2 === 0) scanShape(hoverEl);
            } else if (trackN > 0 && --trackN === 0) {
              ring.classList.remove("tracking");
              scanShape(hoverEl);   /* settled re-scan: final radius for the grown card */
            }
            /* the outline is ATTACHED to the element's edges: exact box, exact radius,
               zero magnetic drift — moving inside the button moves the BUTTON (tilt),
               never the outline. */
            tx = cx; ty = cy;
            tw = r.width + hoverPad * 2; th = r.height + hoverPad * 2;
            if (hoverPct) tr = hoverRad >= 45 ? "50%" :
              (hoverRadY && Math.abs(hoverRadY - hoverRad) > .5 ? hoverRad + "% / " + hoverRadY + "%" : hoverRad + "%");
            else tr = (hoverRad > 0 ? hoverRad + hoverPad : Math.min(th / 2, 12 + hoverPad)) + "px";
          }
          /* perspective warp of the hovered element itself (like the home bubbles),
             composited on its base transform; specials also scale up slightly.
             tiltP eases 0→1 so the reaction GROWS IN fluidly instead of popping. */
          if (tiltEl) {
            tiltP += (1 - tiltP) * .16;
            tiltNx = Math.max(-1, Math.min(1, (mx - cx) / (r.width / 2 || 1)));
            tiltNy = Math.max(-1, Math.min(1, (my - cy) / (r.height / 2 || 1)));
            tiltEl.style.transform = (tiltBase ? tiltBase + " " : "") +
              "perspective(700px) rotateX(" + (-tiltNy * 6 * tiltP).toFixed(2) + "deg) rotateY(" + (tiltNx * 7 * tiltP).toFixed(2) + "deg)" +
              (tiltScale > 1 ? " scale(" + (1 + (tiltScale - 1) * tiltP).toFixed(4) + ")" : "");
          }
        }
      } else { tx = mx; ty = my; tw = 50; th = 50; tr = "50%"; }

      /* ease-out any elements released from hover: shrink/untilt fluidly, then restore */
      if (relEls.length) {
        for (var qi = relEls.length - 1; qi >= 0; qi--) {
          var rl = relEls[qi];
          rl.p *= .8;
          if (rl.p < .04 || !rl.el.isConnected) {
            try { rl.el.style.transform = rl.orig; } catch (_) {}
            relEls.splice(qi, 1);
          } else {
            try {
              rl.el.style.transform = (rl.base ? rl.base + " " : "") +
                "perspective(700px) rotateX(" + (-rl.ny * 6 * rl.p).toFixed(2) + "deg) rotateY(" + (rl.nx * 7 * rl.p).toFixed(2) + "deg)" +
                (rl.scale > 1 ? " scale(" + (1 + (rl.scale - 1) * rl.p).toFixed(4) + ")" : "");
            } catch (_) { relEls.splice(qi, 1); }
          }
        }
      }

      var free = !hoverEl || hoverSpecial;    /* over a special object the ring behaves exactly like free */
      var ease = free ? .22 : (trackN > 0 ? .85 : .35);   /* glued while the hugged element is in motion */
      rx += (tx - rx) * ease;
      ry += (ty - ry) * ease;

      /* RELEASE TRAVEL (hug → free): override the centre with an eased glide from the release
         point to the LIVE pointer — ~14 frames, matching the 0.22s size shrink — so the whole
         shrinking outline visibly travels the button→dot distance instead of snapping. */
      if (travT > 0 && free) {
        travT -= 1 / 14;
        var te = 1 - Math.max(travT, 0);
        var teased = 1 - Math.pow(1 - te, 3);
        rx = travX + (mx - travX) * teased;
        ry = travY + (my - travY) * teased;
      } else if (travT > 0) travT = 0;

      /* CONTAINMENT: the dot must always sit INSIDE the ring. In free/special mode the ring
         trails the pointer, so on fast moves the dot could exit — clamp the lag against the
         ring's current ELLIPSE (rotated by angS, squashed by kS) and pull the ring along. */
      if (free && travT <= 0) {   /* suspended during release travel — the glide owns the centre */
        var cdx = mx - rx, cdy = my - ry;
        var cca = Math.cos(angS), csa = Math.sin(angS);
        var ex = cdx * cca + cdy * csa, ey = -cdx * csa + cdy * cca;
        var press = down ? .9 : 1;
        var eA = (25 * (1 + kS)) * press - 7, eB = (25 * (1 - kS * .62)) * press - 7;
        if (eA < 6) eA = 6; if (eB < 6) eB = 6;
        var qd = (ex * ex) / (eA * eA) + (ey * ey) / (eB * eB);
        if (qd > 1) { var qs = 1 / Math.sqrt(qd); rx = mx - cdx * qs; ry = my - cdy * qs; }
      }

      /* writes (transform-only per frame; width/height only when the target size changes) */
      var moved = Math.abs(tx - rx) + Math.abs(ty - ry) + Math.abs(kS);
      var tf = "translate(" + rx.toFixed(2) + "px," + ry.toFixed(2) + "px) translate(-50%,-50%)";
      var sc = down ? " scale(.9)" : "";
      if (free && kS > .012 && travT <= 0) {   /* no stretch-rotate mid-travel — the shrinking outline must stay true to its shape */
        ring.style.transform = tf + " rotate(" + angS.toFixed(3) + "rad) scale(" + (1 + kS).toFixed(3) + "," + (1 - kS * .62).toFixed(3) + ")" + sc;
      } else {
        ring.style.transform = tf + sc;
      }
      if (ring.__w !== tw || ring.__h !== th || ring.__r !== tr) {
        ring.__w = tw; ring.__h = th; ring.__r = tr;
        ring.style.width = tw + "px"; ring.style.height = th + "px"; ring.style.borderRadius = tr;
      }
      dot.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      mini.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";   /* ghost ring rides the dot 1:1 */
      var lt = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      if (ldr.__lt !== lt) { ldr.__lt = lt; ldr.style.setProperty("--rpc-lt", lt); }

      /* sleep when idle (nothing moving, loading, tilted, or easing back out) */
      if (moved < .06 && sp < .1 && !loading && !loadSince && !tiltEl && !relEls.length && travT <= 0 && trackN <= 0) idleFrames++; else idleFrames = 0;
    }
    function wake() {
      if (running) return;
      /* the loop may have slept for seconds — a stale previous-pointer would read as one
         giant instantaneous delta and detonate the stretch ("pops"). Resync first. */
      pmx = mx; pmy = my;
      running = true;
      requestAnimationFrame(tick);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) wake(); });

    /* ---- cross-document continuity: carry the pointer position through a navigation so the
       destination page can show the loading orbit at the right spot DURING its covered phase
       (before the first mousemove there). ---- */
    addEventListener("pagehide", function () {
      try { sessionStorage.setItem("__rpcpos", Math.round(mx) + "," + Math.round(my)); } catch (_) {}
    });
    try {
      var pos = (sessionStorage.getItem("__rpcpos") || "").split(",");
      if (pos.length === 2) {
        var px = +pos[0], py = +pos[1];
        if (px > 0 && py > 0 && px < innerWidth && py < innerHeight) {
          mx = px; my = py; rx = px; ry = py; pmx = px; pmy = py;
          if (overlayUp()) { show(); loadSince = 1; loading = true; root.classList.add("loading"); }
        }
      }
    } catch (_) {}
    wake();
  }
})();
