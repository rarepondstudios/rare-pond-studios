/* hat.js - themed logo hat overlay (Rare Pond Studios + Rentals).
   Loaded on the Studios SPA, the Rentals page, the legal pages and the maintenance
   page. NOT loaded on the Rare Pond Media page, and it never touches the animated
   home logo (it targets only the STATIC duck head-marks below).

   Source of truth: data/site.json -> hat { enabled, image }, edited in Pages CMS.
   Pages CMS drops empty fields on save, so a missing enabled/image reads as "off".

   Placement: every hat master is authored on a STANDARD 1920x1920 frame, so ONE
   transform lands them all. The hat image is dropped over the duck as a percentage
   of the logo, which means the same rule is correct at 40px and at 120px with no
   per-size tuning. Tunable in one place via the CSS vars below.
     --rp-hat-w  hat width as % of the logo width      (default 85%)
     --rp-hat-x  horizontal centre, % across the logo  (default 36%)
     --rp-hat-y  vertical anchor, % down the logo       (default 8%)

   The Studios site is a single-page app: its footer (and some marks) are inserted
   AFTER first paint, and it swaps scenes on navigation. So beyond the initial pass
   we keep a MutationObserver running and hat any matching logo the moment it enters
   the DOM. Every hatted logo is flagged so nothing is wrapped twice. */
(function () {
  'use strict';
  var SELECTOR = '.hdr-logo img, .lg-logo img, .fwm img';
  var STYLE_ID = 'rp-hat-style';
  var HAT_SRC = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.rp-hatwrap{position:relative;display:inline-block;line-height:0;overflow:visible}' +
      '.rp-hatwrap>img{display:block}' +
      '.rp-hat{position:absolute;left:var(--rp-hat-x,36%);top:var(--rp-hat-y,8%);' +
      'width:var(--rp-hat-w,85%);height:auto;transform:translate(-50%,-50%);' +
      'pointer-events:none;z-index:3;-webkit-user-select:none;user-select:none}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function wrap(img) {
    if (!img || img.nodeType !== 1) return;
    if (img.classList && img.classList.contains('rp-hat')) return;      // never hat a hat
    if (img.getAttribute('data-rp-hat') === '1') return;               // already done
    var parent = img.parentNode;
    if (!parent) return;
    var w = document.createElement('span');
    w.className = 'rp-hatwrap';
    parent.insertBefore(w, img);
    w.appendChild(img);
    var hat = document.createElement('img');
    hat.className = 'rp-hat';
    hat.alt = '';
    hat.setAttribute('aria-hidden', 'true');
    hat.setAttribute('decoding', 'async');
    hat.src = HAT_SRC;
    w.appendChild(hat);
    img.setAttribute('data-rp-hat', '1');
  }

  function scan(root) {
    if (!HAT_SRC) return;
    if (root && root.nodeType === 1 && root.matches && root.matches(SELECTOR)) wrap(root);
    var scope = (root && root.querySelectorAll) ? root : document;
    var imgs = scope.querySelectorAll(SELECTOR);
    for (var i = 0; i < imgs.length; i++) wrap(imgs[i]);
  }

  function observe() {
    if (!('MutationObserver' in window)) return;
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) scan(added[j]);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  function run(cfg) {
    // Off unless explicitly enabled AND a hat image is chosen.
    if (!cfg || cfg.enabled !== true) return;
    var src = (typeof cfg.image === 'string') ? cfg.image.trim() : '';
    if (!src) return;
    HAT_SRC = src;
    injectStyle();
    scan(document);   // static marks (headers, static footers)
    observe();        // SPA-injected footers, scene swaps, route changes
    window.addEventListener('load', function () { scan(document); }, { once: true });
  }

  function boot() {
    fetch('/data/site.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (s) { run(s && s.hat); })
      .catch(function () { /* no hat on fetch failure */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
