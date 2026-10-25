/* Cloudflare Pages Function - rentals gear QR resolver.
 *
 * Every rental sticker QR points here: https://rarepond.com/g/<item_no>. Stickers printed
 * before the 2026-10-20 apex cutover encode www.rarepond.com/g/..., which the zone
 * Redirect Rule (www -> apex, path kept) sends here unchanged.
 * ONE code, TWO audiences:
 *   - Staff ON the Tailscale tailnet reach the internal scan app and are
 *     forwarded straight to that item's in/out page.
 *   - Anyone OFF the tailnet (a customer, the public) cannot reach the tailnet
 *     address, so after a short probe they are sent to the public "Found this item?"
 *     page (rarepond.com/found, a Pages CMS custom page with the rentals contact
 *     details). Nothing on the way says which item was scanned.
 *
 * The branch happens in the visitor's browser: the page probes the scan app's
 * /healthz with a no-cors fetch (which only resolves when the host is actually
 * reachable) and redirects accordingly.
 * 2026-10-25: two checks run at once and the first to succeed wins:
 *   the tailnet: pond.tail8c2778.ts.net:8444 (no-cors probe, as before). Fails on phones with iCloud Private
 *     Relay, which send browser traffic through public relays that cannot reach the tailnet;
 *   Cloudflare Access: scan.rarepond.com/healthz with the phone's Access cookie (CORS, credentials). Only answers
 *     "ok" for a phone already signed in with a Rare Pond Google Workspace account; anyone else gets Cloudflare's
 *     sign-in redirect, which the check treats as a no.
 * Nobody signed in and not on the tailnet = the public /found page, exactly as before.
 */
const TAILNET = 'https://pond.tail8c2778.ts.net:8444';
const ACCESS = 'https://scan.rarepond.com';         // Cloudflare Access (Google sign-in) -> tunnel -> scan app
const HOME = 'https://rarepond.com/';
const FOUND = 'https://rarepond.com/found';   // public landing for anyone off the tailnet
const TIMEOUT_MS = 4000;                        // cellular + a relayed tailnet connection can need 3 s

export async function onRequest(context) {
  const raw = String((context.params && context.params.id) || '');
  // item 2100, unit 3100-A, and (2026-10-24) sub-item pills like 2100.001-B / 1100.020-A, which used to fall
  // through to the home page. A pill opens its kit's check in/out page (the scan app's /find resolves it).
  const m = raw.match(/^(\d+)(\.\d{3})?(?:-([A-Za-z]{1,2}))?$/);
  if (!m) {
    return Response.redirect(HOME, 302);
  }
  const num = m[1];
  const sub = m[2] || '';
  const letter = m[3] ? m[3].toUpperCase() : '';
  const id = num + sub + (letter ? '-' + letter : '');     // human label
  const path = sub ? ('/find?code=' + encodeURIComponent(id)) : letter ? ('/u/' + num + '-' + letter) : ('/i/' + num);
  const scan = ACCESS + path;                           // the staff link shown while probing (signs in if needed)
  const html =
'<!doctype html><html lang="en"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<meta name="robots" content="noindex,nofollow">' +
'<title>Rare Pond Rentals</title>' +
'<style>html,body{height:100%}body{margin:0;display:flex;align-items:center;justify-content:center;' +
'background:#0a1f3c;color:#eaf1ff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}' +
'.b{max-width:340px;padding:24px}.spin{width:26px;height:26px;border:3px solid #24406e;border-top-color:#7aa2ff;' +
'border-radius:50%;margin:0 auto 14px;animation:s 0.8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}' +
'a{color:#7aa2ff}.mut{color:#a9c2e8;font-size:14px;margin-top:10px}</style></head>' +
'<body><div class="b"><div class="spin"></div>' +
'<div>One moment…</div>' +
'<div class="mut"><a href="' + scan + '">Staff: open scan tool</a> &middot; <a href="' + FOUND + '">Found this item?</a></div>' +
'</div><script>' +
'(function(){var tn=' + JSON.stringify(TAILNET) + ',ac=' + JSON.stringify(ACCESS) + ',path=' + JSON.stringify(path) + ',home=' + JSON.stringify(FOUND) + ';' +
'var done=false,left=2;function go(u){if(done)return;done=true;location.replace(u);}' +
'function no(){if(--left===0){clearTimeout(t);go(home);}}' +
'var t=setTimeout(function(){go(home);},' + TIMEOUT_MS + ');' +
'try{fetch(tn+"/healthz",{mode:"no-cors",cache:"no-store"}).then(function(){clearTimeout(t);go(tn+path);},no);}catch(e){no();}' +
'try{fetch(ac+"/healthz",{mode:"cors",credentials:"include",cache:"no-store"}).then(function(r){return r.ok?r.text():"";})' +
'.then(function(x){if(x==="ok"){clearTimeout(t);go(ac+path);}else no();},no);}catch(e){no();}' +
'})();</script></body></html>';
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
