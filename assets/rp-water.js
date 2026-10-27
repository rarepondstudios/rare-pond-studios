/* RP WATER (2026-10-27): the two full-screen covers of the Rare Pond sites, drawn in the V3 bubble's
   three-tier look (a solid band, a 50% band, a 25% band, with gently wobbling edges).

   1. RPWater.veil(el, opts): ENTERING THE WATER, the page-load cover (Jack: "the screen starts white like
      the header, then the blues of the water come up from the bottom of the screen, as the user enters
      the water ... hiding element pop in"). The cover is the page's "sky" colour (white on the Studio
      and Rentals, the Media page's dark blue) and holds while the page loads; if loading takes a while
      a waterline rises into view at the bottom. When the page is ready, reveal() brings the waterline
      up over the whole screen: above it the sky, at it the three bands, below it the page, as if you
      went under. Nothing of the page is visible until it is ready.
   2. RPWater.sweep(el, opts): the sideways Studio / Rentals / Media transition (xwipe.js). Three bands
      cross the screen with parallax: the 25% band leads, the 50% band follows, the solid band covers;
      on the next page the solid band moves on and the 50% and 25% bands trail it off (one continuous
      motion across the page load).

   Plain 2D canvas, not WebGL, on purpose: both run while a page is loading, before any shader could be
   built, and must work on every device and every effects tier. Generic: any page (any colours) uses
   them through the options; nothing here is specific to one page. prefers-reduced-motion and missing
   canvas fall back to the old plain fades (the callers handle that through RPWater.ok). */
