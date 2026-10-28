/* RP WATER (2026-10-27): the two full-screen covers of the Rare Pond sites, drawn in the V3 bubble's
   three-tier look (a solid band, a 50% band, a 25% band, with gently wobbling edges).

   1. RPWater.veil(el, opts): ENTERING THE WATER, the page-load cover (Jack: "the screen starts white like
      the header, then the blues of the water come up from the bottom of the screen, as the user enters
      the water ... hiding element pop in"). The cover is the page's "sky" colour (white on the Studio
      and Rentals, the Media page's dark blue) and holds, plain, while the page loads. When the page is
      ready, reveal() dives in: the waterline rises from below the screen and the page rides up with it
      (sky above, the three bands at the surface, the page under it), then settles into place as the
      surface passes over the top. Nothing of the page is visible until it is ready.
   2. RPWater.sweep(el, opts): the sideways Studio / Rentals / Media transition (xwipe.js). Three bands
      cross the screen with parallax: the 25% band leads, the 50% band follows, the solid band covers;
      on the next page the solid band moves on and the 50% and 25% bands trail it off (one continuous
      motion across the page load).

   The MOTION of both is a Web Animation (the browser's compositor thread), so it stays smooth while the
   page is busy loading; see SAMPLED KEYFRAMES. Drawing is plain 2D canvas, not WebGL, on purpose: both run while a page is loading, before any shader could be
   built, and must work on every device and every effects tier. Generic: any page (any colours) uses
   them through the options; nothing here is specific to one page. prefers-reduced-motion and missing
   canvas fall back to the old plain fades (the callers handle that through RPWater.ok). */
