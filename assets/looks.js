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
      if (L && hexOk(L.accent)) themeCss += ".theme-" + pk + "{--accent:" + L.accent + "}";
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
      ".rp-evbanner{position:relative;overflow:hidden;border-radius:14px;margin:14px auto 6px;max-width:1180px;width:calc(100% - 12px);border:1px solid rgba(255,255,255,.18);background:rgba(9,16,38,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 10px 34px -12px rgba(0,0,0,.55)}",
      ".rp-evbanner .rp-evglow{position:absolute;inset:-45%;z-index:0;background:conic-gradient(from 0deg,var(--e1,#3f6bff),var(--e2,#9b5cff),var(--e3,#56c8ff),var(--e2,#9b5cff),var(--e1,#3f6bff));filter:blur(34px);opacity:.5;animation:rpevspin 9s linear infinite}",
      "@keyframes rpevspin{to{transform:rotate(360deg)}}",
      ".rp-evbanner .rp-evbar{position:absolute;left:0;right:0;top:0;height:3px;z-index:1;background:linear-gradient(90deg,var(--e1),var(--e2),var(--e3),var(--e2),var(--e1));background-size:200% 100%;animation:rpevslide 6s linear infinite}",
      "@keyframes rpevslide{to{background-position:200% 0}}",
      ".rp-evbanner .rp-evinner{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:14px 22px;flex-wrap:wrap;padding:13px 22px;text-align:center}",
      ".rp-evbanner .rp-evtitle{font:800 clamp(15px,1.9vw,19px)/1.3 Heebo,system-ui,sans-serif;color:#fff;text-shadow:0 2px 12px rgba(0,6,22,.72);letter-spacing:.2px}",
      ".rp-evbanner .rp-evbtn{flex:none;padding:9px 20px;border-radius:10px;font:800 14px/1 Heebo,system-ui,sans-serif;text-decoration:none;color:#0c1836;background:#fff;box-shadow:0 6px 18px -5px rgba(0,0,0,.5);transition:transform .16s cubic-bezier(.3,.7,.2,1.4),box-shadow .2s}",
      ".rp-evbanner .rp-evbtn:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 12px 26px -6px rgba(0,0,0,.6)}",
      "@media(prefers-reduced-motion:reduce){.rp-evbanner .rp-evglow,.rp-evbanner .rp-evbar{animation:none}}"
    ].join("");
    var s = document.createElement("style"); s.id = "rp-ev-css"; s.textContent = css;
    document.head.appendChild(s);
  }

  function renderBanner(site, byKey) {
    var mount = document.getElementById("rp-eventbanner-mount");
    if (!mount) return;
    mount.innerHTML = "";
    var eb = (site && site.eventBanner) || {};
    if (!eb.enabled) return;              // OFF by default -> nothing renders
    bannerCssOnce();
    var L = byKey[eb.colorLook] || byKey.signature || { c1: "#3f6bff", c2: "#9b5cff", c3: "#56c8ff" };
    var btn = eb.buttonText ? ('<a class="rp-evbtn" href="' + esc(safeLink(eb.buttonLink)) + '">' + esc(eb.buttonText) + "</a>") : "";
    var el = document.createElement("div");
    el.className = "rp-evbanner";
    el.style.setProperty("--e1", hexOk(L.c1) ? L.c1 : "#3f6bff");
    el.style.setProperty("--e2", hexOk(L.c2) ? L.c2 : "#9b5cff");
    el.style.setProperty("--e3", hexOk(L.c3) ? L.c3 : "#56c8ff");
    el.innerHTML = '<div class="rp-evglow"></div><div class="rp-evbar"></div>' +
      '<div class="rp-evinner"><span class="rp-evtitle">' + esc(eb.title || "") + "</span>" + btn + "</div>";
    mount.appendChild(el);
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
