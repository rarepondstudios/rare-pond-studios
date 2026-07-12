# Rare Pond Rentals - website

A standalone gear‑rentals site for Rare Pond Studios. Built to deploy as its **own Cloudflare Pages project**, separate from the studio site (rarepond.com), and cross‑linked to it.

## What's in here

```
rare-pond-rentals/
├─ index.html            the site (light – ~3 KB; all logic/data is in assets/)
├─ form-check.html       one‑click "are my forms wired correctly?" tool (see below)
├─ assets/
│  ├─ styles.css         all styling
│  ├─ form-config.js     ← THE ONLY FILE YOU EDIT to change the forms
│  └─ app.js             app logic + the gear catalog data
└─ media/                all images as cached files (products, kits, logo)
```

The gear photos are real image files (not embedded), so browsers cache them and the page loads fast on phones. Off‑screen images lazy‑load.

---

## Maintaining the forms (the part built so you don't need a developer)

Both on‑site forms - the **Rental Request** (from the cart) and the **Crew Inquiry** (from the home page) - keep the site's custom styling and **post their answers to Jotform**, so every submission lands in one Jotform dashboard you can view, export, and manage.

Everything that can break lives in **one file: `assets/form-config.js`.** Nothing else references Jotform.

### To add or change a question
1. In **Jotform**, add/rename the field. Copy its **input name** - Jotform → *Publish → Embed → Source Code*; each input looks like `name="q7_insurance"`. That number is stable (reordering fields in Jotform does **not** change it).
2. In `assets/form-config.js`, add/adjust the line in `fields`: `siteKey: "q7_insurance"`.
3. To make a **new** question actually appear on the site, also add a line to that form's `render` list (`label` + `type`). Standard types (`text`, `email`, `url`, `yesno`) render automatically in the site's styling - no other code.
4. Open **`/form-check.html`**, paste your Jotform API key, and click **Run check** (see next section).
5. Submit **one test entry** on the site and confirm it lands complete in your Jotform inbox.

> The multi‑step Review → Confirm → "Request sent!" flow, the cart/date auto‑fill, and the crew role→person cards are custom code. Everyday text/email/link/yes‑no questions are all config - those you own.

### Catching problems yourself (three independent safety nets)
- **`form-check.html`** - pulls the live field list from Jotform via the API and diffs it against `form-config.js`. It prints, in plain English: ✅ each field mapped, ⚠️ a Jotform field the site isn't sending yet (e.g. *"you added `q10_screenplay` - add it to the config"*), or ⛔ a mapping that points at a field that no longer exists. Run it any time you edit a form. Your API key is used only in your browser; nothing is stored.
- **Loud submit** - if the site can't reach Jotform, it logs a clear console warning **and** opens a pre‑filled email to rentals@rarepond.com as a fallback, so a lead is never silently lost.
- **The Jotform inbox** - after any change, submit a test; any blank column in the submission = that field isn't mapping. Turn on Jotform's notification email so a blank field is obvious the moment a real request arrives.

### The two emails on submit (configured in Jotform, not code)
- **Internal notification → rentals@rarepond.com** (Jotform‑branded is fine): Jotform → *Settings → Emails → Notification*.
- **Client autoresponder → the requester, styled like the site, from rentals@rarepond.com**: Jotform → *Settings → Emails → Autoresponder*. Design it as HTML with the logo/colors, echo their submitted fields (and the gear list/dates via the hidden fields), and end with "we'll get back to you soon." To make it truly send **from** rentals@rarepond.com, add and **verify** that sender under Jotform → *Account → Sender Emails* (a one‑time SPF/DKIM step). Until verified, it sends from Jotform with rentals@ as reply‑to.

### What I still need from you to switch it on
- Create the two Jotform forms ("Rental Request", "Crew Inquiry").
- Paste their **form IDs** into `assets/form-config.js`, and confirm the field **input names** match the `fields` map.
- Set up the Notification + styled Autoresponder and verify rentals@ as a sender.
Until those IDs are filled in, the site runs on the email fallback (fully functional) and the health check will tell you exactly what's left.

---

## Cross‑browser (Safari + Chrome)

The site avoids the WebKit‑fragile patterns (no SVG turbulence/displacement filters, no `backdrop-filter`, no `aspect-ratio`/`:has()` dependencies); masks are `-webkit-` prefixed. It uses standard fl/grid, transforms, gradients and `filter: blur`, all of which render the same in Safari and Chrome. Test URL after deploy on both.

## Performance

Small HTML + external, cached, lazy‑loaded images; fonts preconnected. Same visual detail, light payload.

---

## Deploying as a SEPARATE Cloudflare site (linked to the studio site)

This folder is a complete static site - no build step.

1. **New Git repo** (e.g. `rarepondstudios/rare-pond-rentals`) - keep it separate from the studio repo.
2. **New Cloudflare Pages project** pointing at that repo. Build command: *none*. Output directory: `/` (root).
3. **Domain:** give it its own hostname - recommended `rentals.rarepond.com` (a subdomain, added in Pages → Custom domains) so it's clearly a separate site from rarepond.com but on-brand.
4. **The cross‑link is already built in:** the rentals header has a "Studio Site ←" button; on the studio site, the matching "Rental Site →" button should point to this new hostname. (Header logo/duck is bundled locally in `media/` so there's no dependency on the studio site's assets.)

The forms need no server - the Jotform POST + health‑check API call run client‑side. (If you later choose the fully API‑driven form option, that one would add a small Cloudflare Pages Function; the current setup does not.)
