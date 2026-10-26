/* Rare Pond - procedural V3 bubble (WebGL).
   Recreates the After Effects "Bubble 2" comps (RP Anim 1 project, Brand Kit / Animated Graphics):

     RP_V3_Bubble                         final, 2160 sq, 10 s loop
       RP_V3_Bubble_Color_PRE-COMP        COLOUR: three huge ellipses (Color Blob 1/2/3), each
                                          Cell Pattern (Static Plates, size 449) -> Turbulent
                                          Displace (100 / 120) -> Colorama ramp of ONE hue
                                          (light -> full). Blob 1 at the bottom, Blob 2 and Blob 3
                                          on top in OVERLAY (was Darken until 2026-10-26: Darken
                                          turned non-signature looks muddy). A Transform effect
                                          spins the field one full turn per loop, then a 200px
                                          Camera Lens Blur + Wave Warp melt it together.
       alpha matte  RP_V3_Bubble_Alpha_Effects_PRE-COMP
                                          ALPHA: three stroked circles (Edge 1/2/3 at 100 / 50 /
                                          25 % opacity, stroke 105 / 200 / 400, scale 100 / 95 /
                                          90 %, blur 15 / 30 / 75, Edge 2+3 turbulent-displaced),
                                          clipped by an "Exterior Cutter" circle, plus a 4px
                                          "Minor Edge Distortion". Edge 1 thinned to stroke 80 on 2026-10-26 (rim inner edge 0.90 -> 0.92 R).

   So the bubble is a crisp solid rim, a 50% wobbly band inside it, a 25% very soft band inside
   that, and a clear centre. The colour that shows through is a slow-spinning painterly field
   made of the look's three colours:
     Color Blob 1 (sky)    <- c3
     Color Blob 2 (blue)   <- c1
     Color Blob 3 (violet) <- c2
   With the signature look that reproduces the AE palette.

   COLOUR SOURCE. A bubble reads its three colours from CSS custom properties on its own
   element every frame (default --gg1/--gg2/--gg3, the same registered colour vars the old
   conic rims used). The site's existing look logic (signature at rest, film look on hover,
   keyboard selection, the .4s fade) therefore drives the shader with no extra wiring, and
   the fade is the CSS transition itself.

   SHAPE. The bands are measured inward from the element's border, so a bubble that morphs
   into a rounded rectangle (the featured carousel card) keeps the same rim. The corner radius
   is read from the element's computed border-radius each frame, so it follows the morph.
   --rpb-depth (CSS, default 1) scales how far the bands reach inward, in units of the short
   half-side: the wide featured card uses less so its rim matches the round side bubbles.

   ONE shared WebGL context renders every bubble; each bubble gets a plain 2D canvas that the
   frame is copied into (browsers cap WebGL contexts at about 16 per page). Off-screen bubbles
   are skipped, the loop runs at 30 fps, and reduced motion freezes on a still frame.

   API
     RPBubble.attach(el, {vars:[a,b,c] | look:{c1,c2,c3}, seed, max})  canvas fills el
     RPBubble.attach(glowEl, {glow:true, ref:bubbleEl, seed})  halo layer; pass the SAME seed as
                                             the bubble's rim so both show the same colours at once
     RPBubble.setLook(el, {c1,c2,c3})        fixed look instead of CSS vars
     RPBubble.detach(el)
     RPBubble.sprite({c1,c2,c3}, px, t)      one still frame as a data: URL (ambient bubbles)
     RPBubble.params                         live-tunable shape params
*/
(function () {
  "use strict";
  if (window.RPBubble) return;

  var VS = "attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}";

  var FS = [
    "precision highp float;",
    "varying vec2 v;",
    "uniform vec3 uC1,uC2,uC3;",
    "uniform vec2 uBox,uScale;",
    "uniform float uGlow;",
    "uniform float uDepth,uRad,uT,uSeed,uPx,uWob,uSoft,uSpin,uInner,uCol;",
    /* Ashima / Stefan Gustavson 3D simplex noise (MIT) */
    "vec3 m289(vec3 x){return x-floor(x*(1./289.))*289.;}",
    "vec4 m289(vec4 x){return x-floor(x*(1./289.))*289.;}",
    "vec4 perm(vec4 x){return m289(((x*34.)+1.)*x);}",
    "vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}",
    "float sn(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);",
    "vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;",
    "vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;",
    "i=m289(i);vec4 p=perm(perm(perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));",
    "float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);",
    "vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);",
    "vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
    "vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);",
    "vec4 nr=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=nr.x;p1*=nr.y;p2*=nr.z;p3*=nr.w;",
    "vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;",
    "return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}",
    "vec2 wv(vec2 p,float f,float z){return vec2(sn(vec3(p*f,z)),sn(vec3(p*f+vec2(7.3,-3.1),z+11.)));}",
    /* distance-from-centre equivalent for a rounded box: 1.0 on the border, like length(p) on a circle */
    "float rr(vec2 p){vec2 q=abs(p)-uBox+uRad;return 1.+(length(max(q,0.))+min(max(q.x,q.y),0.)-uRad)/uDepth;}",
    /* one Color Blob: soft ellipse (lens blur) of plates shading light -> deep (Colorama) */
    "vec4 blob(vec2 q,vec2 c,float r,vec3 col,float o,float z){",
    "  float d=length(q-c)/r;",
    "  float m=1.-smoothstep(.72,1.18,d);",
    "  float tn=.5+.62*sn(vec3(q*1.25+o,z));",
    "  tn=smoothstep(.12,.92,tn);",
    "  vec3 lite=mix(col,vec3(1.),.06);",
    "  vec3 deep=pow(col,vec3(1.6));",
    "  return vec4(mix(lite,deep,tn),m);}",
    /* AE Overlay: base b, layer s */
    "vec3 ovl(vec3 b,vec3 s){return mix(2.*b*s,1.-2.*(1.-b)*(1.-s),step(.5,b));}",
    "vec4 over(vec4 b,vec4 s){",
    "  float a=s.a+b.a-s.a*b.a; if(a<1e-4) return vec4(0.);",
    "  vec3 c=(s.rgb*s.a*(1.-b.a)+b.rgb*b.a*(1.-s.a)+s.a*b.a*ovl(b.rgb,s.rgb))/a;",
    "  return vec4(c,a);}",
    "void main(){",
    "  vec2 p=v*uScale;",                                               // canvas -> bubble units (1 = bubble edge)
    "  float r=rr(p);",
    "  float al;",
    /* GLOW mode: the soft halo layer outside a bubble (.glow / .cglow). Same colour field, same
       seed, same clock as the bubble's rim, so the halo turns WITH the rim instead of on its own. */
    "  if(uGlow>.5){",
    "    if(r>1.3||r<.55){gl_FragColor=vec4(0.);return;}",
    "    al=smoothstep(.55,.92,r)*(1.-smoothstep(.97,min(1.17,min(uScale.x,uScale.y)),r));",
    "  } else {",
    /* cheap early-outs before any noise: outside the cutter, or the clear centre that no band can reach */
    "  if(r>1.03||r<.5){gl_FragColor=vec4(0.);return;}",
    "  float z=uSeed*17.+uT*.11;",
    /* ---- ALPHA (Alpha_Shape + Alpha_Effects pre-comps) ----
       ONE turbulence field drives both wobbling bands (Edge 2 and Edge 3 sample it with different
       amounts and swizzles), and the 4px Minor Edge Distortion is too small to see at web sizes. */
    "  vec2 w=wv(p,1.9,z+3.);",
    "  float r2=rr(p+uWob*.045*w);",                                 // Edge 2 turbulent displace
    "  float r3=rr(p+uWob*.065*vec2(w.y,-w.x));",                     // Edge 3 turbulent displace
    "  float e1=smoothstep(.917-.012*uSoft,.921+.008*uSoft,r);",      // Edge 1 (solid rim; stroke 80 since 2026-10-26, was 105)
    "  float e2=smoothstep(.805-.022*uSoft,.81+.016*uSoft,r2)*.5;",   // Edge 2 (50%)
    "  float e3=smoothstep(.69-.07*uSoft,.70+.05*uSoft,r3)*.25*uInner;", // Edge 3 (25%)
    "  float cut=1.-smoothstep(1.-uPx,1.+uPx,r);",                    // Exterior Cutter
    "  al=(1.-(1.-e1)*(1.-e2)*(1.-e3))*cut;",
    "  }",
    "  if(al<.004){gl_FragColor=vec4(0.);return;}",
    /* ---- COLOUR (Color pre-comp) ---- */
    "  float tc=uT*uCol;",                                              // colour clock (slower than AE, see P.color)
    "  float zc=uSeed*17.+tc*.11;",
    "  float an=-tc*uSpin*.6283185;",                                 // Rotate: 360deg per 10 s at uCol 1
    "  vec2 q=mat2(cos(an),sin(an),-sin(an),cos(an))*p;",
    "  q+=.12*wv(q,1.3,zc*.7+21.);",                                    // Turbulent Displace
    "  q.x+=.025*sin(q.y*5.+tc*.9);",                                  // Wave Warp
    "  vec4 b1=blob(q,vec2(-1.007,-.614),1.247,uC3,1.7,zc);",          // Color Blob 1 (sky, bottom)
    "  vec4 b2=blob(q,vec2(.969,-.528),1.268,uC1,4.1,zc+5.);",         // Color Blob 2 (blue, Overlay)
    "  vec4 b3=blob(q,vec2(-.024,1.203),1.382,uC2,8.3,zc+9.);",        // Color Blob 3 (violet, Overlay)
    "  vec4 f=over(over(b1,b2),b3);",
    "  vec3 col=mix(uC1,f.rgb,f.a);",                                  // Composite Over Layer
    "  gl_FragColor=vec4(col*al,al);}"                                 // premultiplied
  ].join("\n");

  /* color: speed of the COLOUR field (spin, plate evolution, wave) relative to the AE loop. Jack
     (2026-10-26): the gradients moved way too fast at the AE rate, slow and subtle wanted -> 0.3,
     then "still too fast" -> 0.15, then "too slow now" -> 0.22, about one turn per 45 s. The rim's band
     wobble keeps the AE speed. */
  var P = { wobble: 1, soft: 1, spin: 1, inner: 1, speed: 1, color: 0.22 };
  /* PERFORMANCE BUDGET (2026-10-26, after the first live version cost real frame rate):
     - 24 fps, the AE comp's own rate. The motion is one slow turn per 10 s, so more is invisible.
     - resolution: at most 1.25 device px per CSS px and 480 px on the long side. The look is soft
       everywhere except the outer edge, which stays anti-aliased at that size.
     - NO style or layout reads in the frame loop. Size comes from a ResizeObserver; colours, corner
       radius and --rpb-depth are re-read only while a CSS transition is running on (or above) the
       bubble, plus one slow round-robin refresh so nothing can stay stale.
     - a bubble is drawn only when it is on screen (IntersectionObserver) AND actually visible
       (checkVisibility: not opacity 0 / visibility hidden / display none), checked round-robin.
     - frames are skipped while the carousel is being dragged (body.swiping), the tab is hidden, or
       the ambient animation is idle (body.bg-idle), mirroring what the CSS already pauses.
     - adaptive quality: if the PAGE (not just the bubbles) misses frames for a second, resolution
       steps down (to 55%) and frame rate to 15; it steps back up once frames are smooth again. */
  /* MAXPX only guards against absurd sizes now. It used to be 480, which quietly rendered the big
     home logo bubble (460 css px) at a lower density than the smaller bubbles, so it looked blurrier
     (Jack, 2026-10-26). Every bubble now gets the same 1.25 device px per CSS px; glow layers, which
     are blurred by CSS anyway, render at half that. */
  var FPS = 24, MAXPX = 1600, DPR_CAP = 1.25;
  var Q = { scale: 1, fps: FPS };
  var items = [], gl = null, glc = null, prog = null, U = {}, raf = 0;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canCheckVis = typeof Element !== "undefined" && "checkVisibility" in Element.prototype;

  function hex3(h) {
    h = String(h || "").trim().replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  /* any CSS colour string the browser hands back: #hex, rgb(), rgba(), color(srgb ...) */
  function css3(s) {
    s = String(s || "").trim();
    if (!s) return null;
    if (s[0] === "#") return hex3(s);
    var m = s.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
    if (m) return [m[1] / 255, m[2] / 255, m[3] / 255];
    m = s.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  function lookVec(l) {
    l = l || {};
    var a = hex3(l.c1) || [1, 1, 1], b = hex3(l.c2) || a, c = hex3(l.c3) || a;
    return [a, b, c];
  }

  function initGL() {
    if (gl) return true;
    if (gl === false) return false;
    try {
      glc = document.createElement("canvas");
      gl = glc.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
      if (!gl) { gl = false; return false; }
      var sh = function (type, src) {
        var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); gl.useProgram(prog);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ["uC1", "uC2", "uC3", "uBox", "uScale", "uGlow", "uDepth", "uRad", "uT", "uSeed", "uPx", "uWob", "uSoft", "uSpin", "uInner", "uCol"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1f(U.uWob, P.wobble); gl.uniform1f(U.uSoft, P.soft); gl.uniform1f(U.uSpin, P.spin); gl.uniform1f(U.uInner, P.inner); gl.uniform1f(U.uCol, P.color);
      glc.addEventListener("webglcontextlost", function (e) { e.preventDefault(); gl = false; });
      return true;
    } catch (e) { gl = false; if (window.console) console.warn("RPBubble", e); return false; }
  }

  function find(el) { for (var i = 0; i < items.length; i++) if (items[i].el === el) return items[i]; return null; }

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { var it = find(e.target); if (it) it.onScreen = e.isIntersecting; });
    kick();
  }, { rootMargin: "80px" }) : null;
  var ro = "ResizeObserver" in window ? new ResizeObserver(function (es) {
    es.forEach(function (e) {
      var it = find(e.target); if (!it) return;
      var b = e.borderBoxSize && e.borderBoxSize[0];
      it.w = b ? b.inlineSize : e.contentRect.width; it.h = b ? b.blockSize : e.contentRect.height;
      it.dirty = Math.max(it.dirty, 1);
    });
    kick();
  }) : null;

  /* any CSS transition on a bubble or an ancestor (hover look fade, the carousel card's shape morph,
     --rpb-depth) makes the affected bubbles re-read their style every frame until it ends */
  function onTrans(e) {
    var t = e.target; if (!t || !t.contains) return;
    var live = e.type === "transitionrun" || e.type === "transitionstart";
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (t === it.el || t.contains(it.el) || (it.ref && (t === it.ref || t.contains(it.ref)))) {
        if (live) { it.trans++; it.transAt = performance.now(); } else it.trans = Math.max(0, it.trans - 1);
        it.dirty = Math.max(it.dirty, 2);
      }
    }
    kick();
  }
  ["transitionrun", "transitionend", "transitioncancel"].forEach(function (ev) { document.addEventListener(ev, onTrans, true); });

  /* border-radius -> radius in units of the short half-side (1 = full circle / pill) */
  function radiusOf(cs, w, h) {
    var v = (cs.borderTopLeftRadius || "").trim().split(/\s+/);
    function px(x, ref) { if (!x) return 0; return /%$/.test(x) ? parseFloat(x) / 100 * ref : parseFloat(x) || 0; }
    var rx = px(v[0], w), ry = px(v[1] || v[0], h);
    var s = Math.min(w, h) / 2;
    return s > 0 ? Math.min(1, Math.min(rx, ry) / s) : 1;
  }

  function readStyle(it) {
    if (!it.w || !it.h) { var r = it.el.getBoundingClientRect(); it.w = it.el.offsetWidth || r.width; it.h = it.el.offsetHeight || r.height; }
    var cs = getComputedStyle(it.el);
    if (it.ref) {   // glow layer: the bubble's own box and corner radius define the shape
      it.rw = it.ref.offsetWidth; it.rh = it.ref.offsetHeight;
      it.rrad = radiusOf(getComputedStyle(it.ref), it.rw, it.rh);
    }
    if (it.vars) {
      var a = css3(cs.getPropertyValue(it.vars[0])), b = css3(cs.getPropertyValue(it.vars[1])), c = css3(cs.getPropertyValue(it.vars[2]));
      if (a) it.cols = [a, b || a, c || a];
    }
    it.rad = radiusOf(cs, it.w, it.h);
    it.depth = parseFloat(cs.getPropertyValue("--rpb-depth")) || 1;
    it.styled = true;
  }

  function render(cols, W, H, box, rad, t, seed, scale, depth, glow) {
    if (glc.width < W || glc.height < H) { glc.width = Math.max(glc.width, W, 256); glc.height = Math.max(glc.height, H, 256); }
    gl.viewport(0, glc.height - H, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3fv(U.uC1, cols[0]); gl.uniform3fv(U.uC2, cols[1]); gl.uniform3fv(U.uC3, cols[2]);
    gl.uniform2f(U.uBox, box[0], box[1]); gl.uniform1f(U.uRad, rad); gl.uniform1f(U.uDepth, depth || 1);
    gl.uniform1f(U.uT, t); gl.uniform1f(U.uSeed, seed);
    gl.uniform2f(U.uScale, scale[0], scale[1]); gl.uniform1f(U.uGlow, glow ? 1 : 0);
    gl.uniform1f(U.uPx, 2.4 / Math.min(W, H));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function draw(it, t) {
    if (it.dirty || it.trans || !it.styled) { readStyle(it); if (it.dirty) it.dirty--; }
    var w = it.w, h = it.h;
    if (!w || !h) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * Q.scale * (it.opts.res || 1);
    var k = Math.min(1, (it.opts.max || MAXPX) / (Math.max(w, h) * dpr));
    var W = Math.max(16, Math.round(w * dpr * k)), H = Math.max(16, Math.round(h * dpr * k));
    if (it.cv.width !== W || it.cv.height !== H) { it.cv.width = W; it.cv.height = H; }
    if (it.ref) {
      var bw = it.rw || w, bh = it.rh || h, sb = Math.min(bw, bh) / 2;
      render(it.cols, W, H, [bw / 2 / sb, bh / 2 / sb], it.rrad == null ? 1 : it.rrad, t, it.opts.seed, [w / 2 / sb, h / 2 / sb], 1, true);
    } else {
      var s = Math.min(w, h), inset = it.opts.inset || 1;
      render(it.cols, W, H, [w / s, h / s], it.rad, t, it.opts.seed, [w / s / inset, h / s / inset], it.depth, false);
    }
    it.ctx.clearRect(0, 0, W, H);
    it.ctx.drawImage(glc, 0, 0, W, H, 0, 0, W, H);   // viewport sits in the TOP-left W x H of the shared canvas
    it.drawn = true;
    return true;
  }

  /* round-robin housekeeping, a couple of bubbles per frame: real visibility + a slow style refresh */
  var rr = 0;
  function housekeep(now) {
    if (!items.length) return;
    for (var n = 0; n < 2; n++) {
      rr = (rr + 1) % items.length;
      var it = items[rr];
      if (canCheckVis) it.shown = it.el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      if (it.trans && now - (it.transAt || 0) > 3000) it.trans = 0;   // a transition whose end event never came
      if (now - (it.styledAt || 0) > 2000 && it.onScreen) { it.dirty = Math.max(it.dirty, 1); it.styledAt = now; }
    }
  }

  /* adaptive quality from the page's own frame pacing */
  var pace = { t0: 0, n: 0, slow: 0 };
  function adapt(now, gap) {
    if (!pace.t0) pace.t0 = now;
    pace.n++; if (gap > 24) pace.slow++;
    if (now - pace.t0 < 1000) return;
    var ratio = pace.slow / Math.max(1, pace.n);
    if (ratio > 0.25 && Q.scale > 0.56) { Q.scale = Math.max(0.55, Q.scale - 0.15); Q.fps = 15; }
    else if (ratio < 0.05 && Q.scale < 1) { Q.scale = Math.min(1, Q.scale + 0.1); if (Q.scale >= 1) Q.fps = FPS; }
    pace.t0 = now; pace.n = 0; pace.slow = 0;
  }

  var last = 0, lastDraw = 0, simT = 0;
  function frame(now) {
    raf = 0;
    var gap = last ? now - last : 16; last = now;
    var body = document.body;
    var paused = document.hidden || (body && body.classList.contains("bg-idle"));
    /* carousel drag / slide change: the cards are moving, so only the ones changing shape are
       redrawn, at half rate; everything else holds its last frame */
    var swiping = !!(body && body.classList.contains("swiping"));
    if (!paused && !swiping) adapt(now, gap);
    housekeep(now);
    var due = now - lastDraw >= 1000 / (swiping ? 12 : Q.fps) - 2;
    var pending = false, live = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var vis = it.onScreen !== false && it.shown !== false;
      if (!vis) continue;
      live = true;
      if (!it.drawn || it.trans) pending = true;
    }
    if ((due || pending) && !paused && gl) {
      var dt = Math.min(0.1, (now - (lastDraw || now)) / 1000); lastDraw = now;
      if (!reduce) simT += dt * P.speed;
      for (var j = 0; j < items.length; j++) {
        var x = items[j];
        if (x.onScreen === false || x.shown === false) continue;
        if ((reduce || swiping) && x.drawn && !x.trans && !x.dirty) continue;
        draw(x, simT + x.opts.seed * 3.7);
      }
    }
    var keep = live && (!reduce || items.some(function (x) { return !x.drawn || x.trans || x.dirty; }));
    if (keep || paused && live) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  document.addEventListener("visibilitychange", kick);
  /* reduced motion: hover / focus can still change a bubble's look; wake the idle loop for it */
  if (reduce) ["pointerover", "pointerout", "focusin"].forEach(function (ev) { document.addEventListener(ev, kick, { passive: true }); });

  function attach(el, opts) {
    opts = opts || {};
    if (!el || !initGL()) return null;
    var it = find(el);
    if (it) return it;
    var cv = document.createElement("canvas");
    cv.className = "rp-bubble-cv";
    cv.setAttribute("aria-hidden", "true");
    cv.setAttribute("data-cursor", "noscan");
    cv.width = cv.height = 16;
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;border-radius:inherit";
    el.appendChild(cv);
    el.classList.add("rp-bubble-on");
    it = {
      el: el, cv: cv, ctx: cv.getContext("2d", { alpha: true }),
      opts: { seed: opts.seed != null ? opts.seed : Math.random() * 10, inset: opts.inset, max: opts.max, res: opts.glow ? 0.5 : (opts.res || 1) },
      ref: opts.glow ? (opts.ref || el) : null,
      vars: opts.look ? null : (opts.vars || ["--gg1", "--gg2", "--gg3"]),
      cols: lookVec(opts.look || { c1: "#3f6bff", c2: "#9b5cff", c3: "#56c8ff" }),
      onScreen: io ? undefined : true, shown: undefined, drawn: false, styled: false, dirty: 1, trans: 0, rad: 1, depth: 1, w: 0, h: 0
    };
    items.push(it);
    if (io) io.observe(el);
    if (ro) ro.observe(el);
    kick();
    return it;
  }
  function setLook(el, look) { var it = find(el); if (!it) return; it.vars = null; it.cols = lookVec(look); it.drawn = false; kick(); }
  function detach(el) {
    var i = -1; for (var j = 0; j < items.length; j++) if (items[j].el === el) i = j;
    if (i < 0) return;
    if (io) io.unobserve(el);
    if (ro) ro.unobserve(el);
    items[i].cv.remove(); el.classList.remove("rp-bubble-on"); items.splice(i, 1);
  }
  function setParam(k, v) {
    P[k] = v;
    if (gl) { gl.uniform1f(U.uWob, P.wobble); gl.uniform1f(U.uSoft, P.soft); gl.uniform1f(U.uSpin, P.spin); gl.uniform1f(U.uInner, P.inner); gl.uniform1f(U.uCol, P.color); }
    items.forEach(function (x) { x.drawn = false; }); kick();
  }
  var spriteCache = {};
  function sprite(look, px, t) {
    px = px || 256; t = t || 0;
    var key = [look && look.c1, look && look.c2, look && look.c3, px, t].join("|");
    if (spriteCache[key]) return spriteCache[key];
    if (!initGL()) return "";
    render(lookVec(look), px, px, [1, 1], 1, t, 0.5, [1, 1], 1, false);
    var c = document.createElement("canvas"); c.width = c.height = px;
    c.getContext("2d").drawImage(glc, 0, 0, px, px, 0, 0, px, px);
    return (spriteCache[key] = c.toDataURL("image/png"));
  }
  window.RPBubble = {
    attach: attach, setLook: setLook, detach: detach, sprite: sprite, params: P, setParam: setParam, quality: Q,
    redraw: function () { items.forEach(function (x) { x.drawn = false; }); kick(); },
    supported: function () { return initGL(); }
  };
})();
