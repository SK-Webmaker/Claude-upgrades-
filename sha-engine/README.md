# Sha Engine

Automated content and marketing system for **Hair by Sha**, Camberwell VIC 3124.

Researches what is working in Australian beauty content, cuts Shamalka's raw
salon footage into publish-ready verticals, gates everything behind her
approval, publishes to Instagram and TikTok, then scores the results and feeds
what it learned back into next week's plan.

Sha's total weekly involvement is a batch approval on her phone, plus filming
that happens naturally during appointments.

---

## What actually works, and what needs a human

This is the part most "auto-post to social" tooling is vague about, so it is
stated plainly.

| Platform | Status | Detail |
| --- | --- | --- |
| **Instagram Reels** | Fully automatic | Graph API publishes end to end. Capped at 25 API posts per rolling 24h (Reels and Stories share the bucket), 90s max, 9:16. Requires an Instagram **Business** account linked to a Facebook Page. |
| **TikTok** | Fully automatic | Publishes through an **already-audited partner app** (the Higgsfield connector) rather than waiting on our own TikTok review. `DIRECT_POST` at `PUBLIC_TO_EVERYONE` works day one, and a licensed Commercial Music Library track can be attached — something the raw API cannot do for a draft at all. Quotas: 5 posts/minute, 13/24h. |
| **TikTok fallbacks** | Available | If the broker is ever unavailable, `publishing.tiktok.route` switches to `inbox` (draft + one tap, no audit needed) or `direct` (our own app, once `auditPassed` is true). Same code path. |

Building unattended TikTok posting on an *unaudited* app produces a system that
looks like it works and reaches zero people — an unaudited client is capped at
`SELF_ONLY`, which is visible to nobody and forces the account private. Routing
through an app that has already passed review sidesteps that entirely.

---

## Install

```bash
cd sha-engine
npm install
node src/cli.js doctor
```

`doctor` prints exactly which capabilities are live and what to set for each
one. Nothing else needs to be configured to run the pipeline in dry-run mode.

Requires Node 20+. `ffmpeg` and `ffprobe` arrive via npm — no system install.

---

## Daily use

```bash
node src/cli.js .start     # the weekly run
node src/cli.js week       # the full Monday sequence
```

Or stage by stage:

```bash
node src/cli.js ingest     # pull new footage out of the inbox
node src/cli.js research   # refresh the AU trend brief
node src/cli.js plan       # build the week's slots
node src/cli.js cut        # render everything that has footage
node src/cli.js gate       # run the rules, queue for approval
node src/cli.js approve <postId>
node src/cli.js reject <postId> "hook is weak"
node src/cli.js ship       # publish what is approved and due
node src/cli.js learn      # score results, update pattern memory
```

Add `--dry-run` to any run to go through every motion without publishing.

---

## How it works

Seven stages. Each hands off to the next, and stage 7 writes back into stage 3,
which is what makes the system improve rather than merely repeat.

**1 · Ingest** — Sha drops clips into `data/inbox/`. They are deduped by
content hash, probed for duration and orientation, classified from the filename
(`before-jane.mp4` → `before`), and grouped into appointments by shot time so a
before and after come off the same head.

**2 · Research** — Scrapes TikTok Creative Center filtered to **Australia**
(official TikTok data, free, no ad account) for trending sounds and hashtags,
keeps only what is relevant to hair, and ranks the format library by what has
actually performed for this salon. Without Firecrawl connected it runs on
learned history and says so rather than inventing trends.

**3 · Plan** — Allocates the week across the content mix, picks a format per
slot, and matches each against footage actually on hand. It will not plan a
reveal it has no reveal for; unmatched slots become a shot list telling Sha
what to film.

**4 · Cut** — Scene-detects the source, scores windows by motion energy, keeps
the densest ones in chronological order, crops to 9:16 without squashing,
speed-ramps everything after the hook, and burns captions via libass. One
ffmpeg pass per clip. The finished duration is computed *before* rendering, so
captions are timed correctly on the first pass instead of rendering twice.

Because Sha is on camera with voice, captions are **word-synced** rather than
written in advance: `faster-whisper` produces word-level timestamps, and ASS
`\kf` sweeps highlight each word as she says it. Word timings are remapped
through the trim and the speed ramp — without that remap, captions drift
further out of sync the longer a clip runs, which is the single most common way
an automated caption pipeline produces unusable output.

Framing tracks the subject rather than centre-cropping blindly. Most clipping
tools use face detection; a colourist's footage is frequently the *back* of a
head, where face detection finds nothing and silently centres the crop. Tracking
column edge-energy instead works for a face, a back of a head, or hands in
foils — and the crop holds still unless the subject genuinely moves, because an
animated crop on static footage reads as a mistake.

**5 · Gate** — Ten rules, each of which explains its failure in words a human
can act on. Blockers stop a post dead: not vertical, no captions, no consent
policy, unset booking link, a near-duplicate of the past three weeks. Warnings
flag it for attention: banned brand-voice words, a late hook, too many offer
posts. Whatever survives goes to Sha.

**6 · Ship** — Publishes approved posts at the scheduled Melbourne time,
respecting Instagram's real remaining quota rather than discovering it through
errors. Failures retry up to three times, then say they need a human.

