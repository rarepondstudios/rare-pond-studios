/* RESERVE THE EVENT BANNER'S SPACE BEFORE THE FIRST PAINT.
 *
 * THE PROBLEM
 *   The event banner is driven by Pages CMS, so the page cannot know it exists until
 *   site.json has been fetched. It then renders, measures itself, and sets --evbanner-h,
 *   which pushes all the page content down. The result is a visible downward JUMP a few
 *   hundred milliseconds into every page load.
 *
 *   You notice it most when hopping between the studio and rentals with the corner
 *   button, because those are two separate documents - every hop is a full page load, so
 *   you pay the jump every single time. That is the "glitchy" swap.
 *
 * THE FIX
 *   Remember how tall the banner was last time and reserve exactly that much space
 *   synchronously, before anything is painted. looks.js then confirms the real number
 *   once site.json lands - and because it is almost always the same number, there is
 *   nothing left to jump.
 *
 * WHY THIS IS SAFE
 *   - It is a HINT, never the source of truth. looks.js always overwrites it with the
 *     measured value, and clears it when the banner is off. A stale hint self-corrects on
 *     the very next load.
 *   - The height depends on viewport width, so it is stored per width bucket. Resize
 *     between visits and the worst case is the old behaviour: one small correction.
 *   - First visit ever has nothing cached, so it behaves exactly as before. Every visit
 *     after that - which is the case that actually annoys you - is smooth.
 *   - Wrapped in try/catch: if localStorage is unavailable (private mode, blocked
 *     cookies) the site simply behaves as it did before. It can never break the page.
 *
 * MUST be loaded in <head>, WITHOUT defer/async, on every page that mounts the banner.
 */
(function () {
  try {
    /* Bucket by width so a phone's cached height is never applied to a desktop layout.
       120px buckets are coarse enough to hit on nearly every revisit and fine enough that
       the banner's height cannot differ meaningfully inside one bucket. */
    var bucket = Math.round(window.innerWidth / 120);
    var h = window.localStorage.getItem('rp_ev_h_' + bucket);
    if (h) {
      var px = parseInt(h, 10);
      if (px > 0 && px < 400) {                    // sanity-clamp: never reserve something absurd
        document.documentElement.style.setProperty('--evbanner-h', px + 'px');
      }
    }
  } catch (e) { /* no storage -> no hint -> the old behaviour. Never fatal. */ }
})();

/* Called by looks.js once the banner has measured itself for real. */
window.RP_rememberBannerHeight = function (px) {
  try {
    var key = 'rp_ev_h_' + Math.round(window.innerWidth / 120);
    if (px > 0) window.localStorage.setItem(key, String(Math.round(px)));
    else window.localStorage.removeItem(key);        // banner switched off -> forget it
  } catch (e) {}
};
