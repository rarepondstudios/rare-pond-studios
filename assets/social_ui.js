/* ============================================================================
   Rare Pond / Jack Carlsen — SHARED social UI  (assets/social_ui.js)
   ----------------------------------------------------------------------------
   ONE source of truth for BOTH sites. Master lives in bts-automation/social_ui.js
   and is published to each repo's assets/social_ui.js by social_ui_sync.py
   (launchd com.rarepond.socialuisync). Edit the master, both sites update.

   It does two things, keyed off the markup both sites already emit
   (a[data-net] social links; .contact-bubble with --c1/--c2/--c3/--fg):

   1. CONTACT-BUBBLE look (#2). At REST the box is neutral glass with a subtle
      colour-matched outline glow, and only the CIRCULAR logo badge holds the
      brand gradient. On HOVER the gradient grows OUT of the logo (a clip-path
      circle centred on the badge) to fill the whole box; on mouse-away it
      retracts back into the logo circle.

   2. SOCIAL TRANSPORT (#3). Clicking ANY social link — header, footer, or a
      contact bubble, on either site — plays a full-screen circular wipe in that
      social's gradient, growing from the clicked icon, then opens the link in a
      NEW TAB and retracts (the site stays underneath). Header/footer icons carry
      no colour of their own, so we borrow the matching contact bubble's colours
      by data-net (the colour-look is still the single source; we just reuse it).

   Self-contained: injects its own CSS, guards against double-init, and degrades
   to normal link behaviour under reduced-motion / modified clicks.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__rpSocialUI) return;            // idempotent (defer + possible re-include)
  window.__rpSocialUI = true;

  var REDUCED = false;
  try { REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches; } catch (e) {}

  /* ---- CSS (both concerns) ---------------------------------------------- */
  function injectCSS() {
    if (document.getElementById("rp-social-ui-css")) return;
    var css =
      /* ===== #2 contact bubbles: rest = glass + outline glow, gradient in the round logo ===== */
      ".contact-bubble{position:relative;overflow:hidden;isolation:isolate;" +
      "background:rgba(9,20,44,.55)!important;" +
      "border:1px solid color-mix(in srgb,var(--c1,#3f6bff),transparent 55%);" +
      "box-shadow:0 8px 24px rgba(0,8,30,.34),0 0 20px -6px color-mix(in srgb,var(--c1,#3f6bff),transparent 45%);" +
      "color:#eef4ff;transition:transform .18s ease,box-shadow .3s ease,border-color .3s ease}" +
      ".contact-bubble:hover,.contact-bubble:focus-visible{transform:translateY(-3px);" +
      "border-color:color-mix(in srgb,var(--c1,#3f6bff),transparent 25%);" +
      "box-shadow:0 16px 34px rgba(0,8,30,.46),0 0 30px -6px color-mix(in srgb,var(--c1,#3f6bff),transparent 30%)}" +
      /* the gradient that grows out of the logo. A circle centred on the badge (≈37px in from the
         left, vertically centred); rest radius hugs the 42px badge, hover radius covers the box. */
      ".contact-bubble::before{content:'';position:absolute;inset:0;z-index:-1;" +
      "background:linear-gradient(135deg,var(--c1,#3f6bff),var(--c2,var(--c1,#3f6bff)),var(--c3,var(--c2,var(--c1,#3f6bff))));" +
      "clip-path:circle(22px at 37px 50%);-webkit-clip-path:circle(22px at 37px 50%);" +
      "transition:clip-path .5s cubic-bezier(.4,.7,.2,1),-webkit-clip-path .5s cubic-bezier(.4,.7,.2,1)}" +
      ".contact-bubble:hover::before,.contact-bubble:focus-visible::before{" +
      "clip-path:circle(150% at 37px 50%);-webkit-clip-path:circle(150% at 37px 50%)}" +
      /* logo badge: perfectly round, always holds the gradient, white/dark icon on top */
      ".contact-bubble .cbub-badge{width:42px;height:42px;border-radius:50%!important;" +
      "background:linear-gradient(135deg,var(--c1,#3f6bff),var(--c2,var(--c1,#3f6bff)),var(--c3,var(--c2,var(--c1,#3f6bff))))!important;" +
      "box-shadow:0 4px 14px -3px color-mix(in srgb,var(--c1,#3f6bff),transparent 25%)}" +
      ".contact-bubble .cbub-ico{background:var(--fg,#fff)}" +
      ".contact-bubble .cbub-badge svg{fill:var(--fg,#fff)}" +
      /* label/arrow: light on the glass at rest, flip to the gradient's contrast fg as it fills */
      ".contact-bubble .cbub-label{color:#eef4ff;transition:color .4s ease}" +
      ".contact-bubble .cbub-arrow{color:#cfe0f5;transition:color .4s ease,transform .18s ease}" +
      ".contact-bubble:hover .cbub-label,.contact-bubble:focus-visible .cbub-label," +
      ".contact-bubble:hover .cbub-arrow,.contact-bubble:focus-visible .cbub-arrow{color:var(--fg,#fff)}" +
      /* ===== #3 social transport wipe ===== */
      ".rp-soctransport{position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:1;" +
      "background:radial-gradient(circle at 50% 44%,var(--sc1,#3f6bff),var(--sc2,#3f6bff) 52%,var(--sc3,#9b5cff) 100%);" +
      "clip-path:circle(0px at var(--scx,50%) var(--scy,50%));-webkit-clip-path:circle(0px at var(--scx,50%) var(--scy,50%));" +
      "transition:clip-path .5s cubic-bezier(.66,0,.34,1),-webkit-clip-path .5s cubic-bezier(.66,0,.34,1),opacity .35s ease}" +
      ".rp-soctransport.go{clip-path:circle(160vmax at var(--scx,50%) var(--scy,50%));-webkit-clip-path:circle(160vmax at var(--scx,50%) var(--scy,50%))}" +
      ".rp-soctransport.done{opacity:0}";
    var s = document.createElement("style");
    s.id = "rp-social-ui-css";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---- colour resolution ------------------------------------------------- */
  function gv(el, name) {
    try { return (getComputedStyle(el).getPropertyValue(name) || "").trim(); } catch (e) { return ""; }
  }
  /* A header/footer icon has no colour of its own; borrow the matching contact bubble's
     colours by data-net (the colour-look stays the single source). Falls back to the site
     signature if there is no bubble on this page. */
  function colorsFor(a) {
    var c1 = gv(a, "--c1"), c2 = gv(a, "--c2"), c3 = gv(a, "--c3");
    if (!c1) {
      var net = a.getAttribute("data-net") || "";
      var esc = (window.CSS && CSS.escape) ? CSS.escape(net) : net.replace(/"/g, '\\"');
      var bub = net ? document.querySelector('.contact-bubble[data-net="' + esc + '"]') : null;
      if (bub) { c1 = gv(bub, "--c1"); c2 = gv(bub, "--c2"); c3 = gv(bub, "--c3"); }
    }
    c1 = c1 || "#3f6bff";
    return { c1: c1, c2: c2 || c1, c3: c3 || c2 || c1 };
  }

  /* ---- the wipe ---------------------------------------------------------- */
  var busy = false;
  function transport(a) {
    var href = a.getAttribute("href");
    var open = function () { try { window.open(href, "_blank", "noopener"); } catch (e) { location.href = href; } };
    if (REDUCED) { open(); return; }
    if (busy) { open(); return; }
    busy = true;
    var col = colorsFor(a);
    var r = a.getBoundingClientRect();
    var ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    var d = document.createElement("div");
    d.className = "rp-soctransport";
    d.style.setProperty("--scx", ox + "px");
    d.style.setProperty("--scy", oy + "px");
    d.style.setProperty("--sc1", col.c1);
    d.style.setProperty("--sc2", col.c2);
    d.style.setProperty("--sc3", col.c3);
    document.body.appendChild(d);
    var opened = false, cleaned = false;
    var doOpen = function () { if (opened) return; opened = true; open(); };
    var cleanup = function () {
      if (cleaned) return; cleaned = true;
      d.classList.add("done");
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); busy = false; }, 420);
    };
    // grow -> when covered, open the new tab, then retract + remove
    requestAnimationFrame(function () { requestAnimationFrame(function () { d.classList.add("go"); }); });
    var grew = false;
    d.addEventListener("transitionend", function (e) {
      if (e.propertyName.indexOf("clip-path") < 0) return;
      if (!grew) { grew = true; doOpen(); d.classList.remove("go"); }   // covered -> open + start retract
      else cleanup();                                                    // retracted -> remove
    });
    // safety net if transitionend is missed (background tab / interrupted)
    setTimeout(function () { doOpen(); }, 560);
    setTimeout(function () { cleanup(); }, 1500);
  }

  /* ---- delegated click on any social link -------------------------------- */
  function onClick(e) {
    var a = e.target.closest && e.target.closest("a[data-net]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#") return;             // not an outbound social link
    if (e.defaultPrevented) return;
    if (e.button === 1 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;  // honour open-in-new-tab etc.
    e.preventDefault();
    transport(a);
  }

  function init() {
    injectCSS();
    document.addEventListener("click", onClick, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
