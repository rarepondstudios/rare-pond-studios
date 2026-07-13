/* Rare Pond - Color Looks + Event Banner (shared, both sites).
   SINGLE SOURCE OF TRUTH: reads /data/colorlooks.json and applies each look to the
   site's gradient CSS variables, so tweaking a look in Pages CMS propagates everywhere:
     - "signature"  -> :root --g1/--g2/--g3 (the studio bubble glows + shared gradients)
     - project looks -> .theme-<key> { --accent } (each project's focus page accent)
     - category looks -> rentals COL (via window.RP_setCategoryColors, if present)
   Then renders the CMS-toggleable event banner (site.json -> eventBanner) into
   #rp-eventbanner-mount, coloured by the chosen look. Fully defensive: any fetch or
   data failure leaves the site exactly as its static markup/CSS already is. */
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

  /* Build the CSS for one FILM look, applied to a given project.
     DIRECTION OF THE LINK: a look does not know who uses it. The consumer points
     at the look. projects.json says colorLook:"geri"; we look that up here. That
     way every screen in Pages CMS (Projects, Rentals, Event Banner) asks the same
     question - "which colour look?" - instead of Color Looks having to list every
     place it might be used.

     A film look has three semantic colours:
       accent -> the pop: kicker text, "Where to Watch" label, carousel glow
       main   -> the dominant background wash over the film's page
       tint   -> the softer secondary wash

     Every declaration mirrors a var() whose FALLBACK in index.html is the value
     the site originally shipped with, so CLEARING a field in the CMS restores the
     original look rather than blanking it out. That is the revert path. */
  function filmCss(projectKey, L) {
    var sel = ".theme-" + String(projectKey), d = [];
    if (hexOk(L.accent))        d.push("--accent:" + L.accent);
    var s1 = rgba(L.main, L.mainAlpha); if (s1) d.push("--scrim-1:" + s1);
    var s2 = rgba(L.tint, L.tintAlpha); if (s2) d.push("--scrim-2:" + s2);
    if (hexOk(L.kickerColor))   d.push("--kicker-color:" + L.kickerColor);
    if (L.kickerTracking)       d.push("--kicker-tracking:" + String(L.kickerTracking).replace(/[^0-9a-z.%-]/gi, ""));
    if (hexOk(L.taglineColor))  d.push("--tagline-color:" + L.taglineColor);
    d.push("--tagline-style:" + (L.taglineItalic ? "italic" : "normal"));
    if (hexOk(L.titleGradientFrom)) d.push("--title-from:" + L.titleGradientFrom);
    if (hexOk(L.titleGradientTo))   d.push("--title-to:" + L.titleGradientTo);
    return d.length ? (sel + "{" + d.join(";") + "}") : "";
  }

  /* looks: from colorlooks.json.  projects / rentals: the consumers that point at
     them. Both are optional - anything missing just falls back to the static CSS. */
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
        if (hexOk(byProj[k].accent)) accents[k] = byProj[k].accent;
      });
      window.RP_ACCENTS = accents;
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
        if (L && hexOk(L.c1)) colors[c.id] = L.c1;
      });
      window.RP_CATEGORY_MAP = { colors: colors, labels: labels, order: order };
      if (typeof window.RP_setCategories === "function") {
        window.RP_setCategories(window.RP_CATEGORY_MAP);
      } else if (typeof window.RP_setCategoryColors === "function") {
        window.RP_setCategoryColors(colors);   // older rentals build
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
      ".rp-evbanner .rp-evsheet{position:absolute;left:0;right:0;top:38px;height:170px;background:linear-gradient(180deg,var(--e1,#3f6bff),var(--e2,#9b5cff),var(--e3,#56c8ff));-webkit-mask:radial-gradient(150% 130% at 50% -28%,#000 60%,transparent 85%);mask:radial-gradient(150% 130% at 50% -28%,#000 60%,transparent 85%)}",
      // angle custom-prop so we can rotate the CONIC (not an oversized element) -> pinwheel fills its box, cheap on the GPU
      "@property --rpev-a{syntax:'<angle>';inherits:false;initial-value:0deg}",
      // animated glow rides on top of the colour sheet, clipped to the SAME curved shape
      ".rp-evbanner .rp-evglow{position:absolute;left:0;right:0;top:38px;height:170px;overflow:hidden;-webkit-mask:radial-gradient(150% 130% at 50% -28%,#000 60%,transparent 85%);mask:radial-gradient(150% 130% at 50% -28%,#000 60%,transparent 85%)}",
      ".rp-evbanner .rp-evglow::before{content:'';position:absolute;inset:-15%;filter:blur(24px);will-change:transform}",
      // PINWHEEL: conic fills the whole box; rotating the angle 0->360 loops with NO seam (starts/ends on --e1)
      ".rp-evbanner.rp-ev-pinwheel .rp-evglow::before{background:conic-gradient(from var(--rpev-a),var(--e1,#3f6bff),var(--e2,#9b5cff),var(--e3,#56c8ff),var(--e2,#9b5cff),var(--e1,#3f6bff));opacity:.5;animation:rpevspin 9s linear infinite}",
      "@keyframes rpevspin{to{--rpev-a:360deg}}",
      // STREAM: seamless CONVEYOR - a 200%-wide strip carrying TWO identical colour periods, slid left by exactly one period.
      // Because the two halves are identical, translateX(-50%) lands on a pixel-identical frame => no reset/seam ever.
      ".rp-evbanner.rp-ev-stream .rp-evglow::before{right:auto;width:200%;background:linear-gradient(90deg,var(--e1,#3f6bff),var(--e2,#9b5cff),var(--e3,#56c8ff),var(--e2,#9b5cff),var(--e1,#3f6bff),var(--e2,#9b5cff),var(--e3,#56c8ff),var(--e2,#9b5cff),var(--e1,#3f6bff));opacity:.42;animation:rpevstream 16s linear infinite}",
      // RAINBOW look selected -> paint the banner with the site's animated rainbow
      // instead of an e1/e2/e3 ramp. Same colours the "More to come" bubble uses.
      // PINWHEEL keeps the rotating conic. STREAM must be a LINEAR ramp that slides
      // sideways and loops - reusing the conic here was wrong: it just dragged the
      // centre of the pinwheel across instead of cycling through the colours.
      ".rp-evbanner.rp-ev-rainbow .rp-evsheet{background:linear-gradient(90deg,#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0,#ff5d5d)}",
      ".rp-evbanner.rp-ev-rainbow.rp-ev-pinwheel .rp-evglow::before{background:conic-gradient(from var(--rpev-a),#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0,#ff5d5d)!important;opacity:.5}",
      // The stream repeats the full spectrum twice and ends where it began, so the
      // 0% -> -50% slide is seamless and loops forever.
      ".rp-evbanner.rp-ev-rainbow.rp-ev-stream .rp-evglow::before{right:auto;width:200%;background:linear-gradient(90deg,#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0,#ff5d5d,#ffac5d,#ffe65d,#86ff7a,#5dffe0,#5da8ff,#b15dff,#ff5dd0,#ff5d5d)!important;opacity:.42;animation:rpevstream 16s linear infinite}",
      "@keyframes rpevstream{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
      // content is vertically CENTRED in a fixed band (top+bottom both anchored) via flex align-items:center.
      // This scoots the single-line copy UP a little and trims the reserved headroom, while on narrow screens - // where the title + button wrap to two lines - the taller block overflows the band symmetrically (grows
      // upward toward the header AND down), so it stays inside the coloured area instead of hanging below it.
      ".rp-evbanner .rp-evinner{position:absolute;left:0;right:0;top:104px;bottom:30px;z-index:3;max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:10px 22px;flex-wrap:wrap;padding:0 clamp(18px,5vw,60px);text-align:center}",
      ".rp-evbanner .rp-evtitle{font:800 clamp(15px,1.9vw,19px)/1.3 Heebo,system-ui,sans-serif;color:#fff;text-shadow:0 2px 12px rgba(0,6,22,.72);letter-spacing:.2px}",
      ".rp-evbanner .rp-evbtn{flex:none;padding:9px 20px;border-radius:10px;font:800 14px/1 Heebo,system-ui,sans-serif;text-decoration:none;color:#0c1836;background:#fff;box-shadow:0 6px 18px -5px rgba(0,0,0,.5);transition:transform .18s cubic-bezier(.3,.7,.2,1.4),box-shadow .22s,background .22s,color .22s}",
      ".rp-evbanner .rp-evbtn:hover{transform:translateY(-2px) scale(1.05);color:#fff;background:linear-gradient(120deg,var(--e1),var(--e2),var(--e3));box-shadow:0 0 0 3px rgba(255,255,255,.55),0 0 26px 6px rgba(255,255,255,.6),0 12px 26px -6px rgba(0,0,0,.45)}",
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
      return;
    }
    bannerCssOnce();
    var L = byKey[eb.colorLook] || byKey.signature || { c1: "#3f6bff", c2: "#9b5cff", c3: "#56c8ff" };
    var btn = eb.buttonText ? ('<a class="rp-evbtn" href="' + esc(safeLink(eb.buttonLink)) + '">' + esc(eb.buttonText) + "</a>") : "";
    var el = document.createElement("div");
    var style = (eb.gradientStyle === "pinwheel") ? "pinwheel" : "stream";  // per-place gradient control; default Stream for this wide header
    el.className = "rp-evbanner rp-ev-" + style;
    /* RAINBOW is the one look that is not three colours: it is the animated 9-stop
       conic gradient defined once as --rainbow in index.html (the same one the
       "More to come" bubble uses). Selecting it here paints the banner with that
       gradient instead of an e1/e2/e3 ramp. It is deliberately not editable. */
    if (L.kind === "rainbow" || eb.colorLook === "rainbow") {
      el.classList.add("rp-ev-rainbow");
    }
    /* The banner can point at ANY look now, and a film look stores its colours as
       accent/main/tint rather than c1/c2/c3. Normalise so either kind works. */
    var e1 = hexOk(L.c1) ? L.c1 : (hexOk(L.accent) ? L.accent : "#3f6bff");
    var e2 = hexOk(L.c2) ? L.c2 : (hexOk(L.main)   ? L.main   : e1);
    var e3 = hexOk(L.c3) ? L.c3 : (hexOk(L.tint)   ? L.tint   : e2);
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
      document.documentElement.style.setProperty("--evbanner-h", Math.max(0, bottom - hh + 24) + "px");
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
