# Roadmap v2: shared project platform + jackcarlsen.com off Wix

*Updated July 15, 2026. Supersedes v1. Adds: a NocoDB-style shared database as the source of truth for projects across 3 sites, a render-agnostic data model, role-based filtering, and the full feature-carryover list Jack specified.*

---

## Part 1 — Airtight film system ✅ DONE (shipped)

`tools/validate-projects.mjs` now runs in the pre-deploy smoke test. A film entry **cannot ship** if it has a missing required field (`key`, `title`, `bubbleImage`, `titleLogo`, `focusBg`), a duplicate key, a slug collision, a media path that doesn't exist, or a `colorLook` that doesn't resolve. Verified: current catalogue passes; a deliberately broken entry was caught with all 6 problems named. This same validator becomes the quality gate for the shared catalogue below.

---

## Part 2 — The shared data platform (the core new requirement)

**Goal:** one remote spreadsheet-style UI (like the NocoDB you use now) is the single source of truth for every project. From it you add a project, **multi-select which sites it appears on** (Rare Pond / jackcarlsen / Corporate), and **filter views** to see just one site's projects at a time. Add a new field once → it's available to all sites.

### Recommended architecture: Supabase Postgres (DB) + NocoDB (editing UI) + n8n export → per-site JSON
- **Database:** a `projects` table in the **Supabase Postgres you already run** (the rentals DB). One database, reusing the RLS security model I just reviewed.
- **Editing UI:** point **NocoDB at that Postgres** as an external data source. You get the exact NocoDB experience you have now — grid, multi-select columns, saved filter views ("Rare Pond only", "jackcarlsen only", "Corporate only"), and future columns you (or I) add show up instantly.
- **Delivery to the sites:** an **n8n automation** fires on any change (NocoDB/Supabase webhook), validates the row, and **writes a filtered `projects.json` into each site's repo** (only that site's projects, with that site's fields). Cloudflare Pages redeploys automatically.

**Why export-to-JSON rather than sites reading the DB live:**
- Keeps both sites **pure static and fast** — no runtime database dependency, no build step, exactly how Rare Pond works today. **All current Rare Pond functionality is preserved unchanged** — it still reads a `projects.json`; only *where that file comes from* changes.
- The `validate-projects.mjs` gate runs on the exported file, so a bad edit is caught before it can deploy.
- Resilient: if the DB or n8n is down, the last-good JSON is still committed and serving.
- *Alternative (noted, not recommended first):* sites fetch from Supabase PostgREST at runtime (like rentals availability). Simpler pipeline, but adds a live dependency and loses the pre-deploy validation gate. We can switch to this later if you ever want truly instant updates.

**Scope (refinement — decided):** the database owns the **projects catalogue only**. **Color Looks, team members, site settings, custom pages, and maintenance toggles stay in Pages CMS / git** — they're small, rarely changed, benefit from version history, and (except color looks) are site-specific. This points the heavy machinery exactly where it earns its keep and keeps ownership unambiguous, so nothing edited in Pages CMS gets clobbered by a DB export.

**Shared config (Color Looks) auto-transfer.** Color Looks stay in Pages CMS but must propagate between sites automatically. The same publish pipeline handles it: the canonical `colorlooks.json` lives in the Rare Pond repo; an **automated mirror (a GitHub Action, or the same n8n job)** copies it into the jackcarlsen repo (and later corporate) whenever it changes — so editing a look in one place updates every site within a minute, while each site stays self-contained and static. Same one-way canonical-source → auto-publish pattern as projects, so there's one mental model for all shared data.

**Net result:** you manage projects in one NocoDB grid and shared styling in one Pages CMS; edit once, the right sites update within a minute; nothing about the current Rare Pond behavior regresses.

---

## Part 3 — Render-agnostic data model (so the look can differ per site, and change later safely)

The database stores **content and classification, not markup**. Each site's front-end decides how to *draw* a project (bubbles, grid, wires, list). That's what lets Rare Pond show bubbles while jackcarlsen shows something else later — without ever touching the data.

