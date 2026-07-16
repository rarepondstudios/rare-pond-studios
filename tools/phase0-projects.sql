-- Phase 0: create the shared `projects` catalogue in Supabase Postgres, migrate the
-- current films, and lock it down. SAFE + REVERSIBLE:
--   * Only CREATES a new table (touches nothing existing).
--   * `if not exists` + `on conflict do nothing` => re-running it is harmless.
--   * RLS is ENABLED with NO anon policy, so the public key can never read it
--     (same posture as bookings/orders). Only the service_role key (n8n export) sees it.
--   * Rollback to the pre-DB state = `drop table public.projects;` (nothing else is affected).
--
-- Run in Supabase: SQL Editor -> paste -> Run.

create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  title         text not null,
  year          int,
  subtitle      text,
  eyebrow       text,
  kicker        text,
  tagline       text,
  blurb         text,
  card_logline  text,
  page_logline  text,
  credits       text,
  chips         text[]  default '{}',
  watch         jsonb   default '{}'::jsonb,
  bubble_image  text,
  title_logo    text,
  focus_bg      text,
  focus_video   text,
  stills        jsonb   default '[]'::jsonb,
  sites         text[]  default '{}',
  roles         text[]  default '{}',
  disciplines   text[]  default '{}',
  placeholder   boolean default false,
  per_site      jsonb   default '{}'::jsonb,
  sort_order    int     default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Fast filtering by site (the export job does `where sites @> '{rarepond}'`).
create index if not exists projects_sites_idx on public.projects using gin (sites);

-- Lock it: RLS on, and deliberately NO policy for anon/authenticated.
-- The public key gets nothing; the export job uses service_role, which bypasses RLS.
alter table public.projects enable row level security;

