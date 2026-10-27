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
    "uniform float uDeep,uDepth,uRad,uT,uSeed,uPx,uWob,uSoft,uSpin,uInner,uCol,uSh,uClip,uEll,uOut;",
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
    /* uEll: an ELLIPSE instead (e.g. the rentals logo bubble), same 1.0-on-the-border convention */
    "float rr(vec2 p){if(uEll>.5)return 1.+(length(p/uBox)-1.)*min(uBox.x,uBox.y)/uDepth;vec2 q=abs(p)-uBox+uRad;return 1.+(length(max(q,0.))+min(max(q.x,q.y),0.)-uRad)/uDepth;}",
    /* outward distance for the splash: on an ellipse rr() grows faster along the long axis (its level
       sets are scaled ellipses), which made the outer rings twice as wide at the sides; this divides by
       the gradient, so the rings keep an even width all the way round */
    "float ro(vec2 p){if(uEll<.5)return rr(p);float k=length(p/uBox);vec2 g=p/(uBox*uBox)/max(k,1e-4);return 1.+(k-1.)/max(length(g),1e-4)/uDepth;}",
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
    /* the turbulence is only evaluated where the ellipse can reach (it costs two noise lookups) */
    "  vec2 c3=p-(vec2(.3914,.5728)+o), c2=p-(vec2(.4459,.5962)+o);",
    "  float s3=length(c3/vec2(.3155,.1884))>1.9?0.:shE(c3+.035*uWob*wv(p,10.,z+40.),vec2(.3155,.1884),.105)*.20;",
    "  float s2=length(c2/vec2(.1895,.1151))>1.9?0.:shE(c2+.023*uWob*wv(p,14.,z+47.),vec2(.1895,.1151),.042)*.40;",
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
    /* SPLASH mode (opts.splash, 2026-10-27, Jack: the rentals logo bubble "just white, but working in the
       opposite direction"): the three tiers turned inside out. A solid splash fills the shape, then
       OUTSIDE it a 50% ring and beyond that a 25% ring, each edge wobbling on the same turbulence as
       the rim and each softer than the one inside it. Plain colour (uC1), no colour field, no shine.
       Ring widths are in units of --rpb-depth (half the shape's short side at 1). */
    "  if(uOut>.5){",
    "    float zo=uSeed*17.+uT*.11;",
    "    vec2 wo=wv(p,1.9,zo+3.);",
    "    float o1=ro(p+uWob*.02*wo), o2=ro(p+uWob*.05*wo), o3=ro(p+uWob*.075*vec2(wo.y,-wo.x));",
    "    float a1=1.-smoothstep(1.-uPx-.004*uSoft,1.+uPx+.004*uSoft,o1);",
    "    float a2=(1.-smoothstep(1.22-.03-.035*uSoft,1.22+.035*uSoft,o2))*.5;",
    "    float a3=(1.-smoothstep(1.5-.07-.1*uSoft,1.5+.1*uSoft,o3))*.25*uInner;",
    "    float ao=1.-(1.-a1)*(1.-a2)*(1.-a3);",
    "    gl_FragColor=vec4(uC1*ao,ao);return;",
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
    /* uClip: the bubble sits inside a clipping parent (its photo is clipped to the same shape), so the
       rim stays fully opaque right up to the edge and the PARENT's clip does the antialiasing. With the
       rim's own soft edge there, the photo underneath showed through that last pixel and shimmered as
       the bubble bobbed (Jack, 2026-10-26: "the image behind them is slightly peeking out"). */
    "  float cut=1.-smoothstep(1.-uPx+2.*uPx*uClip,1.+uPx+2.*uPx*uClip,r);",                    // Exterior Cutter
    "  float al=(1.-(1.-e1)*(1.-e2)*(1.-e3))*max(cut,uClip);",   /* clipped: the parent's clip IS the edge (same box, same radius), so no cut of our own */
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
    /* CONNECTED LAYERS (Jack, 2026-10-26): every band continues OUTWARD under the layers in front of it,
       all the way to the rim's outer edge, so when the planes separate the parts they uncover are still
       band, never a gap. Only the foreground rim's exterior cutter ends them. */
    "  if(r1>1.03||(r1<.88&&r2<i2-.12&&r3<i3-.2&&!sh)){gl_FragColor=vec4(0.);return;}",
    "  float z=uSeed*17.+uT*.11;",
    /* PERFORMANCE: the band wobble only matters near a band's inner edge (elsewhere its alpha is flat),
       so the turbulence is only evaluated there; the windows are wider than wobble + edge softness */
    "  float d2=r2, d3=r3;",
    "  if(abs(r2-i2)<.2){vec2 w2=wv(q2,1.9,z+3.);d2=rr(q2+uWob*.045*w2);}",
    "  if(abs(r3-i3)<.26){vec2 w3=wv(q3,1.9,z+3.);d3=rr(q3+uWob*.065*vec2(w3.y,-w3.x));}",
    "  float cut1=1.-smoothstep(1.-uPxz/uS.x,1.+uPxz/uS.x,r1);",
    "  float a1=smoothstep(.917-.012*uSoft,.921+.008*uSoft,r1)*cut1;",
    "  float a2=smoothstep(i2-.005-.022*uSoft,i2+.016*uSoft,d2)*.5*cut1;",
    "  float a3=smoothstep(i3-.01-.07*uSoft,i3+.05*uSoft,d3)*.25*uInner*cut1;",
    "  float sa=sh?shineA(q1,z)*(1.-smoothstep(1.-uPxz/uS.x,1.+uPxz/uS.x,r1)):0.;",
    "  vec4 acc=vec4(0.);",
    /* the two band planes share ONE colour sample (the nearer plane's; the farther one's where only it
       shows), and none is taken where the opaque rim covers them: once the bands fill the screen this
       is a third of the work, with no visible difference (both planes are 50% / 25% washes) */
    "  if(a1<.995&&(a2>.003||a3>.003)){",
    "    vec3 cb=colAt(a2>.003?q2:q3);",
    "    if(a3>.003)acc=vec4(cb*a3,a3);",                                                       // background plane
    "    if(a2>.003)acc=vec4(cb*a2+acc.rgb*(1.-a2),a2+acc.a*(1.-a2));",                        // mid-ground plane
    "  }",
    "  if(a1>.003){acc=vec4(colAt(q1)*a1+acc.rgb*(1.-a1),a1+acc.a*(1.-a1));}",               // foreground plane (the rim)
    "  if(sa>.003){acc=vec4(vec3(1.)*sa+acc.rgb*(1.-sa),sa+acc.a*(1.-sa));}",
    "  gl_FragColor=acc;}"
  ]).join("\n");

  /* color: speed of the COLOUR field (spin, plate evolution, wave) relative to the AE loop. Jack
     (2026-10-26): the gradients moved way too fast at the AE rate, slow and subtle wanted -> 0.3,
     then "still too fast" -> 0.15, then "too slow now" -> 0.22, about one turn per 45 s. The rim's band
     wobble keeps the AE speed. */
  var P = { wobble: 1, soft: 1, spin: 1, inner: 1, speed: 1, color: 0.22, zres: 0.6 };
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
  var ATLAS = (function () {
    var d = Math.min(window.devicePixelRatio || 1, 1.25), sw = (window.screen && screen.width) || 0, sh = (window.screen && screen.height) || 0;
    return [Math.min(2048, Math.ceil((Math.max(sw, window.innerWidth || 0) + 256) * d)), Math.min(2048, Math.ceil((Math.max(sh, window.innerHeight || 0) + 256) * d))];
  })();
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
      glc.width = ATLAS[0]; glc.height = ATLAS[1];
      gl = glc.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
      if (!gl) { gl = false; return false; }
      /* SHADERS BUILD IN THE BACKGROUND (2026-10-27, Jack: on two Windows PCs, one very high end, the
         bubbles took "a long while to pop in" and the carousel stuttered). On Windows the browser turns
         WebGL into Direct3D and compiling a shader this size can take a long time; asking whether it
         compiled (as this did straight away) froze the page until it had. KHR_parallel_shader_compile
         lets it compile off the main thread: frame() polls until it is done, the page keeps running,
         and the bubbles fade in the moment it is ready. The depth-zoom program follows the same way,
         after the bubble one, so it can never freeze a carousel move either. */
      PAR = gl.getExtension("KHR_parallel_shader_compile");
      STATS.compileStart = performance.now();
      prog = startLink(FS);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      try { var dri = gl.getExtension("WEBGL_debug_renderer_info"); STATS.gpu = dri ? String(gl.getParameter(dri.UNMASKED_RENDERER_WEBGL)) : ""; } catch (e) {}
      STATS.parallel = !!PAR;
      /* SOFTWARE RENDERING: when the browser has no GPU to use (hardware acceleration switched off,
         a broken or missing graphics driver, a remote desktop) WebGL runs on the CPU and so does every
         page animation. The bubbles then draw once and redraw only when they change, at lower
         resolution, and html.rp-soft-gpu lets the page drop its continuous effects (index.html). */
      SOFT = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(STATS.gpu);
      if (SOFT) { STATS.soft = true; Q.scale = 0.75; document.documentElement.classList.add("rp-soft-gpu"); }
      glc.addEventListener("webglcontextlost", function (e) { e.preventDefault(); gl = false; });
      if (!PAR && !ready(true)) return false;   /* no extension: build now, as before */
      return true;
    } catch (e) { gl = false; if (window.console) console.warn("RPBubble", e); return false; }
  }

  var SOFT = false, PAR = null, progReady = false, zReady = false, readyCbs = [];
  /* COPY CALIBRATION (2026-10-27, Jack's Windows PC, Firefox: the featured card's rim was missing its
     right and bottom quarter). Each bubble is drawn into the top-left corner of the shared WebGL canvas
     and copied out with drawImage(source rectangle). On that machine the copy came back scaled, so the
     bubble was magnified and its right and bottom edges fell outside its canvas; on the mini (Chrome,
     Firefox, Safari) it is exact, so the cause could not be reproduced. Instead the copy measures
     itself once, when the shaders are ready: a 32 x 16 grid of known colours is drawn where a bubble
     would be, copied the same way into a small canvas, and the colours read back give where the copy
     actually sampled. copyOut() then asks for the rectangle that lands where it should. Where the copy
     is already exact (every machine tested so far) the correction is 1 and 0 and nothing changes. */
  var CAL = { rx: 1, ox: 0, ry: 1, oy: 0 };
  function copyOut(ctx, src, W, H) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(glc, -CAL.ox / CAL.rx, -CAL.oy / CAL.ry, src[0] / CAL.rx, src[1] / CAL.ry, 0, 0, W, H);
  }
  function calibrate() {
    try {
      var GW = 512, GH = 256, NX = 32, NY = 16, DW = 256, DH = 128;
      var dbw = gl.drawingBufferWidth || glc.width, dbh = gl.drawingBufferHeight || glc.height;
      if (dbw < GW || dbh < GH) return;
      gl.viewport(0, 0, dbw, dbh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      for (var i = 0; i < NY; i++) for (var j = 0; j < NX; j++) {
        gl.scissor(j * (GW / NX), dbh - (i + 1) * (GH / NY), GW / NX, GH / NY);
        gl.clearColor((j * 8 + 4) / 255, (i * 16 + 8) / 255, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.disable(gl.SCISSOR_TEST);
      var sx = glc.width / dbw, sy = glc.height / dbh, src = [GW * sx, GH * sy];
      var c = document.createElement("canvas"); c.width = DW; c.height = DH;
      var x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(glc, 0, 0, src[0], src[1], 0, 0, DW, DH);
      var d = x.getImageData(0, 0, DW, DH).data;
      /* source position of every colour boundary along the middle row / column, fitted with a line */
      function fit(along) {
        var pts = [], prev = null, n = along === "x" ? DW : DH;
        for (var k = 0; k < n; k++) {
          var o = along === "x" ? ((DH >> 1) * DW + k) * 4 : (k * DW + (DW >> 1)) * 4;
          var v = along === "x" ? Math.round((d[o] - 4) / 8) : Math.round((d[o + 1] - 8) / 16);
          if (prev !== null && v === prev + 1) pts.push([k, v * (along === "x" ? (GW / NX) * sx : (GH / NY) * sy)]);
          prev = v;
        }
        if (pts.length < 6) return null;
        var mx = 0, my = 0; pts.forEach(function (q) { mx += q[0]; my += q[1]; }); mx /= pts.length; my /= pts.length;
        var sxy = 0, sxx = 0; pts.forEach(function (q) { sxy += (q[0] - mx) * (q[1] - my); sxx += (q[0] - mx) * (q[0] - mx); });
        var a = sxy / sxx; return { a: a, b: my - a * mx };
      }
      var fx = fit("x"), fy = fit("y");
      if (fx && fy) {
        /* a boundary k sits where the copy sampled source position a*k + b; asked for (src / D) * k */
        var rx = fx.a / (src[0] / DW), ry = fy.a / (src[1] / DH), ox = fx.b, oy = fy.b;
        /* (a 2:1 reduction averages pixel pairs, so a boundary lands exactly on a destination pixel: no
           half-pixel term; measured 0 on every exact machine) */
        if (rx > 0.5 && rx < 2 && ry > 0.5 && ry < 2) {
          var off = Math.abs(rx - 1) > 0.015 || Math.abs(ry - 1) > 0.015 || Math.abs(ox) > 3 || Math.abs(oy) > 3;
          if (off) CAL = { rx: rx, ox: ox, ry: ry, oy: oy };
          STATS.calib = [rx, ox, ry, oy].map(function (v) { return Math.round(v * 1000) / 1000; }).join(" / ") + (off ? " (corrected)" : " (exact)");
        } else STATS.calib = "out of range " + [rx, ry].join(" ");
      } else STATS.calib = "unreadable";
    } catch (e) { STATS.calib = "error " + e.message; }
  }
  var STATS = { ver: "20261027e", compileMs: 0, zCompileMs: 0, draws: 0, drawMs: 0, drawMax: 0, frames: 0, frameMs: 0, frameMax: 0, gpu: "", parallel: false };
  var progZ = null, UZ = null;
  var NAMES = ["uC1", "uC2", "uC3", "uBox", "uScale", "uGlow", "uPal", "uPalN", "uRb", "uDeep", "uDepth", "uRad", "uT", "uSeed", "uPx", "uWob", "uSoft", "uSpin", "uInner", "uCol", "uSh", "uClip", "uEll", "uOut"];
  /* compile + link WITHOUT asking for the result (asking blocks until the driver is done) */
  function startLink(fs) {
    var p = gl.createProgram(), sh = [];
    [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]].forEach(function (d) {
      var x = gl.createShader(d[0]); gl.shaderSource(x, d[1]); gl.compileShader(x); gl.attachShader(p, x); sh.push(x);
    });
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    p.__sh = sh;
    return p;
  }
  function linkDone(p) { return !PAR || !!gl.getProgramParameter(p, PAR.COMPLETION_STATUS_KHR); }
  function finishLink(p) {
    if (gl.getProgramParameter(p, gl.LINK_STATUS)) return;
    var log = gl.getProgramInfoLog(p) || "";
    (p.__sh || []).forEach(function (x) { if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) log += " " + gl.getShaderInfoLog(x); });
    throw new Error(log);
  }
  /* is the bubble program built? force: wait for it (only when something cannot go on without it) */
  function ready(force) {
    if (progReady) return true;
    if (!gl || !prog) return false;
    if (!force && !linkDone(prog)) return false;
    try { finishLink(prog); }
    catch (e) {
      if (window.console) console.warn("RPBubble", e);
      gl = false;
      items.slice().forEach(function (x) { detach(x.el); });
      return false;
    }
    U = locs(prog, []);
    gl.useProgram(prog);
    progReady = true;
    calibrate();
    STATS.compileMs = Math.round(performance.now() - STATS.compileStart);
    var cbs = readyCbs; readyCbs = [];
    cbs.forEach(function (f) { try { f(); } catch (e) {} });
    /* then the depth-zoom program. With parallel compile it builds in the background. WITHOUT it
       (Firefox, 2026-10-27: 731 ms on Jack's Windows PC) building it froze the page for that long about a
       second after load, which read as every bubble's gradient snapping to a new point; it is built
       right away instead, while the page veil is still up. */
    if (!PAR) { try { ensureZ(); warmZ(); } catch (e) {} }
    else (window.requestIdleCallback || function (f) { return setTimeout(f, 300); })(function () {
      try { if (gl && !progZ) { STATS.zStart = performance.now(); progZ = startLink(FSZ); kick(); } } catch (e) {}
    });
    return true;
  }
  function locs(p, extra) { var o = {}; NAMES.concat(extra).forEach(function (n) { o[n] = gl.getUniformLocation(p, n); }); return o; }
  function ensureZ() {
    if (zReady) return true;
    if (!gl || !ready(true)) return false;
    if (!progZ) { STATS.zStart = performance.now(); progZ = startLink(FSZ); }
    finishLink(progZ);   /* waits only if a film is opened before the background build finished */
    UZ = locs(progZ, ["uS", "uCen", "uView", "uSpx", "uPxz"]);
    zReady = true;
    STATS.zCompileMs = Math.round(performance.now() - (STATS.zStart || performance.now()));
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
    it.br = cs.borderRadius;
    if (it.host && it.clipped) edgeMedia(it, it.br);
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

  /* GLMAX: the shared canvas never grows past this. And the GPU may give the canvas a SMALLER drawing
     buffer than asked for (memory limits on some machines): everything here works in drawing-buffer
     pixels and returns the source size in canvas pixels for the copy. Assuming the two were equal drew
     only part of a bubble on such machines (Jack, 2026-10-26: rims "only showing on the top left"). */
  /* ATLAS: the shared canvas gets ONE size, up front, big enough for any bubble on this screen, and is
     never resized while bubbles are drawn (the depth zoom resizes it for the flight and puts it back).
     Firefox on Windows (2026-10-27, Jack's screenshot) showed the featured card's rim only along its
     top and left: after the shared canvas had grown, the copy taken from it was a stale, smaller image
     scaled up. One fixed size avoids every such resize. */
  var GLMAX = 2048, renderEll = false, renderOut = false;
  function render(cols, W, H, box, rad, t, seed, scale, depth, glow, deep, rb, pal, clip) {
    var nw = Math.min(GLMAX, Math.max(glc.width, W, 256)), nh = Math.min(GLMAX, Math.max(glc.height, H, 256));
    if (glc.width < nw || glc.height < nh) { glc.width = nw; glc.height = nh; }
    var dbw = gl.drawingBufferWidth || glc.width, dbh = gl.drawingBufferHeight || glc.height;
    var f = Math.min(1, dbw / W, dbh / H);
    var w = Math.max(1, Math.floor(W * f)), h = Math.max(1, Math.floor(H * f));
    gl.useProgram(prog); params(U); gl.uniform1f(U.uSh, glow ? 0 : 1); gl.uniform1f(U.uClip, clip ? 1 : 0); gl.uniform1f(U.uEll, renderEll ? 1 : 0); gl.uniform1f(U.uOut, renderOut ? 1 : 0);
    gl.viewport(0, dbh - h, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3fv(U.uC1, cols[0]); gl.uniform3fv(U.uC2, cols[1]); gl.uniform3fv(U.uC3, cols[2]);
    gl.uniform2f(U.uBox, box[0], box[1]); gl.uniform1f(U.uRad, rad); gl.uniform1f(U.uDepth, depth || 1); gl.uniform1f(U.uDeep, deep || 0);
    if (rb && pal && pal.n > 1) { gl.uniform1f(U.uRb, rb); gl.uniform1f(U.uPalN, pal.n); gl.uniform3fv(U.uPal, pal.flat); }
    else gl.uniform1f(U.uRb, 0);
    gl.uniform1f(U.uT, t); gl.uniform1f(U.uSeed, seed);
    gl.uniform2f(U.uScale, scale[0], scale[1]); gl.uniform1f(U.uGlow, glow ? 1 : 0);
    gl.uniform1f(U.uPx, 2.4 / Math.min(w, h));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return [w * glc.width / dbw, h * glc.height / dbh];
  }

  /* everything draw() needs to READ from the page (computed style, sizes, the clipping parent).
     frame() runs this for all the bubbles it is about to draw BEFORE drawing any of them: reads and
     writes (canvas sizes) interleaved forced the browser to recalculate the page's styles once per
     bubble, every frame (2026-10-27 profile: the largest main-thread cost of a carousel move). */
  function prep(it) {
    if (it.dirty || it.trans || !it.styled) { readStyle(it); if (it.dirty) it.dirty--; }
    if (it.clipped == null && it.w && it.h) it.host = clipParent(it.el);
  }
  function draw(it, t, prepped) {
    if (!prepped) prep(it);
    var tS = performance.now();
    /* inside a clipping parent the PARENT's rounded clip is the only edge: a canvas with its own
       border-radius antialiased a second time, letting a hairline of the photo show around the rim.
       Decided here, not in attach(): a bubble is often built before it is put in the page, when its
       parent has no computed style yet. */
    var w = it.w, h = it.h;
    if (!w || !h) return false;
    if (it.clipped == null) {
      it.clipped = !!it.host;
      if (it.clipped) { it.cv.style.borderRadius = "0"; edgeMedia(it, it.br || getComputedStyle(it.el).borderRadius); }
    }
    w += 2 * it.bleed; h += 2 * it.bleed;   // glow canvases overhang their element so the halo fades out to nothing
    /* while it changes shape (the carousel morph) it renders at 70%: it is moving, and it is the
       heaviest moment (the card swap stuttered on ordinary machines) */
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * Q.scale * (it.opts.res || 1) * (it.trans ? 0.7 : 1);
    var k = Math.min(1, (it.opts.max || MAXPX) / (Math.max(w, h) * dpr));
    var W = Math.max(16, Math.round(w * dpr * k)), H = Math.max(16, Math.round(h * dpr * k));
    var cw = it.cv.width, ch = it.cv.height;
    /* mid-transition the backing store is only reallocated when it is >20% off: CSS scales it meanwhile
       (re-allocating a canvas on every frame of a morph was a big part of that stutter) */
    if (it.trans && cw > 16 && Math.abs(W - cw) < cw * 0.2 && Math.abs(H - ch) < ch * 0.2) { W = cw; H = ch; }
    if (cw !== W || ch !== H) { it.cv.width = W; it.cv.height = H; }
    var src;
    if (it.ref) {
      var bw = it.rw || w, bh = it.rh || h, sb = Math.min(bw, bh) / 2;
      src = render(it.cols, W, H, [bw / 2 / sb, bh / 2 / sb], it.rrad == null ? 1 : it.rrad, t, it.opts.seed, [w / 2 / sb, h / 2 / sb], 1, true, 0, it.rb, it.pal, false);
    } else if (it.opts.splash) {
      /* the shape is the ELEMENT's box; the canvas overhangs it by the bleed, where the outer rings live */
      var sE = Math.min(it.w, it.h) / 2;
      renderEll = !!it.opts.ellipse; renderOut = true;
      src = render(it.cols, W, H, [it.w / 2 / sE, it.h / 2 / sE], it.rad, t, it.opts.seed, [w / 2 / sE, h / 2 / sE], it.depth, false, 0, 0, null, false);
      renderEll = false; renderOut = false;
    } else {
      var s = Math.min(w, h), inset = it.opts.inset || 1;
      renderEll = !!it.opts.ellipse;
      src = render(it.cols, W, H, [w / s, h / s], it.rad, t, it.opts.seed, [w / s / inset, h / s / inset], it.depth, false, it.deep, it.rb, it.pal, it.clipped);
      renderEll = false;
    }
    it.ctx.clearRect(0, 0, W, H);
    copyOut(it.ctx, src, W, H);   // the render sits in the TOP-left of the shared canvas
    if (!it.shownOnce) { it.shownOnce = true; it.cv.style.opacity = "1"; }
    it.drawn = true;
    var dS = performance.now() - tS;
    STATS.draws++; STATS.drawMs += dS; if (dS > STATS.drawMax) STATS.drawMax = dS;
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
    /* a bubble whose element has been removed from the page (a re-rendered list) is let go of here,
       so pages that rebuild their markup never pile up dead bubbles */
    for (var dd = items.length - 1; dd >= 0; dd--) if (!items[dd].el.isConnected) detach(items[dd].el);
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
    else if (ratio < 0.05 && Q.scale < (SOFT ? 0.75 : 1)) { Q.scale = Math.min(SOFT ? 0.75 : 1, Q.scale + 0.1); if (Q.scale >= 1) Q.fps = FPS; }
    pace.t0 = now; pace.n = 0; pace.slow = 0;
  }

  var last = 0, simT = 0, rot = 0;
  /* SCHEDULING (2026-10-26, "running horribly on other people's computers"). Every bubble has its own
     next-draw time instead of all of them being drawn together in one heavy frame:
       live   the AE band wobble, 24 fps (adaptive Q.fps): the bubbles you look at and click
       glow   the soft halos: colour only, which turns once per ~45 s, so 8 fps is indistinguishable
       still  drawn once, then again only when its look / shape / size actually changes (hover look
              fades, the carousel morph): the bubbles in the background (opts.still, or opts.liveWhen
              returning false, e.g. the carousel's side cards)
     and a frame never spends more than BUDGET ms drawing: what is left waits for the next frame, so
     the page keeps its own frame rate on a weak GPU instead of stalling. */
  var GLOW_FPS = 8, BUDGET = 8;
  function kindOf(x) {
    if (x.opts.still || SOFT) return "still";
    if (x.opts.liveWhen) { try { if (!x.opts.liveWhen(x.el)) return "still"; } catch (e) {} }
    return x.ref ? "glow" : "live";
  }
  function sigOf(x) { return [x.cols && x.cols.join(), x.rad, x.depth, x.deep, x.rb, x.w, x.h, x.rw, x.rh, x.rrad].join("|"); }
  function frame(now) {
    raf = 0;
    var gap = last ? now - last : 16; last = now;
    var body = document.body;
    var hidden = document.hidden;
    /* u-cover: a film page covers everything (index.html uCover) */
    var paused = hidden || !!(body && (body.classList.contains("bg-idle") || body.classList.contains("u-cover")));
    /* carousel drag / slide change: only bubbles that are changing shape or look are redrawn */
    var swiping = !!(body && body.classList.contains("swiping"));
    if (!paused && !swiping) adapt(now, gap);
    housekeep(now);
    if (!paused && !reduce) simT += Math.min(0.1, gap / 1000) * P.speed;
    var wants = false;
    if (gl && !progReady) {   /* shaders still building in the background: check again next frame */
      if (!ready(false)) { if (gl) raf = requestAnimationFrame(frame); return; }
    }
    if (progZ && !zReady && gl && !zooming && linkDone(progZ)) { try { ensureZ(); warmZ(); } catch (e) {} }
    if (gl && !zooming && !hidden) {
      var t0 = performance.now(), n = items.length, todo = [];
      /* FAIR: each frame starts one bubble further along, so when the budget runs out the same bubbles
         are not always the ones left waiting (on a slow machine only the first few bubbles on the page
         ever animated) */
      rot = n ? (rot + 1) % n : 0;
      for (var c = 0; c < n; c++) {
        var x = items[(rot + c) % n];
        if (x.onScreen === false || x.shown === false) continue;
        var must = !x.drawn || x.trans || x.dirty;
        var kind = (paused || reduce || swiping) ? "still" : kindOf(x);
        if (!must && kind === "still") continue;
        wants = true;
        if (!must && now < (x.next || 0)) continue;
        /* a periodic style refresh of a still bubble only redraws if something actually changed */
        if (must && x.drawn && !x.trans && kind === "still") {
          readStyle(x); x.dirty = Math.max(0, x.dirty - 1);
          if (sigOf(x) === x.sig) continue;
        }
        todo.push([x, kind]);
      }
      /* READ phase: every style / size this frame needs, while the page's styles are still clean */
      for (c = 0; c < todo.length; c++) prep(todo[c][0]);
      /* WRITE phase: draw until the frame budget is spent; the rest waits for the next frame */
      for (c = 0; c < todo.length; c++) {
        x = todo[c][0];
        if (x.drawn && performance.now() - t0 > BUDGET) continue;   /* over budget: next frame */
        var iv = 1000 / (todo[c][1] === "glow" ? GLOW_FPS : Q.fps);
        x.next = x.drawn ? now + iv : now + iv * Math.random();   /* first draw: random phase, so they spread out */
        if (draw(x, simT + x.opts.seed * 3.7, true)) x.sig = sigOf(x);
      }
      if (todo.length) { var fm = performance.now() - t0; STATS.frames++; STATS.frameMs += fm; if (fm > STATS.frameMax) STATS.frameMax = fm; }
    }
    if (wants || (progZ && !zReady && gl)) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  document.addEventListener("visibilitychange", kick);
  /* hover / focus can change a bubble's look or make a still bubble live (opts.liveWhen): wake the idle loop */
  ["pointerover", "pointerout", "focusin"].forEach(function (ev) { document.addEventListener(ev, kick, { passive: true }); });

  /* is this bubble clipped by a parent (or grandparent) of EXACTLY its own shape (same box, same
     border-radius)? Then that clip is its edge: the rim paints opaque right up to it and the canvas
     has no rounding of its own, so not a hairline of the photo underneath can show (it shimmered as
     the bubbles bobbed; Jack, 2026-10-26). The CSS corner can be elliptical (the featured card's
     13% / 20%) where the shader's is circular, which is why the shader does not cut there itself. */
  function clipParent(el) {
    var r = el.getBoundingClientRect(), br = getComputedStyle(el).borderRadius;
    for (var e = el.parentElement, n = 0; e && n < 2; e = e.parentElement, n++) {
      var cs = getComputedStyle(e);
      if ((cs.overflow && cs.overflow !== "visible") || (cs.clipPath && cs.clipPath !== "none")) {
        var q = e.getBoundingClientRect();
        var cp = cs.clipPath === "none" || (br === "50%" && /^circle\(50%/.test(cs.clipPath));
        return (cp && cs.borderRadius === br && Math.abs(q.left - r.left) < 1 && Math.abs(q.top - r.top) < 1 &&
          Math.abs(q.width - r.width) < 1 && Math.abs(q.height - r.height) < 1) ? e : null;
      }
    }
    return null;
  }
  /* The photo / video under a clipped rim must stop just short of the clip. Chrome clips each composited
     layer (a video, the rim canvas) separately, each with its own antialiased edge, so where they meet
     at the very edge the photo still bleeds through the opaque rim by up to a quarter, a hairline that
     shimmers as the bubble bobs. Any full-size media sibling of the rim gets a clip 1.5px inside the
     edge; the rim's solid band covers that strip. Re-applied when the radius changes (the morph). */
  function edgeMedia(it, br) {
    if (!it.host || it.mbr === br) return;
    it.mbr = br;
    var hr = it.host.getBoundingClientRect();
    for (var c = it.host.firstElementChild; c; c = c.nextElementSibling) {
      if (c === it.el || c.contains(it.el)) continue;
      if (!(c.matches("img,video,picture,canvas") || c.querySelector("img,video,canvas") || getComputedStyle(c).backgroundImage !== "none")) continue;
      var r = c.getBoundingClientRect();
      if (Math.abs(r.width - hr.width) > 1 || Math.abs(r.height - hr.height) > 1) continue;
      if (c.style.clipPath && !c.hasAttribute("data-rpb-edge")) continue;   // the page's own clip wins
      c.setAttribute("data-rpb-edge", "");
      c.style.clipPath = "inset(1.5px round " + br + ")";
    }
  }
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
    var bleed = (opts.glow || opts.splash) ? (opts.bleed != null ? opts.bleed : (opts.splash ? 64 : 24)) : 0;
    /* starts transparent and fades in on its first frame (no rim popping in when a page loads or a view
       switches) */
    cv.style.cssText = "position:absolute;inset:" + (-bleed) + "px;width:calc(100% + " + 2 * bleed + "px);height:calc(100% + " + 2 * bleed + "px);display:block;pointer-events:none;border-radius:inherit;opacity:0;transition:opacity .45s ease";
    if (opts.splash) cv.style.borderRadius = "0";   /* the outer rings must not be cut by a rounded canvas */
    el.appendChild(cv);
    el.classList.add("rp-bubble-on");
    it = {
      el: el, cv: cv, ctx: cv.getContext("2d", { alpha: true }),
      opts: { seed: opts.seed != null ? opts.seed : Math.random() * 10, inset: opts.inset, max: opts.max, res: opts.glow ? 0.5 : (opts.res || 1), still: !!opts.still, liveWhen: opts.liveWhen || null, ellipse: !!opts.ellipse, splash: !!opts.splash },
      ref: opts.glow ? (opts.ref || el) : null, bleed: bleed,
      vars: opts.look ? null : (opts.vars || ["--gg1", "--gg2", "--gg3"]),
      cols: lookVec(opts.look || { c1: "#3f6bff", c2: "#9b5cff", c3: "#56c8ff" }),
      clipped: (opts.glow || opts.splash) ? false : (opts.clipped != null ? !!opts.clipped : null),   /* null: decided on the first draw, once it is in the page */
      onScreen: io ? undefined : true, shown: undefined, drawn: false, styled: false, dirty: 1, trans: 0, rad: 1, depth: 1, w: 0, h: 0
    };
    /* inside a clipping parent the PARENT's rounded clip is the only edge: a canvas with its own
       border-radius antialiased a second time, letting a hairline of the photo show around the rim */
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
    var h = items[i].host;
    if (h) for (var c = h.firstElementChild; c; c = c.nextElementSibling) if (c.hasAttribute("data-rpb-edge")) { c.removeAttribute("data-rpb-edge"); c.style.removeProperty("clip-path"); }
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
    if (!initGL() || !ready(true)) return "";
    var src = render(lookVec(look), px, px, [1, 1], 1, t, 0.5, [1, 1], 1, false);
    var c = document.createElement("canvas"); c.width = c.height = px;
    copyOut(c.getContext("2d"), src, px, px);
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
    glc.width = ATLAS[0]; glc.height = ATLAS[1];   /* back to the bubbles' fixed size (see ATLAS) */
    zooming = false;
    z.it.cv.style.visibility = "";
    z.hide.forEach(function (h) { h.style.removeProperty("opacity"); });
    /* repaint the bubble NOW, in the colours the flight landed in, before anything else changes: its
       canvas otherwise showed a stale frame (from before the film opened) for one frame */
    try { if (gl) { readStyle(z.it); draw(z.it, simT + z.it.opts.seed * 3.7); } } catch (e) {}
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
  /* a rounded-box contour d bubble units inside the bubble's edge, at px-per-unit k: half extents + radius */
  function contour(box, rad0, d, k) {
    return { hx: Math.max(0, box[0] - d) * k, hy: Math.max(0, box[1] - d) * k, r: Math.max(0, Math.min(box[0], box[1]) * rad0 - d) * k };
  }
  /* does that contour (centred at cx, cy) contain the whole viewport? */
  function covers(c, cx, cy, vw, vh) {
    var qx = Math.max(cx, vw - cx) - (c.hx - c.r), qy = Math.max(cy, vh - cy) - (c.hy - c.r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - c.r < -1;
  }
  function zoom(o) {
    o = o || {};
    zoomStop(true);
    if (reduce || !o.el || !initGL() || !ready(true)) return false;
    try { if (!ensureZ()) return false; } catch (e) { return false; }
    var it = find(o.el); if (!it) return false;
    var hb = hostBox(o.el, null);
    if (!hb) return false;
    readStyle(it);
    var vw = window.innerWidth, vh = window.innerHeight;
    var depth = it.depth || 1, deep = it.deep || 0;
    /* o.look: fly with a given look (the close reuses the look the film was opened with, when the
       bubble will be under the pointer again as it lands) */
    var lk = o.look || null;
    if (lk) deep = lk.deep;
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
    /* zres: the flight's resolution in device px per CSS px (before the DPR cap). Everything in it is
       soft or very large once it moves, and since every band now continues out to the rim the shader
       runs on most of the screen, so it renders at about half the pixels of a bubble and is scaled up. */
    var k = Math.min(window.devicePixelRatio || 1, DPR_CAP) * Q.scale * P.zres;
    var W = Math.max(16, Math.round(vw * k)), H = Math.max(16, Math.round(vh * k));
    glc.width = W; glc.height = H;
    glc.setAttribute("aria-hidden", "true");
    glc.style.cssText = "position:fixed;left:0;top:0;width:" + vw + "px;height:" + vh + "px;z-index:100002;pointer-events:none";
    document.body.appendChild(glc);
    zooming = true;
    /* the look is SNAPSHOTTED: once the film covers the bubble its hover look starts fading back to
       the resting colours, and the flight must keep the colours the viewer clicked on */
    var cols = lk ? lk.cols : it.cols.slice(), rb = lk ? lk.rb : it.rb, pal = lk ? lk.pal : it.pal, rad0 = it.rad, seed = it.opts.seed;
    var hide = (o.hide || []).filter(Boolean);
    it.cv.style.visibility = "hidden";
    hide.forEach(function (h) { h.style.setProperty("opacity", "0", "important"); });   /* the halo fades on its own opacity transition */
    var ms = o.ms || 1400, t0 = performance.now(), tBase = simT + seed * 3.7;
    Z = { o: o, it: it, hide: hide, raf: 0 };
    var z = Z;
    var first = true, lastNow = 0, gAcc = 0, gN = 0, kMin = 0.3;
    function step(now) {
      if (Z !== z) return;
      /* IN-FLIGHT ADAPTATION: if this machine cannot hold the frame rate, the flight drops its own
         resolution by 30% steps (down to kMin). It starts sharp, and by the time it could step down the
         rim is already big and soft, so a fast machine never sees a difference and a slow one stays fluid. */
      if (lastNow && !first) {
        gAcc += now - lastNow; gN++;
        if (gN >= 5) {
          if (gAcc / gN > 22 && k > kMin) {
            k = Math.max(kMin, k * 0.7);
            W = Math.max(16, Math.round(vw * k)); H = Math.max(16, Math.round(vh * k));
            glc.width = W; glc.height = H;
          }
          gAcc = 0; gN = 0;
        }
      }
      lastNow = now;
      /* the clock starts on the first real frame: opening a film builds its page in the same task, and a
         slow first frame should hold the opening pose, not make the flight jump ahead */
      if (first && now !== t0) { first = false; t0 = now - 16; }
      var t = Math.min(1, (now - t0) / ms);
      var tt = o.dir === "out" ? 1 - t : t;
      /* the way back: the bubble's halo starts fading back in while the rim is still landing, so it is
         there when the flight ends (it used to start only after landing and read as a late pop-in) */
      if (o.dir === "out" && !z.haloBack && t > 0.7) { z.haloBack = true; hide.forEach(function (h) { h.style.removeProperty("opacity"); }); }
      var e = easeIO(tt), c = cEnd * e;
      hb = hostBox(o.el, hb);
      var S = hb.S, cx = hb.cx, cy = hb.cy, box = hb.box;
      var s = ZD.map(function (d) { return d - c > 0.02 ? d / (d - c) : 1e4; });
      gl.useProgram(progZ); params(UZ); gl.uniform1f(UZ.uEll, 0); gl.uniform1f(UZ.uOut, 0);
      /* drawing-buffer pixels (can be fewer than the canvas has, see GLMAX) */
      var bw = gl.drawingBufferWidth || W, bh = gl.drawingBufferHeight || H, kb = bw / vw;
      gl.viewport(0, 0, bw, bh);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3fv(UZ.uC1, cols[0]); gl.uniform3fv(UZ.uC2, cols[1]); gl.uniform3fv(UZ.uC3, cols[2]);
      gl.uniform2f(UZ.uBox, box[0], box[1]); gl.uniform1f(UZ.uRad, rad0); gl.uniform1f(UZ.uDepth, depth); gl.uniform1f(UZ.uDeep, deep);
      if (rb && pal && pal.n > 1) { gl.uniform1f(UZ.uRb, rb); gl.uniform1f(UZ.uPalN, pal.n); gl.uniform3fv(UZ.uPal, pal.flat); }
      else gl.uniform1f(UZ.uRb, 0);
      gl.uniform1f(UZ.uT, tBase + (now - t0) / 1000 * P.speed); gl.uniform1f(UZ.uSeed, seed); gl.uniform1f(UZ.uSh, 1);
      gl.uniform3f(UZ.uS, s[0], s[1], s[2]);
      gl.uniform2f(UZ.uCen, cx * kb, cy * bh / vh); gl.uniform2f(UZ.uView, bw, bh);
      gl.uniform1f(UZ.uSpx, S * kb); gl.uniform1f(UZ.uPxz, 1.2 / (S * kb));
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
      /* REVEAL FEATHER: the next page fades in across the whole layered band, fully there inside the
         backdrop band's inner edge and gone at the middle of the rim, so the hand-over between the pages
         is spread under all three layers instead of happening at one line. null once the backdrop's
         inner edge has left the screen (the page is simply there). */
      var reveal = null;
      var d3in = (1 - (0.70 - 0.13 * deep + 0.02)) * depth;
      var inn = contour(box, rad0, d3in, S * s[2]);
      if (!covers(inn, cx, cy, vw, vh)) {
        var out = s[0] < 1e3 ? contour(box, rad0, lip, S * s[0]) : { hx: 2e4, hy: 2e4, r: 2e4 };
        reveal = { cx: cx, cy: cy, inn: inn, out: out };
      }
      if (o.onFrame) o.onFrame({ t: t, e: e, clip: clip, reveal: reveal, s1: s[0] });
      if (t >= 1) { zoomStop(true); return; }
      z.raf = requestAnimationFrame(step);
    }
    step(t0);
    return { look: { cols: cols, rb: rb, pal: pal, deep: deep } };
  }
  window.RPBubble = {
    zoom: zoom, zoomStop: function (finish) { zoomStop(!!finish); },
    attach: attach, setLook: setLook, detach: detach, sprite: sprite, params: P, setParam: setParam, quality: Q,
    redraw: function () { items.forEach(function (x) { x.drawn = false; }); kick(); },
    supported: function () { return initGL(); },
    /* run f once the shaders are built (at once if they already are) */
    ready: function (f) { if (!initGL()) return; if (progReady) f(); else { readyCbs.push(f); kick(); } },
    stats: STATS
  };
})();
