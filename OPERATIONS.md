# How the whole thing actually runs

Written for the next person - human or AI - who has to keep this working.

> **⚠️ 2026-08-04 refresh.** The cross-site backend has evolved since parts of this doc were
> written: site content is now built by **Python exporters on macOS launchd** (in
> `~/bts-automation`, looping the `sites.json` registry), **not** by n8n, the old n8n
> "Projects: DB to site (rarepond)" workflow was retired 2026-08-03. n8n remains event-driven
> glue only (rentals HubSpot↔DB sync, integrations, alerts, backups). There is also a THIRD
> surface, **`media/index.html` → rarepond.com/media**, and a separate jackcarlsen.com repo
> sharing the same backend. The canonical current-state master is the context folder
> **`~/Desktop/AI_System_Context`** (local, non-public; start with `START-HERE.md`), trust it
> over any stale wording below; the former `SYSTEM_SOURCE_OF_TRUTH.md` is now a pointer. The n8n-specific sections here have been corrected; the rentals pipeline,
> Supabase, alerting, and "things that have bitten us" sections remain fully current.

> **This repository is PUBLIC.** No keys, passwords, tokens or API secrets go in this file
> or anywhere else in this repo. Where a secret is needed, this document says *where it
> lives*, never what it is.

---

## Website source-of-truth rule (applies to every image/animation on the sites)

Every asset shown on rarepond.com or jackcarlsen.com is published by the `~/bts-automation` sync
scripts **from the `Website Repository/` staging folder** (inside the Synology `Current_Brand_Assets`)
**into the site repos**, and the live sites only reference files inside their own repo. So:

- A sync must only read masters from a **sorted subfolder inside `Website Repository/`** (e.g.
  `Projects (Web)/<Film>/...`, `Rare Pond Brand (Web)/Logos/`, `Rare Pond Brand (Web)/Animations/`,
  `Jack Carlsen (Web)/Logos/`). It must **never** read the raw `Rare Pond V3/Rare Pond Brand Kit/...`
  library or anything else outside `Website Repository/`.
- To put an image/animation on a site, drop a **duplicate into the right sorted folder** under
  `Website Repository/`; the sync republishes it. The brand kit is the design library, the Website
  Repository is the buffer the sites actually pull from.

Full detail (and the folder map) lives in `bts-automation/MEDIA-SPEC.md` → "Website source-of-truth
rule". Enforced in `brand_media_sync.py` and `home_logo_anim_frames.py` (masters resolve only under
`Website Repository/`).

---

## The three surfaces (one repo)

| | |
|---|---|
| **Studio** | `index.html` at the repo root → rarepond.com |
| **Rentals** | `rentals/index.html` → rarepond.com/rentals/ |
| **Media** | `media/index.html` → rarepond.com/media/ |

All three are plain static files with **no build step**. They fetch `data/*.json` at runtime, so
editing a JSON file changes the site with no code change.

**Hosting:** Cloudflare Pages, auto-deploying from the `main` branch of this GitHub repo.
Push to `main` → live in about a minute. There is no staging environment.

**`_headers`** sets no-cache on `/data/*` so CMS edits appear immediately.
**`_redirects`** does the SPA rewrite so deep links like `/geriaction` work.

**Editing, two places, one for each kind of thing:**

- **Projects (the film catalogue)** live in the **shared database**, edited through **NocoDB**
  (`http://localhost:8080`). This is the single source of truth for every project: its content,
  and which sites show it (the `on_rarepond` / `on_jackcarlsen` checkboxes). The background
  **Python exporter `projects_sync.py`** (launchd `com.rarepond.rpprojsync`, every 5 min)
  rebuilds `data/projects.json` from the database and commits it, see "The projects
  pipeline" below.
- **Everything else** stays in **[Pages CMS](https://app.pagescms.org)** (reads `.pages.yml`,
  saving commits to GitHub → redeploys): **Color Looks**, Team, Site Settings, Rentals page,
  Form input types, Custom Pages, Maintenance. The **Projects** section in Pages CMS is now just
  the site-wide *"projects page open/closed"* switch plus a **read-only mirror** of the catalogue,
  edit projects in NocoDB, not there (anything typed into the mirror is overwritten by the sync).

**Why the split:** projects change often and are shared across sites, so they belong in one
database that every site reads from. Color looks, team, and settings are small, site-specific,
and benefit from git history, so they stay in Pages CMS. A project references a color look **by
name** (`colorLook`), so the two never fight: the palette lives in Color Looks, the assignment
lives on the project.

**Recurring maintenance, the exporters' GitHub credentials expire.** The Python exporters
commit to this repo (and the jackcarlsen repo) using stored GitHub credentials (askpass
helpers in `~/bts-automation`) that can lapse. When one lapses, that site's export silently
stops committing. A desktop reminder fires ~8 days before expiry, and the rotation procedure
lives in [`tools/ROTATE-GITHUB-PAT.md`](tools/ROTATE-GITHUB-PAT.md). If "my NocoDB edit isn't
going live", check the exporter logs in `~/bts-automation` and the ClickUp "Automation
Health" doc first.

---

## The projects pipeline (database → site)

