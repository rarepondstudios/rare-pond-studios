/* PERFORMANCE PROBE (2026-10-27). Loaded only when the URL has ?perf=1 (see the loader in index.html).
   Jack's site ran smoothly on the Mac mini but stuttered on two Windows PCs we cannot test from here.
   Open https://rarepond.com/?perf=1 on such a machine, keep the mouse still, and wait about 25 s: it
   measures that machine (shader build time, frame pacing at rest and during four carousel moves, how
   long each bubble takes to draw, and three ways of getting a WebGL frame onto the page) and shows the
   numbers in a panel. A photo of the panel is all that is needed. It also sends the same numbers to
   /api/client-error (kind "perf"). Nothing here runs for normal visitors. */
(function () {
  "use strict";
  var T0 = performance.now(), gaps = [], last = 0, longs = [];
  (function f(now) { if (last) gaps.push([now, now - last]); last = now; requestAnimationFrame(f); })(performance.now());
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { longs.push([e.startTime, e.duration]); }); }).observe({ type: "longtask", buffered: true }); } catch (e) {}

  var box = document.createElement("div");
  box.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483647;max-width:min(760px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:rgba(0,0,0,.88);color:#7dff9a;font:600 14px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:12px 14px;border-radius:10px;white-space:pre-wrap;pointer-events:none";
  function out(t) { box.textContent = t; }
  function add() { (document.body || document.documentElement).appendChild(box); }
  if (document.body) add(); else addEventListener("DOMContentLoaded", add);
  out("Rare Pond performance check: keep the mouse still, about 25 seconds...");

  function stat(a) {
    if (!a.length) return { n: 0 };
    var x = a.slice().sort(function (p, q) { return p - q; }), s = 0; x.forEach(function (v) { s += v; });
    return { n: x.length, fps: Math.round(1000 * x.length / s), avg: +(s / x.length).toFixed(1), p95: Math.round(x[Math.floor(x.length * 0.95)]), max: Math.round(x[x.length - 1]), over50: x.filter(function (v) { return v > 50; }).length };
  }
  function win(t1, t2) { return gaps.filter(function (g) { return g[0] >= t1 && g[0] < t2; }).map(function (g) { return g[1]; }); }
  function longIn(t1, t2) { var n = 0, ms = 0; longs.forEach(function (l) { if (l[0] >= t1 && l[0] < t2) { n++; ms += l[1]; } }); return n + " tasks, " + Math.round(ms) + " ms"; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fmt(s) { return s.n ? (s.fps + " fps  avg " + s.avg + "  p95 " + s.p95 + "  max " + s.max + " ms  frames>50ms " + s.over50) : "n/a"; }

  /* three ways to get a WebGL frame into on-page canvases, 6 canvases at real bubble sizes, 90 frames each */
  function bench(mode) {
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
        else { surf = g; g.width = 2048; g.height = 1024; }
        gl = surf.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
        ctxs = disp.map(function (c) { return c.getContext(mode === "copy" ? "2d" : "bitmaprenderer"); });
      } catch (e) { holder.remove(); return res(mode + ": not supported (" + e.message + ")"); }
      if (!gl) { holder.remove(); return res(mode + ": no WebGL"); }
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
          else gl.viewport(0, 1024 - h, w, h);
          gl.uniform1f(ut, now / 1000 + i); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          if (mode === "copy") { ctxs[i].clearRect(0, 0, w, h); ctxs[i].drawImage(g, 0, 0, w, h, 0, 0, w, h); }
          else ctxs[i].transferFromImageBitmap(surf.transferToImageBitmap());
        });
        work.push(performance.now() - t0);
        if (l) fg.push(now - l); l = now;
        if (++n < 90) requestAnimationFrame(f);
        else { holder.remove(); var lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext(); var w2 = stat(work.slice(10)); res((mode + "            ").slice(0, 14) + "main thread " + w2.avg + " ms/frame (max " + w2.max + ")   " + fmt(stat(fg.slice(10)))); }
      }
      requestAnimationFrame(f);
    });
  }

  /* correctness: does a copy from a WebGL canvas show what was just drawn, after that canvas was resized
     (the old rp-bubble behaviour) and without a resize (the current one)? */
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

  function run() {
    var R = [], S = window.RPBubble && RPBubble.stats;
    var nav = performance.getEntriesByType("navigation")[0] || {};
    var ua = navigator.userAgent, br = (ua.match(/(Edg|Chrome|Firefox|Version)\/[\d.]+/) || [""])[0], os = (ua.match(/\(([^)]+)\)/) || ["", ""])[1].split(";")[0];
    R.push("RARE POND PERF CHECK   " + new Date().toLocaleString());
    R.push(os + " | " + br + " | " + (navigator.hardwareConcurrency || "?") + " cores | screen " + screen.width + "x" + screen.height + " @" + (window.devicePixelRatio || 1) + "x | window " + innerWidth + "x" + innerHeight);
    R.push("GPU: " + ((S && S.gpu) || "?"));
    R.push("load: first byte " + Math.round(nav.responseStart || 0) + " ms, page shown " + Math.round(window.__revealedAt || 0) + " ms, all loaded " + Math.round(nav.loadEventEnd || 0) + " ms");
    if (S) R.push("bubble shader build " + S.compileMs + " ms (background: " + (S.parallel ? "yes" : "NO") + "), zoom shader " + S.zCompileMs + " ms");
    R.push("WebGL copy check: after a resize " + snapTest(true) + ", fixed size " + snapTest(false));
    if (S) R.push("bubble code version " + (S.ver || "old (before 20261027g): please reload") + ", copy calibration " + (S.calib || "not run"));
    var t1 = performance.now();
    out(R.join("\n") + "\n\nmeasuring the page at rest (4 s)...");
    var d0 = S ? [S.draws, S.drawMs, S.frames, S.frameMs] : null;
    return wait(4000).then(function () {
      var t2 = performance.now();
      R.push("at rest:   " + fmt(stat(win(t1, t2))) + "   long tasks " + longIn(t1, t2));
      if (S) { var dn = S.draws - d0[0]; R.push("   bubble draws " + dn + " (" + (dn ? (((S.drawMs - d0[1]) / dn).toFixed(2)) : 0) + " ms each, worst " + S.drawMax.toFixed(1) + " ms), bubble work per frame avg " + (S.frames - d0[2] ? ((S.frameMs - d0[3]) / (S.frames - d0[2])).toFixed(1) : 0) + " ms"); }
      out(R.join("\n") + "\n\nmoving the carousel 4 times...");
      if (S) d0 = [S.draws, S.drawMs, S.frames, S.frameMs, S.drawMax];
      var nx = document.querySelector(".carr.next, .carr:last-of-type, [aria-label*='ext']");
      var t3 = performance.now(), p = Promise.resolve();
      for (var i = 0; i < 4; i++) p = p.then(function () { if (nx) nx.click(); return wait(1300); });
      return p.then(function () {
        var t4 = performance.now();
        R.push("carousel:  " + (nx ? fmt(stat(win(t3, t4))) : "carousel not found") + "   long tasks " + longIn(t3, t4));
        if (S) { var dn = S.draws - d0[0]; R.push("   bubble draws " + dn + " (" + (dn ? (((S.drawMs - d0[1]) / dn).toFixed(2)) : 0) + " ms each, worst " + S.drawMax.toFixed(1) + " ms), bubble work per frame avg " + (S.frames - d0[2] ? ((S.frameMs - d0[3]) / (S.frames - d0[2])).toFixed(1) : 0) + " ms, worst " + S.frameMax.toFixed(1)); }
        out(R.join("\n") + "\n\ncomparing three ways to show WebGL frames...");
        R.push("WebGL to page, 6 canvases:");
        return ["copy", "bitmap-resize", "bitmap-fixed"].reduce(function (q, m) { return q.then(function () { return bench(m).then(function (line) { R.push("  " + line); out(R.join("\n")); }); }); }, wait(300));
      });
    }).then(function () {
      R.push("\nDone. Please send Claude a photo of this panel.");
      out(R.join("\n"));
      try { var body = JSON.stringify({ kind: "perf", msg: R.join(" | ").slice(0, 3800), page: location.pathname + location.search, ua: navigator.userAgent }); if (navigator.sendBeacon) navigator.sendBeacon("/api/client-error", body); } catch (e) {}
    });
  }
  function begin() { wait(2500).then(run).catch(function (e) { out("perf check failed: " + e.message); }); }
  if (window.__contentReady) Promise.resolve(window.__contentReady).then(begin); else addEventListener("load", begin);
})();