**7 · Learn** — Pulls performance back in and scores it. The weighting is
deliberately lopsided: a booking-link tap is worth roughly 17× a like, and a
save 10×, because a like costs nothing and predicts nothing while a save is a
client deciding they want this done to their own head. Winning formats are
promoted, losers demoted, with older results decayed so the system tracks what
is working now.

---

## Agents and the coordinator

Seven specialists, one coordinator that oversees them.

| Agent | Job | Critical |
|---|---|---|
| **Librarian** | Takes in footage, dedupes, classifies, groups into appointments | no |
| **Scout** | Watches what is working in Australian beauty content | no |
| **Producer** | Decides what gets made this week and why | yes |
| **Editor** | Cuts footage into finished verticals | yes |
| **Critic** | Blocks anything that should not reach a client | yes |
| **Publisher** | Sends approved posts out at the right time | no |
| **Analyst** | Scores what went out and teaches the Producer | no |

The coordinator does none of the work. It derives the running order from each
agent's declared requirements rather than a hard-coded sequence, retries
failures twice, and decides what is worth interrupting Sha about. A *critical*
agent failing halts the run and says why; a non-critical one failing is noted
and the run continues, because losing trend data should never cost a week of
posting. Agents that are missing an optional capability run **degraded** and
announce it rather than going quiet.

Every run is recorded — steps, retries, degradations, escalations — so an
automated system stays auditable instead of being a black box that either
worked or did not.

```bash
node src/cli.js week          # coordinator runs the week, holds before publish
```

---

## On the phone

The control room is a PWA. Open it on a phone, add to home screen, and it runs
standalone with no browser chrome.

- **Add footage** — tap the upload zone, pick clips from the camera roll. They
  stream straight to disk (up to 2 GB), get ingested automatically, and are
  classified from the filename. Upload progress is shown, because a 900 MB clip
  over phone data with no feedback reads as a broken app.
- **Build this week** — one button runs the whole coordinated pipeline.
- **Approve** — each cut with its video preview, hook, hashtags and scheduled
  time, with thumb-sized approve and reject.
- **Agents** — live status of every specialist as the coordinator drives them.

Verified at 393×852 with zero horizontal overflow.

---

## The anti-slop design

Four rules, enforced in code rather than intention:

1. **Generative tools never invent a hair result.** They make covers, b-roll and
   graphics. What a viewer sees on a head is footage of work Sha actually did.
2. **Research copies structure, not content** — hook shape, pacing, reveal
   timing. It does not lift another salon's footage or captions.
3. **A human approves everything.** The gate is not a formality to remove later.
4. **Volume is capped on purpose.** Five considered posts beat fourteen thin
   ones, and the duplicate rule refuses near-repeats within three weeks.

A rejection is training data. `sha reject <id> "reason"` demotes that format in
pattern memory, so the planner stops producing what Sha keeps turning down.

---

## Configuration

`config/brand.json` — business details, services, brand voice (including a
do-not-say list the gate enforces), CTA, caption styling, consent policy.

`config/system.json` — cadence, content mix, video specs, cut tuning, gate
thresholds, scoring weights, publishing modes.

Credentials come from the environment only and are never committed:

```bash
IG_USER_ID=              # Instagram Business account ID
IG_ACCESS_TOKEN=         # long-lived Page token
TIKTOK_ACCESS_TOKEN=
TIKTOK_CLIENT_KEY=
FIRECRAWL_API_KEY=
PUBLIC_MEDIA_BASE_URL=   # renders must be publicly fetchable — both platforms
                         # pull the file themselves and cannot read local disk
```

---

## The control room

There is no dashboard. It existed, was deployed to Render, and was retired on
14 Aug 2026 - it cost more upkeep than it returned. The system runs from a
Claude Code session; the weekly command is `/start`. See `../CLAUDE.md`.

Pipeline stages animate as they run, streamed over server-sent events rather
than polling. The approval queue shows each cut with its video preview, hook,
hashtags and scheduled time, with approve and reject inline. Alongside it: what
is connected, the content mix, footage on hand, and a shot list of what still
needs filming. Both light and dark themes.

---

## Tests

```bash
npm test
```

50 tests covering segment selection, the duration prediction that keeps render
count at one, mix allocation with no rounding loss, placeholder resolution,
trend parsing, the scoring weights, every gate rule, ASS generation including
override-block injection, both platform adapters' preflight logic, karaoke line-breaking and gap padding,
word remapping through trims and speed ramps, crop-expression bounds, the
coordinator's dependency ordering and cycle detection, and the broker's media
limits and disclosure honesty.

---

## Layout

```
config/           brand.json, system.json
src/
  cli.js          command entry point
  lib/            config, logging + event bus, state store, ffmpeg, subtitles
  stages/         ingest, research, plan, cut, render, gate, ship, learn
  platforms/      instagram, tiktok
tests/
data/             runtime state, footage, renders (gitignored)
```

State is plain JSON under `data/state/`, written atomically via rename. The
entire marketing history of a single-chair salon is a few hundred records; a
database would be ceremony.