(function () {
  "use strict";
  var RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var SIG = { c1: "#56c8ff", c2: "#3f6bff", c3: "#9b5cff" };
  function canvasOk() { try { return !!document.createElement("canvas").getContext("2d"); } catch (e) { return false; } }
  var OK = !RM && canvasOk();
  function now() { return performance.now(); }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function look(l) { l = l || {}; return { c1: l.c1 || SIG.c1, c2: l.c2 || l.c1 || SIG.c2, c3: l.c3 || l.c2 || l.c1 || SIG.c3 }; }

  /* a full-viewport canvas inside el, at a modest resolution (the bands are soft anyway) */
  function surface(el) {
    var c = el.querySelector("canvas.rpw");
    if (!c) {
      c = document.createElement("canvas"); c.className = "rpw"; c.setAttribute("aria-hidden", "true");
      c.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none";
      el.appendChild(c);
    }
    var W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight;
    var k = Math.min(window.devicePixelRatio || 1, 2) * 0.6;
    var cw = Math.max(2, Math.round(W * k)), ch = Math.max(2, Math.round(H * k));
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    var x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0);
    return { c: c, x: x, W: W, H: H };
  }
  /* the bubble rim's wobble: two slow sines, each edge with its own phase */
  function wave(p, len, t, ph, A) {
    return A * (0.62 * Math.sin(p / (0.42 * len) * 6.2832 + t * 1.25 + ph) + 0.38 * Math.sin(p / (0.23 * len) * 6.2832 - t * 0.85 + ph * 1.7));
  }
  /* region between two wavy edges: horizontal edges (veil) or vertical edges (sweep) */
  function band(x, horiz, len, a, b, t, pa, pb, A, fill, alpha) {
    if (alpha <= 0) return;
    var step = Math.max(10, len / 90), i;
    x.globalAlpha = alpha; x.fillStyle = fill; x.beginPath();
    if (horiz) {
      for (i = 0; i <= len + step; i += step) { var px = Math.min(i, len); var ya = a + (pa == null ? 0 : wave(px, len, t, pa, A)); i ? x.lineTo(px, ya) : x.moveTo(px, ya); }
      for (i = len; i >= -step; i -= step) { var qx = Math.max(i, 0); x.lineTo(qx, b + (pb == null ? 0 : wave(qx, len, t, pb, A))); }
    } else {
      for (i = 0; i <= len + step; i += step) { var py = Math.min(i, len); var xa = a + (pa == null ? 0 : wave(py, len, t, pa, A)); i ? x.lineTo(xa, py) : x.moveTo(xa, py); }
      for (i = len; i >= -step; i -= step) { var qy = Math.max(i, 0); x.lineTo(b + (pb == null ? 0 : wave(qy, len, t, pb, A)), qy); }
    }
    x.closePath(); x.fill(); x.globalAlpha = 1;
  }
  function hgrad(x, W, L) { var g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, L.c1); g.addColorStop(0.5, L.c2); g.addColorStop(1, L.c3); return g; }

  /* ===== 1. ENTERING THE WATER ===== */
  function veil(el, o) {
    o = o || {};
    var L = look(o.look), sky = o.sky || "#ffffff", s = null, loop = 0, t0 = now(), mode = "sky", deep = 0, rise = null, done = false, fin = null;
    /* thickness of the three bands and the wobble, in viewport heights (the bubble's proportions) */
    function dims(H) { return { t1: 0.035 * H, t2: 0.06 * H, t3: 0.08 * H, A: Math.max(5, 0.011 * H) }; }
    function draw() {
      var S = surface(el), x = S.x, W = S.W, H = S.H, d = dims(H), t = (now() - t0) / 1000;
      el.style.background = "transparent";
      x.clearRect(0, 0, W, H);
      var y0 = s, y1 = y0 + d.t1, y2 = y1 + d.t2, y3 = y2 + d.t3;
      /* the sky: everything above the waterline */
      band(x, true, W, -50, y0, t, null, 0, d.A, sky, 1);
      /* while loading, the water below the bands is still opaque (nothing of the page shows yet); it
         clears as the water rises */
      var g = hgrad(x, W, L);
      if (deep > 0) {
        var dg = x.createLinearGradient(0, y3, 0, H); dg.addColorStop(0, L.c2); dg.addColorStop(1, L.c3);
        band(x, true, W, y3, H + 50, t, 3.1, null, d.A, dg, deep);
      }
      band(x, true, W, y0, y1, t, 0, 1.3, d.A, g, 1);
      band(x, true, W, y1, y2, t, 1.3, 2.2, d.A, g, 0.5);
      band(x, true, W, y2, y3, t, 2.2, 3.1, d.A, g, 0.25);
    }
    function tick() {
      loop = 0; if (done) return;
      var H = el.clientHeight || innerHeight, d = dims(H), all = d.t1 + d.t2 + d.t3 + 2 * d.A;
      if (mode === "peek") {
        var p = Math.min(1, (now() - rise.t) / 700);
        s = lerp(H + d.A, H * 0.86, easeOut(p)); deep = 1;
      } else if (mode === "rise") {
        var q = Math.min(1, (now() - rise.t) / rise.ms), e = easeIO(q);
        s = lerp(rise.from, -all, e);
        deep = rise.deep * Math.max(0, 1 - q / 0.35);
        if (q >= 1) { finish(); return; }
      }
      draw();
      loop = requestAnimationFrame(tick);
    }
    function finish() {
      if (done) return; done = true;
      if (loop) cancelAnimationFrame(loop); loop = 0;
      el.classList.add("pv-gone");
      var c = el.querySelector("canvas.rpw"); if (c) c.remove();
      el.style.background = "";
      if (fin) { var f = fin; fin = null; try { f(); } catch (e) {} }
    }
    var ctl = {
      /* a slow load: the waterline rises into view at the bottom (call after a short delay) */
      peek: function () {
        if (!OK || done || mode !== "sky") return;
        mode = "peek"; rise = { t: now() }; if (!loop) loop = requestAnimationFrame(tick);
      },
      /* the page is ready: the water comes up over the screen and the page is there beneath it */
      reveal: function (cb, ms) {
        fin = cb || null;
        if (done) return;
        if (!window.__revealedAt) window.__revealedAt = performance.now();   /* the moment the page starts to show (read by the pop-in audit) */
        if (!OK) { finish(); return; }
        var H = el.clientHeight || innerHeight, d = dims(H);
        rise = { t: now(), ms: ms || 1050, from: mode === "peek" && s != null ? s : H + d.A, deep: mode === "peek" ? 1 : 0 };
        mode = "rise"; s = rise.from;
        if (!loop) loop = requestAnimationFrame(tick);
        /* a background tab never runs the animation: finish anyway */
        setTimeout(function () { if (!done && document.hidden) finish(); }, (ms || 1050) + 300);
        setTimeout(finish, (ms || 1050) + 2500);
      },
      done: function () { return done; },
      setLook: function (l) { L = look(l); }
    };
    return ctl;
  }

  /* ===== 2. THE SIDEWAYS SWEEP ===== */
  function sweep(el, o) {
    o = o || {};
    var L = look(o.look), dir = o.dir === "R" ? "R" : "L", phase = o.phase === "out" ? "out" : "in", ms = o.ms || 550, t0 = now(), loop = 0, done = false;
    el.style.background = "transparent"; el.style.transform = "none";
    function frame() {
      loop = 0; if (done) return;
      var S = surface(el), x = S.x, W = S.W, H = S.H, t = (now() - t0) / 1000, q = Math.min(1, (now() - t0) / ms), e = easeIO(q);
      var A = Math.max(6, 0.012 * W), w2, w3, eS, e50, e25;
      x.clearRect(0, 0, W, H);
      /* positions along the direction of travel, as if moving right to left ("L"); "R" is drawn mirrored */
      x.save(); if (dir === "R") { x.translate(W, 0); x.scale(-1, 1); }
      /* the colours stay in SCREEN space (c1 left, c3 right) in both directions: mirrored drawing would
         flip them and the next page's covered frame (CSS, unmirrored) would not match */
      var g = x.createLinearGradient(dir === "R" ? W : 0, 0, dir === "R" ? 0 : W, 0); g.addColorStop(0, L.c1); g.addColorStop(0.5, L.c2); g.addColorStop(1, L.c3);
      if (phase === "in") {
        /* PARALLAX: the leading 25% and 50% bands are slower than the solid one, so it catches up and
           they compress as it covers */
        w2 = 0.09 * W * (1 - 0.45 * e); w3 = 0.12 * W * (1 - 0.45 * e);
        eS = lerp(W + A + 0.21 * W, -A, e);
        e50 = eS - w2; e25 = e50 - w3;
        band(x, false, H, e25, e50, t, 2.2, 1.3, A, g, 0.25);
        band(x, false, H, e50, eS, t, 1.3, 0, A, g, 0.5);
        band(x, false, H, eS, W + 50, t, 0, null, A, g, 1);
      } else {
        /* the solid band moves on; the 50% and 25% bands trail it and spread out as they go */
        w2 = 0.09 * W * (0.55 + 0.45 * e); w3 = 0.12 * W * (0.55 + 0.45 * e);
        eS = lerp(W + A, -A - 0.21 * W - 2 * A, e);
        e50 = eS + w2; e25 = e50 + w3;
        band(x, false, H, -50, eS, t, null, 0, A, g, 1);
        band(x, false, H, eS, e50, t, 0, 1.3, A, g, 0.5);
        band(x, false, H, e50, e25, t, 1.3, 2.2, A, g, 0.25);
      }
      x.restore();
      if (q >= 1) { done = true; if (o.done) try { o.done(); } catch (er) {} return; }
      loop = requestAnimationFrame(frame);
    }
    frame();
    return { stop: function () { done = true; if (loop) cancelAnimationFrame(loop); var c = el.querySelector("canvas.rpw"); if (c) c.remove(); el.style.background = ""; el.style.transform = ""; } };
  }

  /* ===== LAYOUT SETTLED: resolves once el (default: the page) has kept the same position and size, and the
     page the same height, for `quiet` ms (default 250), or after `cap` ms (default 2500) at the latest.
     A cover should lift only then: content that is drawn in time but then MOVES (a list re-rendered when
     live data arrives, a banner pushing things down) is pop-in just the same (Rentals, 2026-10-27). */
  function settled(el, quiet, cap) {
    quiet = quiet || 250; cap = cap || 2500;
    return new Promise(function (res) {
      var t0 = now(), since = t0, last = null, fin = false;
      function end() { if (!fin) { fin = true; res(); } }
      setTimeout(end, cap);
      (function poll() {
        if (fin) return;
        var e = el || document.body; if (!e) { requestAnimationFrame(poll); return; }
        var r = e.getBoundingClientRect(), k = [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height), document.documentElement.scrollHeight].join();
        if (k !== last) { last = k; since = now(); }
        if (now() - since >= quiet) end(); else requestAnimationFrame(poll);
      })();
    });
  }

  /* ===== 3. A WHOLE PAGE'S LOAD COVER IN ONE CALL (for simple pages and future sites) =====
     RPWater.page({sky, look, ready, cap}): needs <div id="pageveil"> as the first thing in <body> and, in
     <head>, CSS painting it the sky colour from the first frame:
       #pageveil{position:fixed;inset:0;z-index:2147483000;background:<sky>;pointer-events:none}
       #pageveil.pv-gone{display:none}
     ready: a Promise (or a function returning true) for "the first screen is really there"; the cover
     also waits for the fonts (at most 1.2 s) and never stays longer than cap (default 3.5 s).
     style: "fade" keeps the same cover mechanics with a plain fade instead of the water (a site with a
     different look, e.g. jackcarlsen.com: its own cover colours in the CSS, no water). */
  function page(o) {
    o = o || {};
    var v = document.getElementById(o.id || "pageveil"); if (!v) return null;
    var done = false, ctl = (OK && o.style !== "fade") ? veil(v, o) : null;
    var peekT = setTimeout(function () { if (ctl && !done) ctl.peek(); }, 450);
    function hide() {
      if (done) return; done = true; clearTimeout(peekT); window.__revealedAt = performance.now();
      if (ctl) { ctl.reveal(o.onDone); return; }
      v.style.transition = RM ? "none" : "opacity .5s ease"; v.style.opacity = "0";
      setTimeout(function () { v.classList.add("pv-gone"); if (o.onDone) o.onDone(); }, 550);
    }
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var fontsCapped = Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1200); })]);
    var ready = o.ready;
    if (typeof ready === "function") { var fn = ready; ready = new Promise(function (r) { (function poll() { var ok = false; try { ok = fn(); } catch (e) {} if (ok) r(); else requestAnimationFrame(poll); })(); }); }
    if (!ready) ready = new Promise(function (r) { document.readyState === "complete" ? r() : addEventListener("load", r, { once: true }); });
    Promise.all([fontsCapped, ready]).then(function () { return settled(o.settle || document.body, 200, 1500); }).then(function () { requestAnimationFrame(function () { requestAnimationFrame(hide); }); });
    setTimeout(hide, o.cap || 3500);
    addEventListener("error", function () { setTimeout(hide, 60); }, { once: true });
    return { hide: hide, ctl: ctl };
  }

  window.RPWater = { ok: OK, veil: veil, sweep: sweep, page: page, settled: settled, look: look, SIG: SIG };
})();
