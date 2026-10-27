# Rare Pond Rentals - website

The gear rentals site for Rare Pond Studios, live at **www.rarepond.com/rentals/**. It is part of this repo and deploys with the studio site (Cloudflare Pages, on every push to `main`). For running rentals day to day, the plain-language guide is the ClickUp Wiki doc **Rentals Handbook (Info)**; the technical notes are in OPERATIONS.md.

## What's in here

```
rentals/
├─ index.html            the page (light; all logic is in assets/)
├─ form-check.html       one‑click "are my forms wired correctly?" tool (see below)
├─ assets/
│  ├─ styles.css         all styling
│  ├─ availability.js    live availability (reads Supabase, greys out booked gear)
│  └─ app.js             app logic + a built-in copy of the catalog (refreshed hourly)
└─ media/                local images (logos, older gear photos)
```

> **Form config moved to the shared `/assets/form-config.js`** (site‑level, not
> `rentals/assets/`). It is loaded by BOTH the studio home (crew form) and the rentals
> cart, and it must stay reachable even while the rentals page is temporarily closed,
> anything under `/rentals/` is replaced by the "back soon" cover when closed, which would
> otherwise hand the studio HTML instead of the script. `/assets/` is never covered.
> **It is still THE ONLY FILE YOU EDIT to change the forms**, just at the new path.

Gear photos are uploaded through NocoDB (stored on Cloudflare R2) and shown in 16:9 frames (see the photo standard in the handbook). Off‑screen images lazy‑load.

---

## Maintaining the forms (the part built so you don't need a developer)

Both on‑site forms - the **Rental Request** (from the cart) and the **Crew Inquiry** (from the home page) - keep the site's custom styling and **post their answers to Jotform**, so every submission lands in one Jotform dashboard you can view, export, and manage.

Everything that can break lives in **one file: `/assets/form-config.js`.** Nothing else references Jotform.

> Behind the scenes a submission also flows Jotform -> HubSpot (the hidden `rp_order_data` field becomes a deal) -> n8n -> Supabase (the booking, which then drives availability) and a Google Calendar hold. Those hidden fields and the `orderData` payload format must not be renamed - see OPERATIONS.md.

### To add or change a question
1. In **Jotform**, add/rename the field. Copy its **input name** - Jotform → *Publish → Embed → Source Code*; each input looks like `name="q7_insurance"`. That number is stable (reordering fields in Jotform does **not** change it).
2. In `/assets/form-config.js`, add/adjust the line in `fields`: `siteKey: "q7_insurance"`.
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

---

## Cross‑browser (Safari + Chrome)

The site avoids the WebKit‑fragile patterns (no SVG turbulence/displacement filters, no `backdrop-filter`, no `:has()` dependencies); masks are `-webkit-` prefixed. `aspect-ratio` is used for the 16:9 photo frames (Safari 15 and later). It uses standard fl/grid, transforms, gradients and `filter: blur`, all of which render the same in Safari and Chrome. Test URL after deploy on both.

## Performance

Small HTML + external, cached, lazy‑loaded images; fonts preconnected. Same visual detail, light payload.

---

## Deploying

Push to `main` of this repo and Cloudflare Pages deploys the whole site in about a minute. The pre-commit hook
stamps fresh `?v=` versions on the rentals scripts so returning visitors get the new files (OPERATIONS.md,
"Rentals page loads fresh after every change").

---

## Adding new gear (availability is driven by physical UNITS)

Item availability on the website is driven by the **units** table (one row per
physical copy), **not** by a manually typed quantity. The `items.qty` field is
kept in sync automatically and should be treated as read-only.

**To add a new rentable item** (NocoDB, base Rare Pond Rentals):

1. **Add the item row** in **items**: name, department (`category`), price, replacement value, photo (Image),
   and pick its **Section**. Leave the number empty (it is given automatically) and keep `kind` = `item`.
   The database gives it **one unit** (one physical copy) by itself, so it shows as "1 available".
2. **More copies:** add a row in **units** per extra copy, linked to the item; they get letters A, B, C.
   The site shows "N available" for N copies.
3. **Parts of a kit** (sub-items, `parent_id` set) count per copy of the kit: set **Per copy** (how many come with ONE
   copy). The part's copies follow the kit's copies by themselves (3 C-Stands x 1 Base = 3 Bases); see OPERATIONS.
4. **If gear is lost, sold or retired**, delete its unit rows. To pull a copy
   temporarily, set its `condition_status` to `in_repair` or `missing` (NocoDB
   units, view **Condition**): availability, reservations and the scan app skip
   it, a damage_events row opens by itself, and setting it back to `ok` closes
   that row. `items.copies_condition` shows every item's copies at a glance
   (read only). With **zero units the item auto-hides** from the catalog.
5. **Bookings are handled automatically:** the date picker calls the
   `catalog_availability` RPC, so an item still shows in the catalog
   but is **greyed out for dates where all its units are already booked**. You do
   not manage that by hand.

**Parts of a kit are unit-tracked too.** Every physical thing the studio owns gets a unit row, including the parts
inside a kit (sub-items, whose **Belongs to kit** is the kit). A part that comes in several identical pieces (two
straps) gets one unit per piece. For a **shared** part (one physical piece listed under several kits via
`shared_parent_ids`), create units **once** for that row, do not multiply by the number of kits it appears in.

**How the sync works:** a headless job,
`~/bts-automation/rentals_units_sync.py`, recomputes each item's
`qty` = its unit count (items **and** sub-items) and PATCHes
NocoDB only when it changed. It runs on login and every few minutes via the launchd agent
`com.rarepond.rentalsunitssync`, and logs to
`~/bts-automation/rentals_units_sync.log`. So there is a short (a couple of
minutes) delay between adding/removing units and the count updating; you can
force it immediately by running the script once.

**Sections (since 2026-10-25):** the headings inside a department are rows in NocoDB "Sections"; pick an item's
**Section** to move it. See OPERATIONS.md, "Sections".

**Packages (since 2026-10-25)** are no longer rows in `items`. They live in `public.packages` (code `PKG-NNN`)
with their gear in `public.package_lines`, and come in two kinds: a fixed package with one day rate, and a
"Build your own" (customer picks, e.g. PKG-001 Build Your Own Grip Crate). A package is available when every
piece in it is free for the dates; booking one books each piece's unit, tagged with the package. Make and
fill them in NocoDB (Packages: the Gear link; package_lines for qty and max). Full notes:
OPERATIONS.md, "Packages, Build your own, carts".