**The chain:** edit in NocoDB → the Python exporter **`projects_sync.py --site rarepond`**
(launchd `com.rarepond.rpprojsync`, in `~/bts-automation`) reads `rp.projects` from Supabase →
rebuilds `data/projects.json` (only rows with `on_rarepond` ticked) → commits to GitHub →
Cloudflare redeploys. It runs every 5 minutes and can be run by hand
(`python3 projects_sync.py --site rarepond --publish`). It **only commits when something
actually changed** (it compares by meaning, so JSON key-order never triggers a needless
commit). *(This exporter replaced the old n8n "Projects: DB to site (rarepond)" workflow on
2026-08-03; the jackcarlsen equivalent is `jc_projects_sync.py` on `com.rarepond.jcprojsync`.)*

**Where each thing lives**

| Thing | Lives in | Edited in |
|---|---|---|
| Project content (title, logline, stills, watch, images…) | `rp.projects` row | NocoDB |
| Which sites show a project | `on_rarepond` / `on_jackcarlsen` checkboxes | NocoDB |
| Per-site flags (use look, in carousel, sort order) | `rp_*` / `jc_*` columns | NocoDB |
| Colour palettes (the actual colours) | NocoDB `color_looks` table → exported to `data/colorlooks.json` | NocoDB (Pages CMS → Color Looks is view-only) |
| Projects page open/closed | `data/site.json` `projectsPublicAccess` | Pages CMS → Projects |

**How to make common changes**

- **Add a new Rare Pond project:** in NocoDB, add a row, fill the content, tick `on_rarepond`.
  Leave the color look blank and the site uses the **`signature`** look; when you want a bespoke
  palette, add a *film* look in the NocoDB `color_looks` table and put its key in the project's
  `color_look` field (with `rp_use_look` on). Within ~5 min it's live.
- **Take a project off Rare Pond (or put it back):** just untick/tick `on_rarepond` on that row.
  **Nothing is lost**, the row, all its content, and its per-site settings stay in the
  database. Re-ticking brings it back exactly as it was. (The same row can be on jackcarlsen
  independently via `on_jackcarlsen`.)
- **Change a film's colours:** edit that film's look in the NocoDB `color_looks` table. Every
  project pointing at it updates on both sites (Pages CMS → Color Looks is a view-only preview
  link). No project edit needed.
- **Close/open the projects page:** Pages CMS → Projects → the "open to the public" switch.
- **Reorder the carousel:** the `rp_sort_order` column in NocoDB (**higher = shown first**; leave
  gaps like 30/20/10 so new films slot in without renumbering).

**One source of truth:** never edit the project list inside Pages CMS, it's a read-only mirror and
the sync overwrites it. Projects + colour looks = NocoDB; team, settings, page copy = Pages CMS.

### News (added 2026-09-30), same shape as projects

