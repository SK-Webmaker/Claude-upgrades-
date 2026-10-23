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

## Credits: they have to last

**The owner does not want an AI person talking in the reels** (21 Oct 2026).
Make presenter-free reels from the B-roll library (below); the presenter
recipe further down is for the rare reel that truly needs a face.

**Higgsfield subscription credits are wiped when the plan renews on the 26th**
(26 Sep: 2.89 left over, gone). So plan the month's paid calls before then
instead of hoarding them. The best use is B-roll clips that every later reel
can use for 0 credits. A 5 s Seedance 2.5 clip at 720p costs 35 credits with
or without a start image; 1080p costs 80. A GPT Image 2.5 still costs 0.25:
make the still first, look at it, then animate only the stills that work.

The presenter-reel budget, for when one is made: about **80 per reel at
most**. The first reel took two 20 s Seedance calls (a 480p draft, then a
1080p final); never repeat that recipe. In order:

1. **Reuse before you generate (0 credits).** `reel/vo/presenter.mp4` is a
   1080p take of the presenter. Her face, her reactions, the point at camera
   and the closing "DM the word Kairo" can appear in every reel. One recurring
   face is a character people recognise, which helps reach rather than hurts it.
2. **Her voice comes from Picsart, not Higgsfield.** Clone it once from the
   take (Picsart `voice-create`, 4 Picsart credits), then speak each new script
   with ElevenLabs through Picsart (1 credit a script). Picsart refills monthly
   (next on 18 Oct). Check `picsart_credits` first.
3. **Higgsfield only for a new face moment the reel cannot do without.** One
   Seedance call, **8 s or less, 720p, no draft**: her frame from the take as
   `start_image` (the same woman every time) and the Picsart line as the
   `audio` reference, so the words are already fixed and a draft has nothing
   left to check.
4. **Rotate the formats.** Of every ten reels, about four open on her (a short
   Higgsfield clip each) and six are real screens with her cloned voice
   (no Higgsfield at all).
5. **Write it down.** After every paid call, add a line to `reel/credits.md`:
   what was made, its length and resolution, and the balance when the owner
   says it. Stop and ask before any reel would pass 80 credits.

## A presenter-free reel (the default)

Faceless formats that are working on Instagram now: a fake text thread over
moody B-roll, big word-by-word type cut on a beat, and the 7-second "money
can't buy happiness, but…" loop. Instagram ranks on sends, watch time and
replays: open on the claim in the first frame, keep it under 18 s, and make
it something one owner sends another.

- **The library:** `reel/broll/clip-0.mp4` … `clip-15.mp4` (5 s, 720p, 9:16).
  `library-sheet.jpg` beside them shows each at 2.5 s, 0 to 15, left to right. `node tools/broll-frames.mjs` turns them into
  frames under `reel/out/broll/` that the pages play back by time.
  Shots: 0 closing-time salon, phone lights up at 1.50 s · 1 hands typing on a
  phone · 2 card tap at a terminal · 3 late-night desk, laptop, invoices ·
  4 busy salon from behind · 5 barber finishing a fade, phone buzzes ·
  6 empty chair, stylist waiting (no-show) · 7 bedside phone lights up at night (at ~2 s)
  · 8 paper diary, crossings-out, landline · 9 owner on the couch at night with
  invoices · 10 glossy blow-dry reveal · 11 closing up, sweeping · 12 trolley
  tray, phone buzzing · 13 scissors through wet hair, macro slow-mo · 14 colour
  swirling in a bowl, macro · 15 morning, a hand picks up the phone. The two
  macros are pattern-interrupt openers: the first half-second that stops a thumb.
- **Feature reels** (`reel/booked.html`, `reel/refill.html`, `reel/noshow.html`):
  one real Kairo feature each, shown on real screens in a floating 3D phone that
  zooms onto the exact element (`reel/kit.js` + `kit.css`: `Phone`, `ring`,
  `tap`, `makeNotif`, `slam`, `say`, `hl`). The screens come from Kairo itself
  on sample data: `node tools/capture-feature-screens.mjs` runs Kairo locally,
  sets the features up through the API, and writes
  `public/screenshots/feature/*.png` plus `feature.json` (where each element is,
  in capture pixels), which `tools/render-page.mjs` passes to the page. Every
  message shown (booking alert, waitlist text, deposit note) is copied from the
  code that sends it, and a screen that only exists because the sample install
  isn't set up (setup checklist, "add your ClickSend key") never goes in.
- **A page per reel** (`reel/group-chat.html`, `reel/the-bill.html`,
  `reel/loop.html`): everything on screen is a function of t (`reel/lib.js`),
  cut on the beat (`window.BPM`, 124), sound cues in `window.CUES`.
- **Contact sheet first:** `node tools/render-page.mjs <name> --sheet` (seconds).
  Then the full render, `node tools/render-page.mjs <name>` (about 2 min), which
  writes `<name>.mp4` (original beat from `tools/beat.mjs`, never muted for
  copyright) and `<name>-nomusic.mp4`, for posting under a trending sound.
- **Voice-over cuts** (`noshow`, `refill`, `booked`): a synthetic Australian
  woman's voice, designed with ElevenLabs Voice Design (via Picsart) and cloned
  in Higgsfield as "Kairo narrator (AU female)"; never a real person's voice.
  One file per line in `reel/vo/<name>/`, placed by beat in `reel/vo/<name>.json`.
  The reel is rendered slower so the lines fit (`node tools/render-page.mjs <name>
  --tempo 100 --beats 37.5 --as <name>-vo`), then `node tools/mix-vo.mjs <name>`
  writes `<name>-voiceover.mp4` (voice over the effects, no music) and refuses
  lines that collide. Transcribe every new line before using it ("Kairo" is
  said like "Cairo"). Posting one needs Instagram's AI label.
- **Never name a competitor in a reel** (owner, 22 Oct 2026: no "Fresha",
  no logos, no lookalike merchant names). Compare against "your booking app"
  and an example bill ($99 a month); the fine print says it is an example,
  not any particular app's price. Fees some apps charge (a cut of new
  clients, per-team-member pricing) are said as "some apps…". A made-up
  conversation says "Dramatisation". Nobody "says" they bought Kairo: there
  are no customer quotes to use.
- **What Kairo can promise:** "$410 once", "$0 a month, forever" (the
  website's own words), "no commission". Not "special offer" or "limited
  time": $410 is the normal price. Not "yours to keep forever": the terms
  don't say that.
- **Type, late-2026 Reels style:** lowercase and conversational, white with a
  soft shadow (no white boxes), one word under a yellow highlighter
  (`.hl`, #FBBF24), one loud word per reel in Anton
  (`assets/fonts/anton.css`, OFL). All-caps on every line reads as dated.
- **Every feature named must be in the app.** True today: online booking,
  deposits, reminders, the iPhone app, client CSV import, no commission. Card
  payments and texts use the salon's own Stripe and ClickSend, and the fine
  print says their fees apply.
- **Posting, captions and the DM reply** are in the Kairo repo,
  `docs/marketing/REELS.md`.

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
