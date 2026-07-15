/* Production error beacon.
 *
 * WHY THIS EXISTS
 *   The site has no build step and ships hand-written JS, so a typo can reach
 *   production silently (it already happened once). This catches uncaught errors
 *   and unhandled promise rejections in real browsers and reports a compact record
 *   to /api/client-error, which logs it (tail-visible) and forwards it to an alert
 *   webhook IF one is configured (CLIENT_ERROR_WEBHOOK env in Cloudflare Pages).
 *
 *   It is deliberately tiny, dependency-free, and FAILS SILENT: it must never throw,
 *   never block the page, and never spam. It loads FIRST in <head> so it is watching
 *   before any other script parses.
 */
(function () {
  'use strict';
  var MAX = 5;              // never send more than 5 reports per page load
  var sent = 0;
  var seen = {};           // dedupe identical messages

  function post(rec) {
    if (sent >= MAX) return;
    var key = (rec.msg || '') + '|' + (rec.src || '') + '|' + (rec.line || '');
    if (seen[key]) return;
    seen[key] = 1;
    sent++;
    try {
      rec.page = location.pathname + location.search;
      rec.ua = navigator.userAgent;
      rec.t = new Date().toISOString();
      var body = JSON.stringify(rec).slice(0, 2000);   // hard size cap
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/client-error', body);
      } else {
        fetch('/api/client-error', { method: 'POST', body: body, keepalive: true }).catch(function () {});
      }
    } catch (e) { /* never let the reporter itself break anything */ }
  }

  window.addEventListener('error', function (e) {
    if (!e) return;
    // Ignore resource-load errors (img/script 404s) - only report real script errors.
    if (e.message || e.error) {
      post({
        kind: 'error',
        msg: String(e.message || (e.error && e.error.message) || 'error'),
        src: String(e.filename || ''),
        line: e.lineno || 0,
        col: e.colno || 0,
        stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 800) : ''
      });
    }
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    post({
      kind: 'promise',
      msg: r && r.message ? String(r.message) : String(r).slice(0, 300),
      stack: r && r.stack ? String(r.stack).slice(0, 800) : ''
    });
  });
})();