-- ============================ MIGRATE CURRENT FILMS ============================
-- Generated from data/projects.json. sites = {rarepond}; Rare Pond presentation
-- (colorLook / bubbleGlow / inCarousel) goes into per_site.rarepond. roles left empty
-- (they drive jackcarlsen's filter; fill them when a film is added to that site).
insert into public.projects (key, title, year, subtitle, eyebrow, kicker, tagline, blurb, card_logline, page_logline, credits, chips, watch, bubble_image, title_logo, focus_bg, focus_video, stills, sites, roles, disciplines, placeholder, per_site)
  values ('geri', 'Geri-Action', 2024, 'Hybrid Short Film', 'Rare Pond Studios · 2024', 'Live-Action + 2D Animation Hybrid', 'Old Spy. New Mission.', 'A retired superspy breaks out of her nursing home! A live-action x 2D animation hybrid proof of concept.', 'The world''s greatest superspy is now old and decades past her prime, and she''ll break out of her nursing home at any cost.', 'Once the world''s greatest superspy, <b>Agent M</b> is now old and decades past her prime. Now she takes on a new mission: using her old skills to escape her elderly nursing home, at any cost.', '<b>Directed & Written by</b> Jack Carlsen · Loyola Marymount University<br><b>Starring</b> Cameron Quinn · Rachael DeBoer · Kennedy Porter · Adam Kezele', '{"Comedy / Action"}', '{"type": "festival", "text": "Coming to Film Festivals, Fall 2026", "ig": "geri_action_film"}'::jsonb, '/media/projects/geri-bubble.jpg', '/media/projects/geri-logo.png', '/media/projects/geri-split.jpg', '/media/video/geri-action-reel.mp4', '["/media/stills/geri-anim-1.jpg", "/media/stills/geri-anim-2.jpg", "/media/stills/geri-anim-3.jpg", "/media/stills/geri-nursing-1.jpg", "/media/stills/geri-nursing-2.jpg", "/media/stills/geri-madeline.jpg"]'::jsonb, '{rarepond}', '{}', '{}', false, '{"rarepond": {"colorLook": "geri", "bubbleGlow": true, "inCarousel": true}}'::jsonb)
  on conflict (key) do nothing;

insert into public.projects (key, title, year, subtitle, eyebrow, kicker, tagline, blurb, card_logline, page_logline, credits, chips, watch, bubble_image, title_logo, focus_bg, focus_video, stills, sites, roles, disciplines, placeholder, per_site)
  values ('rev', 'Revelations', null, 'Short Film', 'Rare Pond Studios · In Post-Production', 'Live-Action + VFX Short', 'Even angels answer to management.', 'Heaven is an office. Earth is the problem.', 'Angels work a vast Heaven office, quarantined from the sinful world below. When the angel Emmanuel goes missing, his manager Michael must descend to Earth to bring him back.', 'A surreal vision of Heaven and Earth, where angels work a vast office space and keep themselves quarantined from the sinful humans below. When the angel <b>Emmanuel</b> goes missing, his angelic manager <b>Michael</b> must descend to Earth to bring him back before they are both corrupted by the world they find there.', '<b>Directed & Written by</b> Jack Carlsen · Loyola Marymount University<br><b>Starring</b> Lawrence Lacey · Jesse Shafroth · John Klenk · Trinity Medina', '{"Surreal Fantasy"}', '{"type": "post", "text": "In Post-Production", "ig": "revelations_film"}'::jsonb, '/media/projects/revelations-bubble.jpg', '/media/projects/revelations-logo.png', '/media/projects/revelations-earth.jpg', null, '["/media/stills/rev-earth-1.jpg", "/media/stills/rev-earth-2.jpg", "/media/stills/rev-michael-bar.jpg", "/media/stills/rev-heaven-1.jpg", "/media/stills/rev-heaven-2.jpg"]'::jsonb, '{rarepond}', '{}', '{}', false, '{"rarepond": {"colorLook": "rev", "bubbleGlow": true, "inCarousel": true}}'::jsonb)
  on conflict (key) do nothing;

insert into public.projects (key, title, year, subtitle, eyebrow, kicker, tagline, blurb, card_logline, page_logline, credits, chips, watch, bubble_image, title_logo, focus_bg, focus_video, stills, sites, roles, disciplines, placeholder, per_site)
  values ('invalid', 'Invalid Opinion', null, 'Comedy Short', 'Rare Pond Studios · Released', 'Comedy Short', 'Everybody''s a critic.', 'A fast, funny short about a guy who is always right.', 'Everybody''s a critic... A fast, funny short about a guy who''s always right, even when he''s gloriously, and completely wrong.', 'When a self-proclaimed <b>expert Redditor</b> stumbles on a distasteful meme, he does what any genius would: fires up his most advanced AI tech to engineer the <i>perfect</i> witty comeback. A fast, funny send-up of online self-importance, where <b>Tony Stonk</b> is never in doubt and never more wrong.', '<b>Created by</b> Jack Carlsen<br><b>Starring</b> Iago Lashua · Nick Wittcoff<br><b>Director of Photography</b> Jash Shah · <b>Sound</b> Jacob Gensheimer', '{"Comedy"}', '{"type": "youtube", "id": "XGYQv3h3-y4", "url": "https://www.youtube.com/watch?v=XGYQv3h3-y4"}'::jsonb, '/media/projects/invalid-bubble.jpg', '/media/projects/invalid-logo.png', '/media/projects/invalid-focus.jpg', '/media/video/invalid-opinion-reel.mp4', '["/media/stills/invalid-1.jpg", "/media/stills/invalid-2.jpg", "/media/stills/invalid-3.jpg", "/media/stills/invalid-sourpatch.jpg", "/media/stills/invalid-5.jpg"]'::jsonb, '{rarepond}', '{}', '{}', false, '{"rarepond": {"colorLook": "invalid", "bubbleGlow": true, "inCarousel": true}}'::jsonb)
  on conflict (key) do nothing;

insert into public.projects (key, title, year, subtitle, eyebrow, kicker, tagline, blurb, card_logline, page_logline, credits, chips, watch, bubble_image, title_logo, focus_bg, focus_video, stills, sites, roles, disciplines, placeholder, per_site)
  values ('more', 'More to come...', null, 'Stay tuned', null, null, null, 'New worlds are in the works.', 'New worlds are in the works.', null, null, '{}', '{}'::jsonb, null, null, '/media/site/water.jpg', null, '[]'::jsonb, '{rarepond}', '{}', '{}', true, '{"rarepond": {"colorLook": "rainbow", "bubbleGlow": false, "inCarousel": true}}'::jsonb)
  on conflict (key) do nothing;

-- ============================ VERIFY ============================
-- Expect 4 rows; sites should be {rarepond}; per_site.rarepond carries the look flags.
-- select key, title, sites, roles, placeholder, per_site->'rarepond' as rarepond from public.projects order by key;
