/* Sink for the production error beacon (assets/error-beacon.js).
 *
 * It does two safe things and nothing else:
 *   1. console.log the report, so it shows up in `wrangler pages deployment tail`.
 *   2. If CLIENT_ERROR_WEBHOOK is set in the Cloudflare Pages env, forward the
 *      report there (e.g. an n8n webhook that emails you). No env var => no forward.
 *
 * It stores nothing, needs no auth, and ALWAYS returns 204 so a visitor's browser
 * never sees an error from the reporter. Body is size-capped defensively.
 */
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    let text = '';
    try { text = (await request.text()).slice(0, 4000); } catch (e) { text = ''; }
    if (!text) return new Response(null, { status: 204 });

    // Log for tailing. Prefix makes it easy to grep in the live tail.
    console.log('[client-error]', text);

    const hook = env && env.CLIENT_ERROR_WEBHOOK;
    if (hook) {
      // Fire-and-forget; never block or fail the response on the webhook.
      context.waitUntil(
        fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: text,
        }).catch(() => {})
      );
    }
  } catch (e) {
    // swallow - the beacon must be harmless
  }
  return new Response(null, { status: 204 });
}

// Any non-POST just returns 204 too, so probes get nothing interesting.
// Method-specific exports only, so onRequestPost is never shadowed.
export async function onRequestGet() {
  return new Response(null, { status: 204 });
}
export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
