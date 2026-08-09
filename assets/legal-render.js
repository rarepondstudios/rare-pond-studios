/* legal-render.js - draws the Terms of Use and Privacy Policy pages from data/legal.json.

   SINGLE SOURCE OF TRUTH: bts-automation/legal_render.js. Published to
   <repo>/assets/legal-render.js on BOTH sites by social_ui_sync.py. Edit the master, not a copy.

   The page files are shells: site chrome, then <main data-legal="terms"> (or "privacy").
   Everything inside that <main> is written here out of data/legal.json, so the whole document
   is editable in Pages CMS without anyone touching code.

   VARIABLES. Any [name] in a heading or body is swapped for the matching value in legal.json
   "vars" (the fixed fields) or "vars.custom" (name/value pairs added in the CMS). A variable
   that has no value yet renders as an amber placeholder rather than vanishing, so an unfilled
   field is visible on the page instead of reading as a finished sentence. A [word] that is not
   a known variable is left exactly as typed.

   INLINE MARKUP allowed in body text: <strong> <em> <b> <i> <u> <code> <small> <sup> <sub>
   <br> <nobr> and <a href="...">. Everything else is escaped and shown literally, so a stray
   angle bracket can never break the page or inject anything. Emails and https:// addresses
   typed as plain text become links by themselves.
*/
(function () {
  var main = document.querySelector('main[data-legal]');
  if (!main) return;
  var DOC = main.getAttribute('data-legal') || 'terms';
  var P = document.querySelector('.lg-main') ? 'lg' : 'jc';  // class prefix: Rare Pond vs Jack Carlsen
  var TODO_A = '{{unset:', TODO_B = '}}';  // marks a variable with no value yet

  /* Friendly names for the amber "not filled in yet" placeholder. */
  var LABELS = {
    businessName: 'business name', ownerName: 'owner name', contactEmail: 'contact email',
    privacyEmail: 'privacy email', phone: 'phone number',
    /* The postal address carries its own city and state. [state] and [county] below are the
       legal ones (Governing law, "[state] residents"), so moving the office cannot quietly
       change which state's law the documents claim to run under. */
    mailingStreet: 'street address', mailingCity: 'city', mailingState: 'state',
    mailingZip: 'ZIP code',
    state: 'state', county: 'county', region: 'region',
    siteDomain: 'site domain', siteName: 'site name'
  };

  /* ---------- variables ---------- */

  function buildVars(v) {
    var out = {};
    v = v || {};
    Object.keys(v).forEach(function (k) {
      if (k !== 'custom' && (typeof v[k] === 'string' || typeof v[k] === 'number')) out[k] = v[k];
    });
    (v.custom || []).forEach(function (c) {
      if (c && c.name) out[String(c.name).trim()] = c.value;
    });
    return out;
  }

  /* A name counts as a variable if it is one of the fixed ones (LABELS) OR is present in the
     data. Checking LABELS matters: Pages CMS DROPS a field entirely when it is saved empty, so
     an emptied variable arrives here as a missing key, not a blank one. Keying off presence
     alone printed the raw "[mailingZip]" in that case instead of the amber chip, which is the
     silent-blank failure this whole design exists to prevent, arriving through a side door.
     Blank and missing must behave identically. A bracketed word that is neither is left as typed. */
  function subVars(raw, vars) {
    return String(raw == null ? '' : raw).replace(/\[([A-Za-z][\w-]*)\]/g, function (whole, name) {
      if (!(name in vars) && !(name in LABELS)) return whole;   // not one of ours, leave it alone
      var val = vars[name];
      if (val == null || String(val).trim() === '') return TODO_A + (LABELS[name] || name) + TODO_B;
      return String(val);
    });
  }

  /* ---------- text to safe HTML ---------- */

  var ESCMAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESCMAP[c]; });
  }

  var INLINE = 'strong|em|b|i|u|code|small|sup|sub|br|nobr';

  function safeHref(u) {
    u = String(u || '').trim();
    return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u) ? u : '#';
  }

  /* Put back ONLY the handful of inline tags above. Everything else stays escaped. */
  function restore(html) {
    html = html.replace(new RegExp('&lt;(\\/?)(' + INLINE + ')\\s*\\/?&gt;', 'gi'), function (m, slash, tag) {
      tag = tag.toLowerCase();
      if (tag === 'nobr') return slash ? '</span>' : '<span style="white-space:nowrap">';
      return '<' + slash + tag + '>';
    });
    html = html.replace(/&lt;a\s+href=(?:&quot;|&#39;)([^&]*?)(?:&quot;|&#39;)\s*&gt;/gi, function (m, href) {
      var h = safeHref(href);
      var ext = /^https?:\/\//i.test(h) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(h) + '"' + ext + '>';
    });
    return html.replace(/&lt;\/a&gt;/gi, '</a>');
  }

  function todoSpans(html) {
    var re = new RegExp(TODO_A.replace(/[{}]/g, '\\$&') + '(.*?)' + TODO_B.replace(/[{}]/g, '\\$&'), 'g');
    return html.replace(re, function (m, label) {
      return '<span class="' + P + '-todo">[' + label + ' to be added]</span>';
    });
  }

  function fmt(raw, vars) { return todoSpans(restore(esc(subVars(raw, vars)))); }

  /* Same substitution, but for places that take plain text (the browser tab, the meta
     description): no markup, and an unfilled variable reads as a bracketed note. */
  function plain(raw, vars) {
    var re = new RegExp(TODO_A.replace(/[{}]/g, '\\$&') + '(.*?)' + TODO_B.replace(/[{}]/g, '\\$&'), 'g');
    return subVars(raw, vars).replace(re, function (m, label) { return '[' + label + ' to be added]'; })
      .replace(/<[^>]*>/g, '').trim();
  }

  /* Blank line = new paragraph. A single newline is just a wrap and is folded to a space. */
  function paras(raw, vars, cls) {
    return String(raw == null ? '' : raw).split(/\n\s*\n/).map(function (chunk) {
      chunk = chunk.replace(/\s*\n\s*/g, ' ').trim();
      if (!chunk) return '';
      return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + fmt(chunk, vars) + '</p>';
    }).join('');
  }

  /* ---------- blocks ---------- */

  function block(b, vars) {
    if (!b) return '';
    var t = String(b.type || 'paragraph').toLowerCase();
    if (t === 'subheading') return b.text ? '<h3>' + fmt(b.text, vars) + '</h3>' : '';
    if (t === 'list') {
      var li = (b.items || []).filter(function (i) { return String(i || '').trim(); })
        .map(function (i) { return '<li>' + fmt(i, vars) + '</li>'; }).join('');
      return li ? '<ul>' + li + '</ul>' : '';
    }
    if (t === 'note') return b.text ? '<div class="' + P + '-note">' + paras(b.text, vars) + '</div>' : '';
    if (t === 'card') return b.text ? '<div class="' + P + '-card">' + paras(b.text, vars) + '</div>' : '';
    if (t === 'table') {
      var rows = (b.rows || []).filter(function (r) { return r && (r.label || r.text); })
        .map(function (r) {
          return '<tr><th>' + fmt(r.label, vars) + '</th><td>' + fmt(r.text, vars) + '</td></tr>';
        }).join('');
      return rows ? '<div class="' + P + '-card"><table>' + rows + '</table></div>' : '';
    }
    return paras(b.text, vars);
  }

  function hasContent(s) {
    if (!s) return false;
    if (String(s.heading || '').trim()) return true;
    return (s.blocks || []).some(function (b) {
      return b && (String(b.text || '').trim() || (b.items || []).length || (b.rows || []).length);
    });
  }

  /* ---------- plain emails and https:// addresses become links ---------- */

  var RE_MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  var RE_URL = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/;

  function autolink(root) {
    var skip = { A: 1, CODE: 1, SCRIPT: 1, STYLE: 1, H1: 1 };
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walk.nextNode())) { if (!skip[n.parentNode.nodeName]) nodes.push(n); }
    nodes.forEach(function (node) {
      var rest = node.nodeValue, frag = document.createDocumentFragment(), hit = false;
      while (rest) {
        var mm = RE_MAIL.exec(rest), mu = RE_URL.exec(rest);
        var mail = mm && (!mu || mm.index < mu.index);
        var m = mail ? mm : mu;
        if (!m) break;
        hit = true;
        frag.appendChild(document.createTextNode(rest.slice(0, m.index)));
        var a = document.createElement('a');
        a.href = mail ? 'mailto:' + m[0] : m[0];
        if (!mail) { a.target = '_blank'; a.rel = 'noopener'; }
        a.textContent = m[0];
        frag.appendChild(a);
        rest = rest.slice(m.index + m[0].length);
      }
      if (!hit) return;
      frag.appendChild(document.createTextNode(rest));
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* ---------- render ---------- */

  function render(data) {
    var vars = buildVars(data.vars);
    var doc = data[DOC] || {};
    var numbered = doc.numberSections !== false;
    var html = '';
    if (doc.title) html += '<h1>' + fmt(doc.title, vars) + '</h1>';
    if (doc.effectiveDate) {
      html += '<p class="' + P + '-eff">Effective date: ' + fmt(doc.effectiveDate, vars) + '</p>';
    }
    if (doc.intro) html += paras(doc.intro, vars, P + '-lead');
    var n = 0;
    (doc.sections || []).forEach(function (s) {
      if (!hasContent(s)) return;               // a half-finished section is never shown to a visitor
      var head = '';
      if (String(s.heading || '').trim()) {
        head = '<h2>' + (numbered ? (++n) + '. ' : '') + fmt(s.heading, vars) + '</h2>';
      }
      html += head + (s.blocks || []).map(function (b) { return block(b, vars); }).join('');
    });
    main.innerHTML = html;
    autolink(main);
    if (doc.browserTitle) document.title = plain(doc.browserTitle, vars);
    var md = document.querySelector('meta[name="description"]');
    if (md && doc.metaDescription) md.setAttribute('content', plain(doc.metaDescription, vars));
  }

  function fail() {
    main.innerHTML = '<h1>' + (DOC === 'privacy' ? 'Privacy Policy' : 'Terms of Use') + '</h1>'
      + '<p>This page could not be loaded just now. Please refresh, or get in touch and we will'
      + ' send you a copy.</p>';
  }

  fetch('/data/legal.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d) render(d); else fail(); })
    .catch(fail);
})();
