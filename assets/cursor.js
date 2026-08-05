/* ============================================================================
   Rare Pond / Jack Carlsen — SHARED custom cursor  (assets/cursor.js)
   ----------------------------------------------------------------------------
   ONE source of truth for BOTH sites. Master lives in bts-automation/cursor.js
   and is published to each repo's assets/cursor.js by social_ui_sync.py
   (launchd com.rarepond.socialuisync). Edit the master, both sites update.

   WHAT IT IS
   A glowing gradient RING that replaces the mouse (desktop / fine pointers
   only), with a small dot that tracks the real pointer position 1:1:
     - FREE: a 44px open ring (clear gap between the centre dot and the band,
       same silhouette as the loading orbit but solid) trails the dot with
       smoothing and squashes/stretches into an oval along the direction of
       fast movement — relaxing back to a circle at rest.
     - HOVER (iPadOS-style): over ordinary interactive elements (buttons, links,
       cards) the ring snaps DIRECTLY onto the element's border box + radius (no
       offset drift — the outline is attached to the edges) while the element
       itself warps in perspective toward the mouse. SPECIAL objects — project
       bubbles / large circular instances, plus wordmarks tagged
       data-cursor="glow"/"special" — never get the ring outline: the ring stays
       a free ring and the OBJECT reacts instead (its own native glow/tilt if it
       has one, else cursor-driven perspective tilt + slight scale-up).
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
      ".rpc-ring{position:fixed;left:0;top:0;width:44px;height:44px;border-radius:50%;z-index:2147483644;pointer-events:none;opacity:0;will-change:transform;" +
      "-webkit-backdrop-filter:blur(2px) saturate(1.25);backdrop-filter:blur(2px) saturate(1.25);" +   /* liquid-glass: subtle distortion under the orb */
      "box-shadow:0 0 14px -3px " + rgba(COL.c1, .55) + ",inset 0 0 9px -3px " + rgba(COL.c2, .40) + ";" +   /* the ring band GLOWS both outward and inward */
      "transition:width .22s cubic-bezier(.3,.9,.3,1),height .22s cubic-bezier(.3,.9,.3,1),border-radius .22s cubic-bezier(.3,.9,.3,1),opacity .16s ease}" +
      "#rp-cursor.on .rpc-ring{opacity:1}" +
      ".rpc-ring.hover{-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none}" +   /* no blur / free-ring glow once snapped to an element */
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
      /* special objects (bubbles / wordmarks / category tabs): NO skin change — the ring stays
         the free open ring and the ELEMENT reacts. If the special element carries a themed
         colour (--cursor-tint / --tc / --cc), the ring TINTS to it and merges with its glow. */
      ".rpc-ring.tinted .rpc-glow{background:var(--rpct)}" +
      ".rpc-ring.tinted{box-shadow:0 0 16px -2px color-mix(in srgb,var(--rpct),transparent 35%),inset 0 0 9px -3px color-mix(in srgb,var(--rpct),transparent 55%)}" +
      "#rp-cursor.on .rpc-ring.textish{opacity:.3}" +
      ".rpc-dot{position:fixed;left:0;top:0;width:5px;height:5px;border-radius:50%;z-index:2147483646;pointer-events:none;opacity:0;will-change:transform;" +
      "background:#fff;mix-blend-mode:difference;transition:opacity .15s ease}" +   /* difference vs the page = always contrasts (white on dark, black on light) */
      "#rp-cursor.on .rpc-dot{opacity:1}" +
      ".rpc-loader{position:fixed;left:0;top:0;width:38px;height:38px;border-radius:50%;z-index:2147483645;pointer-events:none;opacity:0;will-change:transform;" +
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
    root.innerHTML = '<div class="rpc-ring"><div class="rpc-glow"></div><div class="rpc-fill"></div><div class="rpc-bord"></div></div><div class="rpc-loader"></div><div class="rpc-dot"></div>';
    document.body.appendChild(root);
    document.documentElement.classList.add("rpc-on");

    var ring = root.querySelector(".rpc-ring"),
        dot = root.querySelector(".rpc-dot"),
        ldr = root.querySelector(".rpc-loader");

    /* ---- state ---- */
    var mx = -100, my = -100;          // real pointer
    var rx = -100, ry = -100;          // smoothed ring centre
    var pmx = -100, pmy = -100;        // previous pointer (velocity)
    var kS = 0, kV = 0, angS = 0;      // springy stretch (value + velocity) + angle
    var hoverEl = null, hoverRad = 14, hoverPct = false, hoverSpecial = false, hoverPad = 0, textish = false;
    var tiltEl = null, tiltOrig = "", tiltBase = "", tiltScale = 1;  // tilted element, its original inline transform, its computed base matrix, extra scale
    var tiltP = 0, tiltNx = 0, tiltNy = 0;  // ease-in progress + last tilt direction (for the ease-out)
    var relEls = [];                   // elements easing BACK to rest after hover-off (fluid shrink)
    var clearT = null;                 // hover-out grace timer (kills the between-buttons flash)
    var shown = false, loading = false, loadSince = 0, down = false;
    var idleFrames = 0, running = false, frame = 0;

    function show() { if (!shown) { shown = true; root.classList.add("on"); } }
    function hide() { if (shown) { shown = false; root.classList.remove("on"); } }

    /* ---- pointer tracking ---- */
    addEventListener("mousemove", function (e) {
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
    function applyHover(el, txt, attrSp) {
      if (clearT) { clearTimeout(clearT); clearT = null; }
      textish = !!txt;
      ring.classList.toggle("textish", textish);
      if (el === hoverEl) return;
      releaseTilt();
      hoverEl = el;
      hoverSpecial = false;
      hoverPad = 0;
      if (el) {
        /* The visible rounding often lives on an INNER child (card wrapper > circular image —
           e.g. the project bubbles), so scan the element and its near-full-size descendants
           (2 levels) and take the strongest border-radius. % radius ⇒ the ring ENCOMPASSES the
           circle/ellipse instead of boxing it. */
        var best = { px: 0, pct: false }, rr = null;
        try { rr = el.getBoundingClientRect(); } catch (_) {}
        function takeRad(node) {
          try {
            var raw = getComputedStyle(node).borderTopLeftRadius || "";
            var v = parseFloat(raw) || 0, p = raw.indexOf("%") > -1;
            if (p) { best.px = Math.max(best.px, v); best.pct = true; }
            else if (!best.pct && v > best.px) best.px = v;
          } catch (_) {}
        }
        takeRad(el);
        if (rr && rr.width) {
          var kids = el.children, i, j, k, kr;
          for (i = 0; i < kids.length && i < 6; i++) {
            k = kids[i];
            try { kr = k.getBoundingClientRect(); } catch (_) { continue; }
            if (kr.width >= rr.width * .8 && kr.height >= rr.height * .8) takeRad(k);
            var gk = k.children;
            for (j = 0; j < gk.length && j < 6; j++) {
              try { var gr = gk[j].getBoundingClientRect(); if (gr.width >= rr.width * .8 && gr.height >= rr.height * .8) takeRad(gk[j]); } catch (_) {}
            }
          }
        }
        hoverRad = best.px;
        hoverPct = best.pct;
        /* SPECIAL objects never get the ring outline — the object reacts instead.
           Auto: any large circular target (project bubbles / carousel side circles / JC hbubs;
           % radius ≥45 and ≥64px). Explicit: data-cursor="glow" (wordmarks) or "special".
           Force the outline back on a big circle if ever needed: data-cursor="link" + a
           non-% radius, or ask — small circles (social icons) keep the outline. */
        hoverSpecial = !!attrSp || (best.pct && best.px >= 45 && rr && rr.width >= 64 && rr.height >= 64);
        ring.classList.toggle("hover", !hoverSpecial);
        hoverPad = parseFloat(el.getAttribute("data-cursor-pad")) || 0;   /* extra breathing room around the hug (footer nav links) */
        /* themed specials (rentals category tabs): tint the free ring to the element's colour
           so the cursor visibly merges with that category's glow. Var order: --cursor-tint
           (explicit opt-in for future elements) then --tc / --cc (rentals conventions). */
        var tint = "";
        if (hoverSpecial) {
          try {
            var tcs = getComputedStyle(el);
            tint = (tcs.getPropertyValue("--cursor-tint") || tcs.getPropertyValue("--tc") || tcs.getPropertyValue("--cc") || "").trim();
          } catch (_) {}
        }
        if (tint) { ring.classList.add("tinted"); ring.style.setProperty("--rpct", tint); }
        else ring.classList.remove("tinted");
        /* ELEMENT REACTION (like the home-page bubbles): perspective tilt toward the mouse.
           Ownership rules: if the element natively drives its own tilt (defines --tiltx —
           the RP bubbles do, in CSS or via their pointermove handlers), the cursor stays
           hands-off so the two never fight. If it's inline-transform-driven by other JS,
           also hands-off. Otherwise the cursor tilts it, COMPOSITING on top of the element's
           computed base transform (so transform-positioned elements never jump), and specials
           additionally scale up slightly. Opt out: data-cursor="notilt". */
        if (!dcHas(el, "notilt")) {
          /* if this element was mid-ease-out (re-entered quickly), adopt it back with its
             progress + its ORIGINAL base/orig (its current inline transform is our own). */
          var fromRel = null, ri;
          for (ri = relEls.length - 1; ri >= 0; ri--) {
            if (relEls[ri].el === el) { fromRel = relEls[ri]; relEls.splice(ri, 1); }
          }
          if (fromRel || !(el.style.transform || "").length) {
            var native = "";
            try { native = (getComputedStyle(el).getPropertyValue("--tiltx") || "").trim(); } catch (_) {}
            if (!native) {
              tiltEl = el;
              tiltP = fromRel ? fromRel.p : 0;
              tiltOrig = fromRel ? fromRel.orig : (el.style.transform || "");
              if (fromRel) tiltBase = fromRel.base;
              else {
                tiltBase = "";
                try { var bm = getComputedStyle(el).transform; if (bm && bm !== "none") tiltBase = bm; } catch (_) {}
              }
              tiltScale = hoverSpecial ? (attrSp ? 1.08 : 1.05) : 1;
            } else if (fromRel) { try { el.style.transform = fromRel.orig; } catch (_) {} }
          }
        }
      } else {
        ring.classList.remove("hover");
        ring.classList.remove("tinted");
      }
    }
    function setHover(el, txt) { applyHover(el, txt, false); }   /* back-compat internal alias */

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
        if (!r || !r.width) { applyHover(null, false); tx = mx; ty = my; tw = 44; th = 44; tr = "50%"; }
        else {
          var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          if (hoverSpecial) {
            /* special objects: the ring never outlines them — it stays the free ring
               following the pointer; the OBJECT is what reacts (below). */
            tx = mx; ty = my; tw = 44; th = 44; tr = "50%";
          } else {
            /* the outline is ATTACHED to the element's edges: exact box, exact radius,
               zero magnetic drift — moving inside the button moves the BUTTON (tilt),
               never the outline. */
            tx = cx; ty = cy;
            tw = r.width + hoverPad * 2; th = r.height + hoverPad * 2;
            if (hoverPct) tr = hoverRad >= 45 ? "50%" : (hoverRad + "%");
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
      } else { tx = mx; ty = my; tw = 44; th = 44; tr = "50%"; }

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
      rx += (tx - rx) * (free ? .22 : .35);
      ry += (ty - ry) * (free ? .22 : .35);

      /* CONTAINMENT: the dot must always sit INSIDE the ring. In free/special mode the ring
         trails the pointer, so on fast moves the dot could exit — clamp the lag against the
         ring's current ELLIPSE (rotated by angS, squashed by kS) and pull the ring along. */
      if (free) {
        var cdx = mx - rx, cdy = my - ry;
        var cca = Math.cos(angS), csa = Math.sin(angS);
        var ex = cdx * cca + cdy * csa, ey = -cdx * csa + cdy * cca;
        var press = down ? .9 : 1;
        var eA = (22 * (1 + kS)) * press - 7, eB = (22 * (1 - kS * .62)) * press - 7;
        if (eA < 6) eA = 6; if (eB < 6) eB = 6;
        var qd = (ex * ex) / (eA * eA) + (ey * ey) / (eB * eB);
        if (qd > 1) { var qs = 1 / Math.sqrt(qd); rx = mx - cdx * qs; ry = my - cdy * qs; }
      }

      /* writes (transform-only per frame; width/height only when the target size changes) */
      var moved = Math.abs(tx - rx) + Math.abs(ty - ry) + Math.abs(kS);
      var tf = "translate(" + rx.toFixed(2) + "px," + ry.toFixed(2) + "px) translate(-50%,-50%)";
      var sc = down ? " scale(.9)" : "";
      if (free && kS > .012) {
        ring.style.transform = tf + " rotate(" + angS.toFixed(3) + "rad) scale(" + (1 + kS).toFixed(3) + "," + (1 - kS * .62).toFixed(3) + ")" + sc;
      } else {
        ring.style.transform = tf + sc;
      }
      if (ring.__w !== tw || ring.__h !== th || ring.__r !== tr) {
        ring.__w = tw; ring.__h = th; ring.__r = tr;
        ring.style.width = tw + "px"; ring.style.height = th + "px"; ring.style.borderRadius = tr;
      }
      dot.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      var lt = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      if (ldr.__lt !== lt) { ldr.__lt = lt; ldr.style.setProperty("--rpc-lt", lt); }

      /* sleep when idle (nothing moving, loading, tilted, or easing back out) */
      if (moved < .06 && sp < .1 && !loading && !loadSince && !tiltEl && !relEls.length) idleFrames++; else idleFrames = 0;
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
