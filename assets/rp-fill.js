/* RPFill: every form's submit button fills up as the form is completed (2026-10-30, Jack).
 * MASTER: bts-automation/rp_fill.js, published to each site as assets/rp-fill.js by social_ui_sync.py.
 *
 * Why: the "button fills as you fill the form" look was hand-coded per form (rentals request, crew form), so a new
 * form that forgot the code got a button stuck at its starting sliver (the cart's quote form, 2026-10-30; the same
 * thing happened on the rentals site before). Now it is automatic: load this file once per page and every form
 * gets it, including popups drawn later.
 *
 * How a page uses it (nothing else to write):
 *   - the submit button is a .pbtn / *pbtn / .crewsend / [data-fill-submit] / button[type=submit];
 *   - its form is the nearest [data-fill-form], form, .reqbox, .rpc-box or [role=dialog] around it;
 *   - required fields carry `required` (or data-req). If none in the form do, every visible field counts except
 *     ones marked data-optional or labelled "(optional)" in their placeholder.
 *   - an email must look like one, a phone must have 10 digits, a checkbox must be ticked, a radio group answered.
 * The button gets --fill and --rpc-fill (4% empty to 100% full, the existing CSS draws them) and .ready / .rpc-ready
 * when complete. A form whose own code already drives its button opts out with data-fill-own on that button.
 * A form with no fields (date picker, review steps) is left alone.
 */
(function () {
  'use strict';
  if (window.RPFill) return;
  var BTN = '[data-fill-submit],.pbtn,[class*="pbtn"],.crewsend,button[type=submit]';
  var BOX = '[data-fill-form],form,.reqbox,.rpc-box,[role=dialog]';
  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function fieldsOf(box) {
    return Array.prototype.filter.call(box.querySelectorAll('input,textarea,select'), function (el) {
      var t = (el.type || '').toLowerCase();
      return !el.disabled && t !== 'hidden' && t !== 'search' && t !== 'button' && t !== 'submit' && t !== 'reset' &&
        !el.closest('[data-fill-skip]') && visible(el);
    });
  }
  function needed(fs) {
    var req = fs.filter(function (el) { return el.required || el.getAttribute('aria-required') === 'true' || el.hasAttribute('data-req'); });
    if (req.length) return req;
    return fs.filter(function (el) { return !el.hasAttribute('data-optional') && !/optional/i.test(el.getAttribute('placeholder') || ''); });
  }
  function done(el, box) {
    var t = (el.type || '').toLowerCase(), v = String(el.value || '').trim();
    if (t === 'checkbox') return el.checked;
    if (t === 'radio') return !!box.querySelector('input[type=radio][name="' + (el.name || '').replace(/"/g, '\\"') + '"]:checked');
    if (t === 'email' || el.getAttribute('data-itype') === 'email') return /.+@.+\..+/.test(v);
    if (t === 'tel' || el.getAttribute('data-itype') === 'tel') return v.replace(/\D/g, '').length >= 10;
    return !!v;
  }
  function update(btn) {
    if (btn.hasAttribute('data-fill-own')) return;
    var box = btn.closest(BOX); if (!box) return;
    var fs = needed(fieldsOf(box)); if (!fs.length) return;
    var seen = {}, n = 0, d = 0;
    fs.forEach(function (el) {
      if (el.type === 'radio') { if (seen[el.name]) return; seen[el.name] = 1; }
      n++; if (done(el, box)) d++;
    });
    var fr = n ? d / n : 1, pct = (4 + fr * 96).toFixed(1) + '%';
    btn.style.setProperty('--fill', pct); btn.style.setProperty('--rpc-fill', pct);
    btn.classList.toggle('ready', fr >= 0.999);
    if (btn.className.indexOf('rpc-') >= 0) btn.classList.toggle('rpc-ready', fr >= 0.999);
  }
  var pending = false;
  function run() {
    pending = false;
    Array.prototype.forEach.call(document.querySelectorAll(BTN), update);
  }
  function soon() { if (!pending) { pending = true; (window.requestAnimationFrame || setTimeout)(run); } }
  ['input', 'change', 'click'].forEach(function (ev) { document.addEventListener(ev, soon, true); });
  // a form drawn later (popups): only additions that bring fields or buttons wake it, so busy pages stay cheap
  try {
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var a = ms[i].addedNodes;
        for (var j = 0; j < a.length; j++) {
          var nd = a[j];
          if (nd.nodeType === 1 && (nd.matches('input,textarea,select,button') || nd.querySelector('input,textarea,select,button'))) { soon(); return; }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  window.RPFill = { update: run };
  if (document.readyState !== 'loading') soon(); else document.addEventListener('DOMContentLoaded', soon);
})();
