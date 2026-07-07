/* Rare Pond Rentals — date-aware availability overlay.
   ADDITIVE + SAFE: reads Supabase availability for the customer's chosen dates
   and annotates the catalog. Touches nothing in app.js; remove the <script>
   include in rentals/index.html to fully disable. Loaded right AFTER app.js so
   SB_URL, SB_KEY, RENTALS and render() already exist.

   What it does, per product card (.card[data-open]) once dates are chosen:
     - all copies in-repair/missing  -> hide the card entirely
     - no copy free for those dates  -> "Booked out for these dates" + disable Add
     - otherwise                     -> "N available" badge, Add stays enabled
   It re-applies after every render() (category switch, search) and whenever the
   shared date range changes (window.RPDates.onChange). */
(function () {
  "use strict";

  var AVAIL = null; // map: lowercased item name -> availability row

  function creds() {
    var url = (typeof SB_URL !== "undefined") ? SB_URL : (window.SB_URL || "");
    var key = (typeof SB_KEY !== "undefined") ? SB_KEY : (window.SB_KEY || "");
    return { url: url, key: key };
  }

  function fetchAvail(start, end) {
    var c = creds();
    if (!c.url || !c.key) return Promise.resolve(null);
    return fetch(c.url.replace(/\/$/, "") + "/rest/v1/rpc/catalog_availability", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.key, Authorization: "Bearer " + c.key },
      body: JSON.stringify({ p_start: start, p_end: end })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function toMap(rows) {
    var m = {};
    if (Array.isArray(rows)) rows.forEach(function (r) { m[(r.name || "").trim().toLowerCase()] = r; });
    return m;
  }

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
      var old = card.querySelector(".rp-avail");
      if (old) old.remove();
      var addBtn = card.querySelector("button.add");
      if (addBtn && addBtn.dataset.rpLabel) {
        addBtn.textContent = addBtn.dataset.rpLabel;
        delete addBtn.dataset.rpLabel;
        addBtn.disabled = false;
        addBtn.classList.remove("rp-bookedbtn");
      }

      if (!AVAIL) return; // no dates chosen yet -> leave catalog as-is

      var nameEl = card.querySelector("h3");
      var name = (nameEl ? nameEl.textContent : "").trim().toLowerCase();
      var a = AVAIL[name];
      if (!a) return; // not a tracked product (e.g. a package) -> leave as-is

      if (!a.is_serviceable) { // every copy in-repair/missing -> hide
        card.style.display = "none";
        return;
      }

      var badge = document.createElement("div");
      badge.className = "rp-avail";
      if (!a.is_available || a.available_units <= 0) {
        badge.classList.add("rp-out");
        badge.textContent = "Booked out for these dates";
        if (addBtn) {
          addBtn.dataset.rpLabel = addBtn.textContent;
          addBtn.textContent = "Booked out";
          addBtn.disabled = true;
          addBtn.classList.add("rp-bookedbtn");
        }
      } else {
        badge.classList.add("rp-in");
        badge.textContent = a.available_units + " available";
      }
      if (nameEl && nameEl.parentNode) nameEl.parentNode.insertBefore(badge, nameEl.nextSibling);
      else card.appendChild(badge);
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
      ".rp-avail{display:inline-block;font:600 12px/1.2 Heebo,system-ui,sans-serif;margin:6px 0;padding:3px 9px;border-radius:999px}" +
      ".rp-avail.rp-in{background:#e6f4ea;color:#137333}" +
      ".rp-avail.rp-out{background:#fce8e6;color:#c5221f}" +
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
    refresh(); // in case dates are already set on load
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
