/* PERFORMANCE + DIAGNOSTIC PROBE (rewritten 2026-10-27). Loaded only when the URL has ?perf=1 (the loader
   is in index.html's head). Nothing here runs for normal visitors.

   Jack (2026-10-27): "Make a comprehensive test when going to that perf link that tests everything possible
   and gives you all the information you need to diagnose ... I want to avoid running it over and over".
   So one run, about a minute, measures everything we could want on a machine we cannot reach, and SENDS
   the full report itself to the Supabase table perf_reports through the one write-only function
   submit_perf_report (migrations 20261027b; the browser key can call nothing else but
   catalog_availability). The panel shows the report number; Claude reads the report from the table.
   If sending fails the panel offers the report as a download instead.

   What it does, in order (the panel shows each step):
     0  freshness: fetches the live page, compares every script / stylesheet version with what this tab
        loaded, and reloads once if this tab is out of date (so a report is never about an old version)
     1  this machine: browser, OS, cores, memory, screen, zoom, preferences, a CPU speed test, the GPU
        (a separate WebGL context: renderer, limits, extensions) and WebGPU adapter info where available
     2  the bubble engine: version, effects tier and why, shader build times, copy calibration and
        self-check, and every bubble's state (RPBubble.debug())
     3  the featured carousel card: geometry and styles of every layer, the rim canvas's alpha along all
        four edges, what sits on top of its right / bottom edge (elementsFromPoint), a small picture of it
     4  the page at rest (5 s): frame pacing, long tasks, long animation frames with script attribution
     5  A/B (3 s each): normal / bubbles frozen / CSS animations paused / both / bubbles at half resolution,
        which separates WebGL cost from the page's own CSS animation cost
     6  four carousel moves: frame pacing per move, the featured card checked mid-move and after
     7  two more moves with the shared WebGL canvas at its old screen size (and its copy self-check),
        then put back: the cost of the canvas size on this machine
     8  scrolling the home page down and back
     9  the projects page (3 s at rest)
     10 opening the featured film (the depth zoom) and closing it again
     11 micro-benchmarks: three ways of getting WebGL frames onto the page, the copy correctness test
     12 resources (slowest / largest), memory, paint timings, a page census (animations, blurs, videos,
        canvases), console errors, focus / visibility changes and pointer movement during the run
   Keep the mouse still and the tab in front while it runs. */
