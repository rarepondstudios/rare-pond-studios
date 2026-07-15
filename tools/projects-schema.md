# Shared `projects` catalogue — schema spec (Phase 0 groundwork)

This is the design for the single, multi-site project catalogue that will live in Supabase
Postgres, be edited through NocoDB, and be exported to a per-site `projects.json` by n8n.
It is written so the live standup is paint-by-numbers. **Nothing here changes the live site
yet** — it's a spec + SQL.

## Principles
- **Content, not markup.** The DB stores what a project *is*, never how it's drawn. Each site's
  front-end decides the visual (Rare Pond = bubbles; jackcarlsen = bubbles to start, swappable).
- **One row per project**, tagged with the site(s) it appears on and the role(s) Jack held.
- **Per-site differences live in a `per_site` JSON blob**, so a record never forks.
- **Sites never read the DB directly.** n8n (service_role) reads it and writes each site a
  static `projects.json`. So the `projects` table gets **RLS on with no anon policy** — exactly
  like `bookings`/`orders` today. The public anon key can't see it; only the export job can.

## Postgres table

```sql
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,          -- url-safe id, e.g. 'geri'
  title         text not null,
  year          int,
  -- copy / content
  subtitle      text,
  eyebrow       text,
  kicker        text,
  tagline       text,
  blurb         text,
  card_logline  text,
  page_logline  text,
  credits       text,                           -- allows the existing <b>/<br> markup
  chips         text[]  default '{}',
  watch         jsonb   default '{}'::jsonb,     -- { type, text, ig, yt, url }
  -- media (paths under /media, same as today)
  bubble_image  text,
  title_logo    text,
  focus_bg      text,
  focus_video   text,
  stills        jsonb   default '[]'::jsonb,     -- array of strings today; jsonb allows future {full,fallback}
  -- classification / routing
  sites         text[]  default '{}',            -- {'rarepond','jackcarlsen','corporate'}
  roles         text[]  default '{}',            -- {'Director','Producer','Cinematographer','VFX Artist','Gaffer'}
  disciplines   text[]  default '{}',            -- optional grouping for Cine/VFX portfolios
  placeholder   boolean default false,
  -- per-site presentation overrides (never forks the record)
  per_site      jsonb   default '{}'::jsonb,
  sort_order    int     default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.projects enable row level security;
-- No anon policy on purpose: the public key must never read this table. The export job
-- uses the service_role key, which bypasses RLS.
```

### `per_site` shape
```json
{
  "rarepond":    { "colorLook": "geri", "bubbleGlow": true, "inCarousel": true },
  "jackcarlsen": { "featured": true, "whatIDid": "Directed + edited", "renderStyle": "bubble", "colorLook": "geri" },
  "corporate":   {}
}
```

## Migration map (current `data/projects.json` → columns)
| current field | column | notes |
|---|---|---|
| key, title, subtitle, eyebrow, kicker, tagline, blurb, credits | same | 1:1 |
| cardLogline / pageLogline | card_logline / page_logline | |
| chips | chips | |
| watch | watch | jsonb |
| bubbleImage / titleLogo / focusBg / focusVideo | bubble_image / title_logo / focus_bg / focus_video | |
| stills | stills | jsonb array |
| placeholder | placeholder | |
| colorLook, bubbleGlow, inCarousel | `per_site.rarepond.{colorLook,bubbleGlow,inCarousel}` | these are Rare Pond presentation, not shared content |
| (n/a) | sites | set `{'rarepond'}` for the 3 existing films on migration |
| (n/a) | roles | fill from Jack's actual credits per film |

> The projects **page** `publicAccess` toggle is NOT per-project — it stays in Pages CMS
> (Site/Team/Projects file-level switch), unchanged.

## Export contract (n8n → per-site `projects.json`)
For each site S, emit an array of the rows where `sites @> {S}`, **flattened to the exact shape
that site's renderer already expects**. For Rare Pond that means merging `per_site.rarepond.*`
up to the top level (`colorLook`, `bubbleGlow`, `inCarousel`) and using camelCase keys — i.e. a
byte-compatible `projects.json` — so `index.html` needs **zero changes** and the
`validate-projects.mjs` gate runs on the output before commit/deploy. jackcarlsen's export adds
`roles`, `whatIDid`, `renderStyle`, etc. from `per_site.jackcarlsen`.

## NocoDB views to create
- **All projects** (grid)
- **Rare Pond** — filter `sites` contains `rarepond`
- **jackcarlsen** — filter `sites` contains `jackcarlsen`
- **Corporate** — filter `sites` contains `corporate`
`sites` and `roles` as multi-select columns; `per_site` as a JSON/long-text column (or expand
the common per-site fields into their own columns later for friendlier editing).