**The chain:** write a row in the NocoDB `news` table (`key` = the address `/news/<key>`, `title`,
`date`, `category`, `body`, `social_links`, tick `on_rarepond` when it is ready) -> within ~5 min
`projects_folder_sync.py --profile news` (launchd `com.rarepond.newsmediasync`) creates
`Website Repository/News (Web)/<Title>/Images/` -> drop ONE portrait 3:4 photo there (a social post's frame; if several, the first line of `images` is shown) ->
`news_media_sync.py` (same job) publishes them to `media/news/<key>/images/` and fills the
`images` column -> `news_sync.py` (launchd `com.rarepond.rpnewssync`) rebuilds `data/news.json`
and the generated news block in `sitemap.xml` -> Cloudflare redeploys. The body is TWO SENTENCES
(`**bold**`, `*italic*`, `[text](url)` links); the whole text shows on the card in the /news grid and
in the popup, and the first sentence is the search description. Un-tick `on_rarepond` to take an article
down (row and folder are kept). Delete the row and the folder moves to `#recycling/`. The page's
open/closed switch and headings live in Pages CMS -> "News page" (`data/news-page.json`).
`functions/_news_seo.js` gives `/news` and `/news/<key>` real titles, descriptions, Open Graph tags
and JSON-LD at the edge, from the same `news.json`. Detail: HANDOFF.md section 0.0.-71.

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
integrations**, not by n8n. There used to be an n8n workflow doing the same job - it has been
**retired**, because running both produced duplicate deals and duplicate calendar events. If
you see duplicates reappear, something re-enabled a second path.

**`rp_order_data`** is a hidden Jotform field mapped to a HubSpot deal property. It encodes the
cart (`s:START|e:END|i:ID:QTY,ID:QTY`) and is what lets Supabase rebuild the order.

**Every request holds its gear straight away (since 2026-10-24).** When the sync first sees a
request (dates, a cart, return date not past) it creates the order at draft and reserves the units
as `held`. Held and confirmed bookings both block the website calendar and everyone else, so the
first request wins. Moving the deal on (Start Invoice Sent / In Progress) upgrades the holds to
`confirmed`; Closed Lost releases them; moving back to an early stage turns them back into holds.
A deal first seen already Closed Lost never creates an order.

**Double bookings are stopped on the site first.** Right before sending, the request popup
re-checks every line against live availability (`catalog_availability`, holds included). Anything
taken is listed in a red panel with **Remove it** and **Change dates**, and Send stays off until
it is fixed. After a successful send the cart is emptied so a request cannot go twice.

**The failsafe, when two requests slip through together.** If a request still cannot get all its
gear, the whole request is not booked: `reserve_order` calls `rp_order_conflict`, which frees
anything it took, records `conflict_at` / `conflict_items`, and sets the deal to Closed Lost. Two requests in the same 5-minute sync batch are settled by
HubSpot create time, not by the order the sync happened to read them: `rentals_mail.py` (step
`first_come`) hands the hold to the earlier one with `rp_order_swap` before any email goes out.
The later customer gets "Your Rare Pond rental request did not go through", which lists the taken
items and links back to the rentals page to send again without them or on other dates.

**Lost or cancelled requests are never counted as money (since 2026-10-24).** When a rental deal is Closed
Lost (by the failsafe, or by hand in HubSpot), `rentals_mail.py` (step `lost_amounts`) sets its HubSpot
**Amount to 0** and saves what it was quoted at in the deal property **Lost quote amount**
(`rp_lost_quote_amount`) and in `orders.lost_quote_amount`. Moving the deal back out of Closed Lost clears
the lost quote and the stage push sends the real amount again.

**Phone is required.** The website request form asks for a phone (Jotform field `q22_phone`, required on the
site, at least 10 digits). It also travels in `rp_order_data` as `p:<phone>` (`s:..|e:..|p:..|i:..`), which
`rentals_mail.py` copies into `orders.client_phone`; if the HubSpot contact has no phone it gets this one.

**Customer emails** (`bts-automation/rentals_mail.py`, launchd `com.rarepond.rentalsmail`, every
2 minutes; only orders created from 2026-10-24 on):

- *Request is in*: Jotform's own autoresponder, unchanged (em dashes removed 2026-10-24).
- *Did not go through*: the failsafe above.
- *Confirmed*: sent once when the order reaches confirmed. It lists pickup (after 11:00 AM) and
  return (by 12:00 PM) with the time zone, the gear and estimated total, **Changes from your
  request** (what was asked for vs what is booked, so adjustments made on our side show), and
  **A note from us** = `orders.confirm_note` if you typed one in NocoDB before confirming.
- To raise a concern between the request and the confirmation, just reply to the customer
  (decided 2026-10-24; no extra feature).
- Missing parts, and later "found it" / "replaced" notes: sent from the scan app (see the gear section
  below), never automatically, always with a preview first.

They are sent through the rp_admin@ Google account (`~/.config/rarepond/rentals_smtp.json`) as
"Rare Pond Rentals <rentals@rarepond.com>", Reply-To and Bcc rentals@. Until rentals@ is added
to that account as a "Send mail as" address, Gmail shows the sender as rp_admin@ (replies still
go to rentals@). The log is `bts-automation/rentals_customer_mail.log`; `DRY=1 python3
rentals_mail.py` logs instead of sending and marks nothing.

**Who has the gear.** The deal name is what the scan app and NocoDB lead with; the client's name,
email and phone (`orders.client_name`, `client_email`, `client_phone`) are copied from the deal's
HubSpot contact and shown under it. The website form does not ask for a phone, so the phone is
only there if the HubSpot contact has one.

**Time zone (admin setting).** Every "today" in the system (holds, overdue, the scan app, the
emails) uses `public.rp_today()`, the date in the time zone stored in `rp_settings`. It is set in
Pages CMS: Rentals Sub Site, "Admin: rental operations (change with care)", which also holds how
many days a customer gets to return a missing part (default 7). The website reads it from
`data/rentals.json` (`operations`); `rentals_mail.py` copies it into the database within a few
minutes of a save.

**Pricing is inclusive of both days.** A Jul 27 → Jul 30 rental is **4 days, not 3**. It is
computed server-side in Postgres (see the Supabase section).

### Item numbers, containers, unit letters and kits (since 2026-10-22, containers first since 2026-10-23, from x001)

The database numbers gear itself (`bts-automation/migrations/20261022_rentals_numbering.sql`,
`20261022c_lettered_subitems.sql`, `20261022d_containers_ids.sql`, `20261023_containers_first.sql`).
One ID per thing; the first digit is always the department (Camera 1, Lighting 2, Grip 3,
Electric 4, Sound 5, DIT 6; 7 and 8 free for new departments, one row in `public.dept_blocks`):

| What | ID | Example | On a sticker |
|---|---|---|---|
| Container | `####`, x001-x099 (a 0 in the second digit; x000 unused) | `1001` = CAM 01 | business card sticker (QR) + vinyl case number |
| Item (gear) | `####`, x100-x999 | `2100` | yes, QR |
| Sub-item | `####.###` (item + 3 digits) | `2100.001` | only the item number (pill) |
| Unit | item or sub-item code + letter | `2100-A`, `2100.001-B` | letter tab when the item has 2+ units or the sub-item is lettered |

- **Numbers are automatic:** leave the number empty when adding in NocoDB. Items and containers take
  the lowest free number in their range, sub-items the lowest free `.###` in their item, units the
  lowest free letter. Sub-items never use up item numbers. The database row id is plumbing and is
  never shown or printed.
- **Call names:** a container is called by its department code (`dept_blocks.call_prefix`: CAM, LGT,
  G&E, ELC, SND, DIT) + the last two digits, and the database keeps that at the end of its name in
  brackets ("Nanuk 935 Case (CAM 01)"); rename freely, the bracket is re-added. The same two digits go
  on the case in big department-color numbers. Scan app: "Put it in" also accepts "CAM 01".
- **Renumbers:** 2026-10-22 (gaps closed, containers created) and 2026-10-23 (containers to x001,
  gear to x100). Old to new: `~/Desktop/RarePond_Rental_Labels/Renumber_2026-10-23.csv` (and
  `bts-automation/backups/rentals_containers_first_20261023/`). Every sticker printed before is void.
- **Containers** (`items.is_container`): a case or crate holding gear of ITS department, with
  contents that change (Nanuk 935 cases CAM 01 / CAM 02, full milk crate G&E 01, half milk crates
  ELC 01 / ELC 02, Nanuk 920 sound case SND 01). Fixed inserts and tools that always stay with that
  case are its sub-items. Switching a container on hides it from the website; un-hide it to rent it.
  - What is inside right now is `units.container_unit_id`, separate from checked in/out; the
    database refuses other departments' gear, sub-items (they travel with their item) and containers
    inside containers. Every move is logged in `public.container_moves`.
  - Scan app: scanning a container lists its contents (Take out / Put it in). Checking it out takes
    the ticked contents with it (unticked = not in it: removed from the container); checking it in
    brings them back. Gear checked out on its own leaves its container and its check-in offers to
    put it back (`units.last_container_unit_id`).
- **Packages** were removed 2026-10-22 (record: `bts-automation/rentals_packages_archive_2026-10-22.md`).
  They come back later as groups of items and containers. `catalog_availability` and
  `reserve_order` still contain the package logic.
- **Lettered sub-items** (`items.lettered`): a part that has to be told apart inside its kit (the
  three STORM 80c heads 2100.001-A/B/C; 4100's V-mount batteries). Unit names carry the letter, the
  scan app ticks each letter, its pills print the letter. Leave it off for interchangeable parts.
- **A kit in one case is one item with one unit** (one QR, no letter); everything inside is a
  sub-item. Example: 2100 Aputure STORM 80c 3-Light Kit = 2100.001 heads A/B/C + 2100.002-.016 parts.
- **Retired codes:** a deleted item number or unit code goes on `public.retired_codes` and is not
  handed out again until cleared: `python3 ~/bts-automation/rentals_numbers.py clear 2100`. With no
  arguments the tool shows each department's container and gear ranges; `orphans` lists sub-items
  with no item (none since 2026-10-23). Sub-items lost their item before when the item was deleted
  (now blocked) or the parent link was cleared in NocoDB (still possible: run `orphans` now and then).
  Switching an item to or from container, or to another department, renumbers it and
  retires the old number; a kit's renumber carries its sub-item and unit codes.
- **Deleting an item:** a shared accessory (`shared_parent_ids`) moves to another item; one that
  belongs only to the deleted item blocks the delete (delete both together, or move it first).
- `items.rent_as_set` (several units booked as one set) still exists; no item uses it.
- NocoDB (2026-10-23): the items view is sorted by code (`item_id_new`, so each item is followed by its
  sub-items) and shows it as the formula column "ID"; the units view is sorted by `unit_code` and its
  "Unit ID" column shows it. Package, raw-id and unused columns are hidden in both views (the grid's
  row "#" is only the row position and cannot be hidden). The container links on units are titled
  "In container" / "Container contents". "Accessory picker (DONT TOUCH)" was left as it was. New columns or tables appear after
  **Data Sources -> Supabase Rentals -> Sync Metadata**.
- **Kept by the database (review 2026-10-23, `migrations/20261023d_db_review.sql`):**
  - A new item gets one unit by itself (qty 1); add more units for more copies.
  - Sub-items always carry their item's department (change the item's, the sub-items follow).
  - Names are trimmed (no stray spaces). `sort_order`, which the website lists by, follows the ID.
  - Unit names are generated: "Item name (2100-A)"; a container's unit is just its name. What sets one
    copy apart (brand, size, a marking) goes in the unit's `details` column, which keeps the old
    hand-written text.
  - `photo` (what the site shows) follows Image; clearing Image clears the site photo. The old
    `photo_url` / `photo_orig` copies are gone. `sticker_size` and `cable_wrap` are dropdowns.
  - Removed from NocoDB: the "Component units" view and the old package lookups (`item_parent_id`,
    `unit_class`). Link columns on units now read Item, Out on order, Out on booking, Last container,
    Moves, Sticker prints; on items "Accessory for" is the reverse of "Recommended accessories".

### Gear stickers (since 2026-10-23)

One system makes every rental sticker: `~/bts-automation/rentals_stickers/` (`make.py` runs it,
`stickers.py` draws every design, `SPEC.md` is the design spec). The old label scripts
(`rentals_sticker_*.py`, `rentals_qr_compact.py`, `rentals_subitem_labels.py` and the rest) are gone.

- `make.py status` / `refill` / `full` / `codes <code...>` / `printed <batch>` / `demo`. A batch is a folder
  `~/Desktop/RarePond_Rental_Labels/Print_<date>_<mode>/` (Cricut Print Then Cut sheets, vinyl case
  numbers as SVG, manifest.csv, README.txt); the demo sheet lives in `.../Demo/`.
- Per-item settings in NocoDB (items view): `sticker_size` (S / M / L), `sticker_addon`, `cable_tie`,
  `cable_wrap` (short / long). Prefilled by rule 2026-10-23; containers are always L.
- Every sticker made is a row in `public.sticker_prints`; `printed <batch>` stamps it once the batch is on
  the gear, and `refill` makes only what has no stamped sticker for its current code.
- Before drawing anything `make.py` checks the batch and stops with a list if a department has no color,
  a container has no call name, a unit has no code, or a unit letter would be two letters (27+ units).
- Scan app (2026-10-23 polish): photo and department color on every page, big tick targets, a sticky
  Confirm button, and a code box at the top (1103, 1103-B, 1101.002 or CAM 01) for looking things up
  by hand. A second tap, a reload or a second phone saves nothing ("Nothing was saved") instead of
  sending out another copy. `bts-automation/scan_stress_test.py` runs every flow against the live
  database and puts everything back. Phones and tablets need Tailscale on to open it.
- Scan app without a QR (2026-10-23): the home page is a live search (ID, call name or plain words,
  matched against names, unit details and descriptions) with filters for department, kind (items,
  sub-items, units, containers) and on-website / hidden. The **Scan** button reads stickers with the
  device camera (vendored jsQR, needs the HTTPS address). A container page puts gear in by scanning
  one sticker after another, by searching (Put in), or by typing an ID; **Packing mode** (a 3-hour
  cookie) makes every gear page offer "Put in <container>" for people using the phone camera app.
  The small **i** in the top bar opens the one-page cheat sheet (IDs, checking out/in, containers).
  Dates in the app and the overdue alert use `rp_today()`, the date in the admin time zone (the
  database clock is UTC, which made evenings count as tomorrow).
- **Dashboard** (since 2026-10-24): the scan app's front page (`/`, also "Rare Pond" top left and the
  ☰ menu on every page). Top: a red **Missing gear** button whenever something is missing.
  Then **Out now** (rentals with gear out or dates covering today: who has it, units out, overdue /
  returns today / not picked up yet), **Coming up** (soonest first, with stage), and **Previous
  orders** (`/orders/past`, newest first; "All back" once everything returned). Every order opens
  `/o/<id>`: contact (tap to call / email), dates, stage, money (lost quote for lost ones), gear and
  where each unit is, changes from the request, the confirmation note, missing parts, emails sent,
  every scan, and a link to the HubSpot deal. Search moved to `/search`. The ClickUp **Rentals**
  space has a doc "Rentals Dashboard (start here)" linking to it (tailnet only).
