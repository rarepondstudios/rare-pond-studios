/* Rare Pond Rentals: the studio site's V3 three-tier bubble rim (assets/rp-bubble.js), here too
   (Jack, 2026-10-26: "bring the 3 tier look to rentals as well, at the same efficiency").

   Where it appears, and how it stays cheap:
   - the logo bubble on the rentals Home: a WHITE SPLASH behind the logo, the three tiers inside out
     (Jack, 2026-10-27): solid white under the logo, then a blurred 50% ring outside it, then a softer
     25% ring outside that, drawn by rp-bubble.js (opts.splash). STILL since 2026-10-27 (Jack: only the
     main site's project bubbles keep the wave / colour animation, everything else holds one frame).
   - a gear card under the pointer or the keyboard selection: a rim in that department's colour look
     (one still frame), made when the card is entered and LET GO of shortly after it is left, so a page
     of 100 cards never holds more than a couple of rims. It replaces the card's thin hover outline (the glow stays).
   - the open gear popup: a still rim (drawn once, redrawn only if its size changes) in the department
     look, around the whole panel.
   No WebGL (or reduced data paths that fail) = nothing changes: the old CSS outlines stay. */
(function () {
  if (!window.RPBubble || !RPBubble.supported()) return;
  document.documentElement.classList.add("rp-v3");

  function looks() { return window.RP_LOOKS || {}; }
  function sig() { var L = looks().signature; return (L && L.c1) ? L : { c1: "#3f6bff", c2: "#9b5cff", c3: "#56c8ff" }; }
  function lookOfCat(cat) {
    try {
      var cs = (window.RP_RENTALS && window.RP_RENTALS.categories) || [];
      for (var i = 0; i < cs.length; i++) if (cs[i] && cs[i].id === cat) {
        var L = looks()[cs[i].colorLook];
        if (L && L.c1) return { c1: L.c1, c2: L.c2 || L.c1, c3: L.c3 || L.c2 || L.c1 };
      }
    } catch (e) {}
    return null;
  }
  function lookOfEl(el) {
    var L = lookOfCat(el.getAttribute("data-cat") || "");
    if (L) return L;
    var cc = getComputedStyle(el).getPropertyValue("--cc").trim();
    return cc ? { c1: cc, c2: cc, c3: cc } : sig();
  }
  function rimIn(host, cls) {
    var r = document.createElement("div");
    r.className = "v3rim " + (cls || "");
    r.setAttribute("aria-hidden", "true");
    host.appendChild(r);
    return r;
  }

  /* ---- gear cards: a rim (one still frame) while hovered / keyboard-selected, released after ---- */
  var live = [];   /* {card, rim, t} */
  function cardOn(card) {
    for (var i = 0; i < live.length; i++) if (live[i].card === card) {
      clearTimeout(live[i].t); live[i].rim.classList.add("on"); return;
    }
    var rim = rimIn(card, "v3card");
    /* still: only the main site's project bubbles keep the wave / colour animation (Jack, 2026-10-27) */
    var ok = RPBubble.attach(rim, { look: lookOfEl(card), seed: Math.random() * 10, still: true });
    if (!ok) { rim.remove(); return; }
    requestAnimationFrame(function () { rim.classList.add("on"); });
    live.push({ card: card, rim: rim, t: 0 });
    while (live.length > 3) release(live[0], true);
  }
  function release(e, now) {
    var i = live.indexOf(e); if (i >= 0) live.splice(i, 1);
    clearTimeout(e.t);
    RPBubble.detach(e.rim); e.rim.remove();
  }
  function cardOff(card) {
    for (var i = 0; i < live.length; i++) if (live[i].card === card) {
      var e = live[i];
      e.rim.classList.remove("on");
      clearTimeout(e.t);
      e.t = setTimeout(function () { if (!e.rim.classList.contains("on")) release(e); }, 420);
      return;
    }
  }
  document.addEventListener("pointerover", function (ev) {
    if (ev.pointerType === "touch") return;
    var c = ev.target.closest && ev.target.closest(".card[data-open]");
    if (c && !(ev.relatedTarget && c.contains(ev.relatedTarget))) cardOn(c);
  }, { passive: true });
  document.addEventListener("pointerout", function (ev) {
    var c = ev.target.closest && ev.target.closest(".card[data-open]");
    if (c && !(ev.relatedTarget && c.contains(ev.relatedTarget))) cardOff(c);
  }, { passive: true });
  /* keyboard selection (assets/cursor.js .rpc-kbsel) */
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      var t = m.target;
      if (!t.classList || !t.classList.contains("card")) return;
      if (t.classList.contains("rpc-kbsel")) cardOn(t); else if (!t.matches(":hover")) cardOff(t);
    });
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });

  /* ---- the Home logo bubble and the gear popup: (re)attached whenever the page re-renders them ---- */
  function scan() {
    var lw = document.querySelector(".home .logowrap");
    if (lw && !lw.querySelector(".v3rim")) {
      var sp = rimIn(lw, "v3splash");
      if (RPBubble.attach(sp, { look: { c1: "#ffffff", c2: "#ffffff", c3: "#ffffff" }, seed: 3.3, ellipse: true, splash: true, still: true })) lw.classList.add("v3-splash");
      else sp.remove();
    }
    var dpc = document.querySelector("#dp.show .dpc");
    if (dpc && !dpc.querySelector(".v3rim")) {
      RPBubble.attach(rimIn(dpc, "v3dp"), { look: lookOfEl(dpc), seed: 6.1, still: true });
    }
  }
  var pend = 0;
  new MutationObserver(function () { if (!pend) pend = requestAnimationFrame(function () { pend = 0; scan(); }); })
    .observe(document.body, { subtree: true, childList: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan); else scan();
})();
