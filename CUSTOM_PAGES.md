# Custom Pages - how the mini page-builder works

This is the "special occasion pages" system. It is deliberately small. Read this
before changing it. If you are an AI assistant working on this repo, this file is
the spec - follow it rather than inventing a new pattern.

---

## For Jack (non-technical, 30-second version)

**Make a page:** Pages CMS → **Custom Pages** → **Add item** at the bottom.
Fill in the slug (e.g. `summer-open-house`), a title, then add **blocks**.

**Your page is live immediately at:** `rarepond.com/?p=summer-open-house`

**Put it in the top banner:** flip **"Show in the STUDIO top banner"** on.
There's a separate toggle for the rentals banner. Both are OFF by default, so a
half-finished page is never visible in the nav - but the URL always works, which
means you can preview and share it before announcing it.

**Blocks** are the page's content, top to bottom. **Drag them to reorder** - the page
renders in exactly the order you see. Pick a Type for each block and fill in only
the field that Type uses:

| Type | Fill in | What you get |
|---|---|---|
| `image` | Image (+ optional caption) | Full-width rounded image |
| `header` | Text | Big heading |
| `subheader` | Text | Smaller heading |
| `body` | Text | Paragraphs (blank line = new paragraph) |
| `button` | Button label + Button goes to | A styled button |
| `form` | Jotform form ID | Your Jotform, embedded and styled |

**To put a Jotform on a page:** add a `form` block, and paste the form's ID. Get the
ID from the Jotform address bar - `jotform.com/build/261817432074052` → the ID is
`261817432074052`. **To swap the form later, just paste a different ID.** Nothing else.

**Buttons** can go to: home, team, projects, contact, rentals, **another custom page**
(choose `page`, then put that page's slug in the URL field), or **any external link**
(choose `url`, then put the full `https://...` address).

**Backgrounds:** `home` (the deep-water front-page look, bubbles optional),
`team` (the light blue Meet-Rare-Pond look), or `custom` (your own image).
Custom background specs: **2560×1440 or larger, JPG/WebP, under 600 KB.** It is scaled
to cover and centred, so keep important detail out of the outer 10%. A dark image reads
best - the page automatically switches to light text on a custom background.

---

## For a developer / AI

**Data:** `data/pages.json` → `{ "pages": [ … ] }`
**Schema (what the CMS shows):** the `pages` collection at the bottom of `.pages.yml`
**Renderer + router:** inside `index.html`, in the block marked `/* ===== CUSTOM PAGES =====`
**Rentals banner links:** `assets/custom-pages-nav.js` (loaded by `rentals/index.html`)

### Routing
Pages are a **query on the root**: `/?p=<slug>`. No new files, no build step, no
`_redirects` rule - `/` already serves `index.html`. `renderRoute()` is the single
entry point: it reads `location.search`, and falls back to the existing path router
(`renderPath`) when there is no `?p=`. `popstate` and the initial load both go through it.

### Adding a NEW BLOCK TYPE (the intended extension point)
Two edits, nothing else:

1. **`.pages.yml`** → `pages` → `blocks` → `type` → add the name to `options.values`.
   Add any new field it needs to the `blocks` field list (all block types share one
   field list; each type simply ignores the fields it doesn't use).
2. **`index.html`** → `cpBlock(b)` → add one `case`.

The renderer, nav, router, backgrounds and CMS wiring are generic - they do not need
to know about block types. **Do not** create a new data file or a new view for a new
block type.

### Rules that matter
- **All CMS text is escaped.** `cpRich()` escapes everything, then restores a strict
  whitelist: `<b> <i> <em> <strong> <br>` and `<a href>` limited to `http(s)://`,
  site-relative, or `mailto:`. Never widen this to raw `innerHTML` of CMS content.
- **Fail soft.** A missing/blank field renders nothing rather than breaking the page.
  `pages.json` failing to load leaves the site exactly as it was (the fetch has a
  `.catch(()=>({pages:[]}))`, and the rentals nav script swallows errors).
- **Nav is data-driven.** Never hardcode a page into the header markup.
- Pages live on the **studio site only**. The rentals toggle just adds a link that
  jumps across. Do not duplicate the renderer into `rentals/` - one renderer.

### Known-good example
`data/pages.json` currently holds one real page, slug **`submit-a-screenplay`**, live at
`rarepond.com/?p=submit-a-screenplay` and shown in the studio top banner. It is a working
reference for every block type in use (subheader / body / button). Copy its shape when
building a new page.
