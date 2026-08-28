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
     --rp-hat-y  vertical anchor, % down the logo       (default 8%)  */
(function () {
  'use strict';
  var SELECTOR = '.hdr-logo img, .lg-logo img, .fwm img';
  var STYLE_ID = 'rp-hat-style';

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

  function place(src) {
    var imgs = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.getAttribute('data-rp-hat') === '1') continue;
      var parent = img.parentNode;
      if (!parent) continue;
      var wrap = document.createElement('span');
      wrap.className = 'rp-hatwrap';
      parent.insertBefore(wrap, img);
      wrap.appendChild(img);
      var hat = document.createElement('img');
      hat.className = 'rp-hat';
      hat.alt = '';
      hat.setAttribute('aria-hidden', 'true');
      hat.setAttribute('decoding', 'async');
      hat.src = src;
      wrap.appendChild(hat);
      img.setAttribute('data-rp-hat', '1');
    }
  }

  function run(cfg) {
    // Off unless explicitly enabled AND a hat image is chosen.
    if (!cfg || cfg.enabled !== true) return;
    var src = (typeof cfg.image === 'string') ? cfg.image.trim() : '';
    if (!src) return;
    injectStyle();
    place(src);
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
