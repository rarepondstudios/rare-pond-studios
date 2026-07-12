/* Adds links to custom pages (data/pages.json) into the RENTALS header nav.
   A page appears here only when "Show in the RENTALS top banner" is on.
   The link jumps across to the studio site, where the page actually lives.
   Fully defensive: any fetch/parse failure leaves the header untouched. */
(function () {
  var nav = document.querySelector('header .hnav') || document.querySelector('.hnav');
  if (!nav) return;
  fetch('/data/pages.json')
    .then(function (r) { return r.ok ? r.json() : { pages: [] }; })
    .then(function (d) {
      var pages = (d && Array.isArray(d.pages)) ? d.pages : [];
      pages.filter(function (p) { return p && p.slug && p.showInRentalsNav; })
           .sort(function (a, b) { return (Number(a.navOrder) || 999) - (Number(b.navOrder) || 999); })
           .forEach(function (p) {
             var a = document.createElement('a');
             a.href = '/?p=' + encodeURIComponent(String(p.slug).trim());
             a.textContent = p.navLabel || p.title || p.slug;
             nav.appendChild(a);
           });
    })
    .catch(function () { /* header stays exactly as it was */ });
})();
