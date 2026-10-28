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
    "uniform vec2 uRad;",
    "uniform float uDeep,uDepth,uT,uSeed,uPx,uWob,uSoft,uSpin,uInner,uCol,uSh,uClip,uEll,uOut,uWf;",
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
    /* uRad (2026-10-27) is the corner's two radii, x and y, exactly as CSS has them. The featured carousel
       card is 13% / 20%: elliptical corners, and on its way to and from a circle every value in between.
       A single circular radius (the old uRad) only matched CSS when the two were equal, which is why the
       round bubbles were always right and the rectangle was not: its rim and bands followed a different
       shape from the card under it, by a lot mid-morph (thick blobs, a dark band, missing edges). The
       corner is now an ellipse quadrant (distance approximated by f / |grad f|), the sides are straight. */
    "float rr(vec2 p){if(uEll>.5)return 1.+(length(p/uBox)-1.)*min(uBox.x,uBox.y)/uDepth;",
    "  vec2 R=max(uRad,vec2(1e-4)), a=abs(p), q=a-(uBox-R); float d;",
    "  if(q.x>0.&&q.y>0.){vec2 e=q/R; float k0=length(e), k1=length(e/R); d=k0*(k0-1.)/max(k1,1e-5);}",
    "  else d=max(a.x-uBox.x,a.y-uBox.y);",
    "  return 1.+d/uDepth;}",
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
    "  if(uSh>.01&&length(p-shC())<.62) sa=shineA(p,z)*uSh;",
    /* cheap early-out: the clear centre that no band (and no shine) can reach */
    "  if(r<.5-.14*uDeep&&sa<.004){gl_FragColor=vec4(0.);return;}",
    /* ---- ALPHA (Alpha_Shape + Alpha_Effects pre-comps) ----
       ONE turbulence field drives both wobbling bands (Edge 2 and Edge 3 sample it with different
       amounts and swizzles), and the 4px Minor Edge Distortion is too small to see at web sizes. */
    /* WAVE COUNT AND SIZE ON OTHER SHAPES (2026-10-28, Jack: the featured card and the rentals cards had
       "too many waves" next to the round bubbles): uWf (< 1 on anything longer than a circle) stretches
       the wobble so a shape's whole outline carries as many waves as a round bubble's does, and the
       wobble's size follows the bands' own thickness (uDepth), so thinner bands keep the bubble's three
       tiers instead of breaking up into blobs. A round bubble (uWf 1, depth 1) is exactly as before. */
    "  vec2 w=wv(p*uWf,1.9,z+3.);",
    "  float r2=rr(p+uWob*.045*uDepth*w);",                          // Edge 2 turbulent displace
    "  float r3=rr(p+uWob*.065*uDepth*vec2(w.y,-w.x));",              // Edge 3 turbulent displace
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
    "  bool sh=uSh>.01&&length(q1-shC())<.62;",
    /* CONNECTED LAYERS (Jack, 2026-10-26): every band continues OUTWARD under the layers in front of it,
       all the way to the rim's outer edge, so when the planes separate the parts they uncover are still
       band, never a gap. Only the foreground rim's exterior cutter ends them. */
    "  if(r1>1.03||(r1<.88&&r2<i2-.12&&r3<i3-.2&&!sh)){gl_FragColor=vec4(0.);return;}",
    "  float z=uSeed*17.+uT*.11;",
    /* PERFORMANCE: the band wobble only matters near a band's inner edge (elsewhere its alpha is flat),
       so the turbulence is only evaluated there; the windows are wider than wobble + edge softness */
    "  float d2=r2, d3=r3;",
    "  if(abs(r2-i2)<.2){vec2 w2=wv(q2*uWf,1.9,z+3.);d2=rr(q2+uWob*.045*uDepth*w2);}",
    "  if(abs(r3-i3)<.26){vec2 w3=wv(q3*uWf,1.9,z+3.);d3=rr(q3+uWob*.065*uDepth*vec2(w3.y,-w3.x));}",
    "  float cut1=1.-smoothstep(1.-uPxz/uS.x,1.+uPxz/uS.x,r1);",
    "  float a1=smoothstep(.917-.012*uSoft,.921+.008*uSoft,r1)*cut1;",
    "  float a2=smoothstep(i2-.005-.022*uSoft,i2+.016*uSoft,d2)*.5*cut1;",
    "  float a3=smoothstep(i3-.01-.07*uSoft,i3+.05*uSoft,d3)*.25*uInner*cut1;",
    "  float sa=sh?shineA(q1,z)*uSh*(1.-smoothstep(1.-uPxz/uS.x,1.+uPxz/uS.x,r1)):0.;",
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
  var CODE_VER = "20261027p";

  /* ===== EFFECT TIERS (2026-10-27, Jack: "safety measures and automatic backup versions of the website
     that it can cleanly fall back to if a computer can't handle it ... when future updates are made, it
     will automatically update any elements for lower res versions") =====
     There are no separate copies of the site. Every bubble on every page goes through THIS file, so a
     tier is a way of drawing, applied to all of them, and anything added later with RPBubble.attach()
     gets every tier for free. html gets rp-fx-full / rp-fx-lite / rp-fx-css so page CSS can drop its
     own continuous effects in lite (see index.html "EFFECT TIERS").
       full  the V3 bubble as designed: live wobbling rims, depth-zoom film openings.
       lite  every rim drawn once and redrawn only when its look or shape settles, 75% resolution, a
             CSS ring while a bubble changes shape, no ambient bubbles, no blurred halos (page CSS).
       css   no WebGL at all: the site's original CSS rims (pages already fall back when
             RPBubble.supported() is false), plain page transitions instead of the depth zoom.
     How a tier is chosen: ?fx=full|lite|css (kept for the tab) for testing; else a decision this
     device made before WITH THIS VERSION of the code (so every update re-tests every device and
     nothing stays stuck on a fallback the new code may not need); else Save-Data / a very small
     device -> lite. Then it can only go DOWN while the page runs: a software renderer -> lite; the
     WebGL copy self-check failing -> css (reloads once, behind the page veil); frames staying slow
     at the lowest resolution -> lite now, css from the next visit. */
  var TIER = "full", TIER_WHY = "default";
  function fxSave(t, why) { try { localStorage.setItem("rp-fx", JSON.stringify({ t: t, why: why, v: CODE_VER, at: Date.now() })); } catch (e) {} }
  (function pickTier() {
    var q = (location.search.match(/[?&]fx=(full|lite|css)\b/) || [])[1];
    try { if (q) sessionStorage.setItem("rp-fx-force", q); else q = sessionStorage.getItem("rp-fx-force"); } catch (e) {}
    if (q) { TIER = q; TIER_WHY = "forced (?fx=" + q + ")"; return; }
    var sv = null; try { sv = JSON.parse(localStorage.getItem("rp-fx") || "null"); } catch (e) {}
    if (sv && sv.v === CODE_VER && Date.now() - sv.at < 14 * 864e5 && (sv.t === "lite" || sv.t === "css")) { TIER = sv.t; TIER_WHY = "remembered on this device: " + sv.why; return; }
    var cn = navigator.connection, mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
    if (cn && cn.saveData) { TIER = "lite"; TIER_WHY = "Save-Data"; }
    else if ((mem && mem <= 2) || (cores && cores <= 2)) { TIER = "lite"; TIER_WHY = "small device"; }
  })();
  try { document.documentElement.classList.add("rp-fx-" + TIER); } catch (e) {}
  /* t: the new tier; save: remember it on this device (this code version); reload: apply it by reloading
     the page once (only used for css, which cannot be switched to while bubbles already exist) */
  function setTier(t, why, save, reload) {
    if (save) fxSave(t, why);
    if (t === TIER) return;
    if (reload) {
      try { if (sessionStorage.getItem("rp-fx-reloaded")) return; sessionStorage.setItem("rp-fx-reloaded", "1"); } catch (e) { return; }
      location.reload(); return;
    }
    var de = document.documentElement;
    de.classList.remove("rp-fx-" + TIER); TIER = t; TIER_WHY = why; de.classList.add("rp-fx-" + t);
    if (t === "lite") { Q.scale = Math.min(Q.scale, 0.75); items.forEach(function (x) { x.drawn = false; }); kick(); }
  }
  var Q = { scale: 1, fps: FPS };
  /* set only by RPBubble.debug() (the ?perf=1 probe): freeze = draw nothing, scale = pin the resolution */
  var DBG = { freeze: false, scale: 0 };
  var items = [], gl = null, glc = null, prog = null, U = {}, raf = 0;
  /* ATLAS_MAX: the most the shared canvas may ever need on this screen. ATLAS: its size right now. It starts
     small and grows (never shrinks) to fit the largest bubble actually drawn, see "COPY COST" at render(). */
  var ATLAS_MAX = (function () {
    var d = Math.min(window.devicePixelRatio || 1, 1.25), sw = (window.screen && screen.width) || 0, sh = (window.screen && screen.height) || 0;
    return [Math.min(2048, Math.ceil((Math.max(sw, window.innerWidth || 0) + 256) * d)), Math.min(2048, Math.ceil((Math.max(sh, window.innerHeight || 0) + 256) * d))];
  })();
  var ATLAS = [Math.min(ATLAS_MAX[0], 768), Math.min(ATLAS_MAX[1], 512)];
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
    if (TIER === "css") { gl = false; return false; }
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
      if (SOFT) { STATS.soft = true; setTier("lite", "software renderer (no GPU)", false); }
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
    selfCheck();
  }
  /* SELF-CHECK (safety): one test bubble, a wide rounded rectangle like the featured carousel card,
     drawn and copied exactly the way every bubble is, then read back: its rim must be there on all four
     sides and its middle must be clear. If not, this browser cannot show the bubbles correctly, the
     page switches to the css tier (one reload while the veil is still up) and remembers it for this
     version of the code. */
  function selfCheck(probe) {
    try {
      var W = 300, H = 170, s0 = Math.min(W, H);
      var src = render(lookVec(null), W, H, [W / s0, H / s0], [0.3, 0.45], 0, 0.5, [W / s0, H / s0], 1, false, 0, 0, null, false);
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      var x = c.getContext("2d", { willReadFrequently: true });
      copyOut(x, src, W, H);
      var d = x.getImageData(0, 0, W, H).data;
      var A = function (px, py) { return d[(py * W + px) * 4 + 3]; };
      var edges = [A(W >> 1, 3), A(W >> 1, H - 4), A(3, H >> 1), A(W - 4, H >> 1)], mid = A(W >> 1, H >> 1);
      var ok = edges.every(function (a) { return a > 90; }) && mid < 40;
      var res = (ok ? "ok" : "FAILED") + " (edges " + edges.join("/") + ", middle " + mid + ")";
      if (probe) return res;
      STATS.selfcheck = res;
      if (!ok) setTier("css", "the WebGL copy self-check failed", true, true);
    } catch (e) { if (probe) return "error " + e.message; STATS.selfcheck = "error " + e.message; }
  }
  var STATS = { ver: CODE_VER, compileMs: 0, zCompileMs: 0, draws: 0, drawMs: 0, drawMax: 0, frames: 0, frameMs: 0, frameMax: 0, gpu: "", parallel: false };
  var progZ = null, UZ = null;
  var NAMES = ["uC1", "uC2", "uC3", "uBox", "uScale", "uGlow", "uPal", "uPalN", "uRb", "uDeep", "uDepth", "uRad", "uT", "uSeed", "uPx", "uWob", "uSoft", "uSpin", "uInner", "uCol", "uSh", "uClip", "uEll", "uOut", "uWf"];
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
        /* a SHAPE change (size, corner radius) as opposed to a colour / depth one: see MOVE RING */
        if (/width|height|radius|padding|^inset|^top|^left|^right|^bottom/.test(e.propertyName || "")) {
          if (live) { it.shapeT = (it.shapeT || 0) + 1; it.shapeAt = performance.now(); }
          else it.shapeT = Math.max(0, (it.shapeT || 0) - 1);
        }
      }
    }
    kick();
  }
  ["transitionrun", "transitionend", "transitioncancel"].forEach(function (ev) { document.addEventListener(ev, onTrans, true); });

  /* border-radius -> [x radius, y radius] in units of the short half-side, with CSS's own rule that
     radii too big for the box are scaled down together (50% = a circle on a square, an ellipse otherwise;
     999px = a pill) */
  function radiusOf(cs, w, h) {
    var v = (cs.borderTopLeftRadius || "").trim().split(/\s+/);
    function px(x, ref) { if (!x) return 0; return /%$/.test(x) ? parseFloat(x) / 100 * ref : parseFloat(x) || 0; }
    var rx = px(v[0], w), ry = px(v[1] || v[0], h);
    var f = Math.min(1, rx > 0 ? w / (2 * rx) : 1, ry > 0 ? h / (2 * ry) : 1);
    var s = Math.min(w, h) / 2;
    return s > 0 ? [rx * f / s, ry * f / s] : [1, 1];
  }
  function radMin(r) { return r && r.length ? Math.min(r[0], r[1]) : (r == null ? 1 : r); }

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
    /* --rpb-band: the three tiers' width in CSS px, whatever the element's size (a big card or a popup
       would otherwise get bands as wide as a quarter of its short side, or hairlines at a tiny depth) */
    var bp = parseFloat(cs.getPropertyValue("--rpb-band"));
    if (bp > 0) it.depth = Math.max(0.02, Math.min(1, bp / (0.3 * Math.min(it.w, it.h) / 2)));
    it.deep = parseFloat(cs.getPropertyValue("--rpb-deep")) || 0;
    it.rb = parseFloat(cs.getPropertyValue("--rpb-rainbow")) || 0;
    /* the shine (the white glare at the top right) can be faded per bubble: --rpb-shine 1 -> 0 (the
       featured carousel card, Jack 2026-10-27: "have the bubble reflection fade away when it moves to the
       center ... not distracting when it's the main focus") */
    var sh = parseFloat(cs.getPropertyValue("--rpb-shine")); it.shine = isNaN(sh) ? 1 : Math.max(0, Math.min(1, sh));
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

  /* The GPU may give the canvas a SMALLER drawing buffer than asked for (memory limits on some machines):
     everything here works in drawing-buffer pixels and returns the source size in canvas pixels for the
     copy. Assuming the two were equal drew only part of a bubble on such machines (Jack, 2026-10-26: rims
     "only showing on the top left"). */
  /* ATLAS history: Firefox on Windows (2026-10-27, Jack's screenshot) showed the featured card's rim only
     along its top and left, read then as a stale copy after the shared canvas had grown, so the canvas
     was given one screen-sized size up front (20261027a-k). That made every copy expensive in Firefox and
     Safari (below), and Jack still saw the partial rim with it, so it was not the whole story; the ?perf=1
     report from that machine (rim pixels on all four sides, the copy self-check) is what will settle it. */
  /* COPY COST (2026-10-27, ?perf=1 reports #4 and #5): Firefox and Safari copy the WHOLE shared canvas for
     every drawImage, whatever part of it is asked for. With the canvas sized for the whole screen
     (2048 x 1445 on a 1440 x 900 window at 1.5x) one bubble copy cost Firefox ~4 ms and the page dropped
     to 36-69 fps, 119 fps with the bubbles held still; at 1280 x 768 it costs ~1.5 ms. So the canvas
     starts small and GROWS to fit the largest bubble actually drawn (12% headroom, 64 px steps, at most
     ATLAS_MAX), which on a normal page happens once or twice, never shrinking. Growing was what showed a
     stale, scaled copy on Jack's Windows Firefox before (see ATLAS above), so a growth is followed by a
     throwaway copy, every bubble drawn in that frame is drawn again in the next one, and the copy
     self-check is re-run (RPBubble.stats.atlasGrow, shown by ?perf=1). */
  var renderEll = false, renderOut = false, grewF = -1, flushCv = null;
  function grow(W, H) {
    var nw = Math.min(ATLAS_MAX[0], Math.max(glc.width, Math.ceil(W * 1.12 / 64) * 64)), nh = Math.min(ATLAS_MAX[1], Math.max(glc.height, Math.ceil(H * 1.12 / 64) * 64));
    if (nw <= glc.width && nh <= glc.height) return;
    glc.width = nw; glc.height = nh; ATLAS = [nw, nh]; grewF = FR;
    try {
      if (!flushCv) { flushCv = document.createElement("canvas"); flushCv.width = flushCv.height = 1; }
      gl.viewport(0, 0, 1, 1); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      flushCv.getContext("2d").drawImage(glc, 0, 0, 1, 1, 0, 0, 1, 1);
    } catch (e) {}
    STATS.atlasGrows = (STATS.atlasGrows || 0) + 1;
  }
  /* how many times longer a shape's outline is than a circle's of the same short side (box = half-extents,
     rad = corner radii, both in half-short-side units): straight sides plus the corners' ellipse
     (Ramanujan). uWf = its inverse, so every shape carries a round bubble's number of waves. */
  function wfOf(box, rad) {
    var bx = box[0], by = box[1], rx = Math.min(bx, rad ? rad[0] : 1), ry = Math.min(by, rad ? rad[1] : 1);
    var h = Math.pow(rx - ry, 2) / Math.max(1e-6, Math.pow(rx + ry, 2));
    var per = 4 * (bx - rx) + 4 * (by - ry) + Math.PI * (rx + ry) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));
    return Math.max(0.3, Math.min(1, 2 * Math.PI / Math.max(1e-6, per)));
  }
  function render(cols, W, H, box, rad, t, seed, scale, depth, glow, deep, rb, pal, clip, shine) {
    if ((glc.width < W || glc.height < H) && !zooming) grow(W, H);
    var dbw = gl.drawingBufferWidth || glc.width, dbh = gl.drawingBufferHeight || glc.height;
    var f = Math.min(1, dbw / W, dbh / H);
    var w = Math.max(1, Math.floor(W * f)), h = Math.max(1, Math.floor(H * f));
    gl.useProgram(prog); params(U); gl.uniform1f(U.uSh, glow ? 0 : (shine == null ? 1 : shine)); gl.uniform1f(U.uWf, renderOut ? 1 : wfOf(box, rad)); gl.uniform1f(U.uClip, clip ? 1 : 0); gl.uniform1f(U.uEll, renderEll ? 1 : 0); gl.uniform1f(U.uOut, renderOut ? 1 : 0);
    gl.viewport(0, dbh - h, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3fv(U.uC1, cols[0]); gl.uniform3fv(U.uC2, cols[1]); gl.uniform3fv(U.uC3, cols[2]);
    gl.uniform2f(U.uBox, box[0], box[1]); gl.uniform2f(U.uRad, rad[0], rad[1]); gl.uniform1f(U.uDepth, depth || 1); gl.uniform1f(U.uDeep, deep || 0);
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
    /* THE CANVAS NEVER SHRINKS (2026-10-27, ?perf=1 report #10, Jack's Windows PC, Firefox 158, GTX 980).
       The report read the featured card's canvas back pixel by pixel: its rim was complete on all four
       sides, yet on screen Jack saw it cut off at the right and bottom, "fine for a few frames when the
       site first loaded, then broke". So the drawing was right and what Firefox put on screen was not.
       What changes a few frames in: this canvas's backing store was resized whenever the resolution
       adapted (slow frames while the shaders build at load, then back up), and to 70% for every
       transition. A canvas shown at a size the screen still believes is the OLD one is exactly a picture
       cut off at the right and bottom by the ratio of the two. Now the backing store is sized once, to
       the full-quality size of the largest shape the bubble has had (64 px steps), and only ever grows;
       a lower resolution (adaptive quality, mid-move) is rendered smaller and stretched into the whole
       canvas. Resolution changes and moves never resize a canvas any more. */
    var base = Math.min(window.devicePixelRatio || 1, DPR_CAP) * (it.opts.res || 1);
    var k = Math.min(1, (it.opts.max || MAXPX) / (Math.max(w, h) * base));
    var FW = Math.max(16, Math.round(w * base * k)), FH = Math.max(16, Math.round(h * base * k));
    var q = Q.scale * (it.trans ? 0.7 : 1);
    var W = Math.max(16, Math.round(FW * q)), H = Math.max(16, Math.round(FH * q));
    var cw = it.cv.width, ch = it.cv.height;
    if (!it.hold && (cw < FW || ch < FH)) {
      var gw = Math.ceil(FW / 64) * 64, gh = Math.ceil(FH / 64) * 64;
      /* growing WHILE its shape changes (a side card becoming the featured one): straight to the size of
         the largest bubble canvas on the page, so the move costs one resize instead of one per 64 px */
      if (it.shapeT > 0) for (var mi = 0; mi < items.length; mi++) if (!items[mi].ref && !items[mi].opts.splash) { gw = Math.max(gw, items[mi].cv.width); gh = Math.max(gh, items[mi].cv.height); }
      cw = Math.max(cw, Math.min(gw, MAXPX + 64)); ch = Math.max(ch, Math.min(gh, MAXPX + 64));
      it.cv.width = cw; it.cv.height = ch; it.resizes = (it.resizes || 0) + 1;
    }
    var src;
    if (it.ref) {
      var bw = it.rw || w, bh = it.rh || h, sb = Math.min(bw, bh) / 2;
      src = render(it.cols, W, H, [bw / 2 / sb, bh / 2 / sb], it.rrad == null ? [1, 1] : it.rrad, t, it.opts.seed, [w / 2 / sb, h / 2 / sb], 1, true, 0, it.rb, it.pal, false);
    } else if (it.opts.splash) {
      /* the shape is the ELEMENT's box; the canvas overhangs it by the bleed, where the outer rings live */
      var sE = Math.min(it.w, it.h) / 2;
      renderEll = !!it.opts.ellipse; renderOut = true;
      src = render(it.cols, W, H, [it.w / 2 / sE, it.h / 2 / sE], it.rad, t, it.opts.seed, [w / 2 / sE, h / 2 / sE], it.depth, false, 0, 0, null, false, it.shine);
      renderEll = false; renderOut = false;
    } else {
      var s = Math.min(w, h), inset = it.opts.inset || 1;
      renderEll = !!it.opts.ellipse;
      src = render(it.cols, W, H, [w / s, h / s], it.rad, t, it.opts.seed, [w / s / inset, h / s / inset], it.depth, false, it.deep, it.rb, it.pal, it.clipped, it.shine);
      renderEll = false;
    }
    it.ctx.clearRect(0, 0, cw, ch);
    copyOut(it.ctx, src, cw, ch);   /* rendered at W x H, stretched over the whole canvas */
    it.lastSrc = src; it.lastWH = [W, H];   // the render sits in the TOP-left of the shared canvas
    if (!it.shownOnce) { it.shownOnce = true; it.cv.style.opacity = "1"; }
    it.drawn = true;
    it.lastDraw = performance.now();
    var dS = it.lastDraw - tS;
    STATS.draws++; STATS.drawMs += dS; if (dS > STATS.drawMax) STATS.drawMax = dS;
    return true;
  }

  /* ===== MOVE RING (2026-10-27, Jack's iPad recording) =====
     While a bubble changes SHAPE (the carousel card growing from a circle into the featured
     rectangle and back) its canvas has to be redrawn every frame, or CSS stretches the last picture:
     the old circle's rim became an oval inside the new rectangle, with its dark middle showing as
     black edges. In the lite tier (since 2026-10-27 only there, see frame()), the
     canvas is hidden for the move and the element shows a CSS ring instead, three inset shadows in
     the bubble's colours and tier widths (solid rim, 50%, 25%) that follow the border-radius exactly
     because they ARE the element's own edge. When the shape settles the canvas is redrawn at the
     final size, fades back in, and the ring fades out under it. Generic: any bubble, any page. */
  var MOVE_RING = false, staleMoves = 0, FR = 0;
  (function () {
    try {
      var st = document.createElement("style");
      st.textContent = ".rpb-moving>.rp-bubble-cv{opacity:0!important;transition:opacity .1s ease!important}" +
        ".rpb-moving,.rpb-ringout{box-shadow:inset 0 0 0 var(--rpb-t1) var(--rpb-r1),inset 0 0 var(--rpb-b2) var(--rpb-s2) var(--rpb-r2),inset 0 0 var(--rpb-b3) var(--rpb-s3) var(--rpb-r3)!important}" +
        ".rpb-ringout>.rp-bubble-cv{transition:opacity .22s ease!important}";
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  })();
  function rgba(c, a) { return "rgba(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + "," + a + ")"; }
  function ringOn(it, why) {
    if (it.ring) return;
    it.ring = why || true;
    var hs = Math.min(it.w || 0, it.h || 0) / 2 * (it.depth || 1);
    var t1 = Math.max(1.5, 0.083 * hs), t2 = 0.107 * hs, t3 = 0.11 * hs, st = it.el.style, c = it.cols;
    st.setProperty("--rpb-t1", t1.toFixed(1) + "px"); st.setProperty("--rpb-r1", rgba(c[0], 1));
    st.setProperty("--rpb-b2", (t2 * 0.8).toFixed(1) + "px"); st.setProperty("--rpb-s2", (t1 + t2 * 0.6).toFixed(1) + "px"); st.setProperty("--rpb-r2", rgba(c[1], 0.5));
    st.setProperty("--rpb-b3", (t3 * 1.6).toFixed(1) + "px"); st.setProperty("--rpb-s3", (t1 + t2 + t3 * 0.4).toFixed(1) + "px"); st.setProperty("--rpb-r3", rgba(c[2], 0.25));
    it.el.classList.add("rpb-moving");
  }
  function ringOff(it) {
    if (!it.ring) return;
    it.ring = false;
    it.el.classList.remove("rpb-moving"); it.el.classList.add("rpb-ringout");
    clearTimeout(it.ringT);
    it.ringT = setTimeout(function () { it.el.classList.remove("rpb-ringout"); }, 260);
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
      if (it.shapeT && now - (it.shapeAt || 0) > 3000) it.shapeT = 0;
      if (now - (it.styledAt || 0) > 2000 && it.onScreen) { it.dirty = Math.max(it.dirty, 1); it.styledAt = now; }
    }
  }

  /* ===== ADAPTIVE QUALITY from the page's own frame pacing (rewritten 2026-10-27) =====
     Before: a frame slower than 24 ms counted as slow, and when most were slow the bubbles dropped to
     55% resolution at 15 fps and, after three such seconds, the device was put in the lite tier and
     REMEMBERED. The ?perf=1 probe (report #2, Chrome on the mini) showed the flaw: the browser itself
     went to a steady 30 fps (33.3 ms every frame) in the middle of the run, the bubble engine using about
     1 ms of each frame, and the code read that as overload: 15 fps choppy rims and a saved lite tier.
     A steady 30 fps is a frame-rate CAP (Chrome's Energy Saver, macOS Low Power Mode, a 30 Hz screen, a
     remote desktop, a playing video on some machines), and lowering the bubbles cannot raise it.
     Now: "slow" is measured against the page's own cadence (a frame clearly longer than the usual one),
     and when the cadence itself is low the engine TESTS whether it is the cause: it holds the bubbles
     still for 1.2 s (they keep their last frame) and compares. Frames come back -> the bubbles are the
     cost and quality steps down as before. They do not -> it is a cap: full quality is kept (restored if
     it had been lowered), the result is in RPBubble.stats.paceTest, and it re-tests later (30 s, then
     doubling up to 5 min). The tier only ever drops for slowness the bubbles were shown to cause. */
  var pace = { t0: 0, gaps: [], slowWin: 0, goodWin: 0 };
  var AT = { on: 0, before: 0, gaps: [], last: -1e9, every: 30000, bound: false };
  function median(a) { var x = a.slice().sort(function (p, q) { return p - q; }); return x.length ? x[x.length >> 1] : 0; }
  function atAbort(now) { if (!AT.on) return; AT.on = 0; AT.last = now - AT.every + 5000; }   /* try again in 5 s */
  function adapt(now, gap) {
    if (DBG.scale || DBG.freeze) return;
    if (gap > 250) { pace.t0 = 0; pace.gaps = []; return; }   /* the loop had been idle, not slow */
    if (AT.on) {
      AT.gaps.push(gap);
      if (now - AT.on < 1200) return;
      var mf = median(AT.gaps.slice(4));
      AT.on = 0; AT.last = now;
      AT.bound = mf < AT.before * 0.75;
      STATS.paceTest = "page " + Math.round(AT.before) + " ms per frame, " + Math.round(mf) + " ms with the bubbles held still: " + (AT.bound ? "the bubbles are the cost" : "a frame-rate cap, not the bubbles");
      if (!AT.bound) { AT.every = Math.min(300000, AT.every * 2); Q.scale = TIER === "lite" ? 0.75 : 1; pace.slowWin = 0; }
      pace.t0 = now; pace.gaps = [];
      return;
    }
    if (!pace.t0) { pace.t0 = now; pace.gaps = []; }
    pace.gaps.push(gap);
    if (now - pace.t0 < 1000) return;
    var med = median(pace.gaps), lim = Math.max(24, med * 1.6), slow = 0;
    pace.gaps.forEach(function (g) { if (g > lim) slow++; });
    var ratio = slow / Math.max(1, pace.gaps.length);
    STATS.cadence = Math.round(med * 10) / 10;
    pace.t0 = now; pace.gaps = [];
    /* a low cadence that has not been explained yet: test it (not while anything is moving or zooming) */
    if (med >= 24 && !AT.bound && now - AT.last > AT.every && !zooming && !items.some(function (x) { return x.trans || x.shapeT > 0; })) {
      AT.on = now; AT.before = med; AT.gaps = []; return;
    }
    if (med < 24 && AT.bound && ++pace.goodWin >= 10) { AT.bound = false; pace.goodWin = 0; }   /* recovered for a while: forget */
    if (med >= 24) pace.goodWin = 0;
    var low = med >= 24 && AT.bound;
    var top = TIER === "lite" ? 0.75 : 1;
    /* NEVER CHOPPY (Jack, 2026-10-27: "would rather cut animations than have them look choppy"): a
       struggling device gets a lower RESOLUTION at the full 24 fps (soft rims, which read as fine), and
       if that is not enough the lite tier below, where the rims hold one still frame. The animation
       rate itself is never lowered (it used to drop to 15 fps here, which looked choppy). */
    if ((ratio > 0.25 || low) && Q.scale > 0.56) Q.scale = Math.max(0.55, Q.scale - 0.15);
    else if (ratio < 0.05 && !low && !AT.bound && Q.scale < top) Q.scale = Math.min(top, Q.scale + 0.1);
    /* still slow at the lowest resolution, second after second, and shown to be the bubbles' doing (or
       janky frames well beyond the cadence): this device cannot hold the full effects. Lite now
       (remembered), and if even lite stays slow, css from the next visit. */
    pace.slowWin = (ratio > 0.3 || low) ? pace.slowWin + 1 : 0;
    if (TIER === "full" && Q.scale <= 0.56 && pace.slowWin >= 3) { setTier("lite", low ? "frames stayed slow at the lowest resolution (" + STATS.paceTest + ")" : "frames stayed uneven at the lowest resolution", true); pace.slowWin = 0; }
    else if (TIER === "lite" && pace.slowWin >= 6) { fxSave("css", "frames stayed slow even in lite"); pace.slowWin = 0; }
  }

  var last = 0, simT = 0, rot = 0;
  /* SCHEDULING (2026-10-26, "running horribly on other people's computers"). Every bubble has its own
     next-draw time instead of all of them being drawn together in one heavy frame:
       live   the AE band wobble, always 24 fps (only the resolution adapts): the bubbles you look at and click
       glow   the soft halos: colour only, which turns once per ~45 s, so 8 fps is indistinguishable
       still  drawn once, then again only when its look / shape / size actually changes (hover look
              fades, the carousel morph): the bubbles in the background (opts.still, or opts.liveWhen
              returning false, e.g. the carousel's side cards)
     and a frame never spends more than BUDGET ms drawing: what is left waits for the next frame, so
     the page keeps its own frame rate on a weak GPU instead of stalling. */
  var GLOW_FPS = 8, BUDGET = 8;
  function kindOf(x) {
    if (x.opts.still || TIER === "lite") return "still";
    if (x.opts.liveWhen) { try { if (!x.opts.liveWhen(x.el)) return "still"; } catch (e) {} }
    return x.ref ? "glow" : "live";
  }
  function sigOf(x) { return [x.cols && x.cols.join(), x.rad, x.depth, x.deep, x.rb, x.shine, x.w, x.h, x.rw, x.rrad].join("|"); }
  function frame(now) {
    raf = 0; FR++;
    var gap = last ? now - last : 16; last = now;
    var body = document.body;
    var hidden = document.hidden;
    /* u-cover: a film page covers everything (index.html uCover) */
    var paused = hidden || !!(body && (body.classList.contains("bg-idle") || body.classList.contains("u-cover")));
    /* carousel drag / slide change: only bubbles that are changing shape or look are redrawn */
    var swiping = !!(body && body.classList.contains("swiping"));
    if (!paused && !swiping) adapt(now, gap);
    else atAbort(now);
    housekeep(now);
    /* held still: the probe's A/B (DBG.freeze) or the pacing test above (AT.on); the loop keeps running */
    if (AT.on && items.some(function (x) { return x.trans || x.shapeT > 0; })) atAbort(now);   /* something started moving: never hold it */
    if (DBG.freeze || AT.on) { if (gl) raf = requestAnimationFrame(frame); return; }
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
      for (c = 0; c < n; c++) {
        x = items[c];
        if (x.ref || x.opts.splash) continue;   /* halos and splashes have no edge to ring */
        if (x.shapeT > 0) {
          /* the CSS ring stands in for the rim during a move ONLY in lite (where rims are still frames).
             In full it is never used any more (2026-10-27, Jack's iPad, report #27: two starved moves made
             the page "learn" the ring for every move, and the real rim's inner two bands then snapped in
             about a second after each move, when the ring handed over). Instead a rim that is changing
             shape is drawn EVERY frame, first, outside the frame budget (below). */
          if (!x.ring && TIER === "lite") ringOn(x, "lite");
        } else if (x.ring && !x.ringDraw) { x.ringDraw = 1; x.dirty = Math.max(x.dirty, 1); }   /* settled: redraw first, then show */
      }
      for (var c = 0; c < n; c++) {
        var x = items[(rot + c) % n];
        if (x.onScreen === false || x.shown === false) continue;
        if (x.ring && x.shapeT > 0) continue;   /* hidden behind its CSS ring while it moves */
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
      /* bubbles that are changing shape (the carousel morph) first: they look wrong when late */
      /* order: rims changing shape (largest first: the featured card), then anything else mid-transition,
         then the rest */
      function pri(x) { return (x.shapeT > 0 && !x.ref && !x.opts.splash) ? 2 : (x.trans ? 1 : 0); }
      todo.sort(function (a, b) { return (pri(b[0]) - pri(a[0])) || (pri(a[0]) === 2 ? (b[0].w * b[0].h - a[0].w * a[0].h) : 0); });
      /* READ phase: every style / size this frame needs, while the page's styles are still clean */
      for (c = 0; c < todo.length; c++) prep(todo[c][0]);
      /* WRITE phase: draw until the frame budget is spent; the rest waits for the next frame.
         The budget counts DRAWING only, and every frame draws at least one bubble. (2026-10-27, Jack's
         iPad video: the read phase above forces the page's style update, which during the carousel morph
         took longer than the whole budget on the iPad, so NO bubble was redrawn for the length of the
         move and the card showed its old picture stretched: the round side bubble's rim as an oval inside
         the new rectangle, the old rectangle squashed into the new circle. Round bubbles hid this because
         a stale circle stretched is still a circle.) */
      var tD = performance.now(), nDrawn = 0;
      for (c = 0; c < todo.length; c++) {
        x = todo[c][0];
        if (x.drawn && nDrawn > 0 && pri(x) < 2 && performance.now() - tD > BUDGET) continue;   /* over budget: next frame (never a rim changing shape) */
        nDrawn++;
        var iv = 1000 / (todo[c][1] === "glow" ? GLOW_FPS : Q.fps);
        x.next = x.drawn ? now + iv : now + iv * Math.random();   /* first draw: random phase, so they spread out */
        if (draw(x, x.opts.still ? x.opts.seed * 3.7 : simT + x.opts.seed * 3.7, true)) {
          x.sig = sigOf(x); x.drawnF = FR;
          if (x.ringDraw) { x.ringDraw = 0; ringOff(x); }
        }
      }
      /* STARVED: a bubble changing shape that went three frames in a row without a redraw is being
         stretched stale by CSS: ring it for the rest of the move; two such moves and this page rings
         every move */
      for (c = 0; c < n; c++) {
        x = items[c];
        if (!(x.shapeT > 0) || x.ring || !x.drawn || x.ref || x.opts.splash || x.onScreen === false || x.shown === false) continue;
        if (x.drawnF === FR) x.moveMiss = 0;
        else if (++x.moveMiss >= 3) { x.moveMiss = 0; staleMoves++; STATS.starved = staleMoves; }   /* counted for ?perf=1 only: no ring in full */
      }
      if (grewF === FR) {   /* the shared canvas grew this frame: draw these again next frame, and re-check the copy */
        for (c = 0; c < todo.length; c++) if (todo[c][0].drawnF === FR) todo[c][0].dirty = Math.max(todo[c][0].dirty, 1);
        STATS.atlasGrow = ATLAS.join("x") + " " + selfCheck(true);
        wants = true;
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
    cv.style.cssText = "position:absolute;inset:" + (-bleed) + "px;width:calc(100% + " + 2 * bleed + "px);height:calc(100% + " + 2 * bleed + "px);display:block;pointer-events:none;border-radius:0;opacity:0;transition:opacity .45s ease";
    /* NO ROUNDED CORNERS ON THE CANVAS (2026-10-27, ?perf=1 reports #25 / #26, Jack's Windows PC, Firefox
       158). The screen check recorded his screen: the featured card's rim was on screen along the top and
       left (100% of the test points) and MISSING along the right and bottom (0%), at load, at rest, after
       every carousel move and before / after a forced canvas resize, while the same canvas read back
       complete. The canvas inherited the card's elliptical corners (13% / 20%), and the round bubbles,
       which never broke there, have square canvases (their clipping parent is the edge). The shader
       already draws the bubble's own corners (transparent outside the shape, measured), so the CSS
       corner on the canvas was only ever a second, redundant cut, and on that machine a wrong one. */
    el.appendChild(cv);
    el.classList.add("rp-bubble-on");
    it = {
      el: el, cv: cv, ctx: cv.getContext("2d", { alpha: true }),
      opts: { seed: opts.seed != null ? opts.seed : Math.random() * 10, inset: opts.inset, max: opts.max, res: opts.glow ? 0.5 : (opts.res || 1), still: !!opts.still, liveWhen: opts.liveWhen || null, ellipse: !!opts.ellipse, splash: !!opts.splash },
      ref: opts.glow ? (opts.ref || el) : null, bleed: bleed,
      vars: opts.look ? null : (opts.vars || ["--gg1", "--gg2", "--gg3"]),
      cols: lookVec(opts.look || { c1: "#3f6bff", c2: "#9b5cff", c3: "#56c8ff" }),
      clipped: (opts.glow || opts.splash) ? false : (opts.clipped != null ? !!opts.clipped : null),   /* null: decided on the first draw, once it is in the page */
      onScreen: io ? undefined : true, shown: undefined, drawn: false, styled: false, dirty: 1, trans: 0, rad: [1, 1], depth: 1, w: 0, h: 0
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
    var src = render(lookVec(look), px, px, [1, 1], [1, 1], t, 0.5, [1, 1], 1, false);
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
    try { if (gl) { readStyle(z.it); draw(z.it, z.it.opts.still ? z.it.opts.seed * 3.7 : simT + z.it.opts.seed * 3.7); } } catch (e) {}
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
    var cols = lk ? lk.cols : it.cols.slice(), rb = lk ? lk.rb : it.rb, pal = lk ? lk.pal : it.pal, rad0 = it.rad, radS = radMin(it.rad), seed = it.opts.seed;
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
      gl.uniform2f(UZ.uBox, box[0], box[1]); gl.uniform2f(UZ.uRad, rad0[0], rad0[1]); gl.uniform1f(UZ.uWf, wfOf(box, rad0)); gl.uniform1f(UZ.uDepth, depth); gl.uniform1f(UZ.uDeep, deep);
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
        var rad = Math.max(0, Math.min(box[0], box[1]) * radS - lip) * S * s[0];
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
      var inn = contour(box, radS, d3in, S * s[2]);
      if (!covers(inn, cx, cy, vw, vh)) {
        var out = s[0] < 1e3 ? contour(box, radS, lip, S * s[0]) : { hx: 2e4, hy: 2e4, r: 2e4 };
        reveal = { cx: cx, cy: cy, inn: inn, out: out };
      }
      if (o.onFrame) o.onFrame({ t: t, e: e, clip: clip, reveal: reveal, s1: s[0] });
      if (t >= 1) { zoomStop(true); return; }
      z.raf = requestAnimationFrame(step);
    }
    step(t0);
    return { look: { cols: cols, rb: rb, pal: pal, deep: deep } };
  }
  /* ===== DEBUG (2026-10-27, for the ?perf=1 probe, assets/perf-probe.js) =====
     RPBubble.debug() returns the engine's state and every bubble's (where it is, what size its canvas
     is, what was last copied into it, whether it is live, ringed, waiting...). Options, for the
     probe's A/B tests only: {el: element} reports only that bubble, {freeze: true/false} stops / restarts all drawing, {scale: 0.5 / 0}
     pins / releases the resolution, {atlas: [w, h]} resizes the shared WebGL canvas and re-runs the
     copy self-check on it, {check: true} re-runs the self-check. Nothing calls it on a normal visit. */
  function hexOf(c) { return c ? "#" + c.map(function (v) { return ("0" + Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16)).slice(-2); }).join("") : null; }
  function selOf(e) {
    if (!e || !e.tagName) return null;
    var c = typeof e.className === "string" ? e.className.trim().split(/\s+/).filter(Boolean).slice(0, 4) : [];
    return e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (c.length ? "." + c.join(".") : "");
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function debug(o) {
    o = o || {};
    var out = {};
    if ("freeze" in o) { DBG.freeze = !!o.freeze; if (!DBG.freeze) { items.forEach(function (x) { x.drawn = false; }); } kick(); }
    if ("scale" in o) { DBG.scale = o.scale || 0; if (DBG.scale) Q.scale = DBG.scale; items.forEach(function (x) { x.drawn = false; }); kick(); }
    if (o.atlas && gl && glc && !zooming) {
      ATLAS = [o.atlas[0], o.atlas[1]]; glc.width = ATLAS[0]; glc.height = ATLAS[1];
      out.atlasCheck = progReady ? selfCheck(true) : "not ready";
      items.forEach(function (x) { x.drawn = false; }); kick();
    }
    if (o.check && gl && progReady) out.check = selfCheck(true);
    /* {el, resizeTest: 0.8}: shrink that bubble's canvas to 80% and hold it there (what every resolution
       change used to do), {el, resizeTest: 0}: let it grow back. The probe looks at the screen in between. */
    if (o.el && o.resizeTest != null) {
      var rt = find(o.el);
      if (rt) {
        if (o.resizeTest) { rt.hold = true; rt.cv.width = Math.max(16, Math.round(rt.cv.width * o.resizeTest)); rt.cv.height = Math.max(16, Math.round(rt.cv.height * o.resizeTest)); }
        else rt.hold = false;
        rt.drawn = false; kick();
      }
    }
    var now = performance.now(), lost = null, maxTex = null;
    try { if (gl) { lost = gl.isContextLost(); maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE); } } catch (e) {}
    out.state = {
      ver: CODE_VER, tier: TIER, why: TIER_WHY, moveRing: MOVE_RING, staleMoves: staleMoves, q: { scale: r1(Q.scale * 10) / 10, fps: Q.fps }, dbg: { freeze: DBG.freeze, scale: DBG.scale },
      atlas: ATLAS.slice(), atlasMax: ATLAS_MAX.slice(), atlasGrow: STATS.atlasGrow || null, glc: glc ? [glc.width, glc.height] : null, dbuf: gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null,
      cal: CAL, gl: gl === false ? "off" : gl ? "on" : "not started", progReady: progReady, zReady: zReady, par: !!PAR, soft: SOFT, reduce: !!reduce,
      pace: { cadence: STATS.cadence || null, test: STATS.paceTest || null, bubblesAreTheCost: AT.bound, testing: !!AT.on, retestEvery: AT.every },
      zooming: zooming, frame: FR, simT: r1(simT), loopRunning: !!raf, items: items.length, contextLost: lost, maxTex: maxTex, dpr: window.devicePixelRatio || 1
    };
    if (o.items !== false) out.items = items.map(function (x, i) {
      if (o.el && x.el !== o.el) return null;   /* {el}: only that bubble (cheap enough to call mid-move) */
      var r = x.el.getBoundingClientRect(), cr = x.cv.getBoundingClientRect(), cs = getComputedStyle(x.cv), pe = x.el.parentElement;
      return {
        i: i, el: selOf(x.el), parent: selOf(pe), gp: selOf(pe && pe.parentElement), kind: kindOf(x), still: x.opts.still, glow: !!x.ref, splash: x.opts.splash,
        seed: r1(x.opts.seed), rect: [r.left, r.top, r.width, r.height].map(Math.round), cvRect: [cr.left, cr.top, cr.width, cr.height].map(r1),
        cv: [x.cv.width, x.cv.height], resizes: x.resizes || 0, hold: !!x.hold, lastWH: x.lastWH || null, lastSrc: x.lastSrc ? x.lastSrc.map(r1) : null, wh: [r1(x.w), r1(x.h)], bleed: x.bleed,
        clipped: x.clipped, host: selOf(x.host), rad: x.rad ? x.rad.map(function (v) { return Math.round(v * 1000) / 1000; }) : null, br: x.br, depth: x.depth, deep: x.deep, rb: x.rb,
        onScreen: x.onScreen, shown: x.shown, drawn: x.drawn, shownOnce: !!x.shownOnce, dirty: x.dirty, trans: x.trans, shapeT: x.shapeT || 0, ring: x.ring || false, moveMiss: x.moveMiss || 0,
        lastDrawAgo: x.lastDraw ? Math.round(now - x.lastDraw) : null, drawnF: x.drawnF || null, cols: x.cols.map(hexOf),
        cvCss: { opacity: cs.opacity, visibility: cs.visibility, display: cs.display, radius: cs.borderRadius, transform: cs.transform, inset: [cs.top, cs.right, cs.bottom, cs.left].join(" "), w: cs.width, h: cs.height }
      };
    }).filter(Boolean);
    return out;
  }
  window.RPBubble = {
    zoom: zoom, zoomStop: function (finish) { zoomStop(!!finish); },
    attach: attach, setLook: setLook, detach: detach, sprite: sprite, params: P, setParam: setParam, quality: Q,
    redraw: function () { items.forEach(function (x) { x.drawn = false; }); kick(); },
    supported: function () { return initGL(); },
    tier: function () { return { tier: TIER, why: TIER_WHY, moveRing: MOVE_RING }; },
    setTier: function (t) { if (t === "css") setTier(t, "set by the page", true, true); else setTier(t, "set by the page", true); },
    /* run f once the shaders are built (at once if they already are) */
    ready: function (f) { if (!initGL()) return; if (progReady) f(); else { readyCbs.push(f); kick(); } },
    stats: STATS,
    debug: debug,
    /* the internal canvas of a bubble element (the probe reads its pixels) */
    canvasOf: function (el) { var it = find(el); return it ? it.cv : null; }
  };
})();
