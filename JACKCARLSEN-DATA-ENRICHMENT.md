# Work Order — Enrich the 11 jackcarlsen projects in NocoDB

**For a fresh, focused chat.** Goal: take the 11 skeleton project rows that already exist in
NocoDB (tagged `sites: jackcarlsen`) and fill in each film's real data + assets, sourced from
the NAS archive + online research. This is a self-contained data task — you do **not** need to
build the website. Read `HANDOFF.md` (§5 data model, §11 gotchas, §15 infra) and
`JACKCARLSEN-BRIEF.md` (roles → discipline mapping, roster) first.

> Runs on Jack's Mac Mini. NAS + NocoDB + the repos are all local. Ask Jack to keep **NocoDB
> logged in** at `localhost:8080` — its session expires and the API returns 401 (it will bounce
> to `/signin`); you cannot log in for him.

---

## What already exists (don't recreate)
11 rows in the shared `projects` table, `sites = jackcarlsen`, `placeholder = false`, with
`key`, `title`, and `roles` set (authoritative — from Jack):

| key | title | roles (as stored) |
|---|---|---|
| revision | Revision | Director / VFX Artist |
| lovebug | LoveBug | VFX Supervisor / VFX Artist |
| missfortune | Miss Fortune | VFX Supervisor / VFX Artist |
| theanimator | The Animator | VFX Supervisor / VFX Artist |
| buriedtreasure | The Time I Found Buried Treasure | VFX Supervisor / VFX Artist |
| herosjourney | Hero's Journey | Gaffer |
| rememberme | Remember Me | Cinematographer |
| pityparty | Pity Party | Animation Director |
| eddiesorder | Eddie's Order | VFX Supervisor / VFX Artist |
| heartsbleedbloom | The Hearts That Bleed And Bloom | Title Animation |
| synesthesia | Synesthesia | Cinematographer |

**Do NOT add `rarepond` to `sites` on these — jackcarlsen only.**

---

## Per-project fields to fill (existing schema — see HANDOFF §5)
For each row, research + populate: `year`, `production` (studio/school/other director's
context), `status`, `kicker`, `tagline`, `blurb`, `page_logline`, `genre` (one per line),
`credits` (**"Role: Name(s)" per line** — see HANDOFF §7; include Jack's role(s) + the film's
key credits), `watch` (YouTube/Vimeo links, one per line — auto-detected), `stills`, and the
project images (`bubble_image`, `title_logo`, `focus_bg`, `focus_video`).

### Fields that DON'T EXIST YET (coordinate with the build chat)
`JACKCARLSEN-BRIEF.md` calls for new columns: **`poster_image`**, **`hero_clip`**,
**`jc_in_carousel`**, **`jc_in_workwall`** (and maybe `jc_color_look`). These require
**"Allow Schema Change" ON** in NocoDB (see HANDOFF §11) and are really the build chat's job.
**Options:** (a) stage each film's poster/hero-clip **file paths** in this doc / a scratch note
now and fill the columns once they exist; or (b) if you're also adding the columns, turn schema
change ON, add them, turn it back OFF. Don't block enrichment of the existing fields on this.

---

## Where to source each film
**NAS:** `/Volumes/RarePondNAS/Archived Projects/` (read-only on device; write via Google Drive)
- `01_My Film Projects/{Development,Pre-Production,Post-Production,Distributed,Old Video Edits}/`
  — Jack's own films (e.g. **Revision**). Dig the nested subfolders to find each.
- `02_Other People's Film Projects/{Development,Pre-Production,Post-Production,Distributed}/`
  — films where Jack was crew (Cinematographer/Gaffer/etc.).
- `03_Comissions/…` — VFX-for-hire work.
Each film folder may contain the film file, posters, stills, and notes — inventory before pulling.

**Online research** (for year, synopsis, full credits, high-res posters, watch links):
- Jack's channels: Vimeo `vimeo.com/zytopian`, YouTube `@RarePondStudio` / `@zytopian`.
- Director/creator leads given by Jack: **Hero's Journey** — dir. *Stan Alger* (short);
  **Pity Party** — by *McCrystal* (Jack = Animation Director on the intro); **Synesthesia** —
  series, Jack DP'd Episode 1; **The Hearts That Bleed And Bloom** — Jack animated the title
  intro. The rest (Revision, LoveBug, Miss Fortune, The Animator, Buried Treasure, Eddie's
  Order, Remember Me) — search festival/YouTube/Vimeo/student-film pages + the NAS folders.
- **The Time I Found Buried Treasure:** Jack **provided a treasure-map-style poster** to use
  (a hand-drawn map with houses, red X's, gems, a compass — title in marker). It was attached in
  chat but the file wasn't located on disk this session — **ask Jack for the file** (or find it)
  and save it as this film's poster.

**Save assets** into the jackcarlsen repo: `/Users/rarepondstudios/jackcarlsen-website/media/…`
(e.g. `media/projects/<key>/`, posters under `media/posters/`). Mind image specs in rarepond's
`.pages.yml` / `STILLS.md` (sRGB 8-bit, sensible sizes, <600 KB, never upscale).

---

## How to write to NocoDB (recipe)
On a `localhost:8080` browser tab (Jack logged in):
1. Token: `POST /api/v1/auth/token/refresh` (`credentials: 'include'`) → use the `token` as the
   **`xc-auth`** header. If it 401s, ask Jack to sign in.
2. Base `pn8kzophvbwxtt7`, table **`m765vzpp8kve3wc`**.
3. Read: `GET /api/v2/tables/m765vzpp8kve3wc/records?limit=100`.
4. Update: `PATCH /api/v2/tables/m765vzpp8kve3wc/records` with an array of
   `[{ id: <rowId>, <field>: <value>, … }]` (get each row's `id` from the read).
5. **Newlines:** build multi-line values (`roles`, `genre`, `stills`, `watch`, `credits`) with
   `String.fromCharCode(10)`, not literal `\n` in find/replace.
6. **Browser-tool output filter:** results with URLs/tokens are blocked — store in a `window.__x`
   var and read back booleans/lengths, or strip URLs (see HANDOFF §11).
7. Verify every write by reading the rows back.

Do **not** change field *types* or add columns without turning "Allow Schema Change" ON, and
turn it back OFF when done (HANDOFF §11). Descriptions + row data are fine with it OFF.

---

## Deliverable
All 11 rows populated (as far as sources allow), assets saved into the jackcarlsen repo, and a
short report of **what was found vs. still missing per film** (so Jack can fill gaps). Flag any
film with no locatable footage/poster. Keep everything `sites: jackcarlsen`.