- Scanning (checked 2026-10-24): every gear QR holds `WWW.RAREPOND.COM/G/<code>` (item number, or `####-A`
  for multi-unit items). The phone camera opens rarepond.com/g/<code> (`functions/g/[id].js`): on the
  tailnet it forwards to that gear's check in/out page, off it to /found. The in-app **Scan** button
  reads the same QR. The page opens with the likely action already picked: **Bring IN** when the
  scanned copy is out, **Send OUT** to a booking that starts within 2 days (a request still on hold is
  marked "not confirmed yet"), otherwise in-house use. A copy out for in-house use with a booking
  due offers **Send OUT straight from in-house use** (no check-in first). Sub-item pill codes (`2100.001-B`) typed or
  scanned open their kit's page (the resolver used to send them to the home page).
- Tests for the scan side (bts-automation): `scan_stress_test.py` (every action, then puts everything
  back), `scan_ready_test.py` (every printed QR followed through the resolver and the Scan button to
  the right check in/out page, read-only), `scan_camera_test.py` (a camera feed of real QR images in
  headless Chromium), `scan_swap_test.py` (in-house gear straight to a booking), `rentals_live_request_test.mjs` (a real request on the live site through the UI;
  scrub after with `rentals_dryrun2_20261024.py`). Mail to rentals@ also lands in **studio@**, so test
  emails have to be cleared there too.
