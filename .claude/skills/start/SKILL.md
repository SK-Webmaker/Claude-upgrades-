---
name: start
description: Run the full weekly marketing workflow for Hair by Sha — read the live Instagram account, score last week against its target, set this week's, research what is working elsewhere, then author three finished posts (image + caption), two or three video guides, and the marketing projection. Use when the user types /start, says "start the week", "run the week", or asks for this week's posts.
---

# /start — the weekly run

One command. It ends with three posts Sha can publish without editing anything,
video guides she can film, and a projection that builds on last week.

Read `CLAUDE.md` first if it is not already in context — the business, voice,
prices, invariants and account history are all there. Do not guess any of it.

**Budget: this should take one pass, not an exploration.** Roughly 18–28 tool
calls. Batch shell commands. Do not re-read files already in context. If a step
fails, say so and continue — a partial week delivered beats a perfect week
abandoned.

---

## Step 0 · Orient (2 calls)

```bash
cd sha-engine && node scripts/check-creds.mjs; ls content/packs/; cat content/context/sha-notes.md
```

`check-creds.mjs` says in two seconds whether the live read will work. If it
fails, **say so once, plainly, quote its fix, and carry on** — everything except
the account read still works and the week is still worth producing. Do not stall
waiting for a key, and never invent numbers to fill the gap.

`sha-notes.md` carries the standing context — which days need filling, what she
wants more of, what to avoid. Read it before writing anything.

Then read the newest file in `content/memory/` for the follower count, grade and
engagement rate to score against, and the newest pack in `content/packs/` for
what last week promised.

## Step 1 · Read the account, and check what she actually posted

```bash
cd sha-engine && node src/cli.js posted
```

This does both jobs in one call: grades the last 25 posts through Composio, then
matches the captions the system wrote last week against what is really on the
account. It reports each authored post as published (with its likes, comments,
engagement rate and lift against the account's own average) or not published.

**Read the distinction carefully.** "Not published" is an unrun experiment, not
a failed format. Treating the two the same is how a good idea gets abandoned
because she was busy that Wednesday. If something did not go up, that is a
question for Step 1.5, not a verdict.

Then compare against `content/memory/`: followers gained, engagement moved, and
whether last week's specific prediction held. Write that comparison down — it is
what makes the system compound rather than restart every week.

Note honestly if saves and shares came back unmeasured. This account has never
returned them through the API. Unmeasured is not zero, and views often come back
empty for reels too — say so rather than reporting a zero.

*Firecrawl cannot help here.* Instagram blocks scraping and would give no
engagement figures even if it did not; the Composio read is the only source of
real numbers. Firecrawl is for Step 2, researching other accounts and formats.

## Step 1.5 · Ask her, then write the answers down

Use `AskUserQuestion` — one call, all four. She is answering on a phone between
clients, so these must be tappable, not an essay.

1. **Which days need filling this week?** Options: Mon/Tue · Wed/Thu · Fri/Sat ·
   Evenly booked. Multi-select. **This changes what gets written** — see Step 3.
2. **Did you film any of the video guides?** Options: yes, one · yes, more than
   one · no time · they looked too hard. The last answer means the guides are
   wrong, not that she is.
3. **Anything from the chair worth posting?** Options: a client question I keep
   answering · a colour correction that went well · a product someone asked
   about · nothing this week. Free text is where the best posts come from.
4. **Anything to avoid this week?** Options: nothing · a price is changing ·
   I am away part of the week · something else.

If any authored post did not go up, add a fifth question asking why — wrong
tone, no time, did not like the image. That single answer is the most useful
sentence the system can be given.

**Append the answers to `content/context/sha-notes.md`** under a dated heading,
newest first. Do not overwrite the history; the pattern across weeks is the
point. Update the standing-context section only when an answer changes it.

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
| Quiet-day fill | When a day needs filling. See below. |
| Offer | Sparingly — `cta-frequency` caps these so the feed does not read as ads. |

Do not repeat a format used in the last two weeks. Check previous packs.

### Filling the quiet days

If Step 1.5 named days that need filling, **one of the three posts is written to
drive bookings onto those days**, and the other two carry it in the call to
action. This is the difference between marketing and posting: an empty Wednesday
is money already lost, and a generic "book now" does not move anyone to a
Wednesday.

How to do it without sounding desperate:

- **Name the day and the number, not the discount.** "Two Wednesday afternoons
  open this week" is scarcity that happens to be true. Never invent a number —
  if she said Wed/Thu but gave no count, write "Wednesday and Thursday are the
  quiet ones this week" and leave it there.
- **Give the day a reason to suit her.** Mid-week is genuinely better for a long
  colour appointment: the salon is calmer, and a four-hour balayage on a Saturday
  is a worse experience for everyone. Say that — it is true and it reframes the
  quiet day as the good slot rather than the leftover one.
- **Attach it to the service she wants more of**, from the standing context.
  A quiet Wednesday filled with a $45 toner is worth a fraction of the same
  Wednesday filled with a $340 balayage.
- **Never discount.** Sha has 20+ years and a specialist position; a price cut to
  fill a day trains her audience to wait for one. Scarcity and convenience, not
  price. If she explicitly asks for a promotion, that is her call — otherwise do
  not introduce one.
- **Do not run it two weeks running.** If the same day is still empty next week,
  the problem is demand, not the caption, and the honest thing is to say so.

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
