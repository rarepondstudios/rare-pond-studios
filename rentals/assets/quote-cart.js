/* Rentals cart: "Download a quote (PDF)" (2026-10-30, Jack). For someone who has to hand a price to whoever approves
   the money before they can request the rental. Asks for name, email and the production, then:
     1. draws the branded quote PDF in the browser (assets/quote_pdf.js, master bts-automation/scan_static/quote_pdf.js;
        jsPDF from /assets/vendor, both loaded only when the button is used) and downloads it;
     2. posts the same details and the cart to the Jotform form "Rare Pond Rentals: Website Quote" (FORMS.rentalQuote in
        form-config.js), which bts-automation/rentals_quotes.py turns into a quote row + HubSpot contact + deal at
        Quote Sent. That deal carries rp_quote_data, never rp_order_data: nothing is booked and no gear is held.
   Runs after app.js and reads its globals (cart, cartOrder, RENTALS, BUILDERS, D, CATS, LABELS, COL, days...). */
(function () {
  'use strict';
  var QCFG = (window.FORMS && window.FORMS.rentalQuote) || null;
  var qData = { firstName: '', lastName: '', email: '', phone: '', film: '', company: '' }, qStep = 0, qErr = '', qNum = '';
  var FIELDS = [['firstName', 'First name', 1, 1], ['lastName', 'Last name', 1, 1], ['email', 'Email', 1, 1], ['phone', 'Phone (optional)', 0, 1],
                ['film', 'Project or production', 1, 0], ['company', 'Company or school (optional)', 0, 0]];
  function el(id) { return document.getElementById(id); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function newNumber() {
    var d = new Date(), a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 4; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return 'W-' + iso(d).slice(2).replace(/-/g, '') + '-' + s;
  }
  function loadPdf() {
    // quote_pdf.js is a small deferred script on the page (so its ?v= stamp keeps it fresh); jsPDF itself loads on first use
    return window.RPQuotePDF ? Promise.resolve() : Promise.reject(new Error('Could not load the PDF maker'));
  }
  function hasGear() { return cartOrder.some(function (id) { return id in cart; }) || crateHasItems(); }

  /* the cart as a priced document (website prices; the PDF says it is an estimate) */
  function cartDoc() {
    var dd = days() || 1, groups = {}, rvTotal = 0, fees = [];
    function add(cat, line) { (groups[cat] = groups[cat] || []).push(line); }
    cartOrder.filter(function (id) { return id in cart; }).forEach(function (id) {
      var p = RENTALS[id], n = cart[id], fn = Number(p.fn) || 0, rv = (Number(p.rv) || 0) * n; rvTotal += rv;
      add(p.cat, { code: p.code || p.pkgCode || '', name: p.name, qty: n, rate: fn, rate_unit: 'day', days: dd, full: fn * n * dd, line_discount: 0, rv: rv });
    });
    BUILDERS.forEach(function (b) {
      if (!bCount(b)) return;
      bEntries(b).forEach(function (e) {
        var fn = Number(e.p.fn) || 0, rv = (Number(e.p.rv) || 0) * e.qty; rvTotal += rv;
        add(e.p.cat || b.cat, { code: e.p.code || '', name: e.p.name, note: 'In your ' + (b.button || b.name), qty: e.qty, rate: fn, rate_unit: 'day', days: dd, full: fn * e.qty * dd, line_discount: 0, rv: rv });
      });
      if (Number(b.handling) > 0) fees.push({ name: (b.button || b.name) + ' handling', qty: 1, rate: Number(b.handling), rate_unit: 'day', days: dd, full: Number(b.handling) * dd, line_discount: 0 });
    });
    var gs = CATS.filter(function (c) { return groups[c]; }).concat(Object.keys(groups).filter(function (c) { return CATS.indexOf(c) < 0; })).map(function (c) {
      var full = groups[c].reduce(function (a, l) { return a + l.full; }, 0);
      return { dept: c, label: LABELS[c] || c, color: COL[c] || '#8b93a1', lines: groups[c], full: full, line_discount: 0, group_discount: 0, net: full };
    });
    var sections = [];
    var rpFull = gs.reduce(function (a, g) { return a + g.full; }, 0);
    if (gs.length) sections.push({ key: 'rp', label: 'Rare Pond Rentals gear', groups: gs, full: rpFull, net: rpFull });
    if (fees.length) {
      var ff = fees.reduce(function (a, l) { return a + l.full; }, 0);
      sections.push({ key: 'fees', label: 'Fees', groups: [{ label: '', color: '#2f5fae', lines: fees, full: ff, line_discount: 0, group_discount: 0, net: ff }], full: ff, net: ff });
    }
    var total = sections.reduce(function (a, s) { return a + s.full; }, 0), vu = new Date(); vu.setDate(vu.getDate() + 14);
    return { number: qNum, label: 'Quote', estimate: true, created: iso(new Date()), valid_until: iso(vu), title: qData.film,
             prepared_for: { name: (qData.firstName + ' ' + qData.lastName).trim(), company: qData.company, email: qData.email, phone: qData.phone },
             starts_on: D.s, ends_on: D.e, days: days(), sections: sections, order_discount: null,
             full_total: total, discount_total: 0, total: total, rv_total: rvTotal, terms: { pickup: 'after 11:00 AM', ret: 'by 12:00 PM', tz: 'PT' } };
  }

  function inp(k) {
    var f = FIELDS.filter(function (x) { return x[0] === k; })[0];
    var t = k === 'email' ? 'email' : (k === 'phone' ? 'tel' : 'text');
    return '<div class="crewlab">' + esc(f[1]) + '</div><input class="crewin" data-qk="' + k + '" type="' + t + '"' + (k === 'phone' ? ' inputmode="tel"' : '') + ' value="' + esc(qData[k] || '') + '">';
  }
  function render() {
    var h;
    if (qStep === 0) {
      h = '<div class="reqbox"><button class="dpx" id="qqx" aria-label="Close">&times;</button><h2>Download a quote</h2>' +
        '<p class="crewlede">A branded PDF of this cart, by department with totals, to share with whoever approves the rental. Nothing is booked or held.</p>' +
        '<div class="rgrid2"><div>' + inp('firstName') + '</div><div>' + inp('lastName') + '</div></div>' +
        '<div class="rgrid2"><div>' + inp('email') + '</div><div>' + inp('phone') + '</div></div>' + inp('film') + inp('company') +
        '<div class="reqwarn" id="qqwarn">' + esc(qErr) + '</div><button class="crewsend pbtn ready" id="qqgo"><span>Download quote PDF</span></button></div>';
    } else {
      h = '<div class="reqbox reqdone"><button class="dpx" id="qqx" aria-label="Close">&times;</button><div class="checkmk">&#10003;</div><h2>Your quote is downloading</h2>' +
        '<p class="crewlede">Quote <b>' + esc(qNum) + '</b> for <b>' + esc(qData.film) + '</b>. When it is approved, send the rental request and we will confirm it. ' +
        'Questions: <b>rentals@rarepond.com</b>.</p><div class="reqrow"><button class="reqback" id="qqagain">Download again</button>' +
        '<button class="crewsend pbtn ready" id="qqreq" style="margin:0"><span>Request this rental &rarr;</span></button></div></div>';
    }
    var pop = el('reqpop'); pop.innerHTML = h; pop.classList.add('show');
    el('qqx').onclick = function () { pop.classList.remove('show'); };
    if (qStep === 0) {
      Array.prototype.forEach.call(pop.querySelectorAll('[data-qk]'), function (i) { i.oninput = function () { qData[i.getAttribute('data-qk')] = i.value; }; });
      el('qqgo').onclick = go;
    } else {
      el('qqagain').onclick = function () { download(); };
      el('qqreq').onclick = function () {   // carry what they typed into the request form
        if (typeof reqData === 'object') { ['firstName', 'lastName', 'email', 'phone', 'film'].forEach(function (k) { if (k in reqData && !reqData[k]) reqData[k] = qData[k]; }); }
        openReq();
      };
    }
  }
  function download() { return loadPdf().then(function () { return window.RPQuotePDF.download(cartDoc(), { logoUrl: '/media/logos/rare-pond-rentals-color.webp' }); }); }
  function send(doc) {
    if (!QCFG || !QCFG.formId) return;
    var F = QCFG.fields, ids = cartOrder.filter(function (id) { return id in cart; });
    var pairs = ids.map(function (id) { var p = RENTALS[id]; return (p.pkgId != null ? ('k' + p.pkgId) : p.dbid) + ':' + cart[id]; }).concat(crateOrderPairs())
      .filter(function (s) { return s.indexOf('null') < 0 && s.indexOf('undefined') < 0; });
    var gear = [];
    doc.sections.forEach(function (s) { s.groups.forEach(function (g) { g.lines.forEach(function (l) { gear.push(l.qty + 'x ' + l.name + ' (' + fmt(l.rate) + '/day)'); }); }); });
    var v = { quoteNumber: qNum, firstName: qData.firstName, lastName: qData.lastName, email: qData.email, phone: qData.phone, project: qData.film,
              company: qData.company, startDate: D.s, endDate: D.e, total: doc.total.toFixed(2), gear: gear.join('\n'),
              data: 's:' + D.s + '|e:' + D.e + '|i:' + pairs.join(',') };
    var fd = new FormData(); Object.keys(v).forEach(function (k) { if (F[k]) fd.append(F[k], v[k] == null ? '' : v[k]); });
    fetch('https://submit.jotform.com/submit/' + QCFG.formId, { method: 'POST', body: fd, mode: 'no-cors' }).catch(function (e) { console.warn('[RP Rentals] quote copy not saved', e); });
  }
  function go() {
    var miss = FIELDS.filter(function (f) { return f[2] && !String(qData[f[0]] || '').trim(); }).map(function (f) { return f[1].toLowerCase(); });
    if (qData.email && !/.+@.+\..+/.test(qData.email)) miss.push('a valid email');
    if (miss.length) { qErr = 'Please add: ' + miss.join(', ') + '.'; el('qqwarn').textContent = qErr; return; }
    qErr = ''; qNum = qNum || newNumber();
    var b = el('qqgo'); b.disabled = true; b.textContent = 'Making your PDF...';
    download().then(function () { send(cartDoc()); qStep = 1; render(); })
      .catch(function (e) { b.disabled = false; b.textContent = 'Download quote PDF'; el('qqwarn').textContent = 'The PDF could not be made (' + e.message + '). Please try again.'; });
  }
  function open() {
    var hasD = !!(D.s && D.e);
    if (!hasGear() || !hasD) {   // same nudges as the request button
      if (!hasGear()) { flashRed(el('pit')); var pe = el('pit').querySelector('.empty') || el('pit'); flashArrow(pe); }
      if (!hasD) flashDateBtn();
      return;
    }
    if (qStep === 1) qNum = '';   // a changed cart is a new quote
    qStep = 0; qErr = ''; render();
  }
  var btn = el('dlquote'); if (btn) btn.addEventListener('click', open);
})();