- Customer emails (confirmed, did not go through, missing gear, resolved) go out through **studio@**,
  which owns the rentals@ alias, so they arrive From "Rare Pond Rentals <rentals@rarepond.com>" with
  replies to rentals@ (checked 2026-10-24). Internal alerts (overdue, self-healing, heartbeat) still send
  from rp_admin. Two separate logins on the mini; changing one does not touch the other.
- The scan app reuses database connections (`scan_db.py`): pages went from about 2.5 s to about 1 s.
  The database's session pooler allows 15 clients shared by NocoDB, n8n and every script, so it keeps
  at most 2 idle and closes them after a minute.
- Unticked parts are never marked silently (since 2026-10-24). Check-in: the app lists what was not
  ticked and asks "are they missing?" first. Check-out: for each unticked part, "Not going with this
  rental" (nothing flagged, logged as not sent) or "Missing from storage" (marked missing, not tied to
  the customer). Parts already marked missing do not ask again.
- Missing parts: confirmed ones are marked missing on their own unit (`damage_events` status
  `missing`, unit condition `missing`; for a counted part the highest-numbered pieces). The confirm
  screen offers **Tell the customer** (note, Preview, Send): parts with replacement value, nothing
  charged, return-by date (admin setting, 7 days). Notices are kept in `missing_notices` (`kind`).
