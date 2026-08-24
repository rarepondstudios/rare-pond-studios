/* Cloudflare Pages Function - rentals gear QR resolver.
 *
 * Every rental sticker QR points here: https://www.rarepond.com/g/<item_no>.
 * ONE code, TWO audiences:
 *   - Staff ON the Tailscale tailnet reach the internal scan app and are
 *     forwarded straight to that item's in/out page.
 *   - Anyone OFF the tailnet (a customer, the public) cannot reach the tailnet
 *     address, so after a short probe they are bounced to the rarepond home page.
 *
 * The branch happens in the visitor's browser: the page probes the scan app's
 * /healthz with a no-cors fetch (which only resolves when the host is actually
 * reachable) and redirects accordingly. The scan app itself stays tailnet-only;
 * nothing here exposes it publicly. The tailnet hostname is not a secret - it is
 * unreachable and ACL-gated regardless.
 */
const SCAN_HOST = 'https://pond.tail8c2778.ts.net:8444';
const HOME = 'https://www.rarepond.com/';
const TIMEOUT_MS = 2500;

export async function onRequest(context) {
  const raw = (context.params && context.params.id) || '';
  const id = String(raw).replace(/[^0-9]/g, '');
  if (!id) {
    return Response.redirect(HOME, 302);
  }
  const scan = SCAN_HOST + '/i/' + id;
  const probe = SCAN_HOST + '/healthz';
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
'<div>Opening gear item ' + id + '…</div>' +
'<div class="mut"><a href="' + scan + '">Staff: open scan tool</a> &middot; <a href="' + HOME + '">Rare Pond</a></div>' +
'</div><script>' +
'(function(){var scan=' + JSON.stringify(scan) + ',home=' + JSON.stringify(HOME) + ',probe=' + JSON.stringify(probe) + ';' +
'var done=false;function go(u){if(done)return;done=true;location.replace(u);}' +
'var t=setTimeout(function(){go(home);},' + TIMEOUT_MS + ');' +
'try{fetch(probe,{mode:"no-cors",cache:"no-store"}).then(function(){clearTimeout(t);go(scan);})' +
'.catch(function(){clearTimeout(t);go(home);});}catch(e){clearTimeout(t);go(home);}' +
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
