/* Rare Pond — Color Looks + Event Banner (shared, both sites).
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

    // 2) project looks -> each project's focus-page accent (.theme-<key>{--accent})
    var themeCss = "";
    Object.keys(byProj).forEach(function (pk) {
      var L = byProj[pk];
      if (L && hexOk(L.accent)) themeCss += ".theme-" + pk + "{--accent:" + L.accent + "}.citem[data-pk='" + pk + "']{--accent:" + L.accent + "!important}";
    });
    if (themeCss) {
      var st = document.getElementById("rp-look-theme") || document.createElement("style");
      st.id = "rp-look-theme";
      st.textContent = themeCss;
      if (!st.parentNode) document.head.appendChild(st);
    }

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
      // The banner itself is position:fixed (visually pinned under the header). The mount stays in normal flow as a
      // spacer exactly as tall as the banner (--evbanner-h, set from JS), so it pushes the page's content down by the
      // right amount on ANY page — regardless of how that page positions its content. 0 tall when no banner. Future-proof.
      "#rp-eventbanner-mount{position:static!important;height:var(--evbanner-h,0px)!important;max-width:none!important;width:auto!important;margin:0!important;padding:0!important}",
      // BANNER = full-width extension of the header, pinned directly beneath it (identical on every page). Slides down from behind the header on load; bottom falls off into the page.
      ".rp-evbanner{position:fixed;top:var(--header-h,86px);left:0;right:0;z-index:200;overflow:hidden;background:rgba(9,16,38,.42);-webkit-backdrop-filter:blur(9px) saturate(1.2);backdrop-filter:blur(9px) saturate(1.2);padding-bottom:18px;transform:translateY(-101%);transition:transform .72s cubic-bezier(.2,.8,.24,1);will-change:transform;-webkit-mask:linear-gradient(180deg,#000 0,#000 58%,transparent 100%);mask:linear-gradient(180deg,#000 0,#000 58%,transparent 100%)}",
      ".rp-evbanner.rp-ev-in{transform:translateY(0)}",
      // angle custom-prop so we can rotate the CONIC (not an oversized element) -> pinwheel fills its box, cheap on the GPU
      "@property --rpev-a{syntax:'<angle>';inherits:false;initial-value:0deg}",
      ".rp-evbanner .rp-evglow{position:absolute;inset:-15%;z-index:0;overflow:hidden}",
      ".rp-evbanner .rp-evglow::before{content:'';position:absolute;top:0;bottom:0;left:0;right:0;filter:blur(24px);will-change:transform}",
      // PINWHEEL: conic fills the whole box; rotating the angle 0->360 loops with NO seam (it starts and ends on --e1)
      ".rp-evbanner.rp-ev-pinwheel .rp-evglow::before{background:conic-gradient(from var(--rpev-a),var(--e1,#3f6bff),var(--e2,#9b5cff),var(--e3,#56c8ff),var(--e2,#9b5cff),var(--e1,#3f6bff));opacity:.55;animation:rpevspin 9s linear infinite}",
      "@keyframes rpevspin{to{--rpev-a:360deg}}",
      // STREAM: seamless CONVEYOR — a 200%-wide strip carrying TWO identical colour periods, slid left by exactly one period.
      // Because the two halves are identical, translateX(-50%) lands on a pixel-identical frame => no reset/seam ever.
      ".rp-evbanner.rp-ev-stream .rp-evglow::before{right:auto;width:200%;background:linear-gradient(90deg,var(--e1,#3f6bff),var(--e2,#9b5cff),var(--e3,#56c8ff),var(--e2,#9b5cff),var(--e1,#3f6bff),var(--e2,#9b5cff),var(--e3,#56c8ff),var(--e2,#9b5cff),var(--e1,#3f6bff));opacity:.6;animation:rpevstream 16s linear infinite}",
      "@keyframes rpevstream{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
      // top accent bar uses the same seamless conveyor
      ".rp-evbanner .rp-evbar{position:absolute;left:0;right:0;top:0;height:3px;z-index:1;overflow:hidden}",
      ".rp-evbanner .rp-evbar::before{content:'';position:absolute;top:0;bottom:0;left:0;width:200%;background:linear-gradient(90deg,var(--e1),var(--e2),var(--e3),var(--e2),var(--e1),var(--e2),var(--e3),var(--e2),var(--e1));animation:rpevstream 16s linear infinite}",
      ".rp-evbanner .rp-evinner{position:relative;z-index:2;max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:12px 22px;flex-wrap:wrap;padding:12px clamp(18px,5vw,60px) 4px;text-align:center}",
      ".rp-evbanner .rp-evtitle{font:800 clamp(15px,1.9vw,19px)/1.3 Heebo,system-ui,sans-serif;color:#fff;text-shadow:0 2px 12px rgba(0,6,22,.72);letter-spacing:.2px}",
      ".rp-evbanner .rp-evbtn{flex:none;padding:9px 20px;border-radius:10px;font:800 14px/1 Heebo,system-ui,sans-serif;text-decoration:none;color:#0c1836;background:#fff;box-shadow:0 6px 18px -5px rgba(0,0,0,.5);transition:transform .16s cubic-bezier(.3,.7,.2,1.4),box-shadow .2s}",
      ".rp-evbanner .rp-evbtn:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 12px 26px -6px rgba(0,0,0,.6)}",
      "@media(prefers-reduced-motion:reduce){.rp-evbanner{transition:none}.rp-evbanner .rp-evglow::before,.rp-evbanner .rp-evbar::before{animation:none}}"
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
    el.innerHTML = '<div class="rp-evglow"></div><div class="rp-evbar"></div>' +
      '<div class="rp-evinner"><span class="rp-evtitle">' + esc(eb.title || "") + "</span>" + btn + "</div>";
    mount.appendChild(el);
    // reserve room below the header for the banner (auto-sizes to its content), then reveal it sliding out from behind the header
    var setH = function () { document.documentElement.style.setProperty("--evbanner-h", (el.offsetHeight || 0) + "px"); };
    setH();
    try { window.removeEventListener("resize", window.__rpEvResize); } catch (e) {}
    window.__rpEvResize = setH;
    window.addEventListener("resize", setH);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("rp-ev-in"); }); });
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
