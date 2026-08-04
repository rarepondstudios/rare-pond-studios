/* Rare Pond Rentals — live availability overlay  (assets/availability.js)
   ---------------------------------------------------------------------------
   Loaded RIGHT AFTER app.js, so RENTALS, cart, render(), renderResults(),
   openDP(), addCart(), inc() and window.RPDates already exist in the shared
   script realm.

   SOURCE OF TRUTH: Supabase RPC public.catalog_availability(p_start,p_end),
   which returns, per item AND per package (by name):
     serviceable_units  physical copies whose unit.condition_status='ok'
                        (so an in-repair / missing copy is excluded)  -> repair
     available_units    serviceable copies with NO overlapping held/confirmed
                        booking for the chosen dates                  -> booking
     is_serviceable     serviceable_units > 0
     is_available       available_units > 0

   WHY THIS FILE IS MORE THAN A DISPLAY OVERLAY:
   The catalog is re-rendered from scratch by several code paths in app.js
   (renderResults on search + after every cart change via refresh(); openDP for
   the detail popup). A pure "annotate the DOM after render()" overlay lost its
   marks the instant any of those fired — which is exactly the reported bug:
   click/add on one item and every booked-out item looked free again with full
   quantity. And nothing enforced availability on the CART, so a wrong count
   flowed straight into the quote e-mail + HubSpot deal.

   So this file makes availability AUTHORITATIVE, in three layers:
     1. DATA  — capOf(item) is the single truth (serviceable when no dates are
                chosen, booking-aware once they are). Packages use the RPC's own
                per-package numbers (min over components), no JS math needed.
     2. CART  — addCart()/inc() are wrapped to hard-cap at capOf(); a booked-out
                or in-repair item can never enter the cart, and quantities can
                never exceed what is actually free. Picking tighter dates trims
                any now-over-cap lines so the quote is always correct.
     3. VIEW  — apply() re-marks the grid after EVERY render path (render,
                renderResults, refresh), and applyDP() enforces the detail popup
                (status text + Add button). Repair shows even before dates are
                picked, because serviceable_units is date-independent.

   Fully removable: delete the <script src="assets/availability.js"> include in
   rentals/index.html and the catalog reverts to app.js's raw behaviour. */