(function () {
  "use strict";
  var RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var SIG = { c1: "#56c8ff", c2: "#3f6bff", c3: "#9b5cff" };
  /* the water entry's default colours: the Studio page's own blues (its background gradient), no purple
     (Jack, 2026-10-27: "more like it's diving into the water that matches the main page background") */
  var WATER = { c1: "#6fabe1", c2: "#3d7bbc", c3: "#2a64a6" };
  function canvasOk() { try { return !!document.createElement("canvas").getContext("2d"); } catch (e) { return false; } }
  var OK = !RM && canvasOk();
  function now() { return performance.now(); }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function look(l) { l = l || {}; return { c1: l.c1 || SIG.c1, c2: l.c2 || l.c1 || SIG.c2, c3: l.c3 || l.c2 || l.c1 || SIG.c3 }; }

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

  /* ===== shared: SAMPLED KEYFRAMES =====
     2026-10-27 (Jack: "transitioning between pages causes the site to chug, even on the high end PC"):
     both covers used to be redrawn AND moved from JavaScript on every frame, while the arriving page was
     doing its heaviest work (building itself, its first style and layout pass took 100 to 150 ms on a
     mid-range CPU), so the water froze and jumped exactly when it was supposed to be smooth. Now the
     MOTION is a Web Animation on a pre-drawn layer: the browser's compositor moves it on its own
     thread, smooth even when the page's main thread is busy. JavaScript only refreshes the edges'
     gentle wobble, when it has a free moment (a late wobble frame is invisible; a late position is a
     stutter). Each motion is sampled into keyframes from one curve, so layers that must move together
     (the waterline and the page under it) cannot drift apart. */
  var NK = 32;
  function frames(fn, axis) {
    var k = [], i;
    for (i = 0; i <= NK; i++) { var q = i / NK; k.push({ offset: q, transform: axis === "x" ? "translate3d(" + fn(easeIO(q)).toFixed(2) + "px,0,0)" : "translate3d(0," + fn(easeIO(q)).toFixed(2) + "px,0)" }); }
    return k;
  }
  function layerCanvas(parent, w, h, k) {
    var c = document.createElement("canvas"); c.className = "rpw"; c.setAttribute("aria-hidden", "true");
    c.width = Math.max(2, Math.round(w * k)); c.height = Math.max(2, Math.round(h * k));
    c.style.cssText = "position:absolute;left:0;top:0;width:" + w + "px;height:" + h + "px;display:block;pointer-events:none;will-change:transform";
    parent.appendChild(c);
    var x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0);
    return { c: c, x: x };
  }
  /* wobble refresh at about 30 fps, only while the main thread has time (see above) */
  function wobbler(draw) {
    var on = true, last = 0, id = 0;
    (function f(ts) { if (!on) return; if (!last || ts - last > 30) { last = ts; try { draw((now() - T0) / 1000); } catch (e) {} } id = requestAnimationFrame(f); })(0);
    return function () { on = false; if (id) cancelAnimationFrame(id); };
  }
  var T0 = now();
  function res() { return Math.min(window.devicePixelRatio || 1, 2) * 0.5; }

  /* ===== cover signals, for whatever runs after a cover =====
     RPWater.whenReady(fn): the page said it is ready to be seen (its load cover started to lift). The
       sideways sweep's second half waits for this instead of the bare window 'load' event, which fires
       long before a page that builds itself from data is built (the "empty page, then everything pops
       in" on the hop back to the Studio).
     RPWater.whenGone(fn): the cover (water entry or sweep) has completely gone. Heavy optional work
       (the About logo's frames, and so on) starts after this, so it never competes with a cover's motion. */
  var sig = { ready: [], gone: [] }, sigAt = { ready: 0, gone: 0 };
  function when(n, fn) { if (sigAt[n]) { try { fn(); } catch (e) {} } else sig[n].push(fn); }
  function mark(n) { if (sigAt[n]) return; sigAt[n] = now(); sig[n].splice(0).forEach(function (f) { try { f(); } catch (e) {} }); }

  /* ===== 1. ENTERING THE WATER (diving in) =====
     2026-10-27, Jack: "if as the wave came up from the bottom of the screen, the page elements followed
     with it, so it appears that the user is diving into the water, rather than a white curtain rising up
     to reveal the page". The waterline rises from below the screen (never sitting at the bottom first:
     no "spawn"), slowly enough to be seen, and the page rides up WITH it: the top of the page is right
     under the waterline, the sky (the page's header colour) above, as if the camera dives in. The page
     glides into its place as the surface passes over the top of the screen. The water is the Studio
     page's own blues by default (no purple). */
  function veil(el, o) {
    o = o || {};
    var L = look(o.look || WATER), sky = o.sky || "#ffffff", done = false, fin = null, anims = [], stopW = null, layer = null, moved = [];
    /* thickness of the three bands and the wobble, in viewport heights: the 25% band widest */
    function dims(H) { return { t1: 0.04 * H, t2: 0.08 * H, t3: 0.2 * H, A: Math.max(5, 0.011 * H) }; }
    /* what rides up with the water: every top-level element of the page except the covers themselves
       and the custom cursor (opt out anything else with data-no-dive) */
    function divers() {
      var out = [], kids = document.body ? document.body.children : [], i;
      for (i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n === el || n.id === "xwipe" || n.id === "rp-cursor" || /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/.test(n.tagName) || n.hasAttribute("data-no-dive")) continue;
        if (/(^|\s)rpc-/.test(n.className || "")) continue;
        out.push(n);
      }
      return out;
    }
    function finish() {
      if (done) return; done = true;
      if (stopW) stopW(); stopW = null;
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); anims = [];
      moved.forEach(function (n) { n.style.willChange = n.__rpwWC || ""; }); moved = [];
      el.classList.add("pv-gone");
      if (layer) { layer.remove(); layer = null; }
      el.style.background = "";
      if (o.signal !== false) mark("gone");
      if (fin) { var f = fin; fin = null; try { f(); } catch (e) {} }
    }
    var ctl = {
      /* (the "waterline peeks in while loading" step is gone: Jack saw it as the waves spawning at the
         bottom. Kept as a no-op so older pages calling it keep working.) */
      peek: function () {},
      reveal: function (cb, ms) {
        fin = cb || null;
        if (done) return;
        if (!window.__revealedAt) window.__revealedAt = performance.now();   /* the moment the page starts to show (read by the pop-in audit) */
        mark("ready");
        /* already hidden (a sideways sweep is this page's cover), or no canvas: nothing to animate */
        if (el.classList.contains("pv-gone")) { o.signal = false; finish(); return; }   /* the sweep signals "gone" itself */
        if (!OK || !el.animate) { finish(); return; }
        ms = ms || 2000;
        var W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight, d = dims(H), all = d.t1 + d.t2 + d.t3 + 2 * d.A;
        var pad = 2 * d.A + 4, Y0 = H + pad, LH = Y0 + all + pad, k = res();
        var from = H + 2 * d.A + 2, to = -all;
        /* the water: one layer, sky above the waterline (local Y0), the three bands below it */
        var LC = layerCanvas(el, W, LH, k); layer = LC.c;
        function draw(t) {
          var x = LC.x; x.clearRect(0, 0, W, LH);
          band(x, true, W, -50, Y0, t, null, 0, d.A, sky, 1);
          var g = hgrad(x, W, L);
          band(x, true, W, Y0, Y0 + d.t1, t, 0, 1.3, d.A, g, 1);
          band(x, true, W, Y0 + d.t1, Y0 + d.t1 + d.t2, t, 1.3, 2.2, d.A, g, 0.5);
          band(x, true, W, Y0 + d.t1 + d.t2, Y0 + d.t1 + d.t2 + d.t3, t, 2.2, 3.1, d.A, g, 0.25);
        }
        draw((now() - T0) / 1000);
        function y0(e) { return lerp(from, to, e); }
        /* the page: its top rides just under the waterline, then eases into place (a smooth "max(y, 0)",
           so it decelerates instead of stopping dead) while the surface carries on over the top */
        var c = 0.22 * H;
        function F(y) { return (y + Math.sqrt(y * y + c * c)) / 2; }
        var F0 = F(to), sc = from / (F(from) - F0);
        function pageY(e) { return (F(y0(e)) - F0) * sc; }
        var opts = { duration: ms, easing: "linear", fill: "both" };
        anims.push(layer.animate(frames(function (e) { return y0(e) - Y0; }), opts));
        if (o.dive !== false) {
          var pf = frames(pageY);
          divers().forEach(function (n) {
            n.__rpwWC = n.style.willChange; n.style.willChange = "transform"; moved.push(n);
            try { anims.push(n.animate(pf, opts)); } catch (e) {}
          });
        }
        el.style.background = "transparent";   /* the layer covers exactly what the sky colour did */
        stopW = wobbler(draw);
        anims[0].finished.then(finish, function () {});
        /* a background tab never runs the animation: finish anyway */
        setTimeout(function () { if (!done && document.hidden) finish(); }, ms + 300);
        setTimeout(finish, ms + 2500);
      },
      done: function () { return done; },
      setLook: function (l) { L = look(l || WATER); }
    };
    return ctl;
  }

  /* ===== 2. THE SIDEWAYS SWEEP =====
     Three layers moved by the compositor (see SAMPLED KEYFRAMES): each is a half-plane with one wavy edge.
     Stacked in the same colours their opacities combine to the three tiers: the 25% layer alone = 25%,
     with the 1/3 layer over it = 50%, the solid layer = 100%. Each edge moves at its own speed (the
     parallax: the leading bands bunch up as the solid one catches them, then spread out on the next
     page). Positions are worked out as if travelling right to left ("L"); "R" is the same, mirrored. */
  function sweep(el, o) {
    o = o || {};
    var L = look(o.look), dir = o.dir === "R" ? "R" : "L", phase = o.phase === "out" ? "out" : "in", ms = o.ms || 600, done = false, anims = [], stopW = null;
    var W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight, A = Math.max(6, 0.012 * W), k = res();
    var box = document.createElement("div"); box.className = "rpw";
    box.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none" + (dir === "R" ? ";transform:scaleX(-1)" : "");
    el.appendChild(box);
    var CW = Math.ceil(1.25 * W + 4 * A), M = A + 2, specs;
    /* edges: [start, end] (linear in the eased progress), alpha, wobble phase */
    if (phase === "in") {
      specs = [
        { a: W + 2 * A, b: -A - 0.187 * W, al: 0.25, ph: 2.2 },
        { a: W + 2 * A + 0.24 * W, b: -A - 0.055 * W, al: 1 / 3, ph: 1.3 },
        { a: W + 2 * A + 0.34 * W, b: -A, al: 1, ph: 0, solid: 1 }
      ];
    } else {
      specs = [
        { a: W + A + 0.187 * W, b: -3 * A, al: 0.25, ph: 2.2 },
        { a: W + A + 0.055 * W, b: -3 * A - 0.24 * W, al: 1 / 3, ph: 1.3 },
        { a: W + A, b: -3 * A - 0.34 * W, al: 1, ph: 0, solid: 1 }
      ];
    }
    specs.forEach(function (s) {
      var LC = layerCanvas(box, CW, H, k); s.c = LC.c; s.x = LC.x;
      /* local x of the edge, and the layer offset that puts it at screen edge position p */
      s.ex = phase === "in" ? M : CW - M;
      s.off = function (p) { return p - s.ex; };
      /* colours in SCREEN space at the moment the solid layer covers everything (end of "in", start of
         "out"), so the hand-over to the next page's plain CSS panel is seamless */
      var T = s.off(phase === "in" ? s.b : s.a);
      s.g = dir === "R" ? [W - T, -T] : [-T, W - T];
    });
    function draw(t) {
      specs.forEach(function (s) {
        var x = s.x, g = x.createLinearGradient(s.g[0], 0, s.g[1], 0);
        g.addColorStop(0, L.c1); g.addColorStop(0.5, L.c2); g.addColorStop(1, L.c3);
        x.clearRect(0, 0, CW, H);
        if (phase === "in") band(x, false, H, s.ex, CW + 50, t, s.ph, null, A, g, s.al);
        else band(x, false, H, -50, s.ex, t, null, s.ph, A, g, s.al);
      });
    }
    draw((now() - T0) / 1000);
    var opts = { duration: ms, easing: "linear", fill: "both" };
    specs.forEach(function (s) { anims.push(s.c.animate(frames(function (e) { return s.off(lerp(s.a, s.b, e)); }, "x"), opts)); });
    el.style.background = "transparent"; el.style.transform = "none";
    stopW = wobbler(draw);
    function end() { if (done) return; done = true; if (stopW) stopW(); if (o.done) try { o.done(); } catch (er) {} }
    anims[2].finished.then(end, function () {});
    setTimeout(end, ms + 400);
    return { stop: function () { done = true; if (stopW) stopW(); anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); box.remove(); el.style.background = ""; el.style.transform = ""; } };
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
    function hide() {
      if (done) return; done = true; window.__revealedAt = performance.now();
      if (ctl) { ctl.reveal(o.onDone); return; }
      mark("ready");
      v.style.transition = RM ? "none" : "opacity .5s ease"; v.style.opacity = "0";
      setTimeout(function () { v.classList.add("pv-gone"); mark("gone"); if (o.onDone) o.onDone(); }, 550);
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

  window.RPWater = { ok: OK, veil: veil, sweep: sweep, page: page, settled: settled, look: look, SIG: SIG, WATER: WATER,
    whenReady: function (fn) { when("ready", fn); }, whenGone: function (fn) { when("gone", fn); }, markReady: function () { mark("ready"); }, markGone: function () { mark("gone"); } };
})();
