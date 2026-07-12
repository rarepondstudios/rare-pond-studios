/* Rare Pond Rentals - date-aware availability overlay.
   ADDITIVE + SAFE: reads Supabase availability for the customer's chosen dates
   and annotates the catalog. Touches nothing in app.js; remove the <script>
   include in rentals/index.html to fully disable. Loaded right AFTER app.js so
   SB_URL, SB_KEY, RENTALS and render() already exist.

   What it does, per product card (.card[data-open]):
     - kind = package                -> hide the card (packages get their own
                                        rendering later; hidden for now so a raw
                                        package row never shows as a broken card)
   And once dates are chosen, for item cards:
     - all copies in-repair/missing  -> hide the card entirely
     - no copy free for those dates  -> "Booked out for these dates" + disable Add
     - otherwise                     -> "N available" badge, Add stays enabled
   It re-applies after every render() (category switch, search) and whenever the
   shared date range changes (window.RPDates.onChange). */
(function () {
  "use strict";

  var AVAIL = null;              // map: lowercased item name -> availability row
  var PKG = null;               // set of lowercased package names (to hide for now)

  function creds() {
    var url = (typeof SB_URL !== "undefined") ? SB_URL : (window.SB_URL || "");
    var key = (typeof SB_KEY !== "undefined") ? SB_KEY : (window.SB_KEY || "");
    return { url: url, key: key };
  }

  function sbGet(path) {
    var c = creds();
    if (!c.url || !c.key) return Promise.resolve(null);
    return fetch(c.url.replace(/\/$/, "") + path, {
      headers: { apikey: c.key, Authorization: "Bearer " + c.key }
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function fetchAvail(start, end) {
    var c = creds();
    if (!c.url || !c.key) return Promise.resolve(null);
    return fetch(c.url.replace(/\/$/, "") + "/rest/v1/rpc/catalog_availability", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.key, Authorization: "Bearer " + c.key },
      body: JSON.stringify({ p_start: start, p_end: end })
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function loadPackages() {
    return sbGet("/rest/v1/items?select=name&kind=eq.package").then(function (rows) {
      PKG = {};
      if (Array.isArray(rows)) rows.forEach(function (r) { PKG[(r.name || "").trim().toLowerCase()] = true; });
    });
  }

  function toMap(rows) {
    var m = {};
    if (Array.isArray(rows)) rows.forEach(function (r) { m[(r.name || "").trim().toLowerCase()] = r; });
    return m;
  }

  function fmtNice(d){ try{ var p=String(d).split("-"); var dt=new Date(+p[0],+p[1]-1,+p[2]); return dt.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }catch(e){ return String(d); } }

  function currentRange() {
    try {
      var g = window.RPDates.get();
      if (g && g.start && g.end) return { start: g.start, end: g.end };
    } catch (e) {}
    return null;
  }

  function apply() {
    var cards = document.querySelectorAll(".card[data-open]");
    cards.forEach(function (card) {
      // reset any prior overlay marks so re-applies are idempotent
      card.style.display = "";
      var banner = card.querySelector(".rp-availbanner");
      var addBtn = card.querySelector("button.add");
      if (addBtn && addBtn.dataset.rpLabel) {
        addBtn.textContent = addBtn.dataset.rpLabel;
        delete addBtn.dataset.rpLabel;
        addBtn.disabled = false;
        addBtn.classList.remove("rp-bookedbtn");
      }

      var nameEl = card.querySelector("h3");
      var name = (nameEl ? nameEl.textContent : "").trim().toLowerCase();

      // packages now render natively in app.js (Packages view). Leave their
      // cards alone here; the item-availability map below only covers items.
      if (PKG && PKG[name]) return;

      if (!AVAIL) { if (banner) { banner.className = "rp-availbanner rp-in"; if (banner.dataset.avbDef) banner.textContent = banner.dataset.avbDef; } return; } // no dates -> default banner

      var a = AVAIL[name];
      if (!a) return; // not a tracked item -> leave as-is

      if (!a.is_serviceable) { // every copy in-repair/missing -> hide
        card.style.display = "none";
        return;
      }

      if (!banner) return;
      if (!a.is_available || a.available_units <= 0) {
        banner.className = "rp-availbanner rp-out";
        banner.textContent = a.next_available ? ("Available starting " + fmtNice(a.next_available)) : "Booked for these dates";
        if (addBtn) {
          addBtn.dataset.rpLabel = addBtn.textContent;
          addBtn.textContent = "Booked out";
          addBtn.disabled = true;
          addBtn.classList.add("rp-bookedbtn");
        }
      } else {
        banner.className = "rp-availbanner rp-in";
        banner.textContent = a.available_units + " available";
      }
    });
  }

  function refresh() {
    var r = currentRange();
    if (!r) { AVAIL = null; apply(); return Promise.resolve(); }
    AVAIL = null; apply(); // clear stale marks while we fetch
    return fetchAvail(r.start, r.end).then(function (rows) {
      AVAIL = toMap(rows);
      apply();
    });
  }

  function wrapRender() {
    if (typeof window.render !== "function" || window.render.__rpWrapped) return;
    var orig = window.render;
    var wrapped = function () {
      var out = orig.apply(this, arguments);
      try { apply(); } catch (e) {}
      return out;
    };
    wrapped.__rpWrapped = true;
    window.render = wrapped;
  }

  function styles() {
    var css =
      ".rp-availbanner{display:inline-flex;align-items:center;gap:6px;font:700 12px/1.2 Heebo,system-ui,sans-serif;margin:2px 0 2px;padding:3px 10px;border-radius:8px;width:max-content;max-width:100%;align-self:flex-start}" +
      ".rp-availbanner::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 7px currentColor;flex:none}" +
      ".rp-availbanner.rp-in{background:rgba(120,230,180,.15);color:#8ff0c4;border:1px solid rgba(120,230,180,.4)}" +
      ".rp-availbanner.rp-out{background:rgba(255,90,90,.16);color:#ff9a9a;border:1px solid rgba(255,90,90,.5)}" +
      "button.add.rp-bookedbtn{opacity:.55;cursor:not-allowed;filter:grayscale(1)}";
    var s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function init() {
    styles();
    wrapRender();
    try {
      if (window.RPDates && typeof window.RPDates.onChange === "function") {
        window.RPDates.onChange(function () { refresh(); });
      }
    } catch (e) {}
    loadPackages().then(function () { apply(); });   // hide package rows asap
    refresh();                                        // in case dates already set
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
