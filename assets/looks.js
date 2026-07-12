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

  function applyLooks(looks) {
    var byKey = {}, byCat = {}, byProj = {};
    looks.forEach(function (L) {
      if (!L || !L.key) return;
      byKey[L.key] = L;
      if (L.category) byCat[L.category] = L;
      if (L.project) byProj[L.project] = L;
    });

    // 1) signature -> :root gradient stops (bubble glows + shared conic gradients)
    var sig = byKey.signature;
    if (sig) {
      var rs = document.documentElement.style;
      if (hexOk(sig.c1)) rs.setProperty("--g1", sig.c1);
      if (hexOk(sig.c2)) rs.setProperty("--g2", sig.c2);
      if (hexOk(sig.c3)) rs.setProperty("--g3", sig.c3);
    }

    // 2) project focus-page accents are defined statically in index.html
    //    (.theme-<key>{--accent} + the ACCENT map on the carousel), so color looks
    //    are now purely 3 gradient colours (c1/c2/c3). Nothing to apply here.

    // 3) rentals category colours -> COL (app.js exposes the setter when present)
    try {
      if (typeof window.RP_setCategoryColors === "function") {
        var map = {};
        Object.keys(byCat).forEach(function (c) { if (hexOk(byCat[c].c1)) map[c] = byCat[c].c1; });
        window.RP_setCategoryColors(map);
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
    el.style.setProperty("--e1", hexOk(L.c1) ? L.c1 : "#3f6bff");
    el.style.setProperty("--e2", hexOk(L.c2) ? L.c2 : "#9b5cff");
    el.style.setProperty("--e3", hexOk(L.c3) ? L.c3 : "#56c8ff");
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
    Promise.all([
      fetch("/data/colorlooks.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch("/data/site.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      var looks = (res[0] && res[0].looks) || [];
      var byKey = applyLooks(looks);
      renderBanner(res[1] || {}, byKey);
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
