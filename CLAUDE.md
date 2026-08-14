# Gloss — the marketing system for Hair by Sha

This file loads automatically in every Claude Code session opened on this repo.
It is the working memory: who the client is, how she sounds, what the account
has actually done, and what has already been tried and rejected.

**There is no dashboard and no hosted service.** Both existed and both were
retired on 14 Aug 2026 — the dashboard cost more attention to maintain than it
returned, and Sha never needed to look at it. The system now runs entirely
inside a Claude Code session. The weekly command is `/start`.

---

## 1 · The business

| | |
|---|---|
| Trading name | **Hair by Sha** |
| Owner / operator | **Shamalka** ("Sha") |
| Address | 1 Prospect Hill Rd, Camberwell VIC 3124 |
| Instagram | [@hairbysha_c](https://instagram.com/hairbysha_c) |
| Website | https://hairbyshacamberwell.com/ |
| Booking | https://hairbysha-booking.onrender.com/book (Kairo, self-hosted) |
| Phone | 0452 611 799 |
| Timezone | Australia/Melbourne — **southern hemisphere seasons** |
| Speciality | Hair colour specialist. K18 certified, 20+ years |

Catchment: Camberwell and the surrounding eastern suburbs — Glen Iris, Hawthorn,
Canterbury, Balwyn, Surrey Hills, Kew. Her audience skews working mums.

**Scope: Instagram only.** Sha cross-posts to TikTok and Facebook by hand. Do
not build, schedule, or publish to those platforms.

### Services and prices

Never invent a price. These come from `sha-engine/config/brand.json`, which is
the single source of truth — read it rather than trusting this table if they
ever disagree.

| Service | Price | Time |
|---|---|---|
| Balayage / Lived-in Blonde | from $340 | 3h 30 |
| Blonde Transformation (Foils + Root + Cut) | from $350 | 4h |
| Blonde Transformation + K18 | from $420 | 4h |
| Full Blonde (full head foils) | from $320 | 3h 30 |
| Partial Blonde (Foils) | from $240 | 2h 30 |
| Root Colour + Refresh | from $150 | 1h 45 |
| Balayage | from $150 | 2h 30 |
| Full Colour | from $110 | 2h |
| Root Colour | $85 | 1h 45 |
| **Toner & Gloss** | **$45** | 45 min |
| Restyle Cut | $140 | 1h |
| Cut & Blow Wave | $110 | 1h |
| Blow Wave | from $55 | 45 min |
| K18 Treatment | $45 | 15 min |
| Deep Treatment | $30 | 10 min |
| Extensions — Move up / Refit | $300 | 2h 30 |

`from: true` matters. If the config says `from`, the caption and the card must
say "from" or "starts at" — not a flat number.

---

## 2 · Brand

### Palette (`config/brand.json` → `look`)

| Token | Hex | Use |
|---|---|---|
| Ink | `#12100E` | Dark backgrounds, body text on cream |
| Gold | `#B07C33` | Accent, prices, eyebrows, rules |
| Violet | `#6A5B8C` | Secondary accent, the "answer" line |
| Cream | `#F6F1E9` | Light backgrounds, text on ink |

### Type

**Fraunces** (variable serif, `opsz` 144 for display) for headlines and figures.
**Inter** for body, labels and numerals. Both are inlined as base64 woff2 in
`sha-engine/assets/fonts/brand-fonts.css`. **Chromium cannot reach
fonts.googleapis.com from inside the sandbox** — without the inlined file it
silently falls back to Liberation Serif and the cards look like a school
handout. Regenerate with `scripts/fetch-fonts.mjs` if the faces change.

Use Inter for list numerals. Fraunces' display `3` has a flat top that reads as
a `5` at thumbnail size, and a numbered list whose third item looks like item
five is worse than a plain one.

### Voice

> A calm, expert colourist who explains why things happen to hair. Warm but not
> gushing. Speaks to a client, not an audience.

**Do:** plain language over jargon without dumbing down · name the actual
product or technique when it matters · talk about hair health as much as colour
· speak to one person.

**Never say:** obsessed · slay · ate · iconic · unreal · insane · girlies ·
besties · "link in bio!!!" · ALL CAPS SHOUTING · clickbait the video does not
pay off.

Max 2 emoji. 4–8 hashtags. Core tags: `#melbournehairdresser` `#camberwellhair`
`#balayagemelbourne` `#melbournecolourist`.

Legitimate capitals that are **not** shouting: K18, ELEVEN (ELEVEN Australia, a
line she stocks), DM, CTA, VIC, AU, IG, SMS, UV.

---

## 3 · Where the account actually stands

Last live read: **14 Aug 2026** — `content/memory/baseline-2026-08-14.json`.
That file is the baseline week 2 gets scored against. Read it at the start of
every `/start`.

| | |
|---|---|
| Followers | 176 |
| Posts reviewed | 25 |
| Average engagement | **7.48%** — grade **B** |
| Best post | 36.93% — `/reel/DbYEU0XzW5x/` |
| Worst post | 1.70% — `/reel/DXymBcUTxif/` |

**7.48% on 176 followers is genuinely strong** for this size. The problem is not
engagement rate, it is reach and the total number of people seeing anything.

### What the data says

- **Every top-5 post is a VIDEO.** Stills have never out-performed a reel on this
  account. Reels are the growth lever; cards are the save-and-forward lever.
- **A 35-point spread** between best and worst. The variance is in the first two
  seconds, not in the craft.
- **Instagram returned no saves or shares** for these posts through the API. That
  signal is *unmeasured, not zero* — never report it as zero, and never grade a
  post down for it.
- The bottom three posts are all captions with no hook — price lists and
  hashtag-only captions.

### The caption defect problem — 23 of the last 25 posts

Something in whatever drafting tool she used before strips `#` after the first
few tags and pastes scaffolding into published text. **225 hashtags across the
account currently reach nobody.**

All 23 replacements are written and Critic-validated in
`sha-engine/CAPTION-FIXES.md`. Instagram has **no caption-edit API** — Meta
exposes no endpoint — so these must be fixed by hand in the app: open the post,
`⋯` → Edit, replace, tick. Ask about progress on this occasionally; it is the
single highest-return hour of work available on the account.

Defect types seen live, all now blocked by the Critic:
`Alt caption (shorter, quieter tone)` · `Hashtags:` · `TikTok caption:` ·
`[YourCityHair]` · `Or shorter:` · CamelCase tags stripped of `#` · lowercase
tags stripped of `#`.

---

## 4 · The invariants

These are not preferences. They have each been paid for once already.

1. **Nothing publishes without Sha.** The system produces finished work; she
   posts it. There is no auto-publish, ever.
2. **No AI-generated photographs of hair.** An AI "result" on a colourist's feed
   misrepresents work she did not do, and Instagram auto-labels detected AI
   imagery — on a local service business that costs more trust than the reach is
   worth. Cards are typographic, rendered by Chromium so the text is exact.
   Image models mangle real words, and a price card with a malformed dollar
   figure is worse than no card.
3. **Every caption passes the Critic before it is handed over.** See §6.
4. **Southern hemisphere.** August is late winter in Melbourne. Never write a
   northern-seasons caption.
5. **Prices come from `brand.json`.** Never from memory.
6. **Instagram only.**

---

## 5 · What the repo contains

```
sha-engine/
  config/brand.json        Business, prices, voice rules, palette — source of truth
  config/system.json       Gate thresholds, video limits, content mix
  content/packs/<date>.json  The week's finished posts + video guides
  content/cards/*.png      Rendered post images, 1080×1350
  content/memory/*.json    Account baselines to score against
  content/context/sha-notes.md  Sha's own weekly input — read at every /start
  src/lib/pack.js          Loads a pack, validates every caption, throws if bad
  src/lib/brand.js         Voice rules, seasons, local moments
  src/stages/review.js     Reads the live account via Composio, grades it
  src/stages/gate.js       The Critic — all caption rules live here
  src/platforms/instagram-composio.js   Composio adapter (read + publish)
  scripts/make-cards.mjs   Renders the week's cards via Playwright/Chromium
  scripts/fetch-fonts.mjs  Re-inlines the brand faces
  scripts/check-fixes.mjs  Runs CAPTION-FIXES.md back through the Critic
  scripts/check-creds.mjs  Verifies the Composio key and finds the account id
  CAPTION-FIXES.md         23 replacement captions for published defects
  JOURNAL.md               Running log of decisions
```

`npm test` → 107 tests. Run it after any change to the engine.

---

## 6 · The Critic (`src/stages/gate.js`)

Blockers — a caption carrying one of these is not handed over:

- `bare-hashtag` — CamelCase runs loose in prose, **and** a run of ≥3 lowercase
  tokens of ≥8 characters trailing the last real hashtag on a line. The second
  rule exists because her lowercase tags are indistinguishable from ordinary
  words and the first version missed 44 dead tags across 3 posts.
- `draft-artifact` — Alt caption / Option A / Version 2 / draft: / [insert…] /
  {{…}} / lorem ipsum / TODO / as an ai / "TikTok caption:" / "Hashtags:" /
  "Or shorter:"
- `booking-url`, `consent`, plus the media rules (vertical, resolution,
  duration, burned-in captions) for video.

Warnings: `hashtag-count` (4–8), `voice` (word-boundary matched — a substring
test flagged every caption containing *water*, because "ate" is on the avoid
list), `cta-frequency` (offers capped so the feed does not read as an ad
channel).

Validate any authored caption with:

```js
import { checkCaption } from './src/lib/pack.js';
checkCaption({ hook, body, cta, hashtags });   // [] means clean
```

---

## 7 · Credentials

Read from the environment only, never committed. Set these in the session before
running anything that touches the live account:

Credentials live in `sha-engine/.env`, which is gitignored and loaded
automatically by `config.js`. Copy `.env.example` and fill it in. Run
`node scripts/check-creds.mjs` to verify before anything else.

| Variable | What it is |
|---|---|
| `COMPOSIO_API_KEY` | **Must start `ak_`** — Composio → Settings → **Project Settings** → API Keys. A `ck_` key from the account-level page 401s on every endpoint, and fails silently in the worst way: `/connected_accounts` answers "0 accounts" rather than "bad key", which reads as Instagram not being connected. Three `ck_` keys have been tried and rejected. |
| `COMPOSIO_CONNECTED_ACCOUNT_ID` | Composio → Connected Accounts → the Instagram entry |
| `COMPOSIO_USER_ID` | `sha` |
| `FIRECRAWL_API_KEY` | Optional. Without it, research falls back to web search. |

Composio's **MCP connector and REST API expose different tool slugs for the same
toolkit.** The adapter uses the REST slugs (`INSTAGRAM_GET_USER_INFO`,
`INSTAGRAM_CREATE_MEDIA_CONTAINER`, `INSTAGRAM_CREATE_POST`, …). If a call
returns "Tool not found", that mismatch is why.

Publishing needs `PUBLIC_MEDIA_BASE_URL` — Instagram fetches media server-side,
so it must be a public URL. Not needed for reading or for producing a pack.

---

## 8 · Things already tried and rejected

Do not re-propose these.

- **A hosted dashboard** (Render, `gloss-sha`). Built, deployed, worked. Retired
  14 Aug 2026 — it was maintenance overhead Sha never opened.
- **Instagram drafts / scheduled posts via API.** Meta exposes no save-to-drafts
  endpoint. Containers expire in ~24h. Not possible.
- **Editing a published caption via API.** No endpoint exists.
- **Moving to Vercel.** Serverless has no attachable disk, cannot hold the long
  connections, and struggles with headless Chromium. Hobby plan forbids
  commercial use; Pro is $20/user/month against ~$7 on Render.
- **A Render cron service.** A disk attaches to exactly one service, so a cron
  container would score into a void.
- **Raw Meta Graph API tokens.** Replaced by Composio OAuth.