(function () {
  "use strict";

  var BASE = null;   // name -> {serviceable_units,is_serviceable,total_units}  (date-independent; repair)
  var AVAIL = null;  // name -> full RPC row  (ONLY when the customer has chosen dates; booking-aware)

  /* ---- Supabase creds (published anon key, same as app.js) ---------------- */
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
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function toMap(rows) {
    var m = {};
    if (Array.isArray(rows)) rows.forEach(function (r) { m[(r.name || "").trim().toLowerCase()] = r; });
    return m;
  }

  /* ---- date helpers -------------------------------------------------------- */
  function hasDates() { return !!AVAIL; }

  function currentRange() {
    try {
      var g = window.RPDates.get();
      if (g && g.start && g.end) return { start: g.start, end: g.end };
    } catch (e) {}
    return null;
  }

  function todayISO() {
    var d = new Date(), z = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }

  /* ---- the single availability truth --------------------------------------
     Returns null for an UNTRACKED name (leave app.js behaviour untouched), else
       { serviceable, is_serviceable, cap, booking }
     cap = booking-aware free count when dates are chosen, else serviceable
     (so an in-repair copy drops the count even before any date is picked). */
  function infoByName(name) {
    var b = BASE ? BASE[name] : null;
    var a = AVAIL ? AVAIL[name] : null;
    if (!b && !a) return null;
    var serviceable = (b ? b.serviceable_units : (a ? a.serviceable_units : null));
    var isServ = (b ? b.is_serviceable : (a ? a.is_serviceable : true));
    var cap = a ? a.available_units : serviceable;
    if (cap == null) cap = Infinity;
    return { serviceable: serviceable, is_serviceable: isServ, cap: cap, booking: !!a };
  }

  function infoFor(p) { return p ? infoByName((p.name || "").trim().toLowerCase()) : null; }

  function capOf(p) {
    var info = infoFor(p);
    if (!info) return Infinity;                 // untracked -> no constraint
    if (!info.is_serviceable) return 0;         // every copy in repair/missing
    return (info.cap === Infinity) ? Infinity : Math.max(0, info.cap | 0);
  }

  function bookMsg(p) {
    var info = infoFor(p);
    if (info && !info.is_serviceable) return "This item is currently in repair.";
    return "Booked out for these dates.";
  }

  /* ---- grid marking (idempotent; safe to run after every render) ----------- */
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
      if (banner) { banner.className = "rp-availbanner rp-in"; if (banner.dataset.avbDef) banner.textContent = banner.dataset.avbDef; }

      var nameEl = card.querySelector("h3");
      var name = (nameEl ? nameEl.textContent : "").trim().toLowerCase();
      var info = infoByName(name);
      if (!info) return;                       // untracked -> leave app.js default

      var out = (info.cap <= 0) || !info.is_serviceable;
      if (out) {
        if (!info.is_serviceable) {            // whole line in repair -> hide it
          card.style.display = "none";
          return;
        }
        if (banner) {
          banner.className = "rp-availbanner rp-out";
          banner.textContent = "Booked out for these dates";
        }
        if (addBtn) {
          addBtn.dataset.rpLabel = addBtn.textContent;
          addBtn.textContent = "Booked out";
          addBtn.disabled = true;
          addBtn.classList.add("rp-bookedbtn");
        }
      } else if (banner && info.cap !== Infinity) {
        banner.className = "rp-availbanner rp-in";
        banner.textContent = info.cap + " available";
      }
    });
  }

  /* ---- detail-popup enforcement ------------------------------------------- */
  function applyDP(id) {
    var dp = document.getElementById("dp");
    if (!dp || !dp.classList.contains("show")) return;
    var p = (typeof RENTALS !== "undefined") ? RENTALS[id] : null;
    if (!p) return;
    var info = infoFor(p);
    if (!info) return;                          // untracked -> leave defaults
    var addb = dp.querySelector("[data-da]");
    var plus = dp.querySelector("[data-dp]");
    var stat = dp.querySelector(".stat");
    var isPkg = (p.kind === "package");
    var out = (info.cap <= 0) || !info.is_serviceable;

    if (out) {
      if (addb) { addb.textContent = isPkg ? "Unavailable" : "Booked out"; addb.disabled = true; addb.classList.add("rp-bookedbtn"); }
      if (plus) { plus.disabled = true; }
      if (stat && !isPkg) {
        stat.textContent = !info.is_serviceable ? "Currently in repair" : "Booked out for these dates";
        stat.classList.add("rp-dp-out");
      }
    } else {
      if (stat && !isPkg && info.cap !== Infinity) {
        stat.textContent = info.cap + " available" + (info.booking ? " for these dates" : "");
        stat.classList.remove("rp-dp-out");
      }
      var have = (typeof cart !== "undefined" && cart) ? (cart[id] || 0) : 0;
      if (plus && info.cap !== Infinity && have >= info.cap) plus.disabled = true;
    }
  }

  /* ---- cart truth: trim any line that no longer fits the current dates ----- */
  function trimCart() {
    if (typeof cart === "undefined" || !cart) return false;
    var changed = false;
    Object.keys(cart).forEach(function (k) {
      var id = +k, p = RENTALS[id];
      if (!p) return;
      var cap = capOf(p);
      if (cap <= 0) { delete cart[id]; changed = true; }
      else if (cap !== Infinity && cart[id] > cap) { cart[id] = cap; changed = true; }
    });
    if (changed && typeof cartOrder !== "undefined" && Array.isArray(cartOrder)) {
      cartOrder = cartOrder.filter(function (x) { return cart[x]; });
    }
    return changed;
  }

  /* ---- fetch + refresh everything ----------------------------------------- */
  function syncAvail() {
    var r = currentRange();
    var range = r || { start: todayISO(), end: todayISO() };  // no dates -> still pull serviceable baseline (repair)
    var userDates = !!r;
    return fetchAvail(range.start, range.end).then(function (rows) {
      var map = toMap(rows);
      BASE = {};
      Object.keys(map).forEach(function (n) {
        var row = map[n];
        BASE[n] = { serviceable_units: row.serviceable_units, is_serviceable: row.is_serviceable, total_units: row.total_units };
      });
      AVAIL = userDates ? map : null;
      var trimmed = trimCart();
      if (trimmed && typeof window.uc === "function") { try { window.uc(); } catch (e) {} }
      if (trimmed && typeof window.renderResults === "function" && (typeof active === "undefined" || active !== "Home")) {
        try { window.renderResults(); } catch (e) {}
      } else {
        apply();
      }
      if (typeof dpOpen !== "undefined" && dpOpen != null) applyDP(dpOpen);
      if (trimmed) toast("Cart updated to match availability for your dates.");
    });
  }

  /* ---- wrap the render paths so marks survive every rebuild ---------------- */
  function wrapFn(name, after) {
    var fn = window[name];
    if (typeof fn !== "function" || fn.__rpWrapped) return;
    var wrapped = function () {
      var out = fn.apply(this, arguments);
      try { after.apply(this, arguments); } catch (e) {}
      return out;
    };
    wrapped.__rpWrapped = true;
    window[name] = wrapped;
  }

  function wrapRenders() {
    wrapFn("render", function () { apply(); });
    wrapFn("renderResults", function () { apply(); });
    wrapFn("refresh", function () { apply(); if (typeof dpOpen !== "undefined" && dpOpen != null) applyDP(dpOpen); });
    wrapFn("openDP", function (id) { applyDP(id); });
  }

  /* ---- cart caps: the quote-protecting layer ------------------------------ */
  function wrapCart() {
    if (typeof window.addCart === "function" && !window.addCart.__rpCap) {
      var oa = window.addCart;
      window.addCart = function (id) {
        var p = RENTALS[id];
        if (p) {
          var cap = capOf(p), have = (cart[id] || 0);
          if (cap <= 0) { toast(bookMsg(p)); return; }
          if (cap !== Infinity && have >= cap) { toast("Only " + cap + " available" + (hasDates() ? " for these dates." : ".")); return; }
        }
        return oa.apply(this, arguments);
      };
      window.addCart.__rpCap = true;
    }
    if (typeof window.inc === "function" && !window.inc.__rpCap) {
      var oi = window.inc;
      window.inc = function (id) {
        var p = RENTALS[id];
        if (p) {
          var cap = capOf(p);
          if (cap <= 0) { toast(bookMsg(p)); return; }
          if (cap !== Infinity && (cart[id] || 0) >= cap) { toast("Only " + cap + " available" + (hasDates() ? " for these dates." : ".")); return; }
        }
        return oi.apply(this, arguments);
      };
      window.inc.__rpCap = true;
    }
  }

  /* ---- tiny toast (no dependency on app.js) ------------------------------- */
  var toastEl = null, toastT = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "rp-avtoast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  function styles() {
    var css =
      ".rp-availbanner{display:inline-flex;align-items:center;gap:6px;font:700 12px/1.2 Heebo,system-ui,sans-serif;margin:2px 0 2px;padding:3px 10px;border-radius:8px;width:max-content;max-width:100%;align-self:flex-start}" +
      ".rp-availbanner::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 7px currentColor;flex:none}" +
      ".rp-availbanner.rp-in{background:rgba(120,230,180,.15);color:#8ff0c4;border:1px solid rgba(120,230,180,.4)}" +
      ".rp-availbanner.rp-out{background:rgba(255,90,90,.16);color:#ff9a9a;border:1px solid rgba(255,90,90,.5)}" +
      "button.add.rp-bookedbtn,.dpadd.rp-bookedbtn{opacity:.55;cursor:not-allowed;filter:grayscale(1)}" +
      ".stat.rp-dp-out{color:#ff9a9a!important}" +
      ".rp-avtoast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(14px);z-index:9999;background:rgba(20,26,40,.96);color:#fff;font:600 13.5px/1.3 Heebo,system-ui,sans-serif;padding:11px 18px;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.4);border:1px solid rgba(150,190,255,.22);opacity:0;pointer-events:none;transition:opacity .22s,transform .22s;max-width:min(88vw,420px);text-align:center}" +
      ".rp-avtoast.show{opacity:1;transform:translateX(-50%) translateY(0)}";
    var s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function init() {
    styles();
    wrapRenders();
    wrapCart();
    try {
      if (window.RPDates && typeof window.RPDates.onChange === "function") {
        window.RPDates.onChange(function () { syncAvail(); });
      }
    } catch (e) {}
    syncAvail();  // pull the serviceable baseline now (repair shows without dates), and booking data if dates already set
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
