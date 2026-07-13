/* SOCIAL ICONS + FOOTER, built from data/site.json.
 *
 * THE ONLY PLACE THE ICON ARTWORK LIVES. It used to be hand-copied into index.html and
 * rentals/assets/app.js as well, which is how these things quietly drift apart - someone
 * adds a network in one file and the others silently keep the old set. Both pages now read
 * window.RP_SOCIAL_ICONS from here, so adding a network is a one-line change in one file.
 *
 * The matching CSS lives in assets/chrome.css (classes .rp-soc and .rp-footer). Between the
 * two, the header icons and the footer are defined exactly once for the whole site.
 *
 * Everything is read from site.json (Pages CMS -> Site Settings), so the links, the tagline
 * and the copyright line can never disagree with the rest of the site.
 *
 * MUST load before any script that renders social icons.
 */
(function () {
  var ICONS = {
    yt: '<svg viewBox="0 0 24 24"><path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.4 12 31 31 0 0 0 23 7.5zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>',
    ig: '<svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.1.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.1-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.1-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.1 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7 .1 5.7.1 4.8.3 4.1.6c-.8.3-1.4.7-2.1 1.4C1.3 2.7.9 3.3.6 4.1.3 4.8.1 5.7.1 7 0 8.3 0 8.7 0 12s0 3.7.1 5c.1 1.3.2 2.2.5 2.9.3.8.7 1.4 1.4 2.1.7.7 1.3 1.1 2.1 1.4.7.3 1.6.5 2.9.5 1.3.1 1.7.1 5 .1s3.7 0 5-.1c1.3-.1 2.2-.2 2.9-.5.8-.3 1.4-.7 2.1-1.4.7-.7 1.1-1.3 1.4-2.1.3-.7.5-1.6.5-2.9.1-1.3.1-1.7.1-5s0-3.7-.1-5c-.1-1.3-.2-2.2-.5-2.9-.3-.8-.7-1.4-1.4-2.1-.7-.7-1.3-1.1-2.1-1.4-.7-.3-1.6-.5-2.9-.5C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-10.4a1.4 1.4 0 1 1-2.9 0 1.4 1.4 0 0 1 2.9 0z"/></svg>',
    li: '<svg viewBox="0 0 24 24"><path d="M20.4 3H3.6A.6.6 0 0 0 3 3.6v16.8a.6.6 0 0 0 .6.6h16.8a.6.6 0 0 0 .6-.6V3.6a.6.6 0 0 0-.6-.6zM8.3 18.3H5.5V9.4h2.8v8.9zM6.9 8.2a1.6 1.6 0 1 1 0-3.3 1.6 1.6 0 0 1 0 3.3zm11.4 10.1h-2.8v-4.3c0-1 0-2.4-1.4-2.4s-1.6 1.1-1.6 2.3v4.4H9.7V9.4h2.7v1.2h.04c.4-.7 1.3-1.4 2.6-1.4 2.8 0 3.3 1.8 3.3 4.2v5z"/></svg>',
    fb: '<svg viewBox="0 0 24 24"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"/></svg>'
  };

  /* The single source of the icon artwork. index.html and rentals/assets/app.js read this
     instead of carrying their own copies. */
  window.RP_SOCIAL_ICONS = ICONS;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  /* Only ever emit http(s) links. A malformed URL in the CMS must not become a javascript: href. */
  var safeUrl = function (u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : '#'; };

  function socialsHTML(list) {
    return (list || []).filter(function (s) { return s && ICONS[s.icon]; }).map(function (s) {
      return '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener"'
           + ' data-net="' + esc(s.icon) + '" aria-label="' + esc(s.label || s.icon) + '"'
           + ' title="' + esc(s.label || s.icon) + '">' + ICONS[s.icon] + '</a>';
    }).join('');
  }

  /* Renders the header icons and the footer into the maintenance cover.
     `home` is where the footer's studio links should point ("/" or "/rentals"). */
  window.RP_renderChrome = function (site, opts) {
    opts = opts || {};
    var s = site || {};

    var head = document.getElementById('mSocials');
    if (head) head.innerHTML = socialsHTML(s.socials);

    if (!document.getElementById('mFoot')) return;
    var f = s.footer || {};

    /* The caustic water fade behind the footer, exactly as the home page does it
       (.deepwater + SITE.water). Without it the footer reads as a flat panel. */
    var water = document.getElementById('mWater');
    if (water && s.water) water.style.backgroundImage = 'url("' + s.water + '")';

    /* The footer logo. The studio footer uses logos.footer when set, else logos.color -
       same precedence, so the cover cannot show a different mark from the real footer. */
    var logo = document.getElementById('mFootLogo');
    var src = (s.logos && (s.logos.footer || s.logos.color)) || '/media/logos/rare-pond-color.png';
    if (logo) logo.src = src;

    var tag = document.getElementById('mFootTag');
    if (tag && f.tagline) tag.textContent = f.tagline;

    var soc = document.getElementById('mFootSoc');
    if (soc) soc.innerHTML = socialsHTML(s.socials);

    /* Footer links are CMS-driven. On the real site some are in-page jumps ("go": "team")
       handled by the SPA router; the cover is a standalone page with no router, so those
       become real /#team links - which is what someone stranded here actually needs. */
    var links = document.getElementById('mFootLinks');
    if (links) {
      links.innerHTML = (f.links || []).map(function (l) {
        var href = l.href ? l.href : ('/#' + (l.go || ''));
        return '<a href="' + esc(href) + '">' + esc(l.label || '') + '</a>';
      }).join('');
    }

    var copy = document.getElementById('mFootCopy');
    if (copy) {
      var link = f.copyrightUrlText
        ? '<a href="' + esc(safeUrl(f.copyrightUrl || 'https://rarepond.com')) + '" target="_blank" rel="noopener">'
          + esc(f.copyrightUrlText) + '</a>'
        : '';
      var cp = esc(f.copyright || '');
      copy.innerHTML = (link && cp) ? (link + ' · ' + cp) : (link || cp);
    }
  };
})();
