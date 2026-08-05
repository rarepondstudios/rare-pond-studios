/* ============================================================================
   Rare Pond / Jack Carlsen — SHARED custom cursor  (assets/cursor.js)
   ----------------------------------------------------------------------------
   ONE source of truth for BOTH sites. Master lives in bts-automation/cursor.js
   and is published to each repo's assets/cursor.js by social_ui_sync.py
   (launchd com.rarepond.socialuisync). Edit the master, both sites update.

   WHAT IT IS
   A soft-edged gradient circle that replaces the mouse (desktop / fine pointers
   only), with a small dot that tracks the real pointer position 1:1:
     - FREE: the circle trails the dot with smoothing and stretches subtly along
       the direction of fast movement (relaxes to a circle at rest).
     - HOVER (iPadOS-style): over ANY interactive element it morphs to hug that
       element's border box + border-radius, and returns to a circle on leave.
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
      "#rp-cursor{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none;opacity:0;transition:opacity .15s ease}" +
      "#rp-cursor.on{opacity:1}" +
      ".rpc-ring{position:fixed;left:0;top:0;width:34px;height:34px;border-radius:50%;will-change:transform;" +
      "transition:width .22s cubic-bezier(.3,.9,.3,1),height .22s cubic-bezier(.3,.9,.3,1),border-radius .22s cubic-bezier(.3,.9,.3,1),opacity .16s ease}" +
      /* two stacked skins that crossfade: soft gradient orb (free) vs hug-fill (hover) */
      ".rpc-glow,.rpc-fill{position:absolute;inset:0;border-radius:inherit;transition:opacity .18s ease}" +
      ".rpc-glow{background:radial-gradient(circle," + rgba(COL.c1, .34) + " 0%," + rgba(COL.c2, .20) + " 46%," + rgba(COL.c3, .10) + " 66%,rgba(0,0,0,0) 74%)}" +
      ".rpc-fill{opacity:0;background:" + rgba(COL.c1, .10) + ";box-shadow:0 0 0 1.5px " + rgba(COL.c1, .55) + ",0 0 16px -4px " + rgba(COL.c2, .5) + "}" +
      ".rpc-ring.hover .rpc-glow{opacity:0}.rpc-ring.hover .rpc-fill{opacity:1}" +
      ".rpc-ring.textish{opacity:.3}" +
      ".rpc-dot{position:fixed;left:0;top:0;width:5px;height:5px;border-radius:50%;will-change:transform;" +
      "background:linear-gradient(135deg," + COL.c1 + "," + COL.c2 + ");box-shadow:0 0 6px " + rgba(COL.c1, .5) + "}" +
      ".rpc-loader{position:fixed;left:0;top:0;width:30px;height:30px;border-radius:50%;opacity:0;will-change:transform;" +
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
    root.innerHTML = '<div class="rpc-ring"><div class="rpc-glow"></div><div class="rpc-fill"></div></div><div class="rpc-loader"></div><div class="rpc-dot"></div>';
    document.body.appendChild(root);
    document.documentElement.classList.add("rpc-on");

    var ring = root.querySelector(".rpc-ring"),
        dot = root.querySelector(".rpc-dot"),
        ldr = root.querySelector(".rpc-loader");

    /* ---- state ---- */
    var mx = -100, my = -100;          // real pointer
    var rx = -100, ry = -100;          // smoothed ring centre
    var pmx = -100, pmy = -100;        // previous pointer (velocity)
    var kS = 0, angS = 0;              // smoothed stretch + angle
    var hoverEl = null, hoverRad = 14, textish = false;
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
    addEventListener("mousedown", function () { down = true; wake(); }, { passive: true });
    addEventListener("mouseup", function () { down = false; wake(); }, { passive: true });

    /* ---- standardized interactive detection ---- */
    var SEL = "a[href],button,[role='button'],input,select,textarea,label,summary,[data-cursor='link'],[onclick]";
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
      if (!t || t.nodeType !== 1) { setHover(null, false); return; }
      if (t.tagName === "IFRAME") { hide(); return; }   // embeds own the pointer; reappear on next move outside
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
      if (el && el.getAttribute && el.getAttribute("data-cursor") === "off") el = null;
      var txt = false;
      if (el && isTextField(el)) { txt = true; el = null; }
      if (el) {
        var r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.width > innerWidth * .62 || r.height > innerHeight * .62) el = null;
      }
      setHover(el, txt);
      wake();
    }, true);

    function setHover(el, txt) {
      textish = !!txt;
      ring.classList.toggle("textish", textish);
      if (el === hoverEl) return;
      hoverEl = el;
      if (el) {
        var br = 14;
        try { br = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; } catch (_) {}
        hoverRad = br;
        ring.classList.add("hover");
      } else {
        ring.classList.remove("hover");
      }
    }

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
    function tick(now) {
      frame++;
      if (frame % 12 === 0) pollLoading(now);

      /* velocity (from real pointer deltas) */
      var dxm = mx - pmx, dym = my - pmy;
      pmx = mx; pmy = my;
      var sp = Math.sqrt(dxm * dxm + dym * dym);
      var k = Math.min(sp * .012, .32);
      kS += (k - kS) * .16;
      if (sp > .5) { var a = Math.atan2(dym, dxm); angS += (a - angS) * .3; }

      /* ring target */
      var tx, ty, tw, th, tr;
      if (hoverEl) {
        var r;
        try { r = hoverEl.getBoundingClientRect(); } catch (_) { r = null; }
        if (!r || !r.width) { setHover(null, false); tx = mx; ty = my; tw = 34; th = 34; tr = 17; }
        else {
          tx = r.left + r.width / 2 + (mx - (r.left + r.width / 2)) * .12;   /* slight magnetic follow */
          ty = r.top + r.height / 2 + (my - (r.top + r.height / 2)) * .12;
          tw = r.width + 10; th = r.height + 10;
          tr = hoverRad > 0 ? hoverRad + 5 : Math.min(th / 2, 14);
        }
      } else { tx = mx; ty = my; tw = 34; th = 34; tr = 17; }

      rx += (tx - rx) * (hoverEl ? .3 : .22);
      ry += (ty - ry) * (hoverEl ? .3 : .22);

      /* writes (transform-only per frame; width/height only when the target size changes) */
      var moved = Math.abs(tx - rx) + Math.abs(ty - ry) + Math.abs(kS);
      var tf = "translate(" + rx.toFixed(2) + "px," + ry.toFixed(2) + "px) translate(-50%,-50%)";
      var sc = down ? " scale(.9)" : "";
      if (!hoverEl && kS > .015) {
        ring.style.transform = tf + " rotate(" + angS.toFixed(3) + "rad) scale(" + (1 + kS).toFixed(3) + "," + (1 - kS * .55).toFixed(3) + ")" + sc;
      } else {
        ring.style.transform = tf + sc;
      }
      if (ring.__w !== tw || ring.__h !== th || ring.__r !== tr) {
        ring.__w = tw; ring.__h = th; ring.__r = tr;
        ring.style.width = tw + "px"; ring.style.height = th + "px"; ring.style.borderRadius = tr + "px";
      }
      dot.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      var lt = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      if (ldr.__lt !== lt) { ldr.__lt = lt; ldr.style.setProperty("--rpc-lt", lt); }

      /* sleep when idle (nothing moving, nothing loading) */
      if (moved < .06 && sp < .1 && !loading && !loadSince) idleFrames++; else idleFrames = 0;
      if (idleFrames > 90 || document.hidden) { running = false; return; }
      requestAnimationFrame(tick);
    }
    function wake() {
      if (running) return;
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
