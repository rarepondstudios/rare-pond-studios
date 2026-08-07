# jackcarlsen.com, Wix capture (2026-07-16)

> LOCAL-ONLY note (like HANDOFF.md). Do NOT commit, the rarepond repo is PUBLIC.
> Source: Wix MCP connector, site "Jack Carlsen Website" (`a7f0f9a8-3869-4ff6-929e-c5042e928e05`),
> plus a fetch of the rendered pages. Raw HTML saved at `/tmp/wixpull/` on the Mac Mini.

## IA (live Wix)
- Pages: `/` (one-page home: hero → about/skills → "What I've Been Working On" grid → contact)
  and `/vfxartist` ("Jack Carlsen's Portfolio", the 3 discipline reels + collection links).
- Nav: Portfolio · Contact · Directing · Cinematography · Visual Effects · Skills.
- Portfolio app collections (slugs): `directing-portfolio`, `cinematography-portfolio`,
  `visual-effects-portfolio`.
- Portfolio projects (6): Geri-Action (Short Film), Invalid Opinion, Revelations [all in
  Directing + VFX collections]; The Animator, Miss Fortune, LoveBug [VFX collection only].
  Each has portrait cover art on wixstatic, Project Type / Date / Role(s) details, and a
  watch/IMDb link (Geri-Action + Revelations = private Vimeo early-access links; Invalid
  Opinion = YouTube XGYQv3h3-y4; LoveBug/Miss Fortune/The Animator = IMDb).
- The 3 discipline reels are Wix Video embeds (2025 "Directing Reel", "Cinematography Reel",
  "Visual Effects Reel"), masters are on the NAS per the enrichment report.

## Fonts (rendered CSS, by frequency)
- Primary: **Poppins** (+ poppins-semibold), headings/UI.
- Secondary: **Avenir LT W01 85 Heavy / 35 Light**, display/body accents.
- Minor: DIN Next W01 Light, Proxima Nova Reg, Helvetica W01 Light (Wix defaults/leftovers).
→ Rebuild with Poppins (Google Fonts) + an Avenir-ish fallback stack.

## Color theme (Wix `--color_N` vars)
- Base: `#141414` (20,20,20) near-black; text white; greys 77/199/232.
- **Accent: `#A359EE` (163,89,238) purple**, used for links/buttons/highlights throughout
  (color_41, 48–49, 52–53, 58–61).
- Purple ramp: `#1A0229`, `#351B4F`, `#6B369E`, `#A359EE`, `#CCA3F3`, `#DEC2F9`.
- Also in palette (unused accents): red ramp, green ramp, yellow ramp.
→ jackcarlsen `signature` look ≈ near-black base + #A359EE accent (matches the
  blue-purple/rainbow brand kit headshot cutout).

## Copy (verbatim, from rendered home)
- Hero: "JACK CARLSEN, Director (Live Action + Animation) · Cinematographer · Gaffer ·
  VFX Artist / Supervisor (Based in Los Angeles / Burbank) BFA in Film & TV Production
  from Loyola Marymount University, Proficient in Pre-Production, On Set, & Post
  Production, Software Expertise In: Adobe After Effects, DaVinci Resolve, Unreal Engine,
  Blender, Foundry Nuke & More..."
- Bio quote: "I love crafting worlds for others to experience. As a storyteller, I don't
  want to be constrained by a single medium, so I work in both live action filmmaking as
  well as 2D & 3D animation. I'm ready to work with where you are at, from large teams of
  creatives, to small run and gun projects. I pride myself in my leadership skills, while
  also having the technical experience to back myself up and relate with those I'm working
  alongside. Lets bring your vision to life!"
- CTAs: "SEE MY PORTFOLIO", "See My Resume", "What I've Been Working On", "Contact",
  footer "Lets Make Something Amazing... jackcarlsen.com © Jack Carlsen 2025".
- /vfxartist intro: "Jack Carlsen's Portfolio, Click below to learn more about how my
  skills can help you..."

## Links
- Résumé PDF: https://www.jackcarlsen.com/_files/ugd/651fd4_de0e9c0d82c94509bc45dfcf935f481e.pdf
- Socials: YouTube @RarePondStudio · Vimeo /zytopian · Instagram @jackjrrc ·
  LinkedIn /in/jack-carlsen-7274361b6/

## Media inventory (wixstatic, base URLs, full-res via the bare media URL)
Portrait poster/cover art (also in the Portfolio API payload):
- Geri-Action `651fd4_11538485…~mv2.png` (1920×2485)
- Invalid Opinion `651fd4_e4a6d693…~mv2.png` (2550×3300)
- Revelations `651fd4_8daff2b0…~mv2.png` (2550×3300)
- The Animator `651fd4_749f196c…~mv2.jpg` (1000×1333)
- Miss Fortune `651fd4_df665190…~mv2.jpg` (1000×1500)
- LoveBug `651fd4_63cff965…~mv2.jpg` (1944×2880)
Home-page grid / BTS candidates (the `651fd4_*.jpeg/jpg` set on home), incl.
`0cb853e2`, `0e55b4f7`, `3a174288`, `8030d8d3`, `9fb377657`, `648d7a60`, `b57ee87d`,
`d4c5a9eb`, `f556056a`, `bbbd3541(f000)`, `cac6fbdd(f000)` + png logos/cutouts
(`1fcd0734`, `22db39ad`, `23c66b5f`, `303804c0`, `5b6c951d`, `ab2711b9`, `f9269c00`,
`febcdff7`). Collection covers: `0844ec4c` (directing), `73a1b636` (cine), `b12424fb` (vfx).
→ Download list saved here so the build can pull originals (strip `/v1/fill/...` for full res).

## Notable for the rebuild
- Wix posters for The Animator / Miss Fortune / LoveBug are REAL portrait key art,
  better than the frame-grab placeholders staged in `media/posters/`. Swap them in.
- Geri-Action / Invalid Opinion / Revelations posters exist here too (useful if those
  films later get `sites: jackcarlsen`).
- The Wix "What I've Been Working On" is a static image grid; the new build replaces it
  with the DB-driven poster wall. The jpeg set above seeds `/media/bts/`.
