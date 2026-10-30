/* Rare Pond Rentals quote PDF (2026-10-30). ONE renderer for every quote PDF:
 *   - the website cart ("Download quote", rarepond.com/rentals)      -> copy at rp_site_work/rentals/assets/quote_pdf.js
 *   - the scan app Quotes page (scan.rarepond.com/quotes)             -> served from bts-automation/scan_static
 * MASTER is bts-automation/scan_static/quote_pdf.js; the site copy is refreshed from it (tools/sync-quote-pdf.sh).
 * Needs jsPDF 2.5.2 (window.jspdf), loaded on demand by RPQuotePDF.load().
 *
 * Input is an already-priced document (the backend's rp_quote_calc output, or the cart's estimate), so this file
 * never does pricing of its own beyond adding up what it is given:
 *   { number, label ('Quote' | 'Estimate'), created, valid_until, title, prepared_for {name, company, email, phone},
 *     starts_on, ends_on, days, sections: [{key, label, groups: [{dept, label, color, lines: [...], full, line_discount,
 *     group_pct, group_label, group_discount, net, rv}], full, net, rv}], order_discount {pct, label, amount} | null,
 *     full_total, discount_total, total, rv_total, public_note, terms {pickup, ret, tz}, logo (data URL, optional) }
 *   line: { code, name, note, qty, rate, rate_unit ('day' | 'flat'), days, full, discount_pct, discount_label, line_discount }
 * Layout: full price first, then every discount as its own line, then the total, so the reader sees the deal.
 * Replacement value is printed small and secondary (for insurance), never as a charge.
 */
