# jackcarlsen enrichment, found vs. missing report

Date: 2026-07-16. Scope: the 11 `sites: jackcarlsen` project rows in NocoDB
(base `pn8kzophvbwxtt7`, table `m765vzpp8kve3wc`). Existing fields enriched via PATCH and
verified. `sites` left as `jackcarlsen` only (rarepond untouched). New columns
(`poster_image` / `hero_clip` / `jc_in_carousel` / `jc_in_workwall`) were NOT created, paths
are STAGED below for the build chat.

## What was written to every row
`year` (where known), `production`, `status`, `kicker`, `tagline`, `blurb`, `page_logline`
(HTML `<i>` on titles), `credits` (one `Role: Name(s)` per line), `genre` (one per line), and
`stills` where real stills existed. `watch` was left EMPTY for all 11 (see global gap).

## Assets saved into the repo
Under `/Users/rarepondstudios/jackcarlsen-website/media/` (sRGB JPEG, all < 600 KB):
- `posters/buriedtreasure.jpg`, **REAL poster**, Jack's hand-drawn treasure map (from `~/Documents/Final.png`).
- `posters/{revision,lovebug,missfortune,theanimator,eddiesorder,heartsbleedbloom,synesthesia,pityparty}.jpg` (frame-grab placeholders (16:9, cropped) pulled from each film's cut. **Placeholders) swap for real portrait key art when available.**
- `posters/{herosjourney,rememberme}.jpg`, placeholder made from a real production still.
- `projects/revision/still1-2.jpg`, `projects/lovebug/still1.jpg`, `projects/herosjourney/still1-4.jpg`, `projects/rememberme/still1-3.jpg`, `projects/pityparty/still1.jpg` (also written to each row's `stills`).

## STAGED for new columns (build chat)
`poster_image` → the `media/posters/<key>.jpg` above.
`jc_in_workwall` → suggest ON for all 11 (each has a poster).
`jc_in_carousel` (hero showreel) → suggest Jack's most visual/own work: **revision, lovebug, theanimator, herosjourney, synesthesia, buriedtreasure**.
`hero_clip` → trim a short seamless loop from these NAS masters (read-only; export web-optimized copies into `media/`):
- revision → `01_My Film Projects/Post-Production/Revision Short Film/03_Output/00_Current Cuts/Revision Cut V2 (June 7 2024) COLOR.mov`
- lovebug → `.../LoveBug VFX (Blake Kaiser)/Final Exports/Lovebug.mov` (or `clip1-5.mov`)
- missfortune → `.../Miss Fortune (VFX Artist)/CharlieZ_MissFortune_RC7_TC.mov`
- theanimator → `.../The Animator (Brence Planter) (VFX Artist)/TheAnimator_FinalTimeCode.mp4`
- buriedtreasure → `.../[TheTimeIFoundBuriedTreasure]_VFX_Files/VFX_Scene_*/…_Exports/*.mov`
- herosjourney → `.../Heros Journey (Gaffer)/Hero's Journey - Senior Thesis (Final Cut).mov`
- rememberme → `.../Remember Me (DP)/F2022_PROD390_TEJEDA.mov`
- pityparty → `.../Pity Party Animation (Anim Director)/03_Output/Full Exports/FINAL EXPORTS/Pity_Party_FINAL_CORRECTED.mov`
- eddiesorder → `.../Eddie's Order Film (Editor & VFX)/03_Output/00_Current Cuts_Folder/Eddie's Order_Video Referfence 2_Final Audio Post Pro (1).mp4`
- heartsbleedbloom → `.../The Hearts That Bleed And Bloom (Title VFX Artist)/the_hearts_that_bleed_&_bloom (2160p).mp4`
- synesthesia → `.../Synesthesia (Cinematographer)/Dream Seq Rough Cut.mov`
Also: `title_logo` for **pityparty** available on NAS, `.../Pity Party Animation …/02_SourceFiles/Thumbnail/Pity Party Logo ALPHA.png` (not copied yet).

## GLOBAL gap, needs Jack
**`watch` links: 1 of 11 done** (LoveBug → Prime Video). The other 10 are empty, fastest for Jack to paste his own YouTube (@RarePondStudio / @zytopian) / Vimeo (zytopian) URLs, one per line, so the site auto-detects the platform. NOTE: the site's watch auto-detect currently only recognises YouTube/Vimeo, the LoveBug Amazon/Prime link won't get a click-to-load embed and needs the build chat to render it as an external "Watch on Prime Video" button.

## Per-film: found vs. missing
| Film | Year | Director/creator | Synopsis source | Flags / still missing |
|---|---|---|---|---|
| **Revision** | 2024 ✓ | Jack Carlsen (own) | Real, from screenplay | Cast names (Davey/Coda actors) unknown; watch link |
| **LoveBug** | 2025 ✓ (IMDb) | Blake Kaiser ✓ | Real, Prime Video synopsis (1988 LA feature) | **DONE**: watch link (Prime Video) added; corrected to feature film, genre Drama |
| **Miss Fortune** | 2023 ✓ (IMDb) | *unknown* | Factual (VFX only) | Director name (master hints "McCue", confirm); plot; watch |
| **The Animator** | 2024 (approx) | Brence Planter ✓ | From Jack's note (live action + claymation) | Confirm year; plot; watch |
| **The Time I Found Buried Treasure** | *unknown* | Harrison Carney (client) ✓ | Factual (VFX only) | **Year unknown**; genre inferred (Comedy/Adventure); plot; watch. Poster = REAL ✓ |
| **Hero's Journey** | 2025 ✓ | Stan Alger ✓ | **Real**, festival synopsis | Confirm exact release year; watch link |
| **Remember Me** | 2022 ✓ | Christian Tejeda ✓ | Factual (Jack's DP role), no plot | Plot logline; watch link |
| **Pity Party** | 2025 ✓ (IMDb) | McCrystal ✓ | From delivery docs | Confirm McCrystal spelling; watch link |
| **Eddie's Order** | 2024 (approx) | Troy Seals ✓ | Factual (Editor/VFX) | Confirm year; genre inferred (Fantasy); plot; watch |
| **The Hearts That Bleed And Bloom** | 2022 ✓ (IMDb) | *unknown* | Factual (Jack's title anim) | **Director/production unknown**; plot; watch |
| **Synesthesia** | 2022 ✓ (IMDb) | Wesley Trisnadi ✓ | **Real** (from script (Ep I "Awakening") | Series) confirm episode count; watch link |

### Notes on sourcing
- LoveBug credits are exact (from the film's end-title card on the NAS: VFX by Rare Pond Studios; VFX Supervisor Jack Carlsen; VFX Editors Savannah Tinker, Jack Carlsen, Langdon T. Alger).
- Years/roles for LoveBug, Miss Fortune, Hearts, Pity Party, Synesthesia confirmed on Jack's IMDb (nm13589280). Remember Me / Revision years from master filenames + cut dates.
- No plot summaries were invented. Where the plot wasn't in a script or a credible synopsis, the logline describes only Jack's verified contribution.
- Every film HAS footage/final cuts on the NAS (nothing is missing footage), the main gaps are real portrait posters and public watch links.
