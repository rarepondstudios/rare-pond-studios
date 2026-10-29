/* RARE POND SOCIAL ICONS, V3 (2026-10-28, Jack: "new versions of the social media icons ... inherit a
   version of the three tier bubble look, but inverted to make the center solid. add these into the code
   of the website, re-creating them so they can be edited on the site itself, rather than directly
   referencing the files"). Rare Pond only (rarepond.com: Studio, Rentals, Media); jackcarlsen.com keeps
   its own icons.

   The design (brand kit: Static Graphics/Social Media Icons/RP_*_CIRCLE.png and the animated versions):
   a solid disc in the network's colours, light at the top left to deep at the bottom right, its white
   glyph on top, and outside the disc the bubble's tiers turned inside out: a blurred 50% ring and a
   softer 25% ring with wobbling edges. Built here from parts, nothing is an image:
     - the glyph: assets/socials.js (RP_SOCIAL_ICONS), the same artwork as before
     - the colours: the network's COLOUR LOOK (data/colorlooks.json, edited in NocoDB: youtube,
       instagram, linkedin, facebook, tiktok, vimeo, ...), defaults below until the looks have loaded
     - the rings: rp-bubble.js in SPLASH mode (the same inside-out tiers as the Rentals logo bubble), one
       still frame at rest; the rings wobble while the icon is hovered (Jack: "still, wobble on hover").
       Without WebGL (or on a page without rp-bubble.js, e.g. Media) the rings are a soft CSS glow.
   Where: the header icons, the footer icons and the phone menu (not a team member's own links).
   Styling: assets/chrome.css ("RARE POND SOCIAL ICONS, V3"). */
(function () {
  "use strict";
  var SEL = ".rp-soc:not(.m-links) a[data-net], .rp-footer .fsoc a[data-net], #mFootSoc a[data-net]";
  /* network -> colour look, and which of its colours go where: g = the disc's gradient (top left ->
     bottom right), r = the rings. Defaults = those looks' values on 2026-10-28. */
  var NET = {
    yt: { look: "youtube", g: [3, 1, 2], r: 1, d: ["#ff0000", "#c70000", "#ff2424"] },
    ig: { look: "instagram", g: [3, 2, 1], r: 2, d: ["#f9ce34", "#ee2a7b", "#6228d7"] },
    li: { look: "linkedin", g: [3, 1, 2], r: 1, d: ["#0a66c2", "#085097", "#2c7bcb"] },
    fb: { look: "facebook", g: [3, 1, 2], r: 1, d: ["#1877f2", "#135dbd", "#388af4"] },
    tiktok: { look: "tiktok", g: [3, 2, 2], r: 2, d: ["#25f4ee", "#000000", "#fe2c55"] },
    vimeo: { look: "vimeo", g: [3, 1, 2], r: 1, d: ["#1ab7ea", "#148fb7", "#3ac1ed"] },
    imdb: { look: "imdb", g: [3, 1, 2], r: 1, d: ["#f5c518", "#bf9a13", "#f6cd38"] },
    x: { look: "", g: [3, 1, 2], r: 1, d: ["#111111", "#000000", "#3a3a3a"] },
    threads: { look: "", g: [3, 1, 2], r: 1, d: ["#111111", "#000000", "#3a3a3a"] },
    web: { look: "signature", g: [3, 1, 2], r: 1, d: ["#3f6bff", "#9b5cff", "#56c8ff"] }
  };
  function hexRGB(h) {
    h = String(h || "").replace("#", ""); if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
    var n = parseInt(h.slice(0, 6), 16); return isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function colsOf(net) {
    var c = NET[net] || NET.web, L = (window.RP_LOOKS || {})[c.look];
    var v = (L && L.c1) ? [L.c1, L.c2 || L.c1, L.c3 || L.c2 || L.c1] : c.d;
    return { g: c.g.map(function (i) { return v[i - 1]; }), r: v[c.r - 1] };
  }
  var GL = !!(window.RPBubble && RPBubble.supported && RPBubble.supported());
  var rings = [];
  function paint(a) {
    var k = colsOf(a.getAttribute("data-net")), rgb = hexRGB(k.r).join(",");
    a.style.setProperty("--s1", k.g[0]); a.style.setProperty("--s2", k.g[1]); a.style.setProperty("--s3", k.g[2]);
    a.style.setProperty("--sr50", "rgba(" + rgb + ",.5)"); a.style.setProperty("--sr25", "rgba(" + rgb + ",.25)");
    a.__soc3 = k.r;
  }
  function make(a) {
    if (a.classList.contains("soc3")) return;
    a.classList.add("soc3");
    paint(a);
    var ring = document.createElement("span"); ring.className = "soc3-ring"; ring.setAttribute("aria-hidden", "true");
    var face = document.createElement("span"); face.className = "soc3-face"; face.setAttribute("aria-hidden", "true");
    a.insertBefore(face, a.firstChild); a.insertBefore(ring, a.firstChild);
    if (GL) {
      var ok = RPBubble.attach(ring, {
        look: { c1: a.__soc3, c2: a.__soc3, c3: a.__soc3 }, splash: true, bleed: 16, seed: Math.random() * 10,
        liveWhen: function () { return a.matches(":hover") || a.matches(":focus-visible"); }
      });
      if (ok) { a.classList.add("soc3-gl"); rings.push(ring); }
    }
  }
  /* rings of icons that left the page (the phone menu rebuilds its icons on every open) are let go */
  function sweep() {
    for (var i = rings.length - 1; i >= 0; i--) if (!rings[i].isConnected) { try { RPBubble.detach(rings[i]); } catch (e) {} rings.splice(i, 1); }
  }
  function scan() { sweep(); var l = document.querySelectorAll(SEL); for (var i = 0; i < l.length; i++) make(l[i]); }
  /* the colour looks arrive after the icons: repaint once they are there (the rings too) */
  var looked = false;
  function relook() {
    if (looked || !window.RP_LOOKS) return; looked = true;
    var l = document.querySelectorAll("a.soc3");
    for (var i = 0; i < l.length; i++) {
      var a = l[i], was = a.__soc3; paint(a);
      if (a.__soc3 !== was && a.classList.contains("soc3-gl")) {
        var r = a.querySelector(".soc3-ring");
        try { RPBubble.detach(r); RPBubble.attach(r, { look: { c1: a.__soc3, c2: a.__soc3, c3: a.__soc3 }, splash: true, bleed: 16, seed: Math.random() * 10, liveWhen: function () { return this.matches(":hover"); }.bind(a) }); } catch (e) {}
      }
    }
  }
  var pend = 0;
  new MutationObserver(function () { if (!pend) pend = requestAnimationFrame(function () { pend = 0; scan(); relook(); }); })
    .observe(document.documentElement, { subtree: true, childList: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan); else scan();
  addEventListener("load", relook);
  var tries = 0; (function poll() { relook(); if (!looked && tries++ < 20) setTimeout(poll, 300); })();
})();