(function (root) {
  'use strict';
  var JSPDF_DEFAULT = '/assets/vendor/jspdf.umd.min.js?v=d93ad20f62';   // the page can point elsewhere with window.RP_JSPDF_SRC
  var INK = [27, 34, 48], MUTE = [95, 107, 125], LINE = [227, 232, 240], SOFT = [244, 247, 251], BLUE = [47, 95, 174], GREEN = [31, 138, 76];
  var W = 612, H = 792, M = 40;
  /* fallbacks only: the real windows come in d.terms (Pages CMS > Rentals > Admin: rental operations; rp_times.py) */
  var PICKUP = '11:00 AM to 5:00 PM', RETURN = '11:00 AM to 5:00 PM', NOTE = 'Earlier pickup or return times are available by request with advance notice.';

  function money(v) {
    var n = Math.round((Number(v) || 0) * 100) / 100, neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + '$' + s[0] + '.' + s[1];
  }
  function num(v) { var n = Number(v) || 0; return (Math.round(n * 100) / 100).toString(); }
  function hex(c) {
    c = String(c || '#8b93a1').replace('#', ''); if (c.length === 3) c = c.replace(/(.)/g, '$1$1');
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    if ([r, g, b].some(isNaN)) return [139, 147, 161];
    if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.86) return [139, 147, 161];   // white/near-white (Logistics) prints gray
    return [r, g, b];
  }
  function fdate(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-'); if (p.length < 3) return String(iso);
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
    var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    return wd + ', ' + mo + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }
  /* the PDF's built-in Helvetica only has Latin-1: map the common extras, drop anything else (it would garble the line) */
  function clean(s) {
    return String(s == null ? '' : s).replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
      .replace(/\u2300/g, '\u00d8').replace(/\u2026/g, '...').replace(/\u2122/g, '(TM)').replace(/[\u2022\u00b7]/g, '-').replace(/[^\x00-\xff]/g, '');
  }

  function load() {
    if (root.jspdf && root.jspdf.jsPDF) return Promise.resolve(root.jspdf.jsPDF);
    if (root._rpJsPdfP) return root._rpJsPdfP;
    root._rpJsPdfP = new Promise(function (ok, bad) {
      var s = document.createElement('script'); s.src = root.RP_JSPDF_SRC || JSPDF_DEFAULT; s.async = true;
      s.onload = function () { root.jspdf && root.jspdf.jsPDF ? ok(root.jspdf.jsPDF) : bad(new Error('jsPDF missing')); };
      s.onerror = function () { root._rpJsPdfP = null; bad(new Error('Could not load the PDF maker')); };
      document.head.appendChild(s);
    });
    return root._rpJsPdfP;
  }

  /* the site's own logo is WebP; jsPDF wants PNG, so draw it once on a canvas */
  function logoData(url) {
    return new Promise(function (ok) {
      if (!url) return ok(null);
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
          c.getContext('2d').drawImage(im, 0, 0); ok({ data: c.toDataURL('image/png'), w: im.naturalWidth, h: im.naturalHeight });
        } catch (e) { ok(null); }
      };
      im.onerror = function () { ok(null); }; im.src = url;
    });
  }

  function render(JsPDF, d, logo) {
    var pdf = new JsPDF({ unit: 'pt', format: 'letter' });
    var y = M, page = 1;
    var X_QTY = 372, X_RATE = 452, X_DAYS = 494, X_AMT = W - M, NAME_W = 300;
    function color(c) { pdf.setTextColor(c[0], c[1], c[2]); }
    function font(sz, bold) { pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(sz); }
    function txt(s, x, yy, o) { pdf.text(clean(s), x, yy, o || {}); }
    function rule(yy, c) { c = c || LINE; pdf.setDrawColor(c[0], c[1], c[2]); pdf.setLineWidth(0.6); pdf.line(M, yy, W - M, yy); }
    function need(h, head) {
      if (y + h <= H - 56) return;
      pdf.addPage(); page++; y = M;
      font(9, true); color(MUTE); txt((d.label || 'Quote') + ' ' + (d.number || '') + (d.title ? '  |  ' + d.title : ''), M, y + 4); y += 18;
      if (head) head();
    }

    // ---------------------------------------------------------------- header
    if (logo && logo.data) {
      var lh = 54, lw = lh * logo.w / logo.h; if (lw > 200) { lw = 200; lh = lw * logo.h / logo.w; }
      pdf.addImage(logo.data, 'PNG', M, y - 6, lw, lh);
    } else { font(18, true); color(BLUE); txt('Rare Pond Rentals', M, y + 22); }
    font(24, true); color(INK); txt((d.label || 'Quote').toUpperCase(), W - M, y + 18, { align: 'right' });
    font(9.5); color(MUTE);
    var hy = y + 34;
    [['No.', d.number], ['Date', fdate(d.created)], ['Valid until', fdate(d.valid_until)]].forEach(function (r) {
      if (!r[1]) return; txt(r[0] + '  ' + r[1], W - M, hy, { align: 'right' }); hy += 12;
    });
    y = Math.max(y + 62, hy + 6);
    rule(y); y += 20;

    // ---------------------------------------------------------------- who / what / when
    var pf = d.prepared_for || {}, colB = M + 270;
    font(8, true); color(MUTE); txt('PREPARED FOR', M, y); txt('RENTAL', colB, y); y += 14;
    var ly = y, ry = y;
    font(11, true); color(INK); if (pf.name) { txt(pf.name, M, ly); ly += 14; }
    font(10); color(INK);
    [pf.company, pf.email, pf.phone].forEach(function (v) { if (v) { txt(v, M, ly); ly += 13; } });
    if (!pf.name && !pf.company && !pf.email) { color(MUTE); txt('-', M, ly); ly += 13; }
    font(11, true); color(INK); if (d.title) { pdf.text(pdf.splitTextToSize(clean(d.title), W - M - colB), colB, ry); ry += 14 * pdf.splitTextToSize(clean(d.title), W - M - colB).length; }
    font(10); color(INK);
    var t = d.terms || {};
    if (d.starts_on) { txt('Pickup  ' + fdate(d.starts_on) + ', ' + (t.pickup || PICKUP) + (t.tz ? ' ' + t.tz : ''), colB, ry); ry += 13; }
    if (d.ends_on) { txt('Return  ' + fdate(d.ends_on) + ', ' + (t.ret || RETURN) + (t.tz ? ' ' + t.tz : ''), colB, ry); ry += 13; }
    if (d.days) { color(MUTE); txt(d.days + ' rental day' + (d.days === 1 ? '' : 's') + ' (pickup and return days both count)', colB, ry); ry += 13; }
    y = Math.max(ly, ry) + 10;

    // ---------------------------------------------------------------- the gear, department by department
    function tableHead() {
      font(7.5, true); color(MUTE);
      txt('ITEM', M + 10, y); txt('QTY', X_QTY, y, { align: 'right' }); txt('RATE', X_RATE, y, { align: 'right' });
      txt('DAYS', X_DAYS, y, { align: 'right' }); txt('AMOUNT', X_AMT, y, { align: 'right' });
      y += 6; rule(y); y += 12;
    }
    function lineRow(l, c) {
      var nm = (l.code ? l.code + '  ' : '') + (l.name || '');
      font(9.5); var parts = pdf.splitTextToSize(clean(nm), NAME_W);
      var noteParts = l.note ? (font(8), pdf.splitTextToSize(clean(l.note), NAME_W)) : [];
      var h = parts.length * 12 + noteParts.length * 10 + (l.line_discount > 0 ? 12 : 0) + 4;
      need(h, tableHead);
      pdf.setFillColor(c[0], c[1], c[2]); pdf.rect(M, y - 8, 3, Math.max(10, parts.length * 12 - 2), 'F');
      font(9.5); color(INK); pdf.text(parts, M + 10, y);
      var flat = l.rate_unit === 'flat';
      txt(num(l.qty), X_QTY, y, { align: 'right' });
      txt(money(l.rate) + (flat ? '' : '/day'), X_RATE, y, { align: 'right' });
      txt(flat ? 'flat' : String(l.days || ''), X_DAYS, y, { align: 'right' });
      txt(money(l.full), X_AMT, y, { align: 'right' });
      y += parts.length * 12;
      if (noteParts.length) { font(8); color(MUTE); pdf.text(noteParts, M + 10, y - 2); y += noteParts.length * 10; }
      if (l.line_discount > 0) {
        font(8.5); color(GREEN);
        txt((l.discount_label || 'Discount') + (l.discount_pct && l.discount_pct < 100 ? ' (' + num(l.discount_pct) + '% off)' : ''), M + 22, y);
        txt('-' + money(l.line_discount), X_AMT, y, { align: 'right' }); y += 12;
      }
      y += 3;
    }
    function sumRow(label, amount, opts) {
      opts = opts || {}; need(15);
      font(opts.size || 9.5, !!opts.bold); color(opts.color || INK);
      txt(label, opts.x || X_DAYS, y, { align: 'right' }); txt(amount, X_AMT, y, { align: 'right' }); y += opts.gap || 14;
    }

    (d.sections || []).forEach(function (s) {
      if (!s.groups || !s.groups.length) return;
      need(70);
      pdf.setFillColor(SOFT[0], SOFT[1], SOFT[2]); pdf.rect(M, y - 12, W - 2 * M, 20, 'F');
      font(10.5, true); color(INK); txt(s.label, M + 8, y + 2); y += 22;
      s.groups.forEach(function (g) {
        var c = hex(g.color);
        need(56);
        if (s.groups.length > 1 || g.label) {
          pdf.setFillColor(c[0], c[1], c[2]); pdf.circle(M + 4, y - 3.5, 3.5, 'F');
          font(10, true); color(INK); txt(g.label || g.dept || 'Other', M + 12, y); y += 14;
        }
        tableHead();
        (g.lines || []).forEach(function (l) { lineRow(l, c); });
        var gl = g.label || g.dept || String(s.label || '').split(' (')[0];
        var hasDisc = (g.line_discount > 0) || (g.group_discount > 0);
        need(20 + 15 * (1 + (hasDisc ? 1 : 0) + (g.line_discount > 0 ? 1 : 0) + (g.group_discount > 0 ? 1 : 0)), null);   // keep a group's totals together
        y += 2;
        if (hasDisc) sumRow((gl ? gl + ' ' : '') + 'full price', money(g.full), { color: MUTE });
        if (g.line_discount > 0) sumRow('Item discounts', '-' + money(g.line_discount), { color: GREEN });
        if (g.group_discount > 0) sumRow((g.group_label || ((gl ? gl + ' ' : '') + 'discount')) + ' (' + num(g.group_pct) + '% off)', '-' + money(g.group_discount), { color: GREEN });
        sumRow((gl ? gl + ' ' : '') + 'total', money(g.net), { bold: true, gap: 20 });
      });
    });

    // ---------------------------------------------------------------- summary: full price, every discount, total
    var secs = (d.sections || []).filter(function (s) { return s.groups && s.groups.length; });
    var rowsN = secs.length + (d.order_discount ? 1 : 0) + 4;
    need(rowsN * 15 + 60);
    y += 4; rule(y, INK); y += 18;
    font(10.5, true); color(INK); txt('Summary', M, y); y += 16;
    var SX = W - M - 230;
    function srow(label, amount, o) {
      o = o || {}; font(o.size || 10, !!o.bold); color(o.color || INK);
      txt(label, SX, y); txt(amount, X_AMT, y, { align: 'right' }); y += o.gap || 15;
    }
    secs.forEach(function (s) {
      srow(s.label + (s.full !== s.net ? ' (full price)' : ''), money(s.full));
      var sd = (Number(s.full) || 0) - (Number(s.net) || 0);
      if (sd > 0.004) srow('   Discounts', '-' + money(sd), { color: GREEN });
    });
    if (d.order_discount && d.order_discount.amount > 0) {
      srow((d.order_discount.label || 'Order discount') + ' (' + num(d.order_discount.pct) + '% off)', '-' + money(d.order_discount.amount), { color: GREEN });
    }
    y += 2; pdf.setDrawColor(INK[0], INK[1], INK[2]); pdf.setLineWidth(0.8); pdf.line(SX, y - 8, W - M, y - 8); y += 6;
    srow('Total' + (d.days ? ' (' + d.days + ' day' + (d.days === 1 ? '' : 's') + ')' : ''), money(d.total), { bold: true, size: 14, gap: 18 });
    if (d.discount_total > 0.004) srow('You save ' + money(d.discount_total) + ' off ' + money(d.full_total), '', { color: GREEN, size: 9.5 });
    if (d.estimate) {
      font(8.5); color(MUTE);
      var en = pdf.splitTextToSize('Estimate from the website. Rare Pond confirms the final price and availability.', W - M - SX);
      pdf.text(en, SX, y); y += en.length * 11 + 2;
    }

    // ---------------------------------------------------------------- notes and terms
    y += 8;
    if (d.public_note) {
      font(9.5); var np = pdf.splitTextToSize(clean(d.public_note), W - 2 * M - 16);
      need(np.length * 12 + 28);
      font(8, true); color(MUTE); txt('NOTE', M, y); y += 12; font(9.5); color(INK); pdf.text(np, M, y); y += np.length * 12 + 8;
    }
    var terms = [
      'Pickup on the first rental day, ' + (t.pickup || PICKUP) + '; return on the last rental day, ' + (t.ret || RETURN) + (t.tz ? ' (' + t.tz + ')' : '') +
        '. Both days count as rental days. ' + (t.note == null ? NOTE : t.note),
      d.valid_until ? 'Prices are held until ' + fdate(d.valid_until) + '. Gear is reserved only once the rental is confirmed.' : 'Gear is reserved only once the rental is confirmed.',
      'All prices in US dollars.'
    ];
    if (d.rv_total > 0) terms.push('Replacement value of the Rare Pond gear on this quote: ' + money(d.rv_total) + '. This is not a charge; it is the amount to insure the gear for (certificate of insurance naming Rare Pond Studios), or the renter\'s responsibility if gear is lost or damaged.');
    font(8.5); var tl = [];
    terms.forEach(function (s) { tl = tl.concat(pdf.splitTextToSize(clean(s), W - 2 * M)); });
    need(tl.length * 11 + 24);
    font(8, true); color(MUTE); txt('TERMS', M, y); y += 12; font(8.5); color(MUTE); pdf.text(tl, M, y); y += tl.length * 11;

    // every page gets the footer; the last one too
    var total = pdf.getNumberOfPages();
    for (var i = 1; i <= total; i++) {
      pdf.setPage(i); page = i; font(8); color(MUTE);
      txt('Rare Pond Rentals  |  rentals@rarepond.com  |  (213) 222-8166  |  rarepond.com/rentals', M, H - 24);
      txt((d.label || 'Quote') + ' ' + (d.number || '') + '  |  Page ' + i + ' of ' + total, W - M, H - 24, { align: 'right' });
    }
    return pdf;
  }

  function filename(d) {
    var t = clean(d.title || 'Rental').replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'Rental';
    return 'Rare_Pond_' + (d.label || 'Quote') + '_' + (d.number || '') + '_' + t + '.pdf';
  }

  /* make(doc, {logoUrl}) -> Promise<jsPDF>; download(doc, opts); blob(doc, opts) -> Promise<Blob>; base64(doc, opts) */
  function make(d, o) {
    o = o || {};
    return Promise.all([load(), o.logo ? Promise.resolve(o.logo) : logoData(o.logoUrl)]).then(function (r) { return render(r[0], d, r[1]); });
  }
  root.RPQuotePDF = {
    load: load, make: make, money: money, filename: filename, _render: render,
    download: function (d, o) { return make(d, o).then(function (p) { p.save(filename(d)); return p; }); },
    blob: function (d, o) { return make(d, o).then(function (p) { return p.output('blob'); }); },
    base64: function (d, o) { return make(d, o).then(function (p) { return p.output('datauristring').split(',')[1]; }); }
  };
})(typeof window !== 'undefined' ? window : this);
