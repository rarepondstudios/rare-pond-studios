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
                                          "Minor Edge Distortion".

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
    "uniform vec2 uBox;",
    "uniform float uDepth,uRad,uT,uSeed,uPx,uInset,uWob,uSoft,uSpin,uInner;",
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
    "  float tn=.5+.575*sn(vec3(q*1.25+o,z))+.18*sn(vec3(q*2.6-o,z*1.4));",
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
    "  vec2 p=v*uBox/uInset;",
    "  float r=rr(p);",
    "  if(r>1.03){gl_FragColor=vec4(0.);return;}",
    "  float z=uSeed*17.+uT*.11;",
    /* ---- ALPHA (Alpha_Shape + Alpha_Effects pre-comps) ---- */
    "  float rm=rr(p+.0035*wv(p,3.,z*1.3));",                         // Minor Edge Distortion
    "  float r2=rr(p+uWob*.045*wv(p,2.1,z+3.));",                     // Edge 2 turbulent displace
    "  float r3=rr(p+uWob*.065*wv(p,1.7,z*.8+9.));",                  // Edge 3 turbulent displace
    "  float e1=smoothstep(.902-.012*uSoft,.906+.008*uSoft,rm);",     // Edge 1 (solid rim)
    "  float e2=smoothstep(.805-.022*uSoft,.81+.016*uSoft,r2)*.5;",   // Edge 2 (50%)
    "  float e3=smoothstep(.69-.07*uSoft,.70+.05*uSoft,r3)*.25*uInner;", // Edge 3 (25%)
    "  float cut=1.-smoothstep(1.-uPx,1.+uPx,rm);",                   // Exterior Cutter
    "  float al=(1.-(1.-e1)*(1.-e2)*(1.-e3))*cut;",
    "  if(al<.002){gl_FragColor=vec4(0.);return;}",
    /* ---- COLOUR (Color pre-comp) ---- */
    "  float an=-uT*uSpin*.6283185;",                                 // Rotate: 360deg per 10 s
    "  vec2 q=mat2(cos(an),sin(an),-sin(an),cos(an))*p;",
    "  q+=.12*wv(q,1.3,z*.7+21.);",                                    // Turbulent Displace
    "  q.x+=.025*sin(q.y*5.+uT*.9);",                                  // Wave Warp
    "  vec4 b1=blob(q,vec2(-1.007,-.614),1.247,uC3,1.7,z);",          // Color Blob 1 (sky, bottom)
    "  vec4 b2=blob(q,vec2(.969,-.528),1.268,uC1,4.1,z+5.);",         // Color Blob 2 (blue, Overlay)
    "  vec4 b3=blob(q,vec2(-.024,1.203),1.382,uC2,8.3,z+9.);",        // Color Blob 3 (violet, Overlay)
    "  vec4 f=over(over(b1,b2),b3);",
    "  vec3 col=mix(uC1,f.rgb,f.a);",                                  // Composite Over Layer
    "  gl_FragColor=vec4(col*al,al);}"                                 // premultiplied
  ].join("\n");

  var P = { wobble: 1, soft: 1, spin: 1, inner: 1, speed: 1 };
  var items = [], gl = null, glc = null, prog = null, U = {}, raf = 0;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      gl = glc.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
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
      ["uC1", "uC2", "uC3", "uBox", "uDepth", "uRad", "uT", "uSeed", "uPx", "uInset", "uWob", "uSoft", "uSpin", "uInner"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      return true;
    } catch (e) { gl = false; if (window.console) console.warn("RPBubble", e); return false; }
  }

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { var it = find(e.target); if (it) it.vis = e.isIntersecting; });
    kick();
  }, { rootMargin: "120px" }) : null;

  function find(el) { for (var i = 0; i < items.length; i++) if (items[i].el === el) return items[i]; return null; }

  /* border-radius -> radius in units of the short half-side (1 = full circle / pill) */
  function radiusOf(cs, w, h) {
    var v = (cs.borderTopLeftRadius || "").trim().split(/\s+/);
    function px(x, ref) { if (!x) return 0; return /%$/.test(x) ? parseFloat(x) / 100 * ref : parseFloat(x) || 0; }
    var rx = px(v[0], w), ry = px(v[1] || v[0], h);
    var s = Math.min(w, h) / 2;
    return Math.min(1, Math.min(rx, ry) / s);
  }

  function render(cols, W, H, box, rad, t, seed, inset, depth) {
    if (glc.width < W || glc.height < H) { glc.width = Math.max(glc.width, W); glc.height = Math.max(glc.height, H); }
    gl.viewport(0, glc.height - H, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3fv(U.uC1, cols[0]); gl.uniform3fv(U.uC2, cols[1]); gl.uniform3fv(U.uC3, cols[2]);
    gl.uniform2f(U.uBox, box[0], box[1]); gl.uniform1f(U.uRad, rad); gl.uniform1f(U.uDepth, depth || 1);
    gl.uniform1f(U.uT, t); gl.uniform1f(U.uSeed, seed);
    gl.uniform1f(U.uInset, inset);
    gl.uniform1f(U.uPx, 2.4 / Math.min(W, H));
    gl.uniform1f(U.uWob, P.wobble); gl.uniform1f(U.uSoft, P.soft); gl.uniform1f(U.uSpin, P.spin); gl.uniform1f(U.uInner, P.inner);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function draw(it, t) {
    var w = it.el.clientWidth, h = it.el.clientHeight;
    if (!w || !h) return;
    var cs = getComputedStyle(it.el);
    if (it.vars) {
      var a = css3(cs.getPropertyValue(it.vars[0])), b = css3(cs.getPropertyValue(it.vars[1])), c = css3(cs.getPropertyValue(it.vars[2]));
      if (a) {
        var key = cs.getPropertyValue(it.vars[0]) + cs.getPropertyValue(it.vars[1]) + cs.getPropertyValue(it.vars[2]);
        if (key !== it.key) { it.key = key; changed = true; }
        it.cols = [a, b || a, c || a];
      }
    }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var k = Math.min(1, (it.opts.max || 720) / (Math.max(w, h) * dpr));
    var W = Math.max(16, Math.round(w * dpr * k)), H = Math.max(16, Math.round(h * dpr * k));
    if (it.cv.width !== W || it.cv.height !== H) { it.cv.width = W; it.cv.height = H; }
    var s = Math.min(w, h);
    render(it.cols, W, H, [w / s, h / s], radiusOf(cs, w, h), t, it.opts.seed, it.opts.inset || 1, parseFloat(cs.getPropertyValue("--rpb-depth")) || 1);
    it.ctx.clearRect(0, 0, W, H);
    it.ctx.drawImage(glc, 0, 0, W, H, 0, 0, W, H);   // viewport sits in the TOP-left W x H of the shared canvas
    it.drawn = true;
  }

  var last = 0, simT = 0, changed = false;
  function frame(now) {
    raf = 0;
    if (now - last < 31 && last) { raf = requestAnimationFrame(frame); return; }  // ~30 fps
    var dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (!reduce) simT += dt * P.speed;
    var live = false; changed = false;
    if (!document.hidden) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.vis && it.drawn) continue;
        draw(it, simT + it.opts.seed * 3.7);
        live = true;
      }
    }
    /* reduced motion: time stands still; keep drawing only while a look is fading */
    if (live && (!reduce || changed || items.some(function (x) { return !x.drawn; }))) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  document.addEventListener("visibilitychange", kick);
  /* reduced motion: hover / focus / keyboard selection can still change a bubble's look, so wake
     the (otherwise idle) loop on any of them; it stops again once the colours settle */
  if (reduce) ["pointerover", "pointerout", "focusin", "keydown"].forEach(function (ev) { document.addEventListener(ev, kick, { passive: true }); });

  function attach(el, opts) {
    opts = opts || {};
    if (!el || !initGL()) return null;
    var it = find(el);
    if (it) return it;
    var cv = document.createElement("canvas");
    cv.className = "rp-bubble-cv";
    cv.setAttribute("aria-hidden", "true");
    cv.setAttribute("data-cursor", "noscan");
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;border-radius:inherit";
    el.appendChild(cv);
    el.classList.add("rp-bubble-on");
    it = {
      el: el, cv: cv, ctx: cv.getContext("2d"),
      opts: { seed: opts.seed != null ? opts.seed : Math.random() * 10, inset: opts.inset, max: opts.max },
      vars: opts.look ? null : (opts.vars || ["--gg1", "--gg2", "--gg3"]),
      cols: lookVec(opts.look || { c1: "#3f6bff", c2: "#9b5cff", c3: "#56c8ff" }),
      vis: true, drawn: false
    };
    items.push(it);
    if (io) io.observe(el);
    kick();
    return it;
  }
  function setLook(el, look) { var it = find(el); if (!it) return; it.vars = null; it.cols = lookVec(look); kick(); }
  function detach(el) {
    var i = -1; for (var j = 0; j < items.length; j++) if (items[j].el === el) i = j;
    if (i < 0) return;
    if (io) io.unobserve(el);
    items[i].cv.remove(); el.classList.remove("rp-bubble-on"); items.splice(i, 1);
  }
  var spriteCache = {};
  function sprite(look, px, t) {
    px = px || 256; t = t || 0;
    var key = [look && look.c1, look && look.c2, look && look.c3, px, t].join("|");
    if (spriteCache[key]) return spriteCache[key];
    if (!initGL()) return "";
    render(lookVec(look), px, px, [1, 1], 1, t, 0.5, 1);
    var c = document.createElement("canvas"); c.width = c.height = px;
    c.getContext("2d").drawImage(glc, 0, 0, px, px, 0, 0, px, px);
    return (spriteCache[key] = c.toDataURL("image/png"));
  }
  window.RPBubble = { attach: attach, setLook: setLook, detach: detach, sprite: sprite, params: P, redraw: kick, supported: function () { return initGL(); } };
})();
