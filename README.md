# Rare Pond Studios — Cloudflare Pages site

A self-contained static site (no build step) whose content lives in editable data files,
so you can add projects, swap photos, and replace the logo from a simple no-code admin.

## What's where

```
index.html            The whole site (HTML + CSS + JS). It reads the data files below at load.
data/
  site.json           Logos, hero text, About blurb, social links, About-logo floating images, HubSpot form ids
  projects.json       Every project = one entry. Drives BOTH its home bubble AND its project page.
  team.json           Team members (photo, name, role, bio)
media/                All images. Replace a file here and it updates everywhere it's used.
  logos/              Brand logos (duck-mark, rare-pond-color)  +  per-film title logos
  projects/           Bubble art, feature/background art, highlight shots
  stills/             Film stills (galleries + the About-logo floating bubbles)
  team/               Team photos
.pages.yml            Pages CMS configuration (defines the editing forms)
_headers              Cloudflare cache rules (keeps content fresh after edits)
```

Editing a value in `data/*.json` (or replacing a file in `media/`) changes the site —
nothing in `index.html` needs to be touched.

## Replacing the logo (quick)

The logo lives in two brand files (so the header icon and the full wordmark can differ):
- `media/logos/duck-mark.png`  — the small duck in the header
- `media/logos/rare-pond-color.png` — the full color logo (About bubble + footer)

To update it, either:
1. In the CMS → **Site Settings → Logos**, upload the new image, **or**
2. Drop a new file into `media/logos/` and point the field at it.

Per-film title logos live in `media/projects/*-logo.png` and are set per project in **Projects**.

## Deploy to Cloudflare Pages (one-time)

1. **Put this folder in a GitHub repo.** Create a new repo at github.com, then upload
   this entire folder's contents (or `git init && git add . && git commit && git push`).
2. **Cloudflare → Workers & Pages → Create → Pages → Connect to Git.** Pick the repo.
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Build output directory: **/** (the repo root)
   - Deploy. Your site is live at `<project>.pages.dev` (add your custom domain after).

## Connect the no-code editor (Pages CMS)

1. Go to **https://app.pagescms.org** and sign in with the same GitHub account.
2. Open this repo. Pages CMS reads `.pages.yml` and shows three sections:
   **Site Settings**, **Projects**, **Team** — all as simple forms with image uploads.
3. Edit and **Save**. Saving commits to GitHub, which auto-redeploys Cloudflare Pages.
   Your change is live in ~1 minute.

### Adding a new project (appears as a bubble + a full page)
Projects → **＋ Add** → fill in: a unique `key`, title, theme, images, loglines, where-to-watch,
stills, etc. → Save. A new bubble appears on the home carousel and Projects grid, with its own page.

## Social links (one source, both sites)

The social icons in the header **and** footer of BOTH the Studio site and the Rentals
site are driven by a single list: `data/site.json → socials`. Edit it once and both
sites update.

- **In the CMS:** **Site Settings → Social links**. Each entry has a **Label**
  (e.g. "Instagram"), a **URL**, and an **Icon** (`yt` = YouTube, `ig` = Instagram,
  `li` = LinkedIn). Add / remove / reorder entries and Save.
- On hover, each icon fills with that network's brand gradient (YouTube red,
  the Instagram sunset, LinkedIn blue) — the same gradients the project pages use.

## Changing a form field's input type (CMS)

Which on-site form boxes accept which kind of input is controlled by
`data/form-fields.json`, editable in the CMS under **Form input types**:

- **Rental request form** and **Crew-your-shoot form** each list their fields.
- For each field pick a type: `text`, `email`, `number`, `tel`, or `url`.
  - `number` → the box accepts **digits only** (plus one decimal point); typed
    letters simply never appear. Used for the crew **Budget** by default.
  - `email` → validated as an email on submit.
  - `tel` → accepts phone characters (digits, `+ ( ) - . space`).
  - `text` / `url` → free text.

Save and the change is live in ~1 minute — no code edit needed. If the file is ever
missing, every field safely falls back to plain text so the forms never break.

## Local preview
Because the site loads JSON at runtime, open it through a tiny local server (not file://):
```
cd rare-pond-cloudflare
python3 -m http.server 8080
# visit http://localhost:8080
```
