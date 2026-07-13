/* Rare Pond - Color Looks + Event Banner (shared, both sites).
   SINGLE SOURCE OF TRUTH for colour. Reads /data/colorlooks.json and applies it.

   HOW IT WORKS
     A look holds THREE colours (c1/c2/c3) plus, for a film, a set of TOKENS saying
     which of them to use where ("accent": "color2"). Nothing stores a hex twice.

     The link lives on the CONSUMER, not the look:
       projects.json  -> colorLook  -> a "film" look   -> .theme-<key> CSS variables
       rentals.json   -> categories -> a "basics" look -> the rentals category colours
       site.json      -> eventBanner-> any look        -> the event banner gradient

   NO FALLBACK COLOURS. Anything unassigned is left unset, and index.html renders
   unset as WHITE, on purpose, so a broken link is obvious instead of being papered
   over by a stale default. A fetch failure means no colour is applied at all - the
   page still works, it just goes white where a look should have been. */
(function () {
  "use strict";

  function hexOk(x) { return typeof x === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(x.trim()); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeLink(u) {
    u = String(u == null ? "" : u).trim();
    if (!u) return "#";
    if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u)) return u;
    return "/" + u.replace(/^\/+/, "");
  }

  /* #rrggbb + 0..1 alpha -> "rgba(r,g,b,a)". Returns "" if the hex is bad, so the
     caller can simply not set the variable and let the CSS fallback stand. */
  function rgba(hex, alpha) {
    if (!hexOk(hex)) return "";
    var h = hex.trim().replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var a = Number(alpha);
    if (!isFinite(a)) a = 1;
    a = Math.max(0, Math.min(1, a));
    return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," +
           parseInt(h.slice(4, 6), 16) + "," + a + ")";
  }

  /* ---- THE PALETTE ------------------------------------------------------------
     A look holds THREE colours: Color 1, Color 2, Color 3.
     Every use-case (accent, background wash, kicker, tagline, title...) does NOT
     store a hex. It stores a TOKEN naming which colour to use. That is why the CMS
     shows a dropdown instead of a hex box: you pick "Color 2", not "#bd9661".

     Change Color 2 once and everything pointing at it follows. That is the whole
     point of the system.

     Besides the look's own three colours, four fixed site colours are available:
       white / black, and the two blues the site's text actually uses.            */
  var FIXED = {
    white:     "#ffffff",
    black:     "#000000",
    lightBlue: "#eaf2ff",   // the light-on-dark text colour used across the site
    darkBlue:  "#0b2c55",   // --ink, the site's dark text colour
  };

  /* THE KINDS, and the order they are always grouped in:
       basics   - the site signature (its 3 colours are the shared gradient)
       special  - a colourway that CANNOT be built from three hex boxes, so it is
                  defined in code and locked in the CMS. See SPECIALS below.
       category - a rentals category colour (Color 1 is the one used)
       film     - a movie; the use-case tokens apply
     Nothing depends on the ORDER at runtime - a look is found by KEY, never by
     position. The order only decides how things group in the CMS and on the preview
     page. The colorlooks preview page has the same list; keep them in step. */
  var LOOK_ORDER = { basics: 0, special: 1, category: 2, film: 3 };

  /* ---- SPECIAL COLOURWAYS ------------------------------------------------------
     A "special" is any look that is not three flat colours - an animation, a
     multi-stop ramp, anything the built-in editor cannot express. It lives HERE, in
     code, and shows in Pages CMS as read-only, because there is nothing meaningful
     to type into a hex box.

     TO ADD A NEW SPECIAL - three steps, all in one place each:
       1. add an entry below, keyed by the look's ID
       2. add a look to data/colorlooks.json with that ID and  kind: "special"
       3. add its CSS to bannerCssOnce() below, as .rp-ev-<id>
     Everything else - grouping, the banner, the button hover, the preview page -
     picks it up automatically. Nothing else needs to change.

       btn:  the gradient the event-banner BUTTON uses on hover, so it always
             matches the banner rather than falling back to something invented.
       glow: the gradient a BUBBLE uses when a project's "Bubble glow uses this look"
             switch is on. It is a conic gradient starting "from var(--ang)", which is
             the angle the hue keyframes drive - so the pinwheel still spins on hover
             exactly like the signature glow does. First and last stop must match, or
             the spin shows a seam. */
  var SPECIALS = {
    rainbow: {
      label: "Rainbow",
      btn: "linear-gradient(120deg,#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0)",
      glow: "conic-gradient(from var(--ang),#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0,#ff5d5d)",
    },
    // futureSpecial: { label: "...", btn: "linear-gradient(...)", glow: "conic-gradient(from var(--ang),...)" },
  };
  function specialOf(L) {
    if (!L || L.kind !== "special") return null;
    return SPECIALS[L.key] || null;
  }

  /* token -> hex. Returns "" for anything unrecognised, and "" means UNASSIGNED,
     which the CSS renders as WHITE on purpose so the gap is obvious. */
  function pick(L, token) {
    if (!token) return "";
    var t = String(token).trim();
    if (t === "color1") return hexOk(L.c1) ? L.c1 : "";
    if (t === "color2") return hexOk(L.c2) ? L.c2 : "";
    if (t === "color3") return hexOk(L.c3) ? L.c3 : "";
    if (FIXED[t]) return FIXED[t];
    if (hexOk(t)) return t;      // tolerate a raw hex, in case someone typed one
    return "";
  }

  /* Build the CSS for one FILM look, applied to a given project.
     DIRECTION OF THE LINK: a look does not know who uses it. The consumer points
     at the look. projects.json says colorLook:"geri"; we look that up here. Every
     screen in Pages CMS (Projects, Rentals, Event Banner) asks the same question:
     "which colour look?"

     NO FALLBACK COLOURS. An unassigned or unrecognised value is left unset, and
     index.html renders unset as WHITE, so a mistake is visible instead of hidden. */
  function filmCss(projectKey, L) {
    var sel = ".theme-" + String(projectKey), d = [];
    var accent = pick(L, L.accent);
    if (accent) d.push("--accent:" + accent);
    var s1 = rgba(pick(L, L.main), L.mainAlpha); if (s1) d.push("--scrim-1:" + s1);
    var s2 = rgba(pick(L, L.tint), L.tintAlpha); if (s2) d.push("--scrim-2:" + s2);
    var kick = pick(L, L.kickerColor);   if (kick) d.push("--kicker-color:" + kick);
    if (L.kickerTracking) d.push("--kicker-tracking:" + String(L.kickerTracking).replace(/[^0-9a-z.%-]/gi, ""));
    var tag = pick(L, L.taglineColor);   if (tag)  d.push("--tagline-color:" + tag);
    d.push("--tagline-style:" + (L.taglineItalic ? "italic" : "normal"));
    var tf = pick(L, L.titleGradientFrom); if (tf) d.push("--title-from:" + tf);
    var tt = pick(L, L.titleGradientTo);   if (tt) d.push("--title-to:" + tt);
    return d.length ? (sel + "{" + d.join(";") + "}") : "";
  }

  /* looks: from colorlooks.json.  projects / rentals: the consumers that point at
     them. Both are optional - anything missing just falls back to the static CSS. */
  /* ===== BUBBLE GLOW =========================================================
     Pages CMS, per project: "Bubble glow uses this look" (default OFF).

     OFF - the bubble keeps the site signature glow. That colour comes from --g1/--g2/--g3
           on :root, so we simply leave the element alone.
     ON  - we set --g1/--g2/--g3 ON THE BUBBLE ELEMENT. Because .glow/.edge (grid) and
           .cglow/.cedge (carousel) all read those same three variables, overriding them
           locally recolours every layer of that bubble at once, with no new CSS.
     ON + a "special" look - three hex stops cannot express an animated eight-stop ramp,
           so we hand the whole gradient over in --rp-glow and let one CSS rule use it.

     One selector, [data-pk], covers the home carousel AND the projects grid, so the two
     can never drift apart - which is the whole point of the switch.
     Every property is REMOVED before anything is set, so switching back to OFF actually
     reverts instead of leaving the last colour stuck on. */
  var SAFE_KEY = /^[a-z0-9_-]+$/i;
  function applyBubbleGlow(projects, byKey) {
    (projects || []).forEach(function (p) {
      if (!p || !p.key || !SAFE_KEY.test(p.key)) return;
      var els = document.querySelectorAll('[data-pk="' + p.key + '"]');
      if (!els.length) return;
      var L  = p.bubbleGlow ? byKey[p.colorLook] : null;
      var sp = specialOf(L);
      Array.prototype.forEach.call(els, function (el) {
        el.classList.remove("rp-glow-special");
        ["--rp-glow", "--g1", "--g2", "--g3"].forEach(function (v) { el.style.removeProperty(v); });
        if (!L) return;                                   // switch off -> inherit the signature
        if (sp) {                                         // a special: hand over the whole gradient
          if (sp.glow) {
            el.style.setProperty("--rp-glow", sp.glow);
            el.classList.add("rp-glow-special");
          }
          return;
        }
        if (hexOk(L.c1)) el.style.setProperty("--g1", L.c1);
        if (hexOk(L.c2)) el.style.setProperty("--g2", L.c2);
        if (hexOk(L.c3)) el.style.setProperty("--g3", L.c3);
      });
    });
  }

  function applyLooks(looks, projects, rentals) {
    var byKey = {};
    looks.forEach(function (L) { if (L && L.key) byKey[L.key] = L; });

    // Resolve each PROJECT's chosen look. projects.json -> colorLook -> a film look.
    var byProj = {};
    (projects || []).forEach(function (p) {
      if (!p || !p.key) return;
      var L = byKey[p.colorLook];
      if (L && L.kind === "film") byProj[p.key] = L;
    });

    // 1) signature -> :root gradient stops (bubble glows + shared conic gradients)
    var sig = byKey.signature;
    if (sig) {
      var rs = document.documentElement.style;
      if (hexOk(sig.c1)) rs.setProperty("--g1", sig.c1);
      if (hexOk(sig.c2)) rs.setProperty("--g2", sig.c2);
      if (hexOk(sig.c3)) rs.setProperty("--g3", sig.c3);
    }

    // 1b) per-project bubble glow. Runs AFTER the signature above, because a project
    //     that opts in overrides those same variables on its own bubbles.
    try { applyBubbleGlow(projects, byKey); } catch (e) { /* signature glow stands */ }

    // 2) PROJECT LOOKS -> the film pages. This replaces the old "Theme" system:
    //    accent, scrim tints, kicker/tagline colour + style and title style all
    //    come from Color Looks now. We inject ONE stylesheet of custom properties;
    //    index.html's .theme-* rules read them with the original values as
    //    fallbacks, so if this never runs the site looks exactly as it always did.
    try {
      var css = Object.keys(byProj).map(function (k) { return filmCss(k, byProj[k]); })
                      .filter(Boolean).join("\n");
      if (css) {
        var tag = document.getElementById("rp-looks-css") || document.createElement("style");
        tag.id = "rp-looks-css";
        tag.textContent = css;
        document.head.appendChild(tag);
      }
      // The carousel sets --accent inline per item, and may have been built before
      // this fetch resolved, so re-apply to anything already on the page.
      var accents = {};
      Object.keys(byProj).forEach(function (k) {
        var a = pick(byProj[k], byProj[k].accent);
        if (a) accents[k] = a;
      });
      document.querySelectorAll(".citem[data-pk]").forEach(function (el) {
        var a = accents[el.getAttribute("data-pk")];
        if (a) el.style.setProperty("--accent", a);
      });
      // Title style: gradient-filled titles are opt-in per project.
      Object.keys(byProj).forEach(function (k) {
        document.querySelectorAll(".theme-" + k + " .u-title").forEach(function (t) {
          t.classList.toggle("u-title-gradient", byProj[k].titleStyle === "gradient");
        });
      });
    } catch (e) { /* leave the static theme CSS in charge */ }

    // 3) RENTALS CATEGORIES. Same direction as projects: rentals.json lists the
    //    categories and each one names the look it wants. The look itself knows
    //    nothing about rentals - it is just a named colour.
    //
    //      id       - the category string in the rentals DATABASE. Not editable
    //                 here; it is what groups the gear. Must match exactly.
    //      label    - what visitors see. Free to change without touching the DB.
    //      colorLook- which look supplies the colour.
    try {
      var cats = (rentals && rentals.categories) || [];
      var colors = {}, labels = {}, order = [];
      cats.forEach(function (c) {
        if (!c || !c.id) return;
        order.push(c.id);
        if (c.label) labels[c.id] = c.label;
        var L = byKey[c.colorLook];
        if (L && hexOk(L.c1)) colors[c.id] = L.c1;   // a basics look's Color 1 IS the category colour
      });
      window.RP_CATEGORY_MAP = { colors: colors, labels: labels, order: order };
      if (typeof window.RP_setCategories === "function") {
        window.RP_setCategories(window.RP_CATEGORY_MAP);
      }
    } catch (e) { /* leave categories as-is */ }

    window.RP_LOOKS = byKey;
    return byKey;
  }

  function bannerCssOnce() {
    if (document.getElementById("rp-ev-css")) return;
    var css = [
      // The mount stays in normal flow as a SPACER exactly as tall as the banner's visible content
      // (--evbanner-h, measured in JS), so it pushes the page's content down by the right amount on ANY
      // page regardless of how that page positions its content. 0 tall when no banner. Future-proof.
      "#rp-eventbanner-mount{position:static!important;height:var(--evbanner-h,0px)!important;max-width:none!important;width:auto!important;margin:0!important;padding:0!important}",
      // BANNER = a COLOUR copy of the header's own blob, sitting directly BEHIND the white header
      // (z below .site-header's z-index:300) and shifted DOWN so it peeks out below it. The white header
      // dissolves into the colour (white->colour), and the colour dissolves into the page (colour->page);
      // BOTH edges inherit the header's radial curve because the colour sheet reuses the header's exact
      // mask. Slides down from behind the header on load. Nothing sits between the two layers -> no gap/line.
      // z-index must sit BELOW the studio's project/team overlay (.universe, z-index:100) so that overlay
      // (which is opaque) fully covers the banner and its "Back to the pond" button stays clickable - while
      // still sitting ABOVE all normal page content (studio content maxes ~z-11, rentals cards ~z-5) and
      // BELOW the header (z-300) and every modal (2000+). 90 satisfies all of these on both sites.
      ".rp-evbanner{position:fixed;top:0;left:0;right:0;z-index:90;height:170px;overflow:visible;background:transparent;transform:translateY(-101%);transition:transform .72s cubic-bezier(.2,.8,.24,1);will-change:transform}",
      ".rp-evbanner.rp-ev-in{transform:translateY(0)}",
      // the colour sheet: SAME radial mask as .hdr-bg (identical curve, thickest at centre), shifted down
      // 38px so its opaque body + curved falloff extend below the fully-opaque white header.
      ".rp-evbanner .rp-evsheet{position:absolute;left:0;right:0;top:38px;height:170px;background:linear-gradient(180deg,var(--e1,#ffffff),var(--e2,#ffffff),var(--e3,#ffffff));-webkit-mask:radial-gradient(150% 130% at 50% -28%,#000 60%,transparent 85%);mask:radial-gradient(150% 130% at 50% -28%,#000 60%,transparent 85%)}",
      // angle custom-prop so we can rotate the CONIC (not an oversized element) -> pinwheel fills its box, cheap on the GPU
      "@property --rpev-a{syntax:'<angle>';inherits:false;initial-value:0deg}",
      // animated glow rides on top of the colour sheet, clipped to the SAME curved shape
      ".rp-evbanner .rp-evglow{position:absolute;left:0;right:0;top:38px;height:170px;overflow:hidden;-webkit-mask:radial-gradient(150% 130% at 50% -28%,#000 60%,transparent 85%);mask:radial-gradient(150% 130% at 50% -28%,#000 60%,transparent 85%)}",
      ".rp-evbanner .rp-evglow::before{content:'';position:absolute;inset:-15%;filter:blur(24px);will-change:transform}",
      // PINWHEEL: conic fills the whole box; rotating the angle 0->360 loops with NO seam (starts/ends on --e1)
      ".rp-evbanner.rp-ev-pinwheel .rp-evglow::before{background:conic-gradient(from var(--rpev-a),var(--e1,#ffffff),var(--e2,#ffffff),var(--e3,#ffffff),var(--e2,#ffffff),var(--e1,#ffffff));opacity:.5;animation:rpevspin 9s linear infinite}",
      "@keyframes rpevspin{to{--rpev-a:360deg}}",
      // STREAM: seamless CONVEYOR - a 200%-wide strip carrying TWO identical colour periods, slid left by exactly one period.
      // Because the two halves are identical, translateX(-50%) lands on a pixel-identical frame => no reset/seam ever.
      ".rp-evbanner.rp-ev-stream .rp-evglow::before{background:linear-gradient(90deg,var(--e1,#ffffff),var(--e2,#ffffff),var(--e3,#ffffff),var(--e2,#ffffff),var(--e1,#ffffff));background-size:50% 100%;background-repeat:repeat;opacity:.42;animation:rpevstream 16s linear infinite;will-change:background-position}",
      // RAINBOW look selected -> paint the banner with the site's animated rainbow
      // instead of an e1/e2/e3 ramp. Same colours the "More to come" bubble uses.
      // PINWHEEL keeps the rotating conic. STREAM must be a LINEAR ramp that slides
      // sideways and loops - reusing the conic here was wrong: it just dragged the
      // centre of the pinwheel across instead of cycling through the colours.
      ".rp-evbanner.rp-ev-rainbow .rp-evsheet{background:linear-gradient(90deg,#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0,#ff5d5d)}",
      ".rp-evbanner.rp-ev-rainbow.rp-ev-pinwheel .rp-evglow::before{background:conic-gradient(from var(--rpev-a),#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0,#ff5d5d)!important;opacity:.5}",
      // The stream repeats the full spectrum twice and ends where it began, so the
      // 0% -> -50% slide is seamless and loops forever.
      ".rp-evbanner.rp-ev-rainbow.rp-ev-stream .rp-evglow::before{background:linear-gradient(90deg,#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0,#ff5d5d)!important;background-size:50% 100%!important;background-repeat:repeat!important;opacity:.42;animation:rpevstream 16s linear infinite}",
      "@keyframes rpevstream{from{background-position:0% 0}to{background-position:100% 0}}",
      // content is vertically CENTRED in a fixed band (top+bottom both anchored) via flex align-items:center.
      // This scoots the single-line copy UP a little and trims the reserved headroom, while on narrow screens - // where the title + button wrap to two lines - the taller block overflows the band symmetrically (grows
      // upward toward the header AND down), so it stays inside the coloured area instead of hanging below it.
      ".rp-evbanner .rp-evinner{position:absolute;left:0;right:0;top:104px;bottom:30px;z-index:3;max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:10px 22px;flex-wrap:wrap;padding:0 clamp(18px,5vw,60px);text-align:center}",
      ".rp-evbanner .rp-evtitle{font:800 clamp(15px,1.9vw,19px)/1.3 Heebo,system-ui,sans-serif;color:#fff;text-shadow:0 2px 12px rgba(0,6,22,.72);letter-spacing:.2px}",
      ".rp-evbanner .rp-evbtn{flex:none;padding:9px 20px;border-radius:10px;font:800 14px/1 Heebo,system-ui,sans-serif;text-decoration:none;color:#0c1836;background:#fff;box-shadow:0 6px 18px -5px rgba(0,0,0,.5);transition:transform .18s cubic-bezier(.3,.7,.2,1.4),box-shadow .22s,background .22s,color .22s}",
      /* The button's hover gradient is --ev-btn, set in JS from the SAME look the rest
         of the banner uses - including Rainbow. It used to be hardcoded to
         linear-gradient(120deg, var(--e1), var(--e2), var(--e3)), which broke on the
         Rainbow look: rainbow has no Color 1/2/3, so e1/e2/e3 silently fell back to the
         old signature blues and the button hovered blue on a rainbow banner. */
      ".rp-evbanner .rp-evbtn:hover{transform:translateY(-2px) scale(1.05);color:#fff;background:var(--ev-btn);box-shadow:0 0 0 3px rgba(255,255,255,.55),0 0 26px 6px rgba(255,255,255,.6),0 12px 26px -6px rgba(0,0,0,.45)}",
      "@media(prefers-reduced-motion:reduce){.rp-evbanner{transition:none}.rp-evbanner .rp-evglow::before{animation:none}}"
    ].join("");
    var s = document.createElement("style"); s.id = "rp-ev-css"; s.textContent = css;
    document.head.appendChild(s);
  }

  function renderBanner(site, byKey) {
    var mount = document.getElementById("rp-eventbanner-mount");
    if (!mount) return;
    mount.innerHTML = "";
    var eb = (site && site.eventBanner) || {};
    if (!eb.enabled) {                    // OFF by default -> nothing renders, reclaim the reserved space
      document.documentElement.style.setProperty("--evbanner-h", "0px");
      document.documentElement.classList.remove("rp-ev-active");
      // ...and forget the cached height, so the next page load does not reserve space
      // for a banner that is no longer there.
      if (window.RP_rememberBannerHeight) window.RP_rememberBannerHeight(0);
      return;
    }
    bannerCssOnce();
    /* If the banner points at a look that does not exist, fall back to the Signature -
       and if even that is missing, to nothing, which renders WHITE. No invented colours. */
    var L = byKey[eb.colorLook] || byKey.signature || {};
    var btn = eb.buttonText ? ('<a class="rp-evbtn" href="' + esc(safeLink(eb.buttonLink)) + '">' + esc(eb.buttonText) + "</a>") : "";
    var el = document.createElement("div");
    var style = (eb.gradientStyle === "pinwheel") ? "pinwheel" : "stream";  // per-place gradient control; default Stream for this wide header
    el.className = "rp-evbanner rp-ev-" + style;
    /* A SPECIAL look is not three colours (Rainbow is the first one). Its CSS lives in
       bannerCssOnce() as .rp-ev-<id>, so adding a new special needs no change here. */
    var special = specialOf(L);
    if (special) el.classList.add("rp-ev-" + L.key);

    /* NO HIDDEN FALLBACK COLOURS. This used to fall back to #3f6bff/#9b5cff/#56c8ff -
       the old signature blues - whenever a look had no Color 1/2/3. The Rainbow look
       has none, so the banner painted itself rainbow (via .rp-ev-rainbow) while the
       BUTTON still hovered in phantom blue. Unassigned now means white, the same rule
       as everywhere else on the site, so a gap is visible instead of disguised. */
    var e1 = hexOk(L.c1) ? L.c1 : "#ffffff";
    var e2 = hexOk(L.c2) ? L.c2 : e1;
    var e3 = hexOk(L.c3) ? L.c3 : e2;

    /* ONE gradient, shared by every part of the banner - sheet, glow AND the button's
       hover. Whatever the look is, special or not, they cannot disagree. */
    el.style.setProperty("--ev-btn", special
      ? special.btn
      : ("linear-gradient(120deg," + e1 + "," + e2 + "," + e3 + ")"));
    el.style.setProperty("--e1", e1);
    el.style.setProperty("--e2", e2);
    el.style.setProperty("--e3", e3);
    el.innerHTML = '<div class="rp-evsheet"></div><div class="rp-evglow"></div>' +
      '<div class="rp-evinner"><span class="rp-evtitle">' + esc(eb.title || "") + "</span>" + btn + "</div>";
    mount.appendChild(el);
    document.documentElement.classList.add("rp-ev-active");
    // reserve room below the header for the banner's VISIBLE content (auto-sizes: measures where the content
    // ends, relative to the header height), then reveal it sliding out from behind the header.
    var setH = function () {
      var inner = el.querySelector(".rp-evinner");
      var hh = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h"), 10) || 86;
      var bottom = inner ? (inner.offsetTop + inner.offsetHeight) : 150;
      var px = Math.max(0, bottom - hh + 24);
      document.documentElement.style.setProperty("--evbanner-h", px + "px");
      /* Remember it, so the NEXT page load can reserve this space before it paints and
         the page does not visibly jump down when the banner arrives. See
         assets/banner-reserve.js. This is a cache, never the source of truth. */
      if (window.RP_rememberBannerHeight) window.RP_rememberBannerHeight(px);
    };
    setH();
    try { window.removeEventListener("resize", window.__rpEvResize); } catch (e) {}
    window.__rpEvResize = setH;
    window.addEventListener("resize", setH);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("rp-ev-in"); setH(); }); });
  }

  function init() {
    var get = function (u) {
      return fetch(u, { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    };
    /* The consumers are fetched alongside the looks, because the link now lives on
       the consumer: projects.json says which look each film wants, rentals.json
       says which look each category wants, site.json says which look the banner
       wants. Any of them failing just means that consumer keeps its static look. */
    Promise.all([
      get("/data/colorlooks.json"),
      get("/data/site.json"),
      get("/data/projects.json"),
      get("/data/rentals.json")
    ]).then(function (res) {
      var looks    = (res[0] && res[0].looks) || [];
      var site     = res[1] || {};
      var projects = (res[2] && (res[2].projects || res[2])) || [];
      var rentals  = res[3] || {};
      var byKey = applyLooks(looks, projects, rentals);
      renderBanner(site, byKey);
    }).catch(function () { /* silent: site keeps its static look */ });
  }

  // expose so a site can re-render the banner after its own late DOM work
  window.RP_renderEventBanner = function () {
    fetch("/data/site.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (site) { renderBanner(site || {}, window.RP_LOOKS || {}); }).catch(function () {});
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
