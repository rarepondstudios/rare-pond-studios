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

  var HEAD = [
    "precision highp float;",
    "varying vec2 v;",
    "uniform vec3 uC1,uC2,uC3;",
    "uniform vec2 uBox,uScale;",
    "uniform float uGlow;",
    "uniform vec3 uPal[8];",
    "uniform float uPalN,uRb;",
    "uniform float uDeep,uDepth,uRad,uT,uSeed,uPx,uWob,uSoft,uSpin,uInner,uCol,uSh;",
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
    /* RAINBOW special: a cyclic ramp through up to 8 stops (colour looks' SPECIALS, e.g. rainbow) */
    "vec3 pal(float x){",
    "  float f=x*uPalN; float i0=floor(f); float i1=mod(i0+1.,uPalN); float fr=f-i0;",
    "  vec3 a=uPal[0], b=uPal[0];",
    "  for(int i=0;i<8;i++){float fi=float(i); if(fi==i0) a=uPal[i]; if(fi==i1) b=uPal[i];}",
    "  return mix(a,b,smoothstep(0.,1.,fr));}",
    /* AE Overlay: base b, layer s */
    "vec3 ovl(vec3 b,vec3 s){return mix(2.*b*s,1.-2.*(1.-b)*(1.-s),step(.5,b));}",
    "vec4 over(vec4 b,vec4 s){",
    "  float a=s.a+b.a-s.a*b.a; if(a<1e-4) return vec4(0.);",
    "  vec3 c=(s.rgb*s.a*(1.-b.a)+b.rgb*b.a*(1.-s.a)+s.a*b.a*ovl(b.rgb,s.rgb))/a;",
    "  return vec4(c,a);}",
    /* ---- COLOUR (Color pre-comp), as a function so the depth zoom can sample it per layer ---- */
    "vec3 colAt(vec2 p){",
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
    "  if(uRb>.001){",                                                  // special look: the whole ramp wraps round the bubble
    "    float h=atan(q.y,q.x)/6.2831853+.5+.06*sn(vec3(q*1.4,zc+31.));",
    "    col=mix(col,pal(fract(h)),uRb);",
    "  }",
    "  return col;}",
    /* ---- SHINE (RP_V3_Bubble_Shine_PRE-COMP, Jack's AE build, saved 2026-10-26 16:28) ----
       Three white ellipses, top right, in bubble units (centre 1080,1080, R 853.7 in the 2160 comp):
         Shine 3  centre (.3914,.5728) radii (.3155,.1884)  blur 75  Turbulent 30/40  opacity 20%
         Shine 2  centre (.4459,.5962) radii (.1895,.1151)  blur 30  Turbulent 20/30  opacity 40%
         Shine 1  centre (.3692,.6424) radii (.0757,.0569)  blur 10                   opacity 40%
       all clipped by the Exterior Cutter. On a rounded card it is pinned to the top-right corner. */
    "float shE(vec2 d,vec2 rad,float w){float k=length(d/rad);float sd=(k-1.)*min(rad.x,rad.y);return 1.-smoothstep(-w,w,sd);}",
    "vec2 shC(){return vec2(.42,.6)+uBox-vec2(1.);}",
    "float shineA(vec2 p,float z){",
    "  vec2 o=uBox-vec2(1.);",
    "  float s3=shE(p-(vec2(.3914,.5728)+o)+.035*uWob*wv(p,10.,z+40.),vec2(.3155,.1884),.105)*.20;",
    "  float s2=shE(p-(vec2(.4459,.5962)+o)+.023*uWob*wv(p,14.,z+47.),vec2(.1895,.1151),.042)*.40;",
    "  float s1=shE(p-(vec2(.3692,.6424)+o),vec2(.0757,.0569),.019)*.40;",
    "  return 1.-(1.-s1)*(1.-s2)*(1.-s3);}",
  ];
  var FS = HEAD.concat([
    "void main(){",
    "  vec2 p=v*uScale;",                                               // canvas -> bubble units (1 = bubble edge)
    "  float r=rr(p);",
    /* GLOW mode: the soft halo layer outside a bubble (.glow / .cglow). Same colour field, same
       seed, same clock as the bubble's rim, so the halo turns WITH the rim instead of on its own. */
    "  if(uGlow>.5){",
    "    if(r>1.3||r<.55){gl_FragColor=vec4(0.);return;}",
    "    float ag=smoothstep(.55,.92,r)*(1.-smoothstep(.96,min(1.2,min(uScale.x,uScale.y)-.02),r));",
    "    if(ag<.004){gl_FragColor=vec4(0.);return;}",
    "    gl_FragColor=vec4(colAt(p)*ag,ag);return;",
    "  }",
    "  if(r>1.03){gl_FragColor=vec4(0.);return;}",
    "  float z=uSeed*17.+uT*.11;",
    "  float sa=0.;",
    "  if(uSh>.5&&length(p-shC())<.62) sa=shineA(p,z);",
    /* cheap early-out: the clear centre that no band (and no shine) can reach */
    "  if(r<.5-.14*uDeep&&sa<.004){gl_FragColor=vec4(0.);return;}",
    /* ---- ALPHA (Alpha_Shape + Alpha_Effects pre-comps) ----
       ONE turbulence field drives both wobbling bands (Edge 2 and Edge 3 sample it with different
       amounts and swizzles), and the 4px Minor Edge Distortion is too small to see at web sizes. */
    "  vec2 w=wv(p,1.9,z+3.);",
    "  float r2=rr(p+uWob*.045*w);",                                 // Edge 2 turbulent displace
    "  float r3=rr(p+uWob*.065*vec2(w.y,-w.x));",                     // Edge 3 turbulent displace
    "  float e1=smoothstep(.917-.012*uSoft,.921+.008*uSoft,r);",      // Edge 1 (solid rim; stroke 80 since 2026-10-26, was 105)
    /* uDeep (hover, 0..1): the 50% and 25% bands grow inward so the bubble opens up ("peer deeper") */
    "  float i2=.81-.07*uDeep, i3=.70-.13*uDeep;",
    "  float e2=smoothstep(i2-.005-.022*uSoft,i2+.016*uSoft,r2)*.5;",   // Edge 2 (50%)
    "  float e3=smoothstep(i3-.01-.07*uSoft,i3+.05*uSoft,r3)*.25*uInner;", // Edge 3 (25%)
    "  float cut=1.-smoothstep(1.-uPx,1.+uPx,r);",                    // Exterior Cutter
    "  float al=(1.-(1.-e1)*(1.-e2)*(1.-e3))*cut;",
    "  sa*=cut;",
    "  if(al<.004&&sa<.004){gl_FragColor=vec4(0.);return;}",
    "  vec3 pc=al>.004?colAt(p)*al:vec3(0.);",
    "  gl_FragColor=vec4(vec3(1.)*sa+pc*(1.-sa),sa+al*(1.-sa));}"    // shine (white) over the rim, premultiplied
  ]).join("\n");

  /* DEPTH ZOOM (opening a film from its bubble). The three tiers are three planes of a set: the
     solid rim is the closest, the 50% band sits further back and the 25% band further still. The
     camera flies through them: each plane i at depth D[i] appears at scale D[i]/(D[i]-c) as the
     camera advances by c, so the rim rushes past first and the deeper bands follow later and
     slower. Each plane keeps its own colours (sampled at its own scale), the shine rides on the rim. */
  var FSZ = HEAD.concat([
    "uniform vec3 uS;",
    "uniform vec2 uCen,uView;",
    "uniform float uSpx,uPxz;",
    "void main(){",
    "  vec2 fc=(v*.5+.5)*uView;",
    "  vec2 p=(fc-vec2(uCen.x,uView.y-uCen.y))/uSpx;",                  // bubble units, y up
    "  vec2 q1=p/uS.x, q2=p/uS.y, q3=p/uS.z;",
    "  float r1=rr(q1), r2=rr(q2), r3=rr(q3);",
    "  float i2=.81-.07*uDeep, i3=.70-.13*uDeep;",
    "  bool sh=uSh>.5&&length(q1-shC())<.62;",
    "  if((r1>1.03||r1<.88)&&(r2>1.03||r2<i2-.12)&&(r3>1.03||r3<i3-.2)&&!sh){gl_FragColor=vec4(0.);return;}",
    "  float z=uSeed*17.+uT*.11;",
    "  vec2 w2=wv(q2,1.9,z+3.), w3=wv(q3,1.9,z+3.);",
    "  float d2=rr(q2+uWob*.045*w2), d3=rr(q3+uWob*.065*vec2(w3.y,-w3.x));",
    "  float a1=smoothstep(.917-.012*uSoft,.921+.008*uSoft,r1)*(1.-smoothstep(1.-uPxz/uS.x,1.+uPxz/uS.x,r1));",
    "  float a2=smoothstep(i2-.005-.022*uSoft,i2+.016*uSoft,d2)*.5*(1.-smoothstep(1.-uPxz/uS.y,1.+uPxz/uS.y,r2));",
    "  float a3=smoothstep(i3-.01-.07*uSoft,i3+.05*uSoft,d3)*.25*uInner*(1.-smoothstep(1.-uPxz/uS.z,1.+uPxz/uS.z,r3));",
    "  float sa=sh?shineA(q1,z)*(1.-smoothstep(1.-uPxz/uS.x,1.+uPxz/uS.x,r1)):0.;",
    "  vec4 acc=vec4(0.);",
    "  if(a3>.003){acc=vec4(colAt(q3)*a3,a3);}",                                              // background plane
    "  if(a2>.003){acc=vec4(colAt(q2)*a2+acc.rgb*(1.-a2),a2+acc.a*(1.-a2));}",               // mid-ground plane
    "  if(a1>.003){acc=vec4(colAt(q1)*a1+acc.rgb*(1.-a1),a1+acc.a*(1.-a1));}",               // foreground plane (the rim)
    "  if(sa>.003){acc=vec4(vec3(1.)*sa+acc.rgb*(1.-sa),sa+acc.a*(1.-sa));}",
    "  gl_FragColor=acc;}"
  ]).join("\n");

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
      mkShader = sh;
      prog = link(FS);
      U = locs(prog, []);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      /* the depth-zoom program is compiled when the browser is idle, so the first click never waits for it */
      (window.requestIdleCallback || function (f) { return setTimeout(f, 1500); })(function () { try { ensureZ(); warmZ(); } catch (e) {} });
      glc.addEventListener("webglcontextlost", function (e) { e.preventDefault(); gl = false; });
      return true;
    } catch (e) { gl = false; if (window.console) console.warn("RPBubble", e); return false; }
  }

  var mkShader = null, progZ = null, UZ = null;
  var NAMES = ["uC1", "uC2", "uC3", "uBox", "uScale", "uGlow", "uPal", "uPalN", "uRb", "uDeep", "uDepth", "uRad", "uT", "uSeed", "uPx", "uWob", "uSoft", "uSpin", "uInner", "uCol", "uSh"];
  function link(fs) {
    var p = gl.createProgram();
    gl.attachShader(p, mkShader(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mkShader(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function locs(p, extra) { var o = {}; NAMES.concat(extra).forEach(function (n) { o[n] = gl.getUniformLocation(p, n); }); return o; }
  function ensureZ() {
    if (progZ || !gl) return !!progZ;
    progZ = link(FSZ);
    UZ = locs(progZ, ["uS", "uCen", "uView", "uSpx", "uPxz"]);
    return true;
  }
  /* one throwaway 1 px draw: GPU drivers (ANGLE on Metal in particular) finish building a program on
     its FIRST draw, which cost the first click a 100-170 ms stall before this */
  function warmZ() {
    if (!progZ || !gl) return;
    gl.useProgram(progZ); params(UZ);
    gl.uniform3f(UZ.uS, 1, 1, 1); gl.uniform2f(UZ.uView, 1, 1); gl.uniform2f(UZ.uCen, 0.5, 0.5); gl.uniform1f(UZ.uSpx, 1); gl.uniform1f(UZ.uDepth, 1); gl.uniform2f(UZ.uBox, 1, 1);
    gl.viewport(0, 0, 1, 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.useProgram(prog);
  }
  function params(u) { gl.uniform1f(u.uWob, P.wobble); gl.uniform1f(u.uSoft, P.soft); gl.uniform1f(u.uSpin, P.spin); gl.uniform1f(u.uInner, P.inner); gl.uniform1f(u.uCol, P.color); }

  function find(el) { for (var i = 0; i < items.length; i++) if (items[i].el === el) return items[i]; return null; }

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var it = find(e.target); if (!it) return;
      it.onScreen = e.isIntersecting;
      /* coming on screen (scrolled in, or its view just switched on): check real visibility now, so it
         never waits for the slow round-robin */
      if (e.isIntersecting && canCheckVis) it.shown = it.el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    });
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
    it.deep = parseFloat(cs.getPropertyValue("--rpb-deep")) || 0;
    it.rb = parseFloat(cs.getPropertyValue("--rpb-rainbow")) || 0;
    if (it.rb) it.pal = palOf(cs.getPropertyValue("--rpb-pal"));
    it.styled = true;
  }

  /* the stops of a CSS gradient string (hex or rgb()), at most 8; the closing repeat of the first stop
     in a looping conic is dropped. Cached per string. */
  var palCache = {};
  function palOf(str) {
    str = String(str || "");
    if (palCache[str]) return palCache[str];
    var out = [], m, re = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;
    while ((m = re.exec(str)) && out.length < 9) { var c = css3(m[0].length > 7 && m[0][0] === "#" ? m[0].slice(0, 7) : m[0]); if (c) out.push(c); }
    if (out.length > 2 && out[0].join() === out[out.length - 1].join()) out.pop();
    out = out.slice(0, 8);
    var flat = new Float32Array(24);
    out.forEach(function (c, i) { flat[i * 3] = c[0]; flat[i * 3 + 1] = c[1]; flat[i * 3 + 2] = c[2]; });
    return (palCache[str] = { n: out.length, flat: flat });
  }

  function render(cols, W, H, box, rad, t, seed, scale, depth, glow, deep, rb, pal) {
    if (glc.width < W || glc.height < H) { glc.width = Math.max(glc.width, W, 256); glc.height = Math.max(glc.height, H, 256); }
    gl.useProgram(prog); params(U); gl.uniform1f(U.uSh, glow ? 0 : 1);
    gl.viewport(0, glc.height - H, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3fv(U.uC1, cols[0]); gl.uniform3fv(U.uC2, cols[1]); gl.uniform3fv(U.uC3, cols[2]);
    gl.uniform2f(U.uBox, box[0], box[1]); gl.uniform1f(U.uRad, rad); gl.uniform1f(U.uDepth, depth || 1); gl.uniform1f(U.uDeep, deep || 0);
    if (rb && pal && pal.n > 1) { gl.uniform1f(U.uRb, rb); gl.uniform1f(U.uPalN, pal.n); gl.uniform3fv(U.uPal, pal.flat); }
    else gl.uniform1f(U.uRb, 0);
    gl.uniform1f(U.uT, t); gl.uniform1f(U.uSeed, seed);
    gl.uniform2f(U.uScale, scale[0], scale[1]); gl.uniform1f(U.uGlow, glow ? 1 : 0);
    gl.uniform1f(U.uPx, 2.4 / Math.min(W, H));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function draw(it, t) {
    if (it.dirty || it.trans || !it.styled) { readStyle(it); if (it.dirty) it.dirty--; }
    var w = it.w, h = it.h;
    if (!w || !h) return false;
    w += 2 * it.bleed; h += 2 * it.bleed;   // glow canvases overhang their element so the halo fades out to nothing
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * Q.scale * (it.opts.res || 1);
    var k = Math.min(1, (it.opts.max || MAXPX) / (Math.max(w, h) * dpr));
    var W = Math.max(16, Math.round(w * dpr * k)), H = Math.max(16, Math.round(h * dpr * k));
    if (it.cv.width !== W || it.cv.height !== H) { it.cv.width = W; it.cv.height = H; }
    if (it.ref) {
      var bw = it.rw || w, bh = it.rh || h, sb = Math.min(bw, bh) / 2;
      render(it.cols, W, H, [bw / 2 / sb, bh / 2 / sb], it.rrad == null ? 1 : it.rrad, t, it.opts.seed, [w / 2 / sb, h / 2 / sb], 1, true, 0, it.rb, it.pal);
    } else {
      var s = Math.min(w, h), inset = it.opts.inset || 1;
      render(it.cols, W, H, [w / s, h / s], it.rad, t, it.opts.seed, [w / s / inset, h / s / inset], it.depth, false, it.deep, it.rb, it.pal);
    }
    it.ctx.clearRect(0, 0, W, H);
    it.ctx.drawImage(glc, 0, 0, W, H, 0, 0, W, H);   // viewport sits in the TOP-left W x H of the shared canvas
    it.drawn = true;
    return true;
  }

  /* round-robin housekeeping: real visibility + a slow style refresh. checkVisibility() forces a style
     recalc, and done for two bubbles EVERY frame it was the single biggest main-thread cost on phones
     (profiled 2026-10-26: ~250 ms per film open/close at 4x CPU throttle). Now: two ON-SCREEN bubbles
     every 250 ms, nothing at all during the depth zoom. */
  var rr = 0, hkAt = 0;
  function housekeep(now) {
    if (!items.length || zooming || now - hkAt < 250) return;
    hkAt = now;
    for (var n = 0, seen = 0; n < items.length && seen < 2; n++) {
      rr = (rr + 1) % items.length;
      var it = items[rr];
      if (it.onScreen === false) continue;
      seen++;
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

  var last = 0, lastDraw = 0, simT = 0, drawN = 0;
  var COARSE = !!(window.matchMedia && matchMedia("(hover: none)").matches);
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
    if ((due || pending) && !paused && gl && !zooming) {
      var dt = Math.min(0.1, (now - (lastDraw || now)) / 1000); lastDraw = now;
      if (!reduce) simT += dt * P.speed;
      drawN++;
      for (var j = 0; j < items.length; j++) {
        var x = items[j];
        /* phones / tablets: the soft halos behind the bubbles update at half rate (their colour drift
           is far too slow to see the difference); the rims keep the full 24 fps */
        if (x.ref && COARSE && (drawN & 1) && x.drawn && !x.trans) continue;
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
    var bleed = opts.glow ? (opts.bleed != null ? opts.bleed : 24) : 0;
    cv.style.cssText = "position:absolute;inset:" + (-bleed) + "px;width:calc(100% + " + 2 * bleed + "px);height:calc(100% + " + 2 * bleed + "px);display:block;pointer-events:none;border-radius:inherit";
    el.appendChild(cv);
    el.classList.add("rp-bubble-on");
    it = {
      el: el, cv: cv, ctx: cv.getContext("2d", { alpha: true }),
      opts: { seed: opts.seed != null ? opts.seed : Math.random() * 10, inset: opts.inset, max: opts.max, res: opts.glow ? 0.5 : (opts.res || 1) },
      ref: opts.glow ? (opts.ref || el) : null, bleed: bleed,
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
  /* ===== DEPTH ZOOM: open a film by flying through the bubble (Jack, 2026-10-26) =====
     The bubble's three tiers become three planes of a stage set: the solid rim is the foreground,
     the 50% band the mid-ground, the 25% band the backdrop. A camera moves forward by c; plane i
     (depth D[i]) is drawn at scale D[i]/(D[i]-c), so the rim rushes past first and the deeper bands
     follow later and slower, which is the parallax that sells the depth. The flight is drawn
     full-viewport on its own overlay canvas (FSZ) while the bubble's own canvas is hidden.
     zoom({el, dir:'in'|'out', ms, hide:[elements], onFrame(info), onDone}) -> true if it runs.
     onFrame gets {t, e, clip}: clip is the rim's INNER contour in viewport px ({cx, cy, hx, hy, r}),
     the opening the next page is revealed through, or null once it has left the screen. */
  var Z = null, ZD = [1, 1.3, 1.65], zooming = false;
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function zoomStop(run) {
    if (!Z) return;
    var z = Z; Z = null;
    cancelAnimationFrame(z.raf);
    glc.remove(); glc.style.cssText = "";
    zooming = false;
    z.it.cv.style.visibility = "";
    z.hide.forEach(function (h) { h.style.removeProperty("opacity"); });
    z.it.drawn = false; kick();
    if (run && z.o.onDone) z.o.onDone();
  }
  /* the host's box right now. Bubbles bob, scale on hover and the page shifts when the scroll lock
     comes off, so the flight follows the live element every frame; a box measured once at the start
     left the rim misaligned with the bubble when it landed, and the bubble snapped into place */
  function hostBox(el, prev) {
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return prev;
    var S = Math.min(r.width, r.height) / 2;
    return { S: S, cx: r.left + r.width / 2, cy: r.top + r.height / 2, box: [r.width / 2 / S, r.height / 2 / S] };
  }
  function zoom(o) {
    o = o || {};
    zoomStop(true);
    if (reduce || !o.el || !initGL()) return false;
    try { if (!ensureZ()) return false; } catch (e) { return false; }
    var it = find(o.el); if (!it) return false;
    var hb = hostBox(o.el, null);
    if (!hb) return false;
    readStyle(it);
    var vw = window.innerWidth, vh = window.innerHeight;
    var depth = it.depth || 1, deep = it.deep || 0;
    /* how far the camera must travel: until the BACKDROP band's inner edge has left the screen */
    function farOf(b) { return Math.max(Math.hypot(b.cx, b.cy), Math.hypot(vw - b.cx, b.cy), Math.hypot(b.cx, vh - b.cy), Math.hypot(vw - b.cx, vh - b.cy)); }
    var far = farOf(hb);
    var inner3 = Math.max(0.2, Math.min(hb.box[0], hb.box[1]) - (1 - (0.70 - 0.13 * deep) + 0.14) * depth);
    /* 1.45: overshoot, so the backdrop band is fully off screen well before the flight ends (no pop) */
    var cEnd = ZD[2] * (1 - 1 / Math.max(3, 1.45 * far / (hb.S * inner3)));
    /* the way back starts where the backdrop band is just off screen, so there is no dead time
       before the first layer comes back past the viewer */
    if (o.dir === "out") cEnd = Math.min(cEnd, ZD[2] * (1 - 1 / Math.max(3, 1.08 * far / (hb.S * inner3))));
    /* the opening the next page shows through is cut along the MIDDLE of the solid rim, so its edge
       is always hidden under the opaque foreground layer (never a visible hard edge) */
    var lip = 0.042 * depth;
    /* PERFORMANCE: the flight is drawn straight into the shared WebGL canvas, put on the page as the
       overlay, instead of being copied into a 2D canvas every frame (that copy is a GPU readback on
       iOS Safari and was the main cost there). The bubbles behind hold their last frame meanwhile:
       the film covers them, and their colour drift is far too slow to notice 1.5 s of it. */
    var k = Math.min(window.devicePixelRatio || 1, DPR_CAP) * Q.scale * 0.8;
    var W = Math.max(16, Math.round(vw * k)), H = Math.max(16, Math.round(vh * k));
    glc.width = W; glc.height = H;
    glc.setAttribute("aria-hidden", "true");
    glc.style.cssText = "position:fixed;left:0;top:0;width:" + vw + "px;height:" + vh + "px;z-index:100002;pointer-events:none";
    document.body.appendChild(glc);
    zooming = true;
    /* the look is SNAPSHOTTED: once the film covers the bubble its hover look starts fading back to
       the resting colours, and the flight must keep the colours the viewer clicked on */
    var cols = it.cols.slice(), rb = it.rb, pal = it.pal, rad0 = it.rad, seed = it.opts.seed;
    var hide = (o.hide || []).filter(Boolean);
    it.cv.style.visibility = "hidden";
    hide.forEach(function (h) { h.style.setProperty("opacity", "0", "important"); });   /* the halo fades on its own opacity transition */
    var ms = o.ms || 1400, t0 = performance.now(), tBase = simT + seed * 3.7;
    Z = { o: o, it: it, hide: hide, raf: 0 };
    var z = Z;
    var first = true;
    function step(now) {
      if (Z !== z) return;
      /* the clock starts on the first real frame: opening a film builds its page in the same task, and a
         slow first frame should hold the opening pose, not make the flight jump ahead */
      if (first && now !== t0) { first = false; t0 = now - 16; }
      var t = Math.min(1, (now - t0) / ms);
      var tt = o.dir === "out" ? 1 - t : t;
      var e = easeIO(tt), c = cEnd * e;
      hb = hostBox(o.el, hb);
      var S = hb.S, cx = hb.cx, cy = hb.cy, box = hb.box;
      var s = ZD.map(function (d) { return d - c > 0.02 ? d / (d - c) : 1e4; });
      gl.useProgram(progZ); params(UZ);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3fv(UZ.uC1, cols[0]); gl.uniform3fv(UZ.uC2, cols[1]); gl.uniform3fv(UZ.uC3, cols[2]);
      gl.uniform2f(UZ.uBox, box[0], box[1]); gl.uniform1f(UZ.uRad, rad0); gl.uniform1f(UZ.uDepth, depth); gl.uniform1f(UZ.uDeep, deep);
      if (rb && pal && pal.n > 1) { gl.uniform1f(UZ.uRb, rb); gl.uniform1f(UZ.uPalN, pal.n); gl.uniform3fv(UZ.uPal, pal.flat); }
      else gl.uniform1f(UZ.uRb, 0);
      gl.uniform1f(UZ.uT, tBase + (now - t0) / 1000 * P.speed); gl.uniform1f(UZ.uSeed, seed); gl.uniform1f(UZ.uSh, 1);
      gl.uniform3f(UZ.uS, s[0], s[1], s[2]);
      gl.uniform2f(UZ.uCen, cx * k, cy * k); gl.uniform2f(UZ.uView, W, H);
      gl.uniform1f(UZ.uSpx, S * k); gl.uniform1f(UZ.uPxz, 1.2 / (S * k));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      var clip = null;
      if (s[0] < 1e3) {
        var hx = Math.max(0, box[0] - lip) * S * s[0], hy = Math.max(0, box[1] - lip) * S * s[0];
        var rad = Math.max(0, Math.min(box[0], box[1]) * rad0 - lip) * S * s[0];
        /* still needed while any viewport corner lies outside the opening (rounded-box distance) */
        var qx = Math.max(cx, vw - cx) - (hx - rad), qy = Math.max(cy, vh - cy) - (hy - rad);
        if (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad > -1)
          clip = { cx: cx, cy: cy, hx: hx, hy: hy, r: rad };
      }
      if (o.onFrame) o.onFrame({ t: t, e: e, clip: clip, s1: s[0] });
      if (t >= 1) { zoomStop(true); return; }
      z.raf = requestAnimationFrame(step);
    }
    step(t0);
    return true;
  }
  window.RPBubble = {
    zoom: zoom, zoomStop: function () { zoomStop(false); },
    attach: attach, setLook: setLook, detach: detach, sprite: sprite, params: P, setParam: setParam, quality: Q,
    redraw: function () { items.forEach(function (x) { x.drawn = false; }); kick(); },
    supported: function () { return initGL(); }
  };
})();
