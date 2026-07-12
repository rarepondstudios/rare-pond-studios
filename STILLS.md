# Film stills — how they are made, and the traps

Every still in the Projects galleries was re-pulled from the film's **ProRes master**,
not from a compressed export. This document is the spec. If you are an AI assistant or a
developer touching stills, follow this rather than inventing a new approach — the traps
below have already been paid for once.

---

## The rule

**Stills come from the master. Never from a delivery file, never from a screenshot,
never upscaled.**

A 1000 px still on a Retina screen is being blown up 2–3× by the browser. That is why the
old stills looked soft: not compression, **upscaling**. More compression would have made it
worse. The fix was more pixels, not fewer bytes.

---

## Masters (as of July 2026)

| Film | Master | Resolution | Notes |
|---|---|---|---|
| Geri-Action | ProRes 4444 XQ | 3840×2160 | 12-bit, 4:4:4 |
| Invalid Opinion | ProRes HQ | 3840×2160 | 10-bit, 4:2:2 |
| Revelations | ProRes HQ | **2048×1152** | 2K finish — this is the ceiling |

All three are **Rec.709, limited range (`color_range=tv`)**.

Revelations is only 2K, so its stills cap at 2048 px wide. **We do not upscale it to fake a
2560.** If a 4K Revelations export ever exists, re-run the pipeline and bump its widths in
`data/stills-hd.json`.

---

## Colour — get this right or the grade shifts

The master is **Rec.709, limited range (16–235)**. A still must be decoded to **sRGB, full
range (0–255)**. The correct ffmpeg decode is:

```
-vf "scale=W:H:in_range=tv:in_color_matrix=bt709"
```

`in_range=tv` is the part that matters. Get it wrong and blacks sit at ~16 instead of ~0 —
the image looks milky and lifted. (`out_range` is a red herring here: RGB output is always
full range, so setting it changes nothing. Test `in_range`, not `out_range`.)

**The web stills are slightly punchier than the master.** They have crushed blacks and more
contrast — someone added that when the originals were first made. Jack chose to *keep* that
look, so each new still is tone-matched to the one it replaces: black/white points via
`colorlevels`, then a per-channel gamma via `lutrgb` to line the midtones up.

**Match the grade PER IMAGE.** A single global curve derived from one still crushed the dark
shots badly (it swallowed the "CONTROL ROOM" sign in `geri-anim-3`). Fit each still to its
own predecessor.

---

## Two traps that will bite you

**1. The refine window must be WIDE.**
Frame-matching is: coarse scan the film at 1 s intervals, then refine around the best hit.
If that refine window is narrow (±1 s), it can lock onto the *wrong part of a long locked-off
shot*. On `geri-nursing-1` this picked a frame with a nurse walking through in motion blur —
a person who is not in the real still. Widening to **±12 s** found the right frame, 12× better
match. It bit `geri-anim-2` and `rev-earth-1` too. **Use ±12 s.**

**2. Crops are not always centred.**
Revelations stills are scope crops of a 16:9 frame — but they are *not* all centre-cropped.
`rev-earth-1` is **top-aligned** (y=6). Assuming a centred crop produced a match distance of
799 (vs ~8 for a good one). If a match distance comes back an order of magnitude worse than
its siblings, **suspect the crop, then suspect the frame** — and solve for both.

A good match distance is single digits to ~40. Anything in the hundreds is wrong.

---

## Output: what actually gets served

For each still we generate WebP at several widths plus a JPEG fallback:

```
geri-madeline-800.webp     geri-madeline-1600.webp   geri-madeline-2560.webp
geri-madeline-1600.jpg     (fallback for ancient browsers)
geri-madeline.jpg          (original 1000 px base — kept so nothing 404s)
```

`data/stills-hd.json` maps each still to **the widths that actually exist for it**:

```json
"/media/stills/rev-earth-1.jpg": [800, 1600, 2048]
```

`index.html` reads that map and builds a `<picture>` with a `srcset`. A still **not** listed
in the map renders as a plain `<img>` from its original file — so this is always safe to
extend one film at a time, and a still uploaded through Pages CMS never breaks.

**On-screen size is identical for every still**, regardless of the widths available. The grid
tile and the `sizes` attribute fix the layout box; the widths only decide how much pixel
density the browser can pull into that box. A 2K-sourced Revelations still and a 4K-sourced
Geri still occupy exactly the same space. Keep it that way.

---

## Adding stills for a new film

1. `ffprobe` the master — confirm resolution, `color_range`, `color_space`.
2. Frame-match each existing still (coarse 1 s pass, then **±12 s** refine).
3. Extract at native res with `in_range=tv:in_color_matrix=bt709`.
4. Tone-match **per image** to the still it replaces.
5. **Look at the result next to the original.** Every bug listed above was caught by eye
   after the numbers said "fine". Do not skip this.
6. Encode WebP 800/1600/{2560 or native cap} + a 1600 JPEG fallback. **Never upscale.**
7. Add the still to `data/stills-hd.json` with its real widths.
8. Deploy, then confirm in devtools that the browser fetches the WebP and that the lightbox
   pulls the largest size.

Working scripts live in `/tmp/rp/` during a session (not committed — they are throwaway).
The logic that matters is written down above.

---

## Not stills

`geri-split.jpg` and `geri-bubble.jpg` are **designed composites** (a diagonal animation/live
split, and a poster treatment) — not single frames. They cannot be re-grabbed from the master.
They remain at their original resolution until someone redesigns them properly.
