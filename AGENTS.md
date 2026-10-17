# Gloss for Kairo — reels

This branch (`claude/gloss-kairo-setup-0ds0mp`) carries Gloss for **Kairo**, the
booking software. Hair by Sha's weekly engine is in `sha-engine/` and its own
`CLAUDE.md`; nothing here changes it. None of Gloss is on `main`.

Read this before making a Kairo reel. Every rule below has been paid for once.

## What a Kairo reel is

- **20–25 seconds. Hard cap.** The last one ran 36 s and dragged.
- **One idea, not a list.** A film that walks through six jobs a salon does *is*
  the drag. Pick the single sharpest thing and land it.
- **Hook in the first 1.5 s:** the sharpest line in the script, spoken, with
  something moving on screen. Not a logo, not a title card.
- **No shot holds longer than ~3 s.** If a shot isn't earning, cut it.
- **End on the DM call to action, hard.** No fade-out, no "learn more".
- **No progress bar.** A reel showing how much is left invites the swipe.
- **Fill the frame.** 1080×1920 is portrait geometry with designed edges, and
  something is always moving, or it reads as a paused video.

## Facts

- **Prices from `config/brand.json`. Never from memory.** Kairo is **$410 once**
  (the live checkout, `KAIRO_PRICE_CENTS=41000`).
- **"A salon", never "salons".** Kairo runs one.
- **The call to action is a DM** (`brand.json → cta`). The website isn't launched
  for this audience: never point at a URL.
- **Real screenshots only**, from `public/screenshots/`. No AI pictures of the
  product. They are captures of Kairo itself with sample data; the `.json` beside
  each holds the measured rectangles of what is on it.
- **Melbourne, southern hemisphere.** October is spring.

## The voice — the part that matters most

- **Never the default voice, never a generic neutral male read.** It sounds like
  a corporate explainer, the opposite of what sells to a salon owner.
- **Design the voice**, don't pick one: `brand.json → voice.design`.
- **Write it to be said.** Short sentences. Contractions everywhere except
  "cannot". If a line doesn't sound like speech out loud, rewrite it.
- **After every new take:** `node tools/vo-spans.mjs reel/vo/kairo-notify.mp3`,
  paste what it prints over `LINES` in `tools/cut-vo.mjs`, then run it. The spans
  are hardcoded and go stale the instant the voice changes.
- **Vary the gaps** (`reel/notify.json → gapAfter`). Identical pauses are what
  make TTS sound like TTS; `cut-vo.mjs` warns when they don't vary.
- **Check credits before planning** a voice: designing one costs 3 Picsart credits,
  speaking a script 1 more. It ran out mid-task once and half a brief went unmade.

## A presenter reel (the Higgsfield way)

A face talking to camera in the first second holds a thumb better than any
screen. When the reel has a presenter, her take is the voice and the picture
follows her timing; nothing is re-cut, or her lips stop matching her words.

- **One take, Seedance 2.5, via Higgsfield** (`scene_builder_3d_generate_video`
  in the "Kairo reels" 3D project, t2v, 9:16, `generateAudio: true`). Put the
  whole script in the prompt, word for word, with the accent, the room and "no
  music, no text on screen". 20 s fits ~45 words.
- **Draft first, then finalise that same draft** (`draft: true` at 480p, then
  `draftJobId` at 1080p). The final keeps the draft's words and pauses, so the
  draft is the cheap place to find out the read is wrong. Two charges, never more
  for one reel.
- **She is AI-generated. She is never a customer**, never says "I use it", and
  never says "DM me": she is not the seller (`brand.json → cta.presenter`).
  Switch on Instagram's AI label when posting.

```
python tools/take-words.py reel/vo/presenter.mp4 > reel/out/words.json   # needs faster-whisper
node tools/take-timeline.mjs reel/vo/presenter.mp4   # timeline (snapped to her pauses), vo.wav, her frames
node tools/probe-reel.mjs                            # then the sheet, as always
node tools/render-reel.mjs                           # voice + synthesised effects (tools/sfx.mjs)
```

`take-timeline.mjs` says where she went off script; read it before probing.
The effects are cues in the page (`window.CUES`) on the same cut times as the
picture, and the renderer prints both levels.

## The pipeline (a voice-only reel)

```
node tools/cut-vo.mjs --estimate     # no voice yet: time the lines from word counts
node tools/vo-spans.mjs reel/vo/kairo-notify.mp3   # after a take: read the spans
node tools/cut-vo.mjs                 # voice track + reel/out/timeline.json
node tools/probe-reel.mjs             # frames, measured, and a contact sheet
node tools/render-reel.mjs            # ~13 minutes; only after the sheet is right
```

- **Probe before rendering.** Almost every framing mistake is visible in one frame.
  `probe-reel.mjs` measures with `getBoundingClientRect` — frame, Instagram's safe
  area (230 px top, 380 px bottom, 60 px sides), text size, overflow, frames that
  stop moving, shots over 3 s — and writes `reel/out/probe/sheet.png`. Show the
  sheet before a full render.
- **When handing a reel over:** say plainly that you could not hear the audio, give
  the measured levels `render-reel.mjs` prints, and name anything you could not do.