**Core (shared) fields**
- Identity: `key`, `title`, `slug` (derived), `year`
- Content: `subtitle`, `eyebrow`, `kicker`, `tagline`, `blurb`, `cardLogline`, `pageLogline`, `credits`, `chips[]`, `watch{}`
- Media: `bubbleImage`, `titleLogo`, `focusBg`, `focusVideo`, `stills[]`
- Classification:
  - **`sites[]`** — multi-select: `rarepond`, `jackcarlsen`, `corporate` (drives which site shows it + your NocoDB filter views)
  - **`roles[]`** — multi-select: `Director`, `Producer`, `Cinematographer`, `VFX Artist`, `Gaffer` (drives jackcarlsen's role filter)
  - `disciplines[]` (optional, for Cinematography/VFX portfolio grouping)

**Per-site presentation overrides** — a nested `perSite` object so each site can differ without forking the record:
- `perSite.rarepond`: `colorLook`, `bubbleGlow`, `inCarousel`, `publicAccess`
- `perSite.jackcarlsen`: `featured`, `whatIDid` (internal-notes block), `renderStyle` (`bubble` to start, later `wires`/`grid`/…), `colorLook`
- `perSite.corporate`: reserved for the future site

**Future-proofing:** adding a field = adding one NocoDB column + teaching the relevant site's renderer to use it. Because content and presentation are separated, a new field can populate all sites at once, or just one, by design. The validator is extended alongside so new required fields stay enforced.

---

## Part 4 — Feature carryover matrix (everything you listed, mapped)

| Feature | Rare Pond today | jackcarlsen plan | Shared? |
|---|---|---|---|
| Scrolling project carousel ↔ Projects tab | ✔ bubbles | ✔ start as bubbles, `renderStyle` swappable later | data shared, render per-site |
| **Projects tab filtered by ROLE** (Director/Producer/Cine/VFX/Gaffer) | — | ✔ from `roles[]`, auto-sorts | jackcarlsen feature, data shared |
| Opening reel video at top of home | — | ✔ combined-films reel, `object-fit:cover` | jackcarlsen only |
| Contact tab in header → scrolls to bottom → HubSpot form | ✔ | ✔ **separate** HubSpot form id | mechanic shared, form per-site |
| Maintenance pages toggled in Pages CMS | ✔ | ✔ same middleware + cover | shared code, per-site config |
| Color Looks (theming) + backend preview page | ✔ | ✔ jackcarlsen-specific instance, same features | looks data shared; backend per-site |
| Page-index backend (`/admin/pagesindex`) | ✔ | ✔ jackcarlsen instance | per-site |
| Custom pages (CMS-created) | ✔ | ✔ same system | shared code |
| Shared social icons (hover behavior) | ✔ | ✔ same component | shared |
| Faded header | ✔ | ✔ carry over | shared mechanic |
| Footer | ✔ | ✔ carry over | shared component |
| Logo (top-left) → home | ✔ | ✔ | shared |
| Distinct visual skin | blue "water/bubbles" | **"glowing wires"** look (assets on NAS) | per-site theme |
| **Rare Pond cross-link bubble** (white logo → hover color+glow → rarepond.com) | — (not needed) | ✔ reuses bubble-glow mechanics | jackcarlsen only |
| **Team "Portfolio" per person** (website/YouTube/IG/LinkedIn/FB, skip blanks & re-sort) | ✔ NEW | — | Rare Pond only |

---

## Part 5 — jackcarlsen.com specifics

- **Assets located:** NAS → `Project Wide Files/02_Brand Assets/Archived Brand Assets/Jack Carlsen V2` (read-only mount; I'll pull from here). I'll also grab the "JC V3" opening video referenced in the earlier build if it's there.
- **Look:** same *mechanics* as Rare Pond (faded header, bubbles, glow, carousel), but a **"glowing wires" theme** — its own palette, background, and hover treatment, driven through the Color Looks engine so it stays editable.
- **Home:** opening combined-films reel → hero/bio → role-filterable projects → contact (HubSpot form at the bottom, reached from the Contact tab).
- **Cross-link bubble:** floating Rare Pond bubble, white logo, hover→color+glow, click→rarepond.com.
- **Its own zone:** standing up jackcarlsen as its own Cloudflare project gives it a real zone (where Bot Fight Mode etc. would finally be available).

## Part 6 — Rare Pond additions (reciprocal)

- **Team → Portfolio:** extend `team.json` so each person can have `website`, `youtube`, `instagram`, `linkedin`, `facebook`. The renderer shows only the filled ones and **re-sorts to close any gap** (reusing the socials component's array→icons pattern — feed it the person's filtered list). No cross-link bubble here; this is Rare Pond's equivalent outbound path.

---

## Part 7 — Revised phased roadmap

**Phase 0 — Data platform (2–3 days)**
- Design the `projects` schema (Part 3) in Supabase; set RLS (public read of published columns only).
- Connect NocoDB to it; build the three saved filter views + multi-select columns.
- Migrate the current 3 films + placeholder into it (lossless — every existing field preserved).
- Build the n8n export→per-site `projects.json` automation; run the validator inside it.

**Phase 1 — Rare Pond switches to the shared feed (1 day, low-risk)**
- Point Rare Pond's `projects.json` at the export output; confirm **zero** visible change (validator + smoke test + live check). Keep Pages CMS as a fallback editor.

**Phase 2 — Extract the shared kit (1 day)**
- Package the reusable assets (header/footer/socials/looks/carousel/maintenance/custom-pages/contact) so both sites build from them.

**Phase 3 — Build jackcarlsen on the kit (3–5 days)**
- New Cloudflare project + preview subdomain. Home (reel, bio), role-filtered projects, Cinematography/VFX grids, résumé, contact. Apply the "glowing wires" theme. Add the Rare Pond cross-link bubble.

**Phase 4 — Rare Pond team portfolios ✅ DONE (shipped early, this pass)**
- Per-person website / YouTube / Instagram / LinkedIn / Facebook links, reusing the shared social-icon component; only filled links render so blanks leave no gap. CMS fields added. Verified live (Jack's row shows 4 icons in order; an empty person shows none, no empty band).

**Phase 5 — Corporate site (future)**
- Already accounted for in `sites[]`; spin up when named, reusing the kit + shared feed.

**Phase 6 — Cut jackcarlsen over off Wix (½ day + DNS wait)**
- 301-redirect old Wix URLs, DNS cutover, SEO/OG/favicon/sitemap parity, park then cancel Wix.

---

## Part 8 — Decisions to greenlight Phase 0

1. **DB + UI:** Supabase Postgres as the store, NocoDB connected to it as the editor? *(Recommended — reuses what you run.)*
2. **Delivery:** n8n export → per-site `projects.json` (static, keeps current behavior)? *(Recommended over live DB fetch.)*
3. **Source of truth ownership (scoped):** the DB owns the **projects catalogue only**; Pages CMS stays the real editor for everything else (color looks, team, site settings, custom pages, maintenance); Color Looks auto-mirror to the other sites. *(Confirmed by you.)*
4. **Corporate site name/branding** — TBD; the model already reserves a slot, so no rush.

Nothing here touches the live sites until each phase's explicit cutover.

---

## Part 9 — Phase 0 status (in progress)

- ✅ **Airtight validator** shipped (Part 1) and now gates every deploy.
- ✅ **Team portfolios** shipped (Phase 4, early).
- ✅ **In-repo groundwork** committed: the target `projects` schema is written up as a spec (`tools/projects-schema.md`) — the render-agnostic field list, `sites[]` / `roles[]` / `perSite` model, and the SQL for the Supabase table — so the live standup is a paint-by-numbers step.
- ⏳ **Needs your live systems (next session, together):** create the Supabase `projects` table + RLS from the spec, connect NocoDB to it and build the three filter views, migrate the current 3 films, and build the n8n export→per-site JSON + colorlooks mirror. These touch your Supabase / NocoDB / n8n directly, so I'll do them with you rather than headless.
