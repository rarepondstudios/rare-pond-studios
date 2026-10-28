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
  /* (2026-10-28, Jack: "a bit too dark of a blue") the lighter blues of the top of the Studio background */
  var WATER = { c1: "#8bc0ea", c2: "#68a4dc", c3: "#a3d3f3" };
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

  /* ===== 1. THE LOAD COVER: A DUCK FLOATING ON THE WATER, THEN DIVING IN =====
     2026-10-28, Jack: "have the water effect be in the middle of the frame, and have the waves moving
     slightly. While it loads, add a ducky to the middle ... where the user can see it floating ... have
     the middle layer be the sharpest. That way the duck is in between the foreground and background
     layers. Foreground is second blur level, middle is low blur level, bg is largest blur level. Once
     the page is done loading, then the duck and wave move up, and with it the rest of the website rises."
     (2026-10-27 before that: the page rides up with the water, "diving in"; no waterline spawning at the
     bottom; the page's own blues, no purple.)

     While the page loads: the sky (the page's header colour) over the top half, the water across the
     middle in three layers in perspective, top to bottom: the BACK layer (25%, the most blur), the
     MIDDLE layer (50%, sharp: the waterline the duck floats on, behind the duck), the FRONT layer (solid,
     a medium blur, in front of the duck's underside), and under it the deep water, opaque, so nothing
     of the page shows. Each layer drifts sideways on its own (the waves moving slightly) and the duck
     bobs. When the page is ready (reveal), the deep water clears, and the whole surface, the duck with
     it, rises off the top of the screen while the page rides up directly under the front layer.

     Everything that moves is a pre-drawn layer moved by Web Animations on the compositor (see SAMPLED
     KEYFRAMES), so the water keeps moving smoothly while the page is busy loading under it. The blur is
     drawn into the layers once (canvas filter; a CSS blur where a browser lacks that). opts.duck: the
     floating image (Rare Pond pages pass /media/logos/duck-painted.webp); no duck = just the water. */
  var CF = (function () { try { var x = document.createElement("canvas").getContext("2d"); x.filter = "blur(2px)"; return x.filter === "blur(2px)"; } catch (e) { return false; } })();
  /* a wave that repeats every P px (so a layer can drift sideways forever without a seam): the bubble
     rim's two-sine wobble, at P/2 and P/4 */
  function pw(x, P, A, ph) { return A * (0.62 * Math.sin(x / P * 12.566 + ph) + 0.38 * Math.sin(x / P * 25.133 + ph * 1.7)); }
  /* the look's colours repeating every P px along x, for the same reason */
  function cgrad(x, w, P, L) {
    var g = x.createLinearGradient(0, 0, w, 0), cs = [L.c1, L.c2, L.c3], i, n = Math.ceil(w / (P / 3)) + 1;
    for (i = 0; i <= n; i++) { var px = i * P / 3; if (px > w) { g.addColorStop(1, cs[i % 3]); break; } g.addColorStop(px / w, cs[i % 3]); }
    return g;
  }
  function veil(el, o) {
    o = o || {};
    var L = look(o.look || WATER), sky = o.sky || "#ffffff", done = false, fin = null, anims = [], loops = [], moved = [], rig = null, scene = null, shown = null;
    var W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight;
    var A = Math.max(5, 0.011 * H), P = Math.round(0.9 * W);
    /* the layers' edges, in px from the top of the screen while loading */
    var yM = 0.5 * H, yB = yM - 0.055 * H, yF = yM + 0.05 * H, tF = 0.07 * H, yFB = yF + tF;
    /* the page's HEADER (opts.header, default the body's own <header>s) does not ride up with the water: the
       page's blue comes up first, straight out of the water, and the header (white on most pages) comes in
       after (2026-10-28, Jack: "it should lead directly into the blue BG of the website, then the header can
       come in afterwards") */
    var heads = [], headIn = [];
    /* what rides up with the water: every top-level element of the page except the covers themselves
       and the custom cursor (opt out anything else with data-no-dive) */
    function divers() {
      var out = [], kids = document.body ? document.body.children : [], i;
      for (i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n === el || n.id === "xwipe" || n.id === "rp-cursor" || /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/.test(n.tagName) || n.hasAttribute("data-no-dive") || heads.indexOf(n) >= 0) continue;
        if (/(^|\s)rpc-/.test(n.className || "")) continue;
        out.push(n);
      }
      return out;
    }
    /* one drifting layer: the water below a wavy top edge (and above a wavy or straight bottom edge),
       blurred by `blur` px, alpha `al`, drifting P px every `sec` seconds (negative = to the right) */
    function layer(top, bot, phT, phB, al, blur, sec, fill) {
      var k = res(), pad = Math.ceil(3 * blur + 2 * A + 4), w = W + P + 2 * pad, h = (bot - top) + 2 * pad;
      var c = document.createElement("canvas"); c.className = "rpw"; c.setAttribute("aria-hidden", "true");
      c.width = Math.max(2, Math.round(w * k)); c.height = Math.max(2, Math.round(h * k));
      c.style.cssText = "position:absolute;left:" + (-pad) + "px;top:" + (top - pad) + "px;width:" + w + "px;height:" + h + "px;display:block;pointer-events:none;will-change:transform" + (!CF && blur > 1.5 ? ";filter:blur(" + blur.toFixed(1) + "px)" : "");
      var x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0);
      if (CF && blur > 0.3) x.filter = "blur(" + (blur * k).toFixed(2) + "px)";
      var step = Math.max(8, W / 120), i, ox = pad;   /* local x = screen x + pad (at drift 0) */
      x.globalAlpha = al; x.fillStyle = fill || cgrad(x, w, P, L); x.beginPath();
      for (i = -pad - 20; i <= w + 20; i += step) { var y = pad + (phT == null ? 0 : pw(i - ox, P, A, phT)); i === -pad - 20 ? x.moveTo(i, y) : x.lineTo(i, y); }
      for (i = w + 20; i >= -pad - 20; i -= step) x.lineTo(i, h - pad + (phB == null ? pad + 20 : pw(i - ox, P, A, phB)));
      x.closePath(); x.fill();
      scene.appendChild(c);
      if (sec) loops.push(c.animate([{ transform: "translate3d(" + (sec > 0 ? 0 : -P) + "px,0,0)" }, { transform: "translate3d(" + (sec > 0 ? -P : 0) + "px,0,0)" }], { duration: Math.abs(sec) * 1000, iterations: Infinity, easing: "linear" }));
      return c;
    }
    var deep = null, duckBox = null;
    function build() {
      if (!OK || !el.animate || rig) return;
      rig = document.createElement("div"); rig.className = "rpw";
      rig.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;will-change:transform,opacity;opacity:0";
      scene = rig;
      /* the sky, behind the translucent layers, down into the front layer */
      var s = document.createElement("div");
      s.style.cssText = "position:absolute;left:0;right:0;top:" + (-H) + "px;height:" + (H + yF + tF / 2) + "px;background:" + sky;
      rig.appendChild(s);
      layer(yB, yF + tF / 2, 2.2, null, 0.25, 0.013 * H, 11);         /* back: 25%, most blur, drifts left */
      layer(yM, yF + tF / 2, 1.3, null, 1 / 3, 0.6, -8.5);            /* middle: 25% + 1/3 = 50%, sharp, drifts right */
      if (o.duck) {
        duckBox = document.createElement("div");
        var dh = Math.max(64, Math.min(0.17 * H, 200, 0.3 * W)), dw = dh * 1.32;
        duckBox.style.cssText = "position:absolute;left:" + ((W - dw) / 2).toFixed(1) + "px;top:" + (yF + 0.022 * H - dh).toFixed(1) + "px;width:" + dw.toFixed(1) + "px;height:" + dh.toFixed(1) + "px;opacity:0;will-change:transform,opacity";
        var im = new Image(); im.alt = ""; im.setAttribute("aria-hidden", "true"); im.decoding = "async";
        im.style.cssText = "display:block;width:100%;height:100%;object-fit:contain";
        duckBox.appendChild(im); rig.appendChild(duckBox);
        /* it bobs and rocks back and forth with the waves (Jack, 2026-10-28) */
        var sx = Math.min(12, 0.009 * W).toFixed(1), by = (0.006 * H).toFixed(1), bu = (-0.005 * H).toFixed(1);
        var bob = duckBox.animate([
          { transform: "translate3d(" + (-sx) + "px," + bu + "px,0) rotate(-3deg)" },
          { transform: "translate3d(0," + by + "px,0) rotate(1deg)", offset: 0.25 },
          { transform: "translate3d(" + sx + "px," + bu + "px,0) rotate(3deg)", offset: 0.5 },
          { transform: "translate3d(0," + by + "px,0) rotate(-1deg)", offset: 0.75 },
          { transform: "translate3d(" + (-sx) + "px," + bu + "px,0) rotate(-3deg)" }
        ], { duration: 4200, iterations: Infinity, easing: "ease-in-out" });
        loops.push(bob);
        im.src = o.duck;
        (im.decode ? im.decode() : new Promise(function (r) { im.onload = r; })).then(function () {
          if (duckBox && !done) duckBox.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, fill: "forwards", easing: "ease-out" });
        }, function () {});
      }
      /* front: solid, medium blur, drifts left. Its colour is the page's own background at its top (opts.join),
         so when the page rises in right under it, the water runs straight into the page's blue (2026-10-28,
         Jack: "the blue of the waves has to stay directly connected to the blue of the top of the background") */
      var fr = layer(yF, yFB, 0, 3.1, 1, 0.0065 * H, 6.5, o.join || null);
      deep = document.createElement("div");
      /* the deep water = the page's own background (opts.deep, a CSS background whose top is the page's top),
         so clearing it on reveal only brings in the page's content, never a change of colour */
      deep.style.cssText = "position:absolute;left:0;right:0;top:" + (yF + tF / 2) + "px;height:" + (H - yF + 0.1 * H) + "px;will-change:opacity;background:" + (o.deep || ("linear-gradient(180deg," + (o.join || L.c2) + "," + L.c3 + ")")) + ";background-position:0 " + (tF / 2).toFixed(1) + "px;background-repeat:no-repeat;background-color:" + (o.join || L.c2);
      rig.insertBefore(deep, fr);
      el.appendChild(rig);
      /* the water fades in over the white (never just there: no "spawn") */
      shown = rig.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, fill: "forwards", easing: "ease-out" });
      shown.finished.then(function () { if (!done) el.style.background = "transparent"; }, function () {});
    }
    function finish() {
      if (done) return; done = true;
      anims.concat(loops).forEach(function (a) { try { a.cancel(); } catch (e) {} }); anims = []; loops = [];
      moved.forEach(function (n) { n.style.willChange = n.__rpwWC || ""; }); moved = [];
      el.classList.add("pv-gone");
      if (rig) { rig.remove(); rig = null; }
      el.style.background = "";
      /* the header comes in: a short fade and drop into place */
      headIn.forEach(function (h) { try { h.animate([{ opacity: 0, transform: "translate3d(0,-14px,0)" }, { opacity: 1, transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)" }); } catch (e) {} });
      headIn = [];
      if (o.signal !== false) mark("gone");
      if (fin) { var f = fin; fin = null; try { f(); } catch (e) {} }
    }
    function rise(ms) {
      /* the surface (and the duck) rises until the front layer's bottom edge is off the top */
      var S = yFB + 3 * A + 0.02 * H;
      function ry(e) { return -S * e; }
      /* the page: its top rides just under the front layer, then eases into place (a smooth "max(y, 0)"
         so it decelerates instead of stopping dead) while the surface carries on over the top */
      var from = yFB, to = yFB - S, c = 0.22 * H;
      function F(y) { return (y + Math.sqrt(y * y + c * c)) / 2; }
      var F0 = F(to), sc = from / (F(from) - F0);
      function pageY(e) { return (F(yFB + ry(e)) - F0) * sc; }
      var opts = { duration: ms, easing: "linear", fill: "both" };
      anims.push(rig.animate(frames(ry), opts));
      /* the deep water clears as it starts to rise, so the page is there under the surface */
      if (deep) anims.push(deep.animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], opts));
      try { heads = [].slice.call(document.querySelectorAll(o.header || "body > header")); } catch (e) {}
      if (o.dive !== false) heads.forEach(function (h) { try { anims.push(h.animate([{ opacity: 0 }, { opacity: 0 }], opts)); headIn.push(h); } catch (e) {} });
      if (o.dive !== false) {
        var pf = frames(pageY);
        divers().forEach(function (n) {
          n.__rpwWC = n.style.willChange; n.style.willChange = "transform"; moved.push(n);
          try { anims.push(n.animate(pf, opts)); } catch (e) {}
        });
      }
      el.style.background = "transparent";
      anims[0].finished.then(finish, function () {});
      /* a background tab never runs the animation: finish anyway */
      setTimeout(function () { if (!done && document.hidden) finish(); }, ms + 300);
      setTimeout(finish, ms + 2500);
    }
    build();
    var ctl = {
      peek: function () {},   /* (the old "waterline peeks in while loading" step: kept as a no-op) */
      reveal: function (cb, ms) {
        fin = cb || null;
        if (done) return;
        if (!window.__revealedAt) window.__revealedAt = performance.now();   /* the moment the page starts to show (read by the pop-in audit) */
        mark("ready");
        /* already hidden (a sideways sweep is this page's cover), or no canvas: nothing to animate */
        if (el.classList.contains("pv-gone")) { o.signal = false; finish(); return; }   /* the sweep signals "gone" itself */
        if (!rig) { finish(); return; }
        ms = ms || 2000;
        /* the water first finishes fading in (at most 0.38 s), then rises */
        if (shown && shown.playState !== "finished") shown.finished.then(function () { if (!done) rise(ms); }, function () { finish(); });
        else rise(ms);
        setTimeout(finish, ms + 3500);
      },
      done: function () { return done; },
      setLook: function (l) { L = look(l || WATER); if (rig && !done && !anims.length) { var r = rig; rig = null; loops.forEach(function (a) { try { a.cancel(); } catch (e) {} }); loops = []; r.remove(); build(); if (shown) shown.finish(); } }
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

  /* ===== FIRST SCREEN READY (2026-10-28, Jack: "decrease loading times across the site"): resolves once
     every image and video that is on the screen right now can be shown (images decoded, videos with a
     frame), at most `cap` ms (default 1500). A cover should wait for THIS, not the window 'load' event,
     which also waits for every image further down the page. Call it after the page has built its first
     screen (DOMContentLoaded or later). */
  function firstScreen(cap) {
    cap = cap || 1500;
    return new Promise(function (res) {
      function go() {
        var vw = innerWidth, vh = innerHeight, wait = [];
        function on(e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw; }
        [].forEach.call(document.querySelectorAll("img"), function (im) {
          if ((im.complete && im.naturalWidth) || !on(im)) return;
          wait.push((im.decode ? im.decode() : new Promise(function (r) { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); })).catch(function () {}));
        });
        [].forEach.call(document.querySelectorAll("video"), function (v) {
          if (v.readyState >= 2 || !on(v) || v.preload === "none") return;
          wait.push(new Promise(function (r) { v.addEventListener("loadeddata", r, { once: true }); v.addEventListener("error", r, { once: true }); }));
        });
        Promise.race([Promise.all(wait), new Promise(function (r) { setTimeout(r, cap); })]).then(res);
      }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true }); else go();
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

  window.RPWater = { ok: OK, veil: veil, sweep: sweep, page: page, settled: settled, firstScreen: firstScreen, look: look, SIG: SIG, WATER: WATER,
    whenReady: function (fn) { when("ready", fn); }, whenGone: function (fn) { when("gone", fn); }, markReady: function () { mark("ready"); }, markGone: function () { mark("gone"); } };
})();