(function () {
  "use strict";
  var PROBE_VER = 11;
  var KEY = "sb_publishable_VFAFJq23B8hJAGViL2nDiA_uTAVxe05";   /* public by design (also in rentals/assets/app.js) */
  var SEND = "https://gnifidmyahtzydwvaegj.supabase.co/rest/v1/rpc/submit_perf_report";
  var T0 = performance.now();
  var R = { probe: PROBE_VER, at: new Date().toISOString(), page: location.pathname + location.search, ua: navigator.userAgent, steps: {}, errors: [], events: [], timeline: [] };

  /* ---------- collectors that run for the whole test ---------- */
  var gaps = [], lastF = 0, longs = [], loafs = [], ptrMoves = 0;
  (function f(now) { if (lastF) gaps.push([now, now - lastF]); lastF = now; requestAnimationFrame(f); })(performance.now());
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { longs.push([e.startTime, e.duration]); }); }).observe({ type: "longtask", buffered: true }); } catch (e) {}
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) {
        loafs.push({
          t: Math.round(e.startTime), dur: Math.round(e.duration), block: Math.round(e.blockingDuration || 0),
          render: e.renderStart ? Math.round(e.startTime + e.duration - e.renderStart) : null,
          style: e.styleAndLayoutStart ? Math.round(e.startTime + e.duration - e.styleAndLayoutStart) : null,
          scripts: (e.scripts || []).slice(0, 5).map(function (s) {
            return { src: String(s.sourceURL || "").replace(location.origin, "").slice(0, 80), fn: String(s.sourceFunctionName || "").slice(0, 40), inv: String(s.invoker || "").slice(0, 60), type: s.invokerType, dur: Math.round(s.duration), forced: Math.round(s.forcedStyleAndLayoutDuration || 0) };
          })
        });
      });
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch (e) {}
  function err(kind, msg) { if (R.errors.length < 60) R.errors.push({ t: Math.round(performance.now()), kind: kind, msg: String(msg).slice(0, 300) }); }
  addEventListener("error", function (e) { err("error", (e.message || "") + " @ " + (e.filename || "").replace(location.origin, "") + ":" + (e.lineno || "")); });
  addEventListener("unhandledrejection", function (e) { err("rejection", e.reason && (e.reason.message || e.reason)); });
  ["error", "warn"].forEach(function (k) {
    var o = console[k]; if (!o) return;
    console[k] = function () { try { err("console." + k, Array.prototype.map.call(arguments, function (a) { return a && a.message ? a.message : String(a); }).join(" ")); } catch (e) {} return o.apply(console, arguments); };
  });
  function ev(what) { if (R.events.length < 80) R.events.push([Math.round(performance.now()), what]); }
  document.addEventListener("visibilitychange", function () { ev("visibility " + document.visibilityState); });
  addEventListener("blur", function () { ev("window blur"); });
  addEventListener("focus", function () { ev("window focus"); });
  addEventListener("resize", function () { ev("resize " + innerWidth + "x" + innerHeight); });
  addEventListener("pointermove", function () { ptrMoves++; }, { passive: true });
  /* every 0.5 s: the page's frame cadence (median ms per frame), bubble resolution / fps / tier; a cadence
     that jumps (a browser switching to 30 fps, say) is logged in events with the step that was running */
  var curStep = "start", lastCad = 0, lastQ = null;
  R.timelineCols = ["t", "cadenceMs", "scale", "fps", "tier", "moveRing"];
  var tl = setInterval(function () {
    var B = window.RPBubble, q = B && B.quality, ti = B && B.tier && B.tier(), now = performance.now();
    var g = gaps.filter(function (x) { return x[0] > now - 500; }).map(function (x) { return x[1]; }).sort(function (a, b) { return a - b; });
    var cad = g.length ? Math.round(g[g.length >> 1] * 10) / 10 : null;
    if (cad && lastCad && (cad > lastCad * 1.4 || cad < lastCad / 1.4)) ev("cadence " + lastCad + " -> " + cad + " ms per frame, during: " + curStep);
    if (cad) lastCad = cad;
    /* every change of the bubbles' quality, with the step that was running: resolution, tier, and the
       animation rate (which must stay 24: since 20261027m a struggling device gets a lower resolution or
       still rims, never a choppier animation; anything else is flagged) */
    var qs = q ? [Math.round(q.scale * 100) / 100, q.fps, ti ? ti.tier : null].join(" / ") : null;
    if (qs && qs !== lastQ) { ev("quality: resolution " + qs.replace(" / ", ", animation ").replace(" / ", " fps, tier ") + (lastQ ? "" : " (start)") + ", during: " + curStep); lastQ = qs; }
    if (q && q.fps < 24 && !R.choppy) { R.choppy = "the bubble animation rate fell to " + q.fps + " fps during " + curStep; ev("CHOPPY: " + R.choppy); }
    if (R.timeline.length < 200) R.timeline.push([Math.round(now), cad, q ? Math.round(q.scale * 100) / 100 : null, q ? q.fps : null, ti ? ti.tier : null, ti ? ti.moveRing : null]);
  }, 500);

  /* ---------- panel ---------- */
  var box = document.createElement("div");
  box.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483647;max-width:min(680px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:rgba(0,0,0,.9);color:#7dff9a;font:600 14px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:12px 14px;border-radius:10px;white-space:pre-wrap;pointer-events:none";
  var lines = ["Rare Pond diagnostic (v" + PROBE_VER + "): keep the mouse still and this tab in front, about a minute."];
  function out(extra) { box.textContent = lines.join("\n") + (extra ? "\n" + extra : ""); }
  function say(t) { lines.push(t); out(); }
  function addBox() { (document.body || document.documentElement).appendChild(box); out(); }
  if (document.body) addBox(); else addEventListener("DOMContentLoaded", addBox);

  /* ---------- helpers ---------- */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function raf2() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }
  function rnd(v, d) { var k = Math.pow(10, d || 0); return Math.round(v * k) / k; }
  function stat(a) {
    if (!a.length) return { n: 0 };
    var x = a.slice().sort(function (p, q) { return p - q; }), s = 0; x.forEach(function (v) { s += v; });
    return { n: x.length, fps: Math.round(1000 * x.length / s), avg: rnd(s / x.length, 1), p50: rnd(x[Math.floor(x.length * 0.5)], 1), p95: Math.round(x[Math.floor(x.length * 0.95)]), max: Math.round(x[x.length - 1]), over25: x.filter(function (v) { return v > 25; }).length, over50: x.filter(function (v) { return v > 50; }).length };
  }
  function win(t1, t2) { return gaps.filter(function (g) { return g[0] >= t1 && g[0] < t2; }).map(function (g) { return g[1]; }); }
  function longIn(t1, t2) { var n = 0, ms = 0; longs.forEach(function (l) { if (l[0] >= t1 && l[0] < t2) { n++; ms += l[1]; } }); return { n: n, ms: Math.round(ms) }; }
  function loafIn(t1, t2) { return loafs.filter(function (l) { return l.t >= t1 && l.t < t2; }).sort(function (a, b) { return b.dur - a.dur; }).slice(0, 6); }
  function bstats() { var S = window.RPBubble && RPBubble.stats; return S ? { draws: S.draws, drawMs: S.drawMs, frames: S.frames, frameMs: S.frameMs } : null; }
  function bdelta(a) {
    var b = bstats(); if (!a || !b) return null;
    var dn = b.draws - a.draws, fn = b.frames - a.frames;
    return { draws: dn, msPerDraw: dn ? rnd((b.drawMs - a.drawMs) / dn, 2) : 0, bubbleFrames: fn, msPerBubbleFrame: fn ? rnd((b.frameMs - a.frameMs) / fn, 2) : 0 };
  }
  /* measure a window of time: frame pacing, long tasks, long animation frames, bubble work */
  function measure(name, ms, during) {
    var t1 = performance.now(), b0 = bstats(), p = Promise.resolve(during ? during() : null);
    return Promise.all([p, wait(ms)]).then(function (res) {
      var t2 = performance.now(), g = win(t1, t2);
      var m = { ms: Math.round(t2 - t1), frames: stat(g), longTasks: longIn(t1, t2), loaf: loafIn(t1, t2), bubbles: bdelta(b0), worst: g.slice().sort(function (a, b) { return b - a; }).slice(0, 8).map(function (v) { return Math.round(v); }) };
      if (res[0] != null) m.extra = res[0];
      return m;
    });
  }
  function fmt(m) { var s = m && m.frames; return s && s.n ? s.fps + " fps, p95 " + s.p95 + " ms, max " + s.max + " ms, >50ms: " + s.over50 + ", long tasks " + m.longTasks.n + " (" + m.longTasks.ms + " ms)" : "no frames"; }
  function selOf(e) {
    if (!e || !e.tagName) return null;
    var c = typeof e.className === "string" ? e.className.trim().split(/\s+/).filter(Boolean).slice(0, 4) : [];
    return e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (c.length ? "." + c.join(".") : "");
  }
  function step(n, title, fn) {
    say(n + "  " + title + "...");
    curStep = n + " " + title;
    var t = performance.now();
    return Promise.resolve().then(fn).then(function (v) {
      R.steps[n + " " + title] = { ms: Math.round(performance.now() - t), data: v };
      lines[lines.length - 1] = n + "  " + title + (v && v._line ? ": " + v._line : ": done");
      if (v && v._line) delete v._line;
      out(); return v;
    }, function (e) {
      R.steps[n + " " + title] = { error: String(e && e.message || e) };
      lines[lines.length - 1] = n + "  " + title + ": FAILED (" + (e && e.message || e) + ")"; out();
    });
  }

  /* ---------- 0 freshness ---------- */
  function refsOf(doc) {
    var o = {};
    String(doc).replace(/["']((?:\/|\.\.\/)?(?:[A-Za-z0-9_\-]+\/)*assets\/[A-Za-z0-9_.\-\/]+\.(?:js|css))(?:\?v=([0-9A-Za-z]+))?["']/g, function (m, p, v) { o[p] = v || ""; return m; });
    return o;
  }
  var BUB = "/assets/" + "rp-bubble.js";   /* built, so the version stamper (tools/stamp-rentals-assets.py) leaves it alone */
  function freshness() {
    var mine = {};
    Array.prototype.forEach.call(document.querySelectorAll("script[src],link[rel=stylesheet][href]"), function (e) {
      var u = new URL(e.src || e.href, location.href); if (u.origin !== location.origin) return;
      mine[u.pathname] = u.searchParams.get("v") || "";
    });
    return fetch("/?rp_fresh=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (html) {
      var live = refsOf(html), stale = [];
      Object.keys(live).forEach(function (p) { if (p in mine && mine[p] !== live[p] && !/perf-probe/.test(p)) stale.push(p + " " + mine[p] + " -> " + live[p]); });
      var nav = performance.getEntriesByType("navigation")[0] || {};
      var res = { stale: stale, liveBubble: live[BUB] || null, tabBubble: mine[BUB] || null, codeVer: window.RPBubble && RPBubble.stats ? RPBubble.stats.ver : null, htmlFrom: nav.deliveryType || (nav.transferSize === 0 ? "cache" : "network"), htmlTransfer: nav.transferSize };
      var reloaded = false; try { reloaded = !!sessionStorage.getItem("rp-perf-reloaded"); } catch (e) {}
      res.reloadedForFreshness = reloaded;
      if (stale.length && !reloaded) {
        try { sessionStorage.setItem("rp-perf-reloaded", "1"); } catch (e) {}
        say("this tab was out of date (" + stale.length + " files): reloading once...");
        setTimeout(function () { location.reload(); }, 600);
        return new Promise(function () {});   /* the reload takes over */
      }
      try { sessionStorage.removeItem("rp-perf-reloaded"); } catch (e) {}
      R.ver = res.codeVer;
      res._line = stale.length ? "STILL OUT OF DATE after a reload: " + stale.join(", ") : "up to date (bubble code " + res.codeVer + ")";
      return res;
    });
  }

  /* ---------- 1 this machine ---------- */
  function machine() {
    var n = navigator, s = screen, vv = window.visualViewport, cn = n.connection || {};
    var mq = {};
    ["(prefers-reduced-motion: reduce)", "(prefers-reduced-transparency: reduce)", "(hover: hover)", "(pointer: fine)", "(pointer: coarse)", "(dynamic-range: high)", "(color-gamut: p3)", "(prefers-color-scheme: dark)", "(forced-colors: active)"].forEach(function (q) { try { mq[q] = matchMedia(q).matches; } catch (e) {} });
    /* CPU speed: how many simple loop iterations fit in 60 ms (a throttled / battery-saver CPU shows here) */
    var t = performance.now(), i = 0, x = 0; while (performance.now() - t < 60) { for (var k = 0; k < 2000; k++) x += Math.sqrt(k + i); i++; }
    var o = {
      platform: n.platform, uaData: n.userAgentData ? { brands: (n.userAgentData.brands || []).map(function (b) { return b.brand + " " + b.version; }), mobile: n.userAgentData.mobile, platform: n.userAgentData.platform } : null,
      cores: n.hardwareConcurrency, memoryGB: n.deviceMemory, lang: n.language, touchPoints: n.maxTouchPoints,
      screen: [s.width, s.height, s.availWidth, s.availHeight, s.colorDepth], dpr: window.devicePixelRatio, inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight],
      zoomGuess: outerWidth && innerWidth ? rnd(outerWidth / innerWidth, 2) : null, vvScale: vv ? vv.scale : null,
      media: mq, connection: { type: cn.effectiveType, downlink: cn.downlink, rtt: cn.rtt, saveData: cn.saveData },
      cpuLoops60ms: i, htmlClass: document.documentElement.className, visibility: document.visibilityState, focus: document.hasFocus()
    };
    return gpu().then(function (g) {
      o.gpu = g;
      o._line = (o.uaData && o.uaData.platform || n.platform) + ", " + o.cores + " cores, " + o.dpr + "x, " + innerWidth + "x" + innerHeight + ", GPU " + (g.renderer || "?");
      return o;
    });
  }
  function gpu() {
    var g = {};
    try {
      var c = document.createElement("canvas"), gl = c.getContext("webgl");
      if (gl) {
        var d = gl.getExtension("WEBGL_debug_renderer_info");
        g.vendor = d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        g.renderer = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        g.version = gl.getParameter(gl.VERSION); g.glsl = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
        g.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE); g.maxRB = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE); g.maxView = Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS));
        g.precisionHigh = (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT) || {}).precision;
        g.ext = gl.getSupportedExtensions();
        var ca = gl.getContextAttributes(); g.attrs = ca ? { aa: ca.antialias, pd: ca.preserveDrawingBuffer, pp: ca.powerPreference } : null;
        var lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();
      } else g.webgl = "none";
      g.webgl2 = !!document.createElement("canvas").getContext("webgl2");
    } catch (e) { g.error = e.message; }
    if (!navigator.gpu) return Promise.resolve(g);
    return Promise.race([
      navigator.gpu.requestAdapter().then(function (a) {
        if (!a) { g.webgpu = "no adapter"; return g; }
        var inf = a.info || {}; g.webgpu = { vendor: inf.vendor, arch: inf.architecture, device: inf.device, desc: inf.description, fallback: a.isFallbackAdapter };
        return g;
      }).catch(function () { return g; }),
      wait(1500).then(function () { return g; })
    ]);
  }

  /* ---------- 2 the bubble engine ---------- */
  function engine() {
    var B = window.RPBubble;
    if (!B) return { _line: "RPBubble not loaded" };
    var d = B.debug ? B.debug() : null, S = B.stats, ti = B.tier ? B.tier() : null;
    var st = {}; for (var k in S) st[k] = typeof S[k] === "number" ? rnd(S[k], 1) : S[k];
    var kinds = {}; (d && d.items || []).forEach(function (x) { kinds[x.kind] = (kinds[x.kind] || 0) + 1; });
    return { stats: st, tier: ti, debug: d, check: B.debug ? B.debug({ check: true, items: false }).check : null, kinds: kinds,
      _line: "tier " + (ti ? ti.tier + " (" + ti.why + ")" : "?") + ", animation " + (B.quality ? B.quality.fps : "?") + " fps at " + (B.quality ? Math.round(B.quality.scale * 100) : "?") + "% resolution, shaders " + S.compileMs + " ms (background " + (S.parallel ? "yes" : "NO") + "), calib " + S.calib + ", self-check " + S.selfcheck };
  }

  /* ---------- 3 the featured carousel card ---------- */
  var STYLE_KEYS = ["position", "display", "visibility", "opacity", "transform", "borderRadius", "overflow", "clipPath", "zIndex", "willChange", "contain", "filter", "mixBlendMode", "isolation", "boxShadow", "inset", "top", "left", "width", "height", "animationName", "transitionProperty"];
  function styleOf(e) {
    if (!e) return null;
    var cs = getComputedStyle(e), r = e.getBoundingClientRect(), o = { sel: selOf(e), rect: [r.left, r.top, r.width, r.height].map(function (v) { return rnd(v, 1); }) };
    STYLE_KEYS.forEach(function (k) { var v = cs[k]; if (v && v !== "none" && v !== "auto" && v !== "normal" && v !== "visible") o[k] = String(v).slice(0, 120); });
    if (e.style && e.style.clipPath) o.inlineClip = e.style.clipPath;
    return o;
  }
  function featured() { return document.querySelector(".citem.feat"); }
  function alphaProfile(cv) {
    try {
      var W = cv.width, H = cv.height; if (W < 8 || H < 8) return { size: [W, H] };
      /* read a COPY: getImageData on the bubble's own canvas makes Chrome move that canvas off the GPU for
         good after a few reads, which halved the whole page's frame rate in the first test run */
      var tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
      var tx = tmp.getContext("2d", { willReadFrequently: true }); tx.drawImage(cv, 0, 0);
      var x = tx.getImageData(0, 0, W, H).data;
      function A(px, py) { return x[(py * W + px) * 4 + 3]; }
      function C(px, py) { var o = (py * W + px) * 4; return [x[o], x[o + 1], x[o + 2], x[o + 3]]; }
      function band(get, n) {   /* from the edge inwards: first opaque pixel, how many in a row, alpha of the first 24 */
        var first = -1, run = 0, a = [];
        for (var i = 0; i < n; i++) { var v = get(i); if (i < 24) a.push(v); if (v > 60) { if (first < 0) first = i; run++; } else if (first >= 0) break; }
        return { first: first, width: run, a: a.join(",") };
      }
      var mx = W >> 1, my = H >> 1, lim = Math.min(W, H) >> 1;
      var sides = {
        top: band(function (i) { return A(mx, i); }, lim), bottom: band(function (i) { return A(mx, H - 1 - i); }, lim),
        left: band(function (i) { return A(i, my); }, lim), right: band(function (i) { return A(W - 1 - i, my); }, lim)
      };
      /* the same at quarter positions (a rim missing only near one corner shows here) */
      var q = {
        top25: band(function (i) { return A(W >> 2, i); }, lim).first, top75: band(function (i) { return A((W * 3) >> 2, i); }, lim).first,
        bottom25: band(function (i) { return A(W >> 2, H - 1 - i); }, lim).first, bottom75: band(function (i) { return A((W * 3) >> 2, H - 1 - i); }, lim).first,
        left25: band(function (i) { return A(i, H >> 2); }, lim).first, left75: band(function (i) { return A(i, (H * 3) >> 2); }, lim).first,
        right25: band(function (i) { return A(W - 1 - i, H >> 2); }, lim).first, right75: band(function (i) { return A(W - 1 - i, (H * 3) >> 2); }, lim).first
      };
      /* opaque pixels per eighth of the canvas (a missing quarter shows as zeros on one side) */
      var grid = [];
      for (var gy = 0; gy < 4; gy++) { var row = []; for (var gx = 0; gx < 4; gx++) { var n = 0, tot = 0; for (var yy = Math.floor(gy * H / 4); yy < Math.floor((gy + 1) * H / 4); yy += 3) for (var xx = Math.floor(gx * W / 4); xx < Math.floor((gx + 1) * W / 4); xx += 3) { tot++; if (A(xx, yy) > 60) n++; } row.push(tot ? Math.round(100 * n / tot) : 0); } grid.push(row.join(" ")); }
      return { size: [W, H], sides: sides, quarters: q, opaquePctGrid4x4: grid, centre: C(mx, my), corner: C(2, 2) };
    } catch (e) { return { error: e.message }; }
  }
  function thumb(cv, w) {
    try {
      var k = Math.min(1, w / cv.width), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(cv.width * k)); c.height = Math.max(1, Math.round(cv.height * k));
      var x = c.getContext("2d"); x.fillStyle = "#808080"; x.fillRect(0, 0, c.width, c.height); x.drawImage(cv, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.8);
    } catch (e) { return "error " + e.message; }
  }
  function stackAt(px, py) { try { return (document.elementsFromPoint(px, py) || []).slice(0, 7).map(selOf); } catch (e) { return null; } }
  function card(full) {
    var el = featured(); if (!el) return { _line: "no featured carousel card on this page" };
    var edge = el.querySelector(".cedge"), cv = edge && window.RPBubble && RPBubble.canvasOf ? RPBubble.canvasOf(edge) : (edge && edge.querySelector("canvas"));
    var o = { key: el.getAttribute("data-pk"), classes: el.className };
    o.item = edge && window.RPBubble && RPBubble.debug ? (RPBubble.debug({ el: edge }).items || [])[0] || "not a bubble" : null;
    o.alpha = cv ? alphaProfile(cv) : "no canvas";
    if (full) {
      o.layers = [el, el.querySelector(".cbody"), el.querySelector(".cbub"), edge, cv, el.querySelector(".cglow"), el.querySelector(".cglow canvas"), el.querySelector(".crim"), el.querySelector(".cshade"), el.querySelector(".cspec"), el.querySelector(".focus-bg,.cbub > img,.cbub > video")].map(styleOf);
      var r = (edge || el).getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      o.onTop = { right2: stackAt(r.right - 2, cy), right8: stackAt(r.right - 8, cy), right16: stackAt(r.right - 16, cy), bottom2: stackAt(cx, r.bottom - 2), bottom8: stackAt(cx, r.bottom - 8), bottom16: stackAt(cx, r.bottom - 16), left8: stackAt(r.left + 8, cy), top8: stackAt(cx, r.top + 8), corner: stackAt(r.right - 12, r.bottom - 12) };
    }
    o.thumb = cv ? thumb(cv, full ? 260 : 160) : null;
    var a = o.alpha && o.alpha.sides;
    o._line = a ? "rim band px (top/right/bottom/left) " + [a.top.width, a.right.width, a.bottom.width, a.left.width].join("/") + ", canvas " + o.alpha.size.join("x") : String(o.alpha && o.alpha.error || o.alpha);
    return o;
  }

  /* ---------- 5 A/B ---------- */
  function pauseCSS(on) {
    var list = [];
    try { list = document.getAnimations(); } catch (e) { return 0; }
    if (on) { pauseCSS.paused = list.filter(function (a) { return a.playState === "running"; }); pauseCSS.paused.forEach(function (a) { try { a.pause(); } catch (e) {} }); return pauseCSS.paused.length; }
    (pauseCSS.paused || []).forEach(function (a) { try { a.play(); } catch (e) {} }); var n = (pauseCSS.paused || []).length; pauseCSS.paused = []; return n;
  }
  function ab() {
    var B = window.RPBubble, has = B && B.debug, o = {};
    return measure("normal", 3000).then(function (m) { o.normal = m; say("    normal: " + fmt(m)); if (has) B.debug({ freeze: true, items: false }); return wait(300); })
      .then(function () { return measure("frozen", 3000); }).then(function (m) { o.bubblesFrozen = m; say("    bubbles frozen: " + fmt(m)); if (has) B.debug({ freeze: false, items: false }); o.cssAnimations = pauseCSS(true); return wait(300); })
      .then(function () { return measure("cssPaused", 3000); }).then(function (m) { o.cssPaused = m; say("    CSS animations paused (" + o.cssAnimations + "): " + fmt(m)); if (has) B.debug({ freeze: true, items: false }); return wait(300); })
      .then(function () { return measure("both", 3000); }).then(function (m) { o.bothOff = m; say("    both off: " + fmt(m)); if (has) B.debug({ freeze: false, items: false }); pauseCSS(false); if (has) B.debug({ scale: 0.5, items: false }); return wait(400); })
      .then(function () { return measure("half", 3000); }).then(function (m) { o.halfRes = m; say("    bubbles at half resolution: " + fmt(m)); if (has) B.debug({ scale: 0, items: false }); if (B && B.quality) B.quality.scale = 1; return wait(500); })
      .then(function () { o._line = "see the lines above"; return o; });
  }

  /* ---------- 6 / 7 carousel ---------- */
  function moves(n, label) {
    var nx = document.getElementById("carNext"); if (!nx) return Promise.resolve({ _line: "carousel not found" });
    var res = [], p = Promise.resolve();
    for (var i = 0; i < n; i++) p = p.then(function () {
      var mv = {}, t1 = performance.now(), b0 = bstats();
      curStep = (label || "carousel") + " move " + (res.length + 1);
      nx.click();
      return wait(350).then(function () { mv.mid = card(false); delete mv.mid.thumb; return wait(1150); }).then(function () {
        var t2 = performance.now(), g = win(t1, t2);
        mv.frames = stat(g); mv.gaps = g.map(function (v) { return Math.round(v); }).slice(0, 120); mv.longTasks = longIn(t1, t2); mv.loaf = loafIn(t1, t2); mv.bubbles = bdelta(b0);
        mv.end = card(false);
        res.push(mv);
        say("    " + label + " move " + res.length + ": " + mv.frames.fps + " fps, max " + mv.frames.max + " ms, " + mv.end._line);
        return grab((label || "carousel") + " move " + res.length).then(function (g) { if (g) mv.screen = g.sides || g.error; });
      });
    });
    return p.then(function () { return { moves: res, _line: "done" }; });
  }
  /* A/B of the shared WebGL canvas size: since 20261027l it is only as big as the largest bubble; before,
     it was screen-sized, which made every copy expensive in Firefox and Safari. Two moves at the old size. */
  function atlasAB() {
    var B = window.RPBubble; if (!B || !B.debug) return Promise.resolve({ _line: "no debug API" });
    var st = B.debug({ items: false }).state, cur = st.atlas, big = st.atlasMax || cur;
    var o = { atlas: cur, atlasMax: big, grow: st.atlasGrow };
    if (big[0] <= cur[0] && big[1] <= cur[1]) { o._line = "the shared canvas is already at its largest (" + cur.join("x") + ")"; return Promise.resolve(o); }
    o.checkBig = B.debug({ atlas: big, items: false }).atlasCheck;
    say("    shared canvas " + cur.join("x") + " -> old size " + big.join("x") + ", copy self-check " + o.checkBig);
    return wait(500).then(function () { return moves(2, "old-size canvas"); }).then(function (m) {
      o.moves = m.moves;
      o.checkBack = B.debug({ atlas: cur, items: false }).atlasCheck;
      o._line = "copy self-check at the old size " + o.checkBig + ", back to " + cur.join("x") + " " + o.checkBack;
      return wait(600).then(function () { return o; });
    });
  }

  /* ---------- 8 scrolling ---------- */
  function scrolling() {
    var de = document.documentElement, prev = de.style.scrollBehavior, max = Math.max(0, de.scrollHeight - innerHeight), dist = Math.min(max, 3200);
    if (dist < 200) return Promise.resolve({ _line: "page too short to scroll" });
    de.style.scrollBehavior = "auto";
    function glide(from, to, ms) {
      return new Promise(function (res) {
        var t0 = performance.now();
        (function f(now) { var t = Math.min(1, (now - t0) / ms); window.scrollTo(0, from + (to - from) * t); if (t < 1) requestAnimationFrame(f); else res(); })(t0);
      });
    }
    return measure("scroll", 5400, function () { return glide(0, dist, 2500).then(function () { return wait(300); }).then(function () { return glide(dist, 0, 2500); }); }).then(function (m) {
      de.style.scrollBehavior = prev; m._line = fmt(m); return m;
    });
  }

  /* ---------- 9 projects page, 10 film ---------- */
  /* the site's router lives inside its main script, so go the way the Back / Forward buttons do */
  function goto(path) { try { history.pushState({}, "", path); dispatchEvent(new PopStateEvent("popstate", { state: {} })); return true; } catch (e) { return false; } }
  function projects() {
    if (!goto("/projects")) return Promise.resolve({ _line: "no SPA navigation here" });
    return wait(1500).then(function () { return measure("projects", 3000); }).then(function (m) {
      var d = window.RPBubble && RPBubble.debug ? RPBubble.debug() : null;
      m.bubbles_on_page = d ? d.items.filter(function (x) { return x.onScreen !== false && x.shown !== false; }).length : null;
      m.kinds = {}; if (d) d.items.forEach(function (x) { if (x.onScreen !== false && x.shown !== false) m.kinds[x.kind] = (m.kinds[x.kind] || 0) + 1; });
      goto("/"); m._line = fmt(m);
      return wait(2200).then(function () { return m; });
    });
  }
  function film() {
    var el = featured(); if (!el) return Promise.resolve({ _line: "no featured card" });
    var nx = document.getElementById("carNext"), tries = 0;
    function pick() { el = featured(); if (el && el.classList.contains("placeholder") && nx && tries++ < 4) { nx.click(); return wait(1400).then(pick); } return Promise.resolve(); }
    return pick().then(function () {
      if (!el) return { _line: "no featured card" };
      var o = { key: el.getAttribute("data-pk") }, path0 = location.pathname;
      return measure("open", 3500, function () { el.click(); return wait(100).then(function () { return { path: location.pathname, cover: document.body.classList.contains("u-cover") }; }); }).then(function (m) {
        o.open = m; o.opened = location.pathname !== path0;
        say("    film open: " + fmt(m));
        if (!o.opened) { o._line = "the film did not open"; return o; }
        return measure("close", 3000, function () { history.back(); }).then(function (m2) {
          o.close = m2; say("    film close: " + fmt(m2));
          o._line = "done"; return wait(800).then(function () { return o; });
        });
      });
    });
  }

  /* ---------- 11 micro-benchmarks ---------- */
  function bench(mode, atlas) {
    return new Promise(function (res) {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      var sizes = [[880, 490], [300, 300], [300, 300], [420, 420], [220, 220], [220, 220]].map(function (z) { return [Math.round(z[0] * dpr), Math.round(z[1] * dpr)]; });
      var holder = document.createElement("div");
      holder.style.cssText = "position:fixed;left:0;top:0;width:10px;height:10px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1";
      document.body.appendChild(holder);
      var disp = sizes.map(function (z) { var c = document.createElement("canvas"); c.width = z[0]; c.height = z[1]; c.style.cssText = "width:" + z[0] + "px;height:" + z[1] + "px"; holder.appendChild(c); return c; });
      var g = document.createElement("canvas"), surf, gl, ctxs;
      try {
        if (mode !== "copy") { surf = g.transferControlToOffscreen(); if (mode === "bitmap-fixed") { surf.width = sizes[0][0]; surf.height = sizes[0][1]; } }
        else { surf = g; g.width = atlas[0]; g.height = atlas[1]; }
        gl = surf.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
        ctxs = disp.map(function (c) { return c.getContext(mode === "copy" ? "2d" : "bitmaprenderer"); });
      } catch (e) { holder.remove(); return res({ mode: mode, error: e.message }); }
      if (!gl) { holder.remove(); return res({ mode: mode, error: "no WebGL" }); }
      var VS = "attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}";
      var FS = "precision mediump float;varying vec2 v;uniform float t;void main(){float a=0.;for(int i=0;i<24;i++){a+=sin(v.x*float(i)*3.+t)*cos(v.y*float(i)*2.-t);}gl_FragColor=vec4(.5+.5*sin(a),v.x,v.y,1.)*.8;}";
      var pr = gl.createProgram();
      [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]].forEach(function (d) { var x = gl.createShader(d[0]); gl.shaderSource(x, d[1]); gl.compileShader(x); gl.attachShader(pr, x); });
      gl.bindAttribLocation(pr, 0, "a"); gl.linkProgram(pr); gl.useProgram(pr);
      var bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      var ut = gl.getUniformLocation(pr, "t");
      var work = [], fg = [], l = 0, n = 0;
      function f(now) {
        var t0 = performance.now();
        sizes.forEach(function (z, i) {
          var w = z[0], h = z[1];
          if (mode === "bitmap-resize") { if (surf.width !== w) surf.width = w; if (surf.height !== h) surf.height = h; gl.viewport(0, 0, w, h); }
          else if (mode === "bitmap-fixed") gl.viewport(0, 0, surf.width, surf.height);
          else gl.viewport(0, gl.drawingBufferHeight - h, w, h);
          gl.uniform1f(ut, now / 1000 + i); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          if (mode === "copy") { ctxs[i].clearRect(0, 0, w, h); ctxs[i].drawImage(g, 0, 0, w, h, 0, 0, w, h); }
          else ctxs[i].transferFromImageBitmap(surf.transferToImageBitmap());
        });
        work.push(performance.now() - t0);
        if (l) fg.push(now - l); l = now;
        if (++n < 80) requestAnimationFrame(f);
        else { holder.remove(); var lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext(); var w2 = stat(work.slice(10)); res({ mode: mode + (atlas ? " " + atlas.join("x") : ""), mainMsPerFrame: w2.avg, mainMax: w2.max, frames: stat(fg.slice(10)) }); }
      }
      requestAnimationFrame(f);
    });
  }
  function snapTest(resize) {
    try {
      var g = document.createElement("canvas"); g.width = resize ? 256 : 1024; g.height = resize ? 256 : 600;
      var gl = g.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!gl) return "no WebGL";
      gl.clearColor(0, 1, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      var c0 = document.createElement("canvas"); c0.width = c0.height = 8; c0.getContext("2d").drawImage(g, 0, 0, 8, 8);
      if (resize) { g.width = 1024; g.height = 600; }
      var dbh = gl.drawingBufferHeight;
      gl.viewport(0, 0, gl.drawingBufferWidth, dbh); gl.clearColor(0, 0, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, dbh - 200, 400, 200); gl.clearColor(1, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.SCISSOR_TEST);
      var c = document.createElement("canvas"); c.width = 400; c.height = 200; var x = c.getContext("2d");
      x.drawImage(g, 0, 0, 400, 200, 0, 0, 400, 200);
      var pts = [[5, 5], [395, 5], [5, 195], [395, 195], [200, 100]], bad = [];
      pts.forEach(function (q) { var d = x.getImageData(q[0], q[1], 1, 1).data; if (!(d[0] > 200 && d[1] < 60 && d[2] < 60)) bad.push(q.join(",") + "=" + d[0] + "/" + d[1] + "/" + d[2]); });
      var lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();
      return bad.length ? "WRONG at " + bad.join(" ") : "ok";
    } catch (e) { return "error " + e.message; }
  }
  function benches() {
    var d = window.RPBubble && RPBubble.debug ? RPBubble.debug({ items: false }).state : null, atlas = d ? d.atlas : [2048, 1024];
    var o = { snapAfterResize: snapTest(true), snapFixed: snapTest(false), runs: [] };
    var list = [["copy", atlas], ["copy", (d && d.atlasMax) || [2048, 1445]], ["bitmap-resize"], ["bitmap-fixed"]];
    return list.reduce(function (p, m) { return p.then(function () { return bench(m[0], m[1]).then(function (r) { o.runs.push(r); say("    " + r.mode + ": " + (r.error || (r.mainMsPerFrame + " ms/frame on the main thread, " + (r.frames.fps || "?") + " fps"))); }); }); }, wait(200))
      .then(function () { o._line = "copy check " + o.snapAfterResize + " / " + o.snapFixed; return o; });
  }

  /* ---------- 12 page census ---------- */
  function census() {
    var o = {}, all = document.getElementsByTagName("*");
    o.elements = all.length;
    var blur = 0, bdf = 0, wc = 0, shadow = 0, fixed = 0, n = Math.min(all.length, 6000), heavy = [];
    for (var i = 0; i < n; i++) {
      var e = all[i], cs = getComputedStyle(e);
      if (cs.display === "none") continue;
      var f = cs.filter !== "none" && /blur/.test(cs.filter), b = cs.backdropFilter && cs.backdropFilter !== "none";
      if (f) blur++; if (b) bdf++; if (cs.willChange && cs.willChange !== "auto") wc++; if (cs.boxShadow !== "none") shadow++; if (cs.position === "fixed") fixed++;
      if ((f || b) && heavy.length < 25) { var r = e.getBoundingClientRect(); if (r.width * r.height > 20000 && r.bottom > 0 && r.top < innerHeight) heavy.push(selOf(e) + " " + Math.round(r.width) + "x" + Math.round(r.height) + (f ? " " + cs.filter : "") + (b ? " backdrop " + cs.backdropFilter : "")); }
    }
    o.blurFilters = blur; o.backdropFilters = bdf; o.willChange = wc; o.boxShadows = shadow; o.fixed = fixed; o.bigBlursOnScreen = heavy;
    try {
      var by = {}; document.getAnimations().forEach(function (a) { var k = (a.animationName || a.transitionProperty || (a.constructor && a.constructor.name)) + ":" + a.playState; by[k] = (by[k] || 0) + 1; });
      o.animations = by;
    } catch (e) {}
    o.videos = Array.prototype.map.call(document.querySelectorAll("video"), function (v) { return { playing: !v.paused, w: v.videoWidth, h: v.videoHeight, src: String(v.currentSrc || "").replace(location.origin, "").slice(0, 60) }; }).filter(function (v) { return v.playing || v.w; });
    var px = 0, cvs = document.querySelectorAll("canvas"); Array.prototype.forEach.call(cvs, function (c) { px += c.width * c.height; });
    o.canvases = cvs.length; o.canvasMegapixels = rnd(px / 1e6, 2);
    o.images = document.images.length;
    return o;
  }
  function resources() {
    var nav = performance.getEntriesByType("navigation")[0] || {}, res = performance.getEntriesByType("resource");
    var o = {
      nav: { ttfb: Math.round(nav.responseStart || 0), domInteractive: Math.round(nav.domInteractive || 0), dcl: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0), transfer: nav.transferSize, type: nav.type, protocol: nav.nextHopProtocol },
      revealedAt: Math.round(window.__revealedAt || 0),
      paint: performance.getEntriesByType("paint").map(function (p) { return p.name + " " + Math.round(p.startTime); }),
      count: res.length, totalKB: Math.round(res.reduce(function (s, r) { return s + (r.transferSize || 0); }, 0) / 1024),
      cached: res.filter(function (r) { return r.transferSize === 0 && r.decodedBodySize > 0; }).length
    };
    try { var lcp = performance.getEntriesByType("largest-contentful-paint"); if (lcp && lcp.length) o.lcp = Math.round(lcp[lcp.length - 1].startTime); } catch (e) {}
    function row(r) { return [String(r.name).replace(location.origin, "").slice(0, 90), Math.round(r.startTime), Math.round(r.duration), Math.round((r.transferSize || 0) / 1024), r.initiatorType, r.deliveryType || ""]; }
    o.slowest = res.slice().sort(function (a, b) { return b.duration - a.duration; }).slice(0, 15).map(row);
    o.largest = res.slice().sort(function (a, b) { return (b.transferSize || 0) - (a.transferSize || 0); }).slice(0, 12).map(row);
    o.scripts = res.filter(function (r) { return /\.(js|css)(\?|$)/.test(r.name); }).map(row);
    if (performance.memory) o.memoryMB = { used: Math.round(performance.memory.usedJSHeapSize / 1048576), total: Math.round(performance.memory.totalJSHeapSize / 1048576), limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) };
    return o;
  }

  /* ---------- screen check: what is ACTUALLY on screen (2026-10-27) ----------
     Report #10 (Jack's Windows PC) read the featured card's rim canvas back pixel by pixel and found it
     complete, while Jack saw it cut off on screen. A canvas read-back cannot see what the browser then
     puts on the screen, so with the visitor's permission (one click, then pick this window or the screen)
     the probe records the screen itself (getDisplayMedia) and compares, at points just inside all four
     edges of the card's rim, the colour on screen with the colour in the rim canvas. Four coloured
     squares in the window's corners (shown only for the instant of each grab) locate the page in the
     recording. Each grab also keeps a small picture of the card as it appeared on screen. */
  var SC = { status: "not asked", grabs: [] }, scVideo = null, scStream = null;
  function askScreen() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { SC.status = "not available in this browser"; return Promise.resolve(SC); }
    return new Promise(function (res) {
      var wrap = document.createElement("div"), go = document.createElement("button"), skip = document.createElement("button"), t0 = performance.now();
      wrap.style.cssText = "margin-top:10px;display:flex;gap:8px;flex-wrap:wrap";
      go.textContent = "Allow the screen check";
      skip.textContent = "Skip it";
      [go, skip].forEach(function (b, i) { b.style.cssText = "pointer-events:auto;cursor:pointer;font:800 14px system-ui,sans-serif;padding:9px 14px;border-radius:8px;border:0;" + (i ? "background:#444;color:#fff" : "background:#7dff9a;color:#000"); wrap.appendChild(b); });
      say("SCREEN CHECK: click the green button, then choose THIS browser window (or the whole screen) and Share / Allow. It records only while the test runs.");
      box.appendChild(wrap); box.style.pointerEvents = "auto";
      var to = setTimeout(function () { done("skipped (no click within 40 s)"); }, 40000);
      function done(st) {
        clearTimeout(to); SC.status = st; SC.waitMs = Math.round(performance.now() - t0);
        wrap.remove(); box.style.pointerEvents = "none";
        lines[lines.length - 1] = "    screen check: " + st; out(); res(SC);
      }
      skip.onclick = function () { done("skipped by the visitor"); };
      go.onclick = function () {
        var opts = { video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude", monitorTypeSurfaces: "include" };
        navigator.mediaDevices.getDisplayMedia(opts).then(function (st) {
          scStream = st; var v = document.createElement("video"); v.muted = true; v.playsInline = true; v.srcObject = st;
          /* in the page (a 2 px dot), or the browser may stop updating a video nobody can see */
          v.style.cssText = "position:fixed;left:50%;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:2147483646";
          document.documentElement.appendChild(v);
          var tr = st.getVideoTracks()[0]; try { var se = tr.getSettings(); SC.surface = se.displaySurface || null; SC.size = [se.width, se.height]; } catch (e) {}
          SC.label = tr.label;
          tr.addEventListener("ended", function () { ev("screen recording ended"); scVideo = null; });
          return v.play().then(function () { scVideo = v; return wait(700); });
        }).then(function () { done("on (" + (SC.surface || "?") + ")"); }, function (e) { done("not allowed (" + (e && e.name || e) + ")"); });
      };
    });
  }
  /* the colours rotate between corners on every grab, so a recording that has not caught up yet (still
     showing the previous grab's squares) can never be mistaken for the current one */
  /* pure colours the site never uses (yellow matched the duck logo, cyan the background bubbles) */
  var COLS = [[255, 0, 255], [0, 255, 0], [255, 0, 0], [0, 0, 255]], MK = [];
  function markers(on) {
    if (!on) { (markers.els || []).forEach(function (e) { e.remove(); }); markers.els = []; return; }
    var k = SC.grabs.length + (markers.n = (markers.n || 0) + 1);
    MK = ["tl", "tr", "bl", "br"].map(function (pos, i) { return [pos, COLS[(i + k) % 4]]; });
    markers.els = MK.map(function (m) {
      var e = document.createElement("div"), c = m[1];
      e.style.cssText = "position:fixed;z-index:2147483647;width:18px;height:18px;pointer-events:none;box-sizing:border-box;border:3px solid #000;background:rgb(" + c.join(",") + ");" + (m[0][0] === "t" ? "top:4px;" : "bottom:4px;") + (m[0][1] === "l" ? "left:4px" : "right:4px");
      document.documentElement.appendChild(e); return e;
    });
  }
  function grab(tag) {
    if (!scVideo || !scVideo.videoWidth) return Promise.resolve(null);
    var el = featured(), edge = el && el.querySelector(".cedge"), cv = edge && window.RPBubble && RPBubble.canvasOf ? RPBubble.canvasOf(edge) : null;
    if (!cv) return Promise.resolve(null);
    /* the rims are held still for the grab, so the screen and the canvas show the same moment */
    var B = window.RPBubble; if (B && B.debug) B.debug({ freeze: true, items: false });
    markers(true); var vis = box.style.visibility; box.style.visibility = "hidden";
    var mpos = null, fc = null, fx = null, F = null, VW = 0, VH = 0, found = null, tries = 0, g = { tag: tag, t: Math.round(performance.now()), during: curStep };
    /* each marker: centroid of its pure colour, searched in its own quarter of the recording */
    function find(which) {
      return MK.filter(function (m, i) { return which == null || i === which; }).map(function (m) {
        var c = m[1], x0 = m[0][1] === "l" ? 0 : VW >> 1, y0 = m[0][0] === "t" ? 0 : VH >> 1, sx = 0, sy = 0, n = 0;
        for (var y = y0; y < y0 + (VH >> 1); y++) for (var x = x0; x < x0 + (VW >> 1); x++) { var o = (y * VW + x) * 4; if (Math.abs(F[o] - c[0]) + Math.abs(F[o + 1] - c[1]) + Math.abs(F[o + 2] - c[2]) < 60) { sx += x; sy += y; n++; } }
        return n >= 12 ? [sx / n, sy / n, n] : null;
      });
    }
    /* the recording lags the page a little: take frames until the markers show (at most ~1.6 s) */
    function frame() {
      var v = scVideo; if (!v || !v.videoWidth) return Promise.resolve(false);
      VW = v.videoWidth; VH = v.videoHeight;
      if (!fc || fc.width !== VW || fc.height !== VH) { fc = document.createElement("canvas"); fc.width = VW; fc.height = VH; fx = fc.getContext("2d", { willReadFrequently: true }); }
      fx.drawImage(v, 0, 0, VW, VH); F = fx.getImageData(0, 0, VW, VH).data;
      if (find(0)[0]) return Promise.resolve(true);
      return ++tries < 16 ? wait(160).then(frame) : Promise.resolve(false);
    }
    return raf2().then(function () { return wait(120); }).then(function () {
      mpos = markers.els.map(function (e) { var r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      return frame();
    }).then(function () {
      markers(false); box.style.visibility = vis;
      g.tries = tries + 1;
      try {
        if (!F) { g.error = "no frame from the recording"; return g; }
        found = find(null);
        g.frame = [VW, VH]; g.markers = found.map(function (f) { return f ? f.map(function (q) { return Math.round(q); }) : null; });
        if (!found[0] || !found[1] || !found[2]) { g.error = "page not found in the recording (pick this window or the whole screen)"; return g; }
        /* the three squares must sit on a rectangle with the window's proportions, or something else matched */
        var wx = found[1][0] - found[0][0], hy = found[2][1] - found[0][1], ex = mpos[1][0] - mpos[0][0], ey = mpos[2][1] - mpos[0][1];
        if (wx <= 0 || hy <= 0 || Math.abs(found[1][1] - found[0][1]) > 0.03 * hy || Math.abs(found[2][0] - found[0][0]) > 0.03 * wx || Math.abs((wx / hy) / (ex / ey) - 1) > 0.06) { g.error = "corner squares did not line up (something on screen matched their colour)"; return g; }
        var ax = (found[1][0] - found[0][0]) / (mpos[1][0] - mpos[0][0]), bx = found[0][0] - ax * mpos[0][0];
        var ay = (found[2][1] - found[0][1]) / (mpos[2][1] - mpos[0][1]), by = found[0][1] - ay * mpos[0][1];
        g.map = [ax, bx, ay, by].map(function (q) { return Math.round(q * 1000) / 1000; });
        /* the rim canvas, read through a copy */
        var W = cv.width, H = cv.height, tc = document.createElement("canvas"); tc.width = W; tc.height = H;
        var tx = tc.getContext("2d", { willReadFrequently: true }); tx.drawImage(cv, 0, 0); var C = tx.getImageData(0, 0, W, H).data;
        var r = cv.getBoundingClientRect(), item = el.querySelector(".cbody") || el, lg = el.querySelector(".clogo"), logo = lg ? lg.getBoundingClientRect() : null;   /* covered = anything outside the card body: the film logo, a cookie banner */
        function side(name, pt) {
          var ok = 0, n = 0, covered = 0, bad = [];
          for (var i = 0; i < 24; i++) {
            var f = 0.2 + 0.6 * i / 23, p = pt(f), px = p[0], py = p[1];
            var top = document.elementFromPoint(px, py); if (top && !item.contains(top)) { covered++; continue; }
            if (logo && px >= logo.left && px <= logo.right && py >= logo.top && py <= logo.bottom) { covered++; continue; }
            var cx = Math.min(W - 1, Math.max(0, Math.floor((px - r.left) / r.width * W))), cy = Math.min(H - 1, Math.max(0, Math.floor((py - r.top) / r.height * H)));
            var co = (cy * W + cx) * 4; if (C[co + 3] < 240) continue;
            var fxp = Math.round(ax * px + bx), fyp = Math.round(ay * py + by); if (fxp < 1 || fyp < 1 || fxp >= VW - 1 || fyp >= VH - 1) continue;
            var sr = 0, sg = 0, sb = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var fo = ((fyp + dy) * VW + fxp + dx) * 4; sr += F[fo]; sg += F[fo + 1]; sb += F[fo + 2]; }
            sr /= 9; sg /= 9; sb /= 9;
            var dist = Math.abs(sr - C[co]) + Math.abs(sg - C[co + 1]) + Math.abs(sb - C[co + 2]);
            n++; if (dist < 90) ok++; else if (bad.length < 4) bad.push([Math.round(sr), Math.round(sg), Math.round(sb), "want", C[co], C[co + 1], C[co + 2]].join(" "));
          }
          return { pct: n ? Math.round(100 * ok / n) : null, n: n, covered: covered, bad: bad };
        }
        var d = 6;   /* css px inside the edge: well inside the solid rim band */
        g.sides = {
          top: side("top", function (f) { return [r.left + r.width * f, r.top + d]; }),
          right: side("right", function (f) { return [r.right - d, r.top + r.height * f]; }),
          bottom: side("bottom", function (f) { return [r.left + r.width * f, r.bottom - d]; }),
          left: side("left", function (f) { return [r.left + d, r.top + r.height * f]; })
        };
        /* the card as it appeared on screen, small */
        var m = 30, x0 = Math.max(0, Math.round(ax * (r.left - m) + bx)), y0 = Math.max(0, Math.round(ay * (r.top - m) + by));
        var x1 = Math.min(VW, Math.round(ax * (r.right + m) + bx)), y1 = Math.min(VH, Math.round(ay * (r.bottom + m) + by));
        if (x1 - x0 > 8 && y1 - y0 > 8) {
          var k = Math.min(1, 380 / (x1 - x0)), sc = document.createElement("canvas"); sc.width = Math.round((x1 - x0) * k); sc.height = Math.round((y1 - y0) * k);
          sc.getContext("2d").drawImage(fc, x0, y0, x1 - x0, y1 - y0, 0, 0, sc.width, sc.height);
          g.thumb = sc.toDataURL("image/jpeg", 0.75);
        }
        var s = g.sides; g._line = "on screen, rim present (top/right/bottom/left) " + [s.top.pct, s.right.pct, s.bottom.pct, s.left.pct].map(function (q) { return q == null ? "?" : q + "%"; }).join(" / ");
      } catch (e) { g.error = String(e && e.message || e); markers(false); box.style.visibility = vis; }
      return g;
    }).then(function (g) { if (B && B.debug) B.debug({ freeze: false, items: false }); if (g) { SC.grabs.push(g); if (g._line || g.error) say("    [" + tag + "] " + (g.error || g._line)); } return g; });
  }
  /* what every resolution change used to do to the rim canvas: shrink it 20%, look at the screen, let it grow back, look again */
  function resizeTest() {
    var el = featured(), edge = el && el.querySelector(".cedge");
    if (!edge || !window.RPBubble || !RPBubble.debug) return Promise.resolve({ _line: "not possible here" });
    if (!scVideo) return Promise.resolve({ _line: "skipped (no screen check)" });
    var o = {};
    return grab("before the resize test").then(function (g) {
      o.before = g && g.sides; RPBubble.debug({ el: edge, resizeTest: 0.8, items: false }); return wait(900);
    }).then(function () { return grab("canvas shrunk 20%, as resolution changes used to do"); }).then(function (g) {
      o.shrunk = g && g.sides; RPBubble.debug({ el: edge, resizeTest: 0, items: false }); return wait(900);
    }).then(function () { return grab("canvas grown back"); }).then(function (g) {
      o.back = g && g.sides;
      function f(sd) { return sd ? [sd.top.pct, sd.right.pct, sd.bottom.pct, sd.left.pct].join("/") : "?"; }
      o._line = "rim on screen % before " + f(o.before) + ", shrunk " + f(o.shrunk) + ", grown back " + f(o.back);
      return o;
    });
  }
  function stopScreen() { try { if (scStream) scStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} scVideo = null; }

  /* ---------- send ---------- */
  function finish() {
    clearInterval(tl);
    stopScreen();
    R.screen = SC;
    R.totalMs = Math.round(performance.now() - T0);
    R.pointerMoves = ptrMoves;
    R.longTasksAll = { n: longs.length, ms: Math.round(longs.reduce(function (s, l) { return s + l[1]; }, 0)) };
    R.loafTop = loafs.slice().sort(function (a, b) { return b.dur - a.dur; }).slice(0, 25);
    R.ver = R.ver || (window.RPBubble && RPBubble.stats && RPBubble.stats.ver) || null;
    var body = JSON.stringify(R);
    if (body.length > 560000) {   /* stay under the table's limit: drop the pictures first */
      Object.keys(R.steps).forEach(function (k) { var d = R.steps[k] && R.steps[k].data; (function strip(x) { if (!x || typeof x !== "object") return; for (var p in x) { if (p === "thumb") x[p] = "dropped"; else strip(x[p]); } })(d); });
      if (R.screen && R.screen.grabs) R.screen.grabs.forEach(function (g, i) { if (i > 3 && g.thumb) g.thumb = "dropped"; });
      body = JSON.stringify(R);
    }
    if (R.choppy) say("NOTE: " + R.choppy);
    say("sending the report (" + Math.round(body.length / 1024) + " KB)...");
    return fetch(SEND, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY }, body: JSON.stringify({ r: R }) })
      .then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(r.status + " " + t.slice(0, 160)); return t; }); })
      .then(function (id) {
        id = String(id).trim();
        lines[lines.length - 1] = "REPORT SENT: #" + id;
        say("Done. Tell Claude the report number: #" + id);
        box.style.background = "rgba(0,40,10,.94)";
      })
      .catch(function (e) {
        lines[lines.length - 1] = "sending failed (" + e.message + ")";
        say("Use the button to save the report, then send the file to Claude.");
        var a = document.createElement("a");
        a.textContent = "Download report";
        a.href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
        a.download = "rarepond-perf-" + Date.now() + ".json";
        a.style.cssText = "display:inline-block;margin-top:10px;padding:8px 14px;border-radius:8px;background:#7dff9a;color:#000;font-weight:800;pointer-events:auto;text-decoration:none";
        box.appendChild(document.createElement("br")); box.appendChild(a); box.style.pointerEvents = "auto";
      });
  }

  /* ---------- run ---------- */
  function run() {
    return step(0, "freshness", freshness)
      .then(function () { return askScreen(); })
      .then(function () { return grab("page loaded"); })
      .then(function () { return step(1, "this machine", machine); })
      .then(function () { return step(2, "bubble engine", engine); })
      .then(function () { return step(3, "featured card", function () { return card(true); }); })
      .then(function () { return step(4, "at rest (5 s)", function () { return measure("rest", 5000).then(function (m) { m._line = fmt(m); return m; }); }); })
      .then(function () { return grab("after 5 s at rest"); })
      .then(function () { return step(5, "A/B: what costs the frames", ab); })
      .then(function () { return step(6, "carousel, 4 moves", function () { return moves(4, ""); }); })
      .then(function () { return step(7, "carousel with the old screen-sized WebGL canvas", atlasAB); })
      .then(function () { return step("7b", "canvas resize test (on screen)", resizeTest); })
      .then(function () { return step(8, "scrolling", scrolling); })
      .then(function () { return step(9, "projects page", projects); })
      .then(function () { return step(10, "open and close a film", film); })
      .then(function () { return step(11, "micro-benchmarks", benches); })
      .then(function () { return step(12, "page census", function () { var o = { census: census(), resources: resources(), engineAfter: engine() }; o.card = card(true); o._line = o.census.elements + " elements, " + o.census.canvases + " canvases"; return o; }); })
      .then(finish)
      .catch(function (e) { say("probe error: " + e.message); R.fatal = String(e.message); return finish(); });
  }
  function begin() { setTimeout(run, 2500); }
  if (window.__contentReady) Promise.resolve(window.__contentReady).then(begin, begin); else addEventListener("load", begin);
})();