- Resolving: **Missing gear** (`/missing`) lists each missing part, its kit, the rental and customer,
  and whether they were emailed. **Resolve** marks it **Found** or **Replaced** (amount billed, blank
  if we covered it, plus a note); who did it is recorded from their Tailscale name. Then an optional
  email (all clear, or what was replaced and billed), preview first. The row keeps its history
  (`status` found/replaced, `resolved_on`, `resolved_note`, `resolved_by`, `billed_amount`). In
  NocoDB: `damage_events`, views **Missing gear** and **Missing gear (resolved)**: change `status` to
  `found` or `replaced` (fill `billed_amount`); `part` and `rental` are filled in automatically. Ticking
  the part at a later scan also marks it found.
- Parts belong to kits, never to other parts (since 2026-10-24; the database refuses it). The
  NATO-to-Rosette clamp 1100.018 is a part of the A7c kit again. To move a part to another kit:
  scan app, gear page, **Parts: list and move**, Move, search the kit, **Move here**; or in NocoDB set
  the part's "Belongs to kit". Its code changes to the new kit's number, so it needs a new pill
  (`make.py refill`). Moving the wing handle to another camera means moving the handle and the clamp.
- Brand stickers (duck bubble, Rare Pond pill) are generic: `make.py brand` prints them in bulk; unit
  batches no longer include them.
- The booking funnel was dry-run end to end on 2026-10-23 (five requests: normal, empty cart,
  overlap, double booking, multi-department; scan out/in for a booking, late return, overdue
  email, NocoDB stage push to Closed Lost, Work Completed). Scrub script for the next time:
  `bts-automation/rentals_dryrun_cleanup_20261023.py` (HubSpot first, then one sync window, then db).
- Round 2 on 2026-10-24 (holds, stale-cart panel, a same-batch race settled first come, the
  confirmation with an adjustment and a note, missing parts and the missing email), scrubbed with
  `bts-automation/rentals_dryrun2_20261024.py` (`baseline` before, then `hubspot`, one sync window,
  `db`, `jotform`, `check`).

---

## How to actually reach n8n / NocoDB (and why no URLs are written here)

This repo is **public**, so no internal hostnames, ports or IPs are written in it - on
purpose. They were removed once already after leaking.

The access details live in two places:

- **ClickUp -> Work -> "How To Remote Access"** - the working doc. Every link in it
  is tested. Start here.
- `~/rp_site_private/REMOTE_ACCESS.md` on the Mac mini - the same thing, offline.

The short version, without the specifics: n8n and NocoDB run in Docker on the studio Mac
and are bound to **loopback + the Tailscale address only**. They are deliberately NOT
reachable over the home Wi-Fi, and never over the public internet. You get to them by
joining the private network (Tailscale), not by opening a port.

Two rules that matter:
- **Never run `tailscale funnel`** on them. `serve` keeps a service private to the
  network; `funnel` publishes it to the entire internet.
- **Never rebind them to `0.0.0.0`** to "make them work at home". That puts the rental
  database and the automation engine on the local Wi-Fi.

## n8n (automations)

Runs in Docker on an in-studio machine, bound to localhost - **not reachable from the
internet**. Backed by SQLite. (Exact host, port and access details are deliberately not in this
public repo - see "Where the private details live" at the bottom.)

Workflows (mind the **Status** column - some are inactive *by design*):

| Workflow | Status | What it does |
|---|---|---|
| HubSpot → Rental DB Sync | **ACTIVE** | polls HubSpot, writes orders/bookings to Supabase |
| Rental DB → HubSpot Stage Push | **ACTIVE** | pushes stage changes back |
| ~~Projects: DB to site (rarepond)~~ | **RETIRED 2026-08-03** | replaced by the Python exporter `projects_sync.py` on launchd (see the projects pipeline). n8n no longer builds any site content. |
| ~~[Alerts] Workflow Failure → Email~~ | **RETIRED 2026-09-27** | replaced by autoheal on the mini (see below); unpublished, kept for rollback |
| ~~[Alerts] Watchdog - workflow gone silent~~ | **RETIRED 2026-09-27** | replaced by autoheal on the mini (see below); unpublished, kept for rollback |
| *...plus the non-site glue* | ACTIVE | The table lists the site-facing workflows. The full live inventory (11 active workflows as of 2026-08-09: also weekly backup, Apple/ClickUp/iMessage/Gemini HubSpot glue, chores) is on the ClickUp **Automation Health** doc, rewritten every 15 min. |
| ~~`[Website Forms]` Jotform Intake / Crew / Rental → HubSpot + Calendar~~ | **DELETED 2026-08-03** | The old n8n copy of the form → HubSpot + Calendar job. **Jotform's own native integrations do this now** (see "The rental pipeline" above); after a live end-to-end proof the inactive workflows were deleted (backed up to `bts-automation/backups/n8n_20260803/`). Do not resurrect them - running them alongside native previously created duplicate deals + duplicate calendar events. |

> **The `[Website Forms]` workflows are GONE from n8n on purpose** (deleted 2026-08-03, backup in
> `bts-automation/backups/n8n_20260803/`) - not a broken or rolled-back migration. The source of
> truth for form → HubSpot + Calendar is **Jotform's native integrations**, full stop. If someone
> reports "the form workflows are missing, did something break?" - the answer is no; that's how
> it's supposed to be. Never rebuild them while Jotform native is on - that combination created
> duplicate deals + duplicate calendar events, which the "things that have bitten us" list
> warns about.

