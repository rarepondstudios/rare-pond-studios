/* ============================================================================
   Rare Pond / Jack Carlsen — SHARED social UI  (assets/social_ui.js)
   ----------------------------------------------------------------------------
   ONE source of truth for BOTH sites. Master lives in bts-automation/social_ui.js
   and is published to each repo's assets/social_ui.js by social_ui_sync.py
   (launchd com.rarepond.socialuisync). Edit the master, both sites update.

   It does two things, keyed off the markup both sites already emit
   (a[data-net] social links; .contact-bubble with --c1/--c2/--c3/--fg):

   1. CONTACT-BUBBLE look (#2). At REST the box is neutral glass with a subtle
      colour-matched outline glow, and only the CIRCULAR logo badge holds the
      brand gradient. On HOVER the gradient grows OUT of the logo (a clip-path
      circle centred on the badge) to fill the whole box; on mouse-away it
      retracts back into the logo circle.

   2. SOCIAL TRANSPORT (#3). Clicking ANY social link — header, footer, or a
      contact bubble, on either site — plays a full-screen circular wipe in that
      social's gradient, growing from the clicked icon, then opens the link in a
      NEW TAB and retracts (the site stays underneath). Header/footer icons carry
      no colour of their own, so we borrow the matching contact bubble's colours
      by data-net (the colour-look is still the single source; we just reuse it).

   Self-contained: injects its own CSS, guards against double-init, and degrades
   to normal link behaviour under reduced-motion / modified clicks.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__rpSocialUI) return;            // idempotent (defer + possible re-include)
  window.__rpSocialUI = true;

  var REDUCED = false;
  try { REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches; } catch (e) {}

  /* ---- CSS (both concerns) ---------------------------------------------- */
  function injectCSS() {
    if (document.getElementById("rp-social-ui-css")) return;
    var css =
      /* ===== #2 contact bubbles: rest = glass + outline glow, gradient in the round logo ===== */
      ".contact-bubble{position:relative;overflow:hidden;isolation:isolate;" +
      "background:rgba(9,20,44,.55)!important;" +
      "border:1px solid color-mix(in srgb,var(--c1,#3f6bff),transparent 55%);" +
      "box-shadow:0 8px 24px rgba(0,8,30,.34),0 0 20px -6px color-mix(in srgb,var(--c1,#3f6bff),transparent 45%);" +
      "color:#eef4ff;transition:transform .18s ease,box-shadow .3s ease,border-color .3s ease}" +
      ".contact-bubble:hover,.contact-bubble:focus-visible{transform:translateY(-3px);" +
      "border-color:color-mix(in srgb,var(--c1,#3f6bff),transparent 25%);" +
      "box-shadow:0 16px 34px rgba(0,8,30,.46),0 0 30px -6px color-mix(in srgb,var(--c1,#3f6bff),transparent 30%)}" +
      /* the gradient that grows out of the logo. A circle centred on the badge (≈37px in from the
         left, vertically centred); rest radius hugs the 42px badge, hover radius covers the box. */
      ".contact-bubble::before{content:'';position:absolute;inset:0;z-index:-1;" +
      "background:linear-gradient(135deg,var(--c1,#3f6bff),var(--c2,var(--c1,#3f6bff)),var(--c3,var(--c2,var(--c1,#3f6bff))));" +
      "clip-path:circle(22px at 37px 50%);-webkit-clip-path:circle(22px at 37px 50%);" +
      "transition:clip-path .5s cubic-bezier(.4,.7,.2,1),-webkit-clip-path .5s cubic-bezier(.4,.7,.2,1)}" +
      ".contact-bubble:hover::before,.contact-bubble:focus-visible::before{" +
      "clip-path:circle(150% at 37px 50%);-webkit-clip-path:circle(150% at 37px 50%)}" +
      /* logo badge: perfectly round, always holds the gradient, white/dark icon on top */
      ".contact-bubble .cbub-badge{width:42px;height:42px;border-radius:50%!important;" +
      "background:linear-gradient(135deg,var(--c1,#3f6bff),var(--c2,var(--c1,#3f6bff)),var(--c3,var(--c2,var(--c1,#3f6bff))))!important;" +
      "box-shadow:0 4px 14px -3px color-mix(in srgb,var(--c1,#3f6bff),transparent 25%)}" +
      ".contact-bubble .cbub-ico{background:var(--fg,#fff)}" +
      ".contact-bubble .cbub-badge svg{fill:var(--fg,#fff)}" +
      /* label/arrow: light on the glass at rest, flip to the gradient's contrast fg as it fills */
      ".contact-bubble .cbub-label{color:#eef4ff;transition:color .4s ease}" +
      ".contact-bubble .cbub-arrow{color:#cfe0f5;transition:color .4s ease,transform .18s ease}" +
      ".contact-bubble:hover .cbub-label,.contact-bubble:focus-visible .cbub-label," +
      ".contact-bubble:hover .cbub-arrow,.contact-bubble:focus-visible .cbub-arrow{color:var(--fg,#fff)}" +
      /* ===== #3 social transport wipe ===== */
      /* height:100lvh (large-viewport) + inset:0 cover the FULL mobile screen, extending behind
         iOS Safari's dynamic top/bottom bars so the wipe never leaves an uncovered band. */
      /* The gradient radiates from the SAME point the clip circle grows from (--scx/--scy = the
         user's actual click), so the wipe always reads as blooming out of the click: the innermost
         colour (c1 = the brand colour already on the clicked icon) appears first at radius 0 and
         c2/c3 unfold outward — no hard cut between the button's gradient and the wipe's. */
      ".rp-soctransport{position:fixed;inset:0;height:100vh;height:100lvh;z-index:2147483000;pointer-events:none;opacity:1;" +
      "background:radial-gradient(circle at var(--scx,50%) var(--scy,44%),var(--sc1,#3f6bff),var(--sc2,#3f6bff) 52%,var(--sc3,#9b5cff) 100%);" +
      "clip-path:circle(0px at var(--scx,50%) var(--scy,50%));-webkit-clip-path:circle(0px at var(--scx,50%) var(--scy,50%));" +
      "transition:clip-path .5s cubic-bezier(.66,0,.34,1),-webkit-clip-path .5s cubic-bezier(.66,0,.34,1),opacity .35s ease}" +
      ".rp-soctransport.go{clip-path:circle(220vmax at var(--scx,50%) var(--scy,50%));-webkit-clip-path:circle(220vmax at var(--scx,50%) var(--scy,50%))}" +
      ".rp-soctransport.done{opacity:0}";
    var s = document.createElement("style");
    s.id = "rp-social-ui-css";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---- colour resolution ------------------------------------------------- */
  function gv(el, name) {
    try { return (getComputedStyle(el).getPropertyValue(name) || "").trim(); } catch (e) { return ""; }
  }
  /* A header/footer icon has no colour of its own; borrow the matching contact bubble's
     colours by data-net (the colour-look stays the single source). Falls back to the site
     signature if there is no bubble on this page. */
  function colorsFor(a) {
    var c1 = gv(a, "--c1"), c2 = gv(a, "--c2"), c3 = gv(a, "--c3");
    if (!c1) {
      var net = a.getAttribute("data-net") || "";
      var esc = (window.CSS && CSS.escape) ? CSS.escape(net) : net.replace(/"/g, '\\"');
      var bub = net ? document.querySelector('.contact-bubble[data-net="' + esc + '"]') : null;
      if (bub) { c1 = gv(bub, "--c1"); c2 = gv(bub, "--c2"); c3 = gv(bub, "--c3"); }
    }
    c1 = c1 || "#3f6bff";
    return { c1: c1, c2: c2 || c1, c3: c3 || c2 || c1 };
  }

  /* ---- the wipe ---------------------------------------------------------- */
  /* Touch devices block window.open() when it's called AFTER the wipe (outside the tap gesture),
     so the social bubbles did nothing on mobile. On touch we navigate the SAME tab once the wipe
     has covered the screen (always works, and the wipe stays covering during the hand-off); on
     desktop we keep the new-tab behaviour. */
  var IS_TOUCH = false;
  try { IS_TOUCH = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || ("ontouchstart" in window) || navigator.maxTouchPoints > 0; } catch (e) {}
  var busy = false;
  /* CORE wipe runner — the ONE implementation of the click-origin radial-gradient transport.
     o = { x, y            : origin in viewport px (click point) — clip circle AND gradient centre
           c1, c2, c3      : gradient colours, innermost→outermost
           open            : function that performs the navigation once fully covered
           hold            : true = never retract/fade — stay covering through a same-tab
                             navigation so the wipe hands off to the destination's load veil }
     Also exported as window.__rpTransport({x,y,c1,c2,c3,href,sameTab,hold}) so OTHER effects
     (e.g. the JC "go to Rare Pond" bubble) reuse this exact code instead of re-implementing it. */
  function runTransport(o) {
    if (REDUCED || busy) { o.open(); return; }
    busy = true;
    var d = document.createElement("div");
    d.className = "rp-soctransport";
    d.style.setProperty("--scx", o.x + "px");
    d.style.setProperty("--scy", o.y + "px");
    d.style.setProperty("--sc1", o.c1);
    d.style.setProperty("--sc2", o.c2);
    d.style.setProperty("--sc3", o.c3);
    document.body.appendChild(d);
    // tint the browser chrome to the wipe colour so iOS Safari's bars blend into it
    if (window.__setThemeColor) window.__setThemeColor(o.c1);
    var opened = false, cleaned = false;
    var doOpen = function () { if (opened) return; opened = true; o.open(); };
    var cleanup = function () {
      if (cleaned || o.hold) return; cleaned = true;              // hold: keep covering through the navigation
      d.classList.add("done");
      if (window.__resetThemeColor) window.__resetThemeColor(0);   // restore chrome as the wipe fades (desktop)
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); busy = false; }, 420);
    };
    // grow -> when fully covered, open the link
    requestAnimationFrame(function () { requestAnimationFrame(function () { d.classList.add("go"); }); });
    var grew = false;
    d.addEventListener("transitionend", function (e) {
      if (e.propertyName.indexOf("clip-path") < 0) return;
      if (!grew) {
        grew = true; doOpen();
        // Desktop opens a NEW TAB, which backgrounds this one; a clip-path RETRACT would then
        // freeze part-way and leave the circle's edge stuck in the far corners. So on desktop we
        // hold the FULL cover and fade it out by opacity (cleanup) instead of retracting. Touch
        // navigates in the same tab and keeps covering through the hand-off.
        cleanup();
      } else cleanup();
    });
    // If a new tab foregrounds (this tab becomes hidden), drop the cover immediately so coming
    // back to this tab never shows a half-finished wipe. (Held same-tab wipes are cleaned by
    // the pageshow handler below when the user comes Back instead.)
    var onHide = function () {
      if (!document.hidden || o.hold) return;
      document.removeEventListener("visibilitychange", onHide);
      if (d.parentNode) d.parentNode.removeChild(d);
      if (window.__resetThemeColor) window.__resetThemeColor(0);
      busy = false;
    };
    document.addEventListener("visibilitychange", onHide);
    // safety net if transitionend is missed (background tab / interrupted)
    setTimeout(function () { doOpen(); }, 560);
    setTimeout(function () { cleanup(); }, 1500);
  }
  /* HANDOFF (cross-site seamlessness): a HELD same-tab wipe covers this page right up to the
     unload, but the DESTINATION used to hard-cut in. Now the click origin + gradient colours
     travel WITH the navigation in the URL hash (#rpt=x%|y%|c1|c2|c3 — sessionStorage can't
     cross the jackcarlsen.com ⇄ rarepond.com origin boundary), the destination's pre-paint
     snippet paints the SAME gradient before first paint, and shared social_ui.js on that side
     retracts it to the carried click point (centre if the coords are missing/invalid). */
  function handoffHref(href, x, y, c1, c2, c3) {
    try {
      var u = new URL(href, location.href);
      if (u.hash) return href;                                   // never clobber a real anchor
      u.hash = "rpt=" + [Math.round(x / innerWidth * 1000) / 10, Math.round(y / innerHeight * 1000) / 10,
        encodeURIComponent(c1), encodeURIComponent(c2), encodeURIComponent(c3)].join("|");
      return u.href;
    } catch (e) { return href; }
  }
  window.__rpTransport = function (o) {
    var c1 = o.c1 || "#3f6bff", c2 = o.c2 || c1, c3 = o.c3 || c2;
    var open = o.open || function () {
      var href = o.href;
      if (o.sameTab || IS_TOUCH) {
        if (o.hold) href = handoffHref(href, o.x, o.y, c1, c2, c3);   // held same-tab wipe → destination retracts it
        location.href = href; return;
      }
      try { window.open(href, "_blank", "noopener"); } catch (e) { location.href = href; }
    };
    runTransport({ x: o.x, y: o.y, c1: c1, c2: c2, c3: c3, open: open, hold: !!o.hold });
  };
  function transport(a, ev) {
    var href = a.getAttribute("href");
    var col = colorsFor(a);
    var r = a.getBoundingClientRect();
    /* Origin = the user's ACTUAL click point when we have one (a real pointer event carries
       clientX/Y inside the icon's rect); keyboard/synthetic activations fall back to the icon's
       centre. Both the clip circle AND the gradient use this same origin. */
    var ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    if (ev && typeof ev.clientX === "number" && (ev.clientX || ev.clientY)) { ox = ev.clientX; oy = ev.clientY; }
    runTransport({
      x: ox, y: oy, c1: col.c1, c2: col.c2, c3: col.c3,
      open: function () {
        if (IS_TOUCH) { location.href = href; return; }           // reliable on mobile (no popup block)
        try { window.open(href, "_blank", "noopener"); } catch (e) { location.href = href; }
      }
    });
  }

  /* ---- delegated click on any social link -------------------------------- */
  function onClick(e) {
    var a = e.target.closest && e.target.closest("a[data-net]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#") return;             // not an outbound social link
    if (e.defaultPrevented) return;
    if (e.button === 1 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;  // honour open-in-new-tab etc.
    e.preventDefault();
    transport(a, e);
  }

  /* ARRIVAL: retract a handed-off wipe (#rpt=...) to the carried click point. The pre-paint
     snippet in each document painted the cover before first paint (window.__RPT); if that
     snippet is absent the cover is built here (worst case a brief flash instead of a cut). */
  function arrivalRetract() {
    var m = /[#&]rpt=([^&]+)/.exec(location.hash || "");
    if (!m) return;
    var okc = function (c) { return (/^#[0-9a-f]{3,8}$/i.test(c) || /^rgba?\([\d ,.%]+\)$/i.test(c)) ? c : ""; };
    var p = m[1].split("|"), x = parseFloat(p[0]), y = parseFloat(p[1]);
    if (!(x >= 0 && x <= 100)) x = 50;
    if (!(y >= 0 && y <= 100)) y = 50;
    var c1 = okc(decodeURIComponent(p[2] || "")) || "#3f6bff";
    var c2 = okc(decodeURIComponent(p[3] || "")) || c1;
    var c3 = okc(decodeURIComponent(p[4] || "")) || c2;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    var d = window.__RPT && window.__RPT.el;
    if (!d) {
      d = document.createElement("div");
      d.style.cssText = "position:fixed;inset:0;height:100vh;height:100lvh;z-index:2147483001;pointer-events:none;" +
        "background:radial-gradient(circle at " + x + "% " + y + "%," + c1 + "," + c2 + " 52%," + c3 + " 100%)";
      document.body.appendChild(d);
    }
    if (REDUCED) {
      if (d.parentNode) d.parentNode.removeChild(d);
      window.__RPT = null;
      if (window.__resetThemeColor) window.__resetThemeColor(0);
      return;
    }
    d.style.transition = "clip-path .55s cubic-bezier(.66,0,.34,1),-webkit-clip-path .55s cubic-bezier(.66,0,.34,1)";
    d.style.clipPath = d.style.webkitClipPath = "circle(220vmax at " + x + "% " + y + "%)";
    var gone = false;
    var go = function () {
      if (gone) return; gone = true;
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        d.style.clipPath = d.style.webkitClipPath = "circle(0px at " + x + "% " + y + "%)";
        if (window.__resetThemeColor) window.__resetThemeColor(0);
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); window.__RPT = null; }, 750);
      }); });
    };
    /* start once the page behind the cover has actually painted */
    if (document.readyState === "complete") setTimeout(go, 120);
    else addEventListener("load", function () { setTimeout(go, 120); }, { once: true });
    setTimeout(go, 1800);   // safety: never trap the user behind the cover
  }
  function init() {
    injectCSS();
    arrivalRetract();
    document.addEventListener("click", onClick, false);
    /* Back/bfcache: a HELD same-tab wipe is still painted when the page is restored from the
       back-forward cache — clear any leftover transport so Back always shows the real page. */
    addEventListener("pageshow", function (e) {
      if (!e.persisted && !document.querySelector(".rp-soctransport")) return;
      document.querySelectorAll(".rp-soctransport").forEach(function (d) { if (d.parentNode) d.parentNode.removeChild(d); });
      busy = false;
      if (window.__resetThemeColor) window.__resetThemeColor(0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
