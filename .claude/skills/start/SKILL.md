---
name: start
description: Run the full weekly marketing workflow for Hair by Sha — read the live Instagram account, score last week against its target, set this week's, research what is working elsewhere, then author three finished posts (image + caption), two or three video guides, and the marketing projection. Use when the user types /start, says "start the week", "run the week", or asks for this week's posts.
---

# /start — the weekly run

One command. It ends with three posts Sha can publish without editing anything,
video guides she can film, and a projection that builds on last week.

Read `CLAUDE.md` first if it is not already in context — the business, voice,
prices, invariants and account history are all there. Do not guess any of it.

**Budget: this should take one pass, not an exploration.** Roughly 15–25 tool
calls. Batch shell commands. Do not re-read files already in context. If a step
fails, say so and continue — a partial week delivered beats a perfect week
abandoned.

---

## Step 0 · Orient (2 calls)

```bash
cd sha-engine && ls content/packs/ && cat content/memory/*.json | head -60
```

Establish: what week is it (Monday-anchored), what did last week's pack promise,
and what is the last known follower count and grade.

If `COMPOSIO_API_KEY` is not set in the environment, say so plainly and skip to
Step 2 — everything except the live read still works, and the week is still
worth producing. Do not stall waiting for a key.

## Step 1 · Read the live account

```bash
cd sha-engine && node src/cli.js review
```

This calls Instagram through Composio and grades the last 25 posts.

Then **compare against `content/memory/`**: followers gained, engagement moved,
which of last week's three posts actually went up, and whether the specific
prediction made last week held. Write that comparison down — it is the part that
makes the system compound rather than restart every week.

Note honestly if saves and shares came back unmeasured. Unmeasured is not zero.

## Step 2 · Research what is working

Two or three searches, no more. Look for:

- Formats performing for hairdressers/colourists right now — not generic
  "Instagram tips", but what salons specifically are getting reach on.
- Any seasonal hook. **Southern hemisphere**: check the actual month against
  Melbourne's calendar (spring racing, Christmas party season in Nov–Dec,
  Mother's Day in May, back-to-school late Jan).

Keep the URLs. Every video guide must cite a real reference, not an assertion.

## Step 3 · Author three finished posts

This is the deliverable. Not briefs — finished work.

**Choose the mix deliberately** against what the account needs this week. Rough
shape, adjust with evidence:

| Type | Why it earns a slot |
|---|---|
| Price / transparency | Nobody local publishes numbers. Gets screenshotted and forwarded. |
| Myth correction | Lands as news, not advice. Sells a service without an offer in it. |
| Saveable list | Saves score 6× a like. Sets up the rebook. |
| Seasonal | Only when the moment is real and close. |
| Offer | Sparingly — `cta-frequency` caps these so the feed does not read as ads. |

Do not repeat a format used in the last two weeks. Check previous packs.

### Write the captions

Structure: `hook` (one line, the scroll-stopper) → `body` → `cta` → `hashtags`
(4–8, all with `#`).

The hook does the work. Her best post ran 36.93%, her worst 1.70% — the
difference is the opening, not the craft. Make it specific and slightly
uncomfortable: *"Purple shampoo is not fixing your brass."*

Validate every caption before going further:

```js
import { checkCaption } from './src/lib/pack.js';
checkCaption({ hook, body, cta, hashtags });   // must return []
```

### Render the images

Edit the `CARDS` array in `scripts/make-cards.mjs` — new `file` names prefixed
with the week (`w2-price.png`), then:

```bash
cd sha-engine && node scripts/make-cards.mjs
```

Three layouts exist: `price`, `myth`, `list`. Add a layout only if the content
genuinely needs one. **Look at the output** with the Read tool before shipping
it — check for dead space, text that wrapped badly, and numerals that misread.
A card you have not looked at is not finished.

If Chromium fails to launch, the executable path is `/opt/pw-browsers/chromium`
(the installed revision is behind what Playwright resolves — this is already
handled in `chromiumPath()`, so a failure means something else changed).

## Step 4 · Two or three video guides

Reels are the growth lever — every top-5 post on this account is video. Each
guide needs:

- **A hook instruction** for the first 0.5–2 seconds. Instagram weights that
  window harder than TikTok does.
- **A shot list with timings**, filmable on a phone in a working salon. She is
  alone in the chair with a client; nothing requiring a second person.
- **On-screen text with timings.** Most of the feed watches on mute.
- **An audio note.**
- **A written caption**, Critic-validated like any other.
- **Real references with URLs** — what format this is, and where it is working.
- **A "watch for"** — the one thing that breaks it.

Design at least one to be sent rather than liked. A DM share is the strongest
signal a Reel generates, so the caption should say who to send it to.

## Step 5 · The projection

Short. Four or five sentences, in the pack as `projection`:

- What last week's numbers imply for this week (target followers, target reach).
- The one thing to change, drawn from the review — not a general principle.
- What this week sets up for next week, so the weeks stack.

Growth model in `src/stages/goals.js`: ~4%/week base, ×1.15 accelerating,
×0.5 consolidating. On 176 followers that is roughly +7/week. Never invent a
target when the baseline is unknown — say it is unavailable and why.

## Step 6 · Save, verify, hand over

```bash
cd sha-engine && node -e "import('./src/lib/pack.js').then(m=>{const p=m.current();console.log(p.weekOf,p.posts.length,p.videoGuides.length,p.complete)})" && npm test
```

Write the pack to `content/packs/<monday>.json` matching the existing shape
(read last week's file for the schema). Loading it runs every caption through
the Critic — **if it throws, fix the caption, never loosen the rule.**

Then commit, push, and send Sha the images:

- `SendUserFile` the three PNGs so she can save them straight to her phone.
- Post the three captions in chat as copyable blocks.
- List the video guides with their references.
- State the projection in two lines.

Keep the closing message tight. She is reading it between clients.

---

## Learning

Two things must survive into next week or the system does not compound:

1. **Update `content/memory/`** with this week's numbers so next `/start` has a
   baseline to score against.
2. **Record what was predicted** in the pack's `projection`, so next week can
   check it rather than quietly moving on.

If a format underperformed, say so next week and do not run it again. If one
over-performed, run a variant.

## Token management

Every MCP connector costs schema tokens on every turn — `ruflo doctor` measured
**333 advertised tools ≈ 61,550 tokens** on this account. That dwarfs anything
the workflow itself spends.

- Keep only the connectors this work uses: **Composio** (Instagram),
  **Firecrawl** (research). Everything else — Figma, Picsart, Resend, Semrush,
  artlist, higgsfield, Canva, GitHub — should be off unless a specific task
  needs it.
- Batch shell commands into single calls.
- Do not re-read files already in context, and do not re-run `review` twice in
  one session.
- Do not spawn subagents for this workflow. It is linear and each spawn
  re-derives context already loaded.
- `npx @claude-flow/cli@latest doctor` reports the current schema overhead if it
  feels heavy again.
