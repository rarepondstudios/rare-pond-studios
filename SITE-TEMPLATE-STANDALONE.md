# Standalone site playbook: building a Rare Pond style site for someone else

> **Which template am I in?** Two templates exist and both stay current.
> `SITE-TEMPLATE.md` is the standard for a site INSIDE Jack's system (his NocoDB, his exporters,
> his Synology media tree; adding a site there is one `sites.json` entry). THIS file is the
> playbook for a site that must live entirely on its own: the client's accounts, no connection to
> Jack's database or mini, and no always-on machine required on their side.
> **When a standard section changes in `SITE-TEMPLATE.md`, check in the same commit whether this
> playbook needs the matching change.** Last updated: 2026-08-09.

## What the client actually gets

The same architecture the Rare Pond sites run on, minus the database backend: a single-page
static site on Cloudflare Pages, all content in editable JSON files, edited through Pages CMS in
the browser (no code, phone-friendly), per-page maintenance switches decided at the edge, the
shared UI engines (cursor, contact popup, social bubbles, legal renderer, maintenance cover), and
the same test suite. Nothing on their side ever needs a running computer: GitHub stores it,
Cloudflare serves it, Pages CMS edits it.

## Accounts, all theirs from day one, and what it costs

| Account | Plan | Cost | Why theirs and not Jack's |
|---|---|---|---|
| GitHub (holds the repo) | Free | $0 | They own their site's history; Jack joins as a collaborator |
| Cloudflare (Pages hosting + DNS) | Free | $0 | Their domain, their traffic, their analytics |
| Pages CMS (app.pagescms.org) | Free | $0 | Signs in with THEIR GitHub, edits their repo |
| Domain registrar | any | ~$10-15/yr | The only real recurring cost |
| Forms, pick one: HubSpot Free / Jotform Free / plain mailto | Free | $0 | Their inbox, their contacts. Never wire a client form into Jack's HubSpot |

Total: about the price of the domain per year. No subscriptions required for full functionality.

## Build steps

1. **Repo.** Create a private repo under THEIR GitHub account from the skeleton: `index.html`,
   `functions/_middleware.js`, `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`,
   `maintenance.html`, `tools/`, `.pages.yml`, `data/`, `media/`, plus the shared masters copied
   in once (`assets/cursor.js`, `assets/social_ui.js`, `assets/contact.*`,
   `assets/legal-render.js`, `functions/_maintenance.js`, `tools/check-page-switches.mjs`).
   The masters do NOT auto-sync to a standalone site: record the copied version in the repo
   README, and pull newer masters deliberately when wanted. That is a feature: a client site
   cannot be broken by a Rare Pond master edit.
2. **Content model, the one real difference.** There is no NocoDB and no exporter, so nothing is
   "generated": EVERY `data/*.json` is hand-edited through Pages CMS, including the project list.
   Keep `projects.json` but treat it as a CMS-edited file, with a CMS screen defined for it in
   `.pages.yml` (list of films/works: key, title, year, kicker, tagline, logline, genre, stills,
   watch link, colour look key, sort order). `colorlooks.json` likewise becomes a CMS-edited
   file. `tools/validate-projects.mjs` still guards the shape.
3. **`.pages.yml`.** Start from Rare Pond's, then: delete the NocoDB read-only mirror notes and
   every "edited in NocoDB" description; keep the switch-first rule (every page screen declares
   `route`, `pageName`, `publicAccess` at the top); keep the empty-box rule and the image-spec
   descriptions (with no pipeline, the specs in the CMS are the only thing standing between an
   8 MB phone photo and the live site). Regenerate `data/page-index.json` by hand or with
   `page_index_sync.py` run once locally, and keep `tools/check-page-switches.mjs` green.
4. **Media without the pipeline, same standard as the live sites:** the client's masters stay at
   FULL resolution (video 1080p or better, images at capture size) and are never degraded; what
   the web serves is DERIVED from the master by downscaling, and the site picks per screen.
   Desktop streams the full-quality 1080p web encode; small screens get the 720p companion;
   images ship as WebP at the standard widths with the original format kept as fallback. Never
   upscale anything. Two ways to produce the derivatives:
   - **Hand-exported (default, zero infrastructure):** from the master, export to the specs the
     CMS shows on each upload field (sRGB 8-bit, WebP/JPG, the standard sizes, under 600 KB),
     plus the 1080p web encode and, for any reel taller than 720p, a CRF-19 720p companion.
   - **Auto-derived (nice to have, still $0 and no machine):** a GitHub Action in their repo
     watches `media-masters/`, and on push writes the WebP sizes, the 1080p web encode and the
     720p companion with ffmpeg, plus a manifest, exactly what the launchd syncs do at home, but
     run by GitHub's free runners (free minutes are ample for a portfolio site's edit rate).
5. **Cloudflare.** Create the Pages project on THEIR account, connect the repo, no build step
   (framework: none). Set the per-site secrets in the Pages project (the `/admin/` gate password
   variables named in `functions/_middleware.js`). Point their domain's DNS at Pages, apex AND
   www from the start (avoid Rare Pond's pending apex-forwarder trap: host the zone on
   Cloudflare on day one and deep links on the bare apex just work).
6. **Forms.** Their provider, their account, embedded the same way the standard contact popup
   embeds a form. If they need nothing fancy, a mailto link costs nothing and breaks never.
7. **QC before handover.** Run the repo test suite (page switches, media refs, slugs, projects
   validator, maintenance, admin gate), click every route on the live host, check phone + desktop,
   confirm the maintenance switch actually covers a page and fails OPEN, confirm legal pages
   render with the client's details in the shared variables, run Lighthouse once and keep the
   numbers in the repo README as the baseline.

## Supporting them remotely, no machine of theirs required

- **Jack stays a GitHub collaborator** on the repo: full remote fixes, PRs, and rollback via git
  history from anywhere.
- **Pages CMS** works for both: they edit content signed in with their GitHub; Jack can too, with
  his collaborator access, from any browser.
- **Cloudflare:** they add Jack as a member on their account (or on the Pages project) so deploys,
  DNS and secrets are fixable remotely.
- Screen-sharing is never structurally required: everything above is browser-based. If the client
  DOES have an always-on machine and wants the folder-drop media automation, that is a port of
  the launchd + Synology pattern and a separate job; the site works fully without it, so add it
  later only if the client's edit volume justifies it.

## What deliberately does NOT carry over from Jack's system

- NocoDB, Supabase, the exporters, `sites.json`, the Synology media tree, launchd jobs, n8n,
  Automation Health: none of it. A standalone site has no moving parts on any home machine.
- Jack's HubSpot, Jotform, analytics and short-link accounts. Client data lives in client
  accounts, full stop.
- Auto-synced shared masters. Copies are pinned per site and upgraded deliberately.

## The glitch history still carries over

The value of building from this skeleton is that the fixes travel with the code: the root-404
Cloudflare trap, the 308 redirect trap, the fail-open cover engine, the switch-per-page wiring
with its failing tests, the scrollbar-measurement rule, the blur re-rasterisation rule, the
empty-box CMS rule, and the image specs in every upload field. A new site starts with every
lesson already applied, and the `tools/` suite fails loudly when a rule is broken.