### The alerting, and why it is shaped this way
**Since 2026-09-27 n8n alerting lives outside n8n, in `~/bts-automation/autoheal.py`** (every
10 min on the mini). It reads every active workflow's last success/failure and schedule, re-runs a
failed weekly backup itself, lets a frequent job retry on its own next run, restarts n8n if a
workflow goes silent, and emails `rp_admin` only when a problem survives that (plus a "Recovered"
email). Full rules: `AI_System_Context/04-automations-and-tools.md`, autoheal section.
- Why: the old in-n8n error workflow emailed on every single failure, including network blips that
  passed on the next run, and could fix nothing; the old watchdog duplicated the silence check.
  Both are unpublished and renamed "[Retired 2026-09-27] ...", and no workflow has an
  `errorWorkflow` setting any more. Do not re-enable them alongside autoheal (double alerts).
- **Never use `execSync` in an n8n Code node.** It freezes the task runner, which misses its
  heartbeat and is killed ("Task execution aborted because runner became unresponsive"), taking
  any other workflow running at that moment down with it. Use async `exec` in a Promise.
- Alerts are email only - a chat-tool alert would depend on the very integrations that might be down.

### Secrets
SMTP credentials and the n8n API key live **only in n8n's own credential store** (encrypted in
the Docker volume). They are not in this repo and must never be.

---

## Supabase

Postgres. Tables `orders` and `bookings`, plus a small set of RPC functions (their names are
visible in `rentals/assets/*.js` where the browser calls them; the internal-only ones are not
listed here on purpose).

The browser uses the public anon key with row-level security. **Prices are always recomputed
server-side** - the cart total shown in the browser is an estimate and is never trusted.

**Pricing lives in a Postgres function, not in the browser.** The day count is *inclusive of
both ends* - Jul 27 → Jul 30 is **4 days, not 3**. This has been wrong before. If a total ever
looks a day light, that function is the first place to look.

---

## Images

**All image specs live in `.pages.yml`** as help text on each upload field, so they appear
inside the CMS at the moment of uploading. The short version:

- **sRGB, 8-bit.** Not Display P3, not Adobe RGB.
- Video frames are **Rec.709 limited range (16–235)** and must be expanded to **full (0–255)**.
- Stills 2560×1440 · backgrounds 2560×1440 · bubbles 1200×1200 · team 800×800 · logos = PNG.
- Under 600 KB. **Never upscale.**

Film stills are a special case with their own pipeline and their own traps - **see [`STILLS.md`](STILLS.md).** Read it before touching stills.

---

## Custom pages

A small CMS-driven page builder (drag-to-reorder blocks). **See [`CUSTOM_PAGES.md`](CUSTOM_PAGES.md).**
Adding a new block type is two edits; the doc says exactly which two.

---

## Database permissions - the rule

The browser holds a **public** Supabase key. It must be able to call **exactly one** function:
`catalog_availability` (a read, used to show what gear is free). Nothing else.

**July 2026:** an audit found 15 `SECURITY DEFINER` functions were callable by the public key.
`SECURITY DEFINER` bypasses row-level security, so a visitor could have invoked order, HubSpot
and repair functions straight against production - right around the RLS that was otherwise
correct. Fixed: revoked public/anon EXECUTE on all of them, re-granted only
`catalog_availability`, and set `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM
PUBLIC` so new functions don't auto-open.

**If you add a Postgres function, it is NOT automatically safe.** Postgres grants EXECUTE to
PUBLIC by default. Check after every migration:

```sql
SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e');
```
Only `catalog_availability` may be `true`. n8n uses the `service_role` key and bypasses all of
this, so tightening these grants never affects the automations.

## Closing a page (the maintenance cover)

A page can be temporarily closed from Pages CMS. Rentals is the first one:
**Pages CMS → Rentals page → "Rentals page is OPEN to the public"** (default ON).

Off, `/rentals` serves `maintenance.html`, a "back soon" page that picks one of the
variations in `data/maintenance.json` (Pages CMS → **Maintenance Cover**) at random on
every load, and generates its own "come back to *Rentals* later" line from the name of the
page it is covering.

Three things about the design are deliberate:

- **It is decided at the EDGE**, in `functions/_middleware.js`, not in the browser. The
  rentals page renders its gear immediately from a built-in catalogue, so a client-side
  check would paint the real page first and only then cover it, every visitor would see a
  flash of the thing you just closed.
- **The URL does not change.** `/rentals` stays `/rentals`; there is no redirect. Refresh
  works, shared links still work, and flipping the switch back on makes the same URL the
  real page again. The cover is a *state* of the page, not a different page.
- **It fails OPEN.** Missing switch file, broken JSON, absent key, missing cover page, all
  serve the REAL page. Wrongly showing the page is far cheaper than wrongly hiding it. All
  of those paths are covered by `tools/test-maintenance.mjs`.

