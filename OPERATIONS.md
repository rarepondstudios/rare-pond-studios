# How the whole thing actually runs

Written for the next person — human or AI — who has to keep this working.

> **This repository is PUBLIC.** No keys, passwords, tokens or API secrets go in this file
> or anywhere else in this repo. Where a secret is needed, this document says *where it
> lives*, never what it is.

---

## The two sites

| | |
|---|---|
| **Studio** | `index.html` at the repo root → rarepond.com |
| **Rentals** | `rentals/index.html` → rarepond.com/rentals/ |

Both are plain static files with **no build step**. They fetch `data/*.json` at runtime, so
editing a JSON file changes the site with no code change.

**Hosting:** Cloudflare Pages, auto-deploying from the `main` branch of this GitHub repo.
Push to `main` → live in about a minute. There is no staging environment.

**`_headers`** sets no-cache on `/data/*` so CMS edits appear immediately.
**`_redirects`** does the SPA rewrite so deep links like `/geriaction` work.

**Editing:** [Pages CMS](https://app.pagescms.org) reads `.pages.yml` and renders the edit
forms. Saving there commits to GitHub, which redeploys. Sections: Site Settings, Color Looks,
Projects, Team, Rentals page, Form input types, Custom Pages.

---

## The rental pipeline (the part with moving parts)

A rental request travels like this:

```
Customer on /rentals/  →  Jotform (rental form)
                             │
              ┌──────────────┴───────────────┐
              │ Jotform's NATIVE integrations │   <-- these do the work. Leave them ON.
              ▼                              ▼
        HubSpot deal                  Google Calendar
   (incl. rp_order_data)         (pickup event + return event)
              │
              ▼
     n8n: "HubSpot → Rental DB Sync"  (polls HubSpot every 5 min)
              │
              ▼
        Supabase: orders + bookings   (price recomputed server-side)
              │
              ▼
     n8n: "Rental DB → HubSpot Stage Push"
```

**Critical:** the HubSpot deal and the calendar events are created by **Jotform's own native
integrations**, not by n8n. There used to be an n8n workflow doing the same job — it has been
**retired**, because running both produced duplicate deals and duplicate calendar events. If
you see duplicates reappear, something re-enabled a second path.

**`rp_order_data`** is a hidden Jotform field mapped to a HubSpot deal property. It encodes the
cart (`s:START|e:END|i:ID:QTY,ID:QTY`) and is what lets Supabase rebuild the order.

**Draft deals are skipped on purpose.** `hubspot_sync_order` returns early for deals still at
the draft stage — an order only lands in Supabase once the deal advances (e.g. to contract-sent).
That is intended behaviour, not a bug.

**Pricing is inclusive of both days.** A Jul 27 → Jul 30 rental is **4 days, not 3**. It is
computed server-side in Postgres (see the Supabase section).

---

## n8n (automations)

Runs in Docker on an in-studio machine, bound to localhost — **not reachable from the
internet**. Backed by SQLite. (Exact host, port and access details are deliberately not in this
public repo — see "Where the private details live" at the bottom.)

Live workflows:

| Workflow | What it does |
|---|---|
| HubSpot → Rental DB Sync | polls HubSpot, writes orders/bookings to Supabase |
| Rental DB → HubSpot Stage Push | pushes stage changes back |
| Website Forms → HubSpot + Calendar (crew) | crew form |
| Website Forms → HubSpot + Calendar (rental) | rental form |
| **[Alerts] Workflow Failure → Email** | fires on ANY workflow error |
| **[Alerts] Watchdog — workflow gone silent** | every 30 min, flags a workflow that has stopped running at all |

### The alerting, and why it is shaped this way
- **Layer 1** is an n8n *Error Workflow*. On n8n 2.x an error workflow **must itself be ACTIVE**
  or it silently does nothing. This was missed once and only caught by deliberately breaking a
  workflow to test it. **If you rebuild it, test it by actually causing a failure.**
- **Layer 2** is a watchdog that catches the case Layer 1 cannot: a workflow that isn't failing
  because it isn't *running*. It **auto-discovers** active workflows from the n8n API, so new
  workflows are covered with zero maintenance. "Silent" means *no execution of any status* —
  a failing workflow is Layer 1's job, not the watchdog's.
- Alerts go to an internal admin address configured inside n8n. Email only — a chat-tool alert
  would depend on the very integrations that might be down.

### Secrets
SMTP credentials and the n8n API key live **only in n8n's own credential store** (encrypted in
the Docker volume). They are not in this repo and must never be.

---

## Supabase

Postgres. Tables `orders` and `bookings`, plus a small set of RPC functions (their names are
visible in `rentals/assets/*.js` where the browser calls them; the internal-only ones are not
listed here on purpose).

The browser uses the public anon key with row-level security. **Prices are always recomputed
server-side** — the cart total shown in the browser is an estimate and is never trusted.

**Pricing lives in a Postgres function, not in the browser.** The day count is *inclusive of
both ends* — Jul 27 → Jul 30 is **4 days, not 3**. This has been wrong before. If a total ever
looks a day light, that function is the first place to look.

---

## Images

**All image specs live in `.pages.yml`** as help text on each upload field, so they appear
inside the CMS at the moment of uploading. The short version:

- **sRGB, 8-bit.** Not Display P3, not Adobe RGB.
- Video frames are **Rec.709 limited range (16–235)** and must be expanded to **full (0–255)**.
- Stills 2560×1440 · backgrounds 2560×1440 · bubbles 1200×1200 · team 800×800 · logos = PNG.
- Under 600 KB. **Never upscale.**

Film stills are a special case with their own pipeline and their own traps —
**see [`STILLS.md`](STILLS.md).** Read it before touching stills.

---

## Custom pages

A small CMS-driven page builder (drag-to-reorder blocks). **See [`CUSTOM_PAGES.md`](CUSTOM_PAGES.md).**
Adding a new block type is two edits; the doc says exactly which two.

---

## Things that have bitten us (don't re-learn these)

- **Jotform's API returns deleted submissions** with `status: DELETED`. Deleting a bad
  submission does *not* protect a workflow that reads the API — you must filter on status.
  A single junk submission once poisoned the intake for three days.
- **A crashing workflow can freeze its own cursor.** The intake stored "last processed id" in
  static data; when the code threw, the id never advanced, so it retried the same poison
  submission forever — 720 errors a day, silently, because there was no alerting. That is why
  the alerting above exists.
- **n8n `import:workflow` deactivates a workflow.** Re-activate it after importing.
- **Don't paste large code into the n8n UI editor** — it has mangled a paste before. Use the
  n8n CLI (`export:workflow` / `import:workflow`), which is byte-exact.
- **Never disable the native Jotform → HubSpot / Calendar integrations.** They are the pipeline.

---

## Where the private details live

This repo is public, so the specifics that would only help someone poking at the setup are
kept **out of it**:

- **Secrets** (SMTP, API keys) — only in n8n's encrypted credential store and Supabase's own
  dashboard. Never in git.
- **Exact host/port of the n8n box, the alert email address, internal-only RPC names** — in
  `OPERATIONS_PRIVATE.md`, kept on the studio machine **outside this repo** (and on the NAS).

If you are an AI assistant working on this and need those details, ask the owner for the
private file. Do not reconstruct them into this repo.

## Local preview

The site fetches JSON at runtime, so `file://` will not work:

```
python3 -m http.server 8080
# http://localhost:8080
```