To cover a different page later, add a row to `COVERABLE` in the middleware (which JSON
file holds the switch, which key, and an id) and a matching entry in `PAGES` in
`maintenance.html` (so it shows that page's header and wording). No other code changes.

## Things that have bitten us (don't re-learn these)

- **A root `404.html` HIJACKS the SPA `/*` catch-all on Cloudflare Pages.** Dropping a
  `404.html` at the repo root to 404 missing files made Pages serve it (with a 404) for EVERY
  non-file route -- every film / projects / team SPA route 404'd, LIVE, until rolled back. Pages'
  only static custom-404 IS a root `404.html`, and `_redirects` has no 404 action (only a 200
  rewrite), so a SPA cannot 404 missing assets via static config. Do it in a Pages Function
  (`functions/_middleware.js`): resolve the path, and if a `/media/` file came back `text/html`
  the real file is missing -> return a real 404. (2026-08-06)
- **Cloudflare Pages 308-redirects `/foo.html` to `/foo`.** A 308 is not `ok`, so a
  `fetch('/maintenance.html')` inside the middleware silently failed and fell through to the
  real page, in production only, while every test passed, because the test fixture served
  `.html` with a 200. Ask for the extensionless path. The test now models the 308.
- **A blurred layer on a resizing element is re-rasterised every frame.** This is the single
  biggest frame-rate trap on this site. `filter: blur()` *and* `box-shadow` both do it, and
  the blur radius is irrelevant (12px costs the same as 40px). It is why the carousel's cast
  shadow is a plain gradient on a fixed-size, transform-scaled layer, and why the hover glow
  is `visibility:hidden` rather than merely `opacity:0` when idle. Measure against a
  **no-effect control** before believing any of it, see the comments in `index.html`.
- **The studio paints before its data arrives.** `__main()` awaits five JSON fetches, so
  whatever the *stylesheet* says is what the visitor sees first. The views used to default to
  `display:block`, so the first paint was Home + Projects + Team stacked (6872px in an 872px
  viewport) and then collapsed. If you add a view, start it hidden.
- **Jotform's API returns deleted submissions** with `status: DELETED`. Deleting a bad
  submission does *not* protect a workflow that reads the API - you must filter on status.
  A single junk submission once poisoned the intake for three days.
- **A crashing workflow can freeze its own cursor.** The intake stored "last processed id" in
  static data; when the code threw, the id never advanced, so it retried the same poison
  submission forever - 720 errors a day, silently, because there was no alerting. That is why
  the alerting above exists.
- **n8n `import:workflow` deactivates a workflow.** Re-activate it after importing.
- **Don't paste large code into the n8n UI editor** - it has mangled a paste before. Use the
  n8n CLI (`export:workflow` / `import:workflow`), which is byte-exact.
- **Never disable the native Jotform → HubSpot / Calendar integrations.** They are the pipeline.

---

## Where the private details live

This repo is public, so the specifics that would only help someone poking at the setup are
kept **out of it**:

- **Secrets** (SMTP, API keys) - only in n8n's encrypted credential store and Supabase's own
  dashboard. Never in git.
- **Exact host/port of the n8n box, the alert email address, internal-only RPC names** - in
  `OPERATIONS_PRIVATE.md`, kept on the studio machine **outside this repo** (and on the NAS).

If you are an AI assistant working on this and need those details, ask the owner for the
private file. Do not reconstruct them into this repo.

## Local preview

The site fetches JSON at runtime, so `file://` will not work:

```
python3 -m http.server 8080
# http://localhost:8080
```


## Colour: unassigned renders WHITE (no hidden fallbacks)

Every colour on the site comes from Pages CMS -> Color Looks. There are deliberately
NO hardcoded fallback colours in the code. If a colour is missing - a blank field, or
a "Linked color look" that does not match a real look - the thing renders **white**.

That is on purpose. A hardcoded fallback would paper over a broken link and make the
system look like it worked when it did not. It would also be a lie for any future
film, which has no "original" to fall back to. White = unassigned. Go fix the link.

Where colour now comes from:
- Films: Projects -> Linked color look -> a `film` look (accent / main / tint).
- Rentals categories: Rentals -> Categories -> Linked color look -> a `basics` look.
- Event banner: Site Settings -> Event Banner -> Linked color look.
The Color Looks page shows what uses each look and flags broken links in red.

### For the record: what the site rendered BEFORE this system existed
Kept as history only. These are NOT fallbacks and are NOT in the code any more.

| Film | accent | wash 1 | wash 2 | kicker | tagline |
|---|---|---|---|---|---|
| Geri-Action | `#ffd21f` | `rgba(255,90,106,.30)` | - | = accent | `#ffd9a0` |
| Revelations | `#ff5230` | `rgba(255,82,48,.34)` | `rgba(255,210,122,.18)` | `#ffd27a` | `#ffd9c0`, italic |
| Invalid Opinion | `#74b3ff` | `rgba(80,150,255,.30)` | - | = accent | inherited |

Rentals categories were `Camera #EA4335`, `Lighting #FF9900`, `Grip #8b5cf6`,
`Electric #FFE600` (brighter lemon since 2026-10-22, was #FBBC04), `Sound Packages #34A853`,
`DIT #FF3EA5` (hot pink look `pink`, added 2026-10-22; items 6001+).

### Replacement values (2026-10-24)

- A normal item carries its own replacement value (today's new price at a major US retailer or the maker).
- Kits and cases with **value_from_parts** ticked add up: their **own_value** (e.g. the empty case) plus every part
  (value x qty). Kept current by a database trigger, so changing a part changes the kit.
- Containers also have **value_with_contents**: the case value plus every piece of gear stored inside it right now.
  It updates when gear is put in or taken out, and when anything inside changes value.
- Parts that only ship inside their kit, or generic bits, stay blank (never guessed).
