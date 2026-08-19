---
name: ads
description: Research, write and render Facebook ad creative for Hair by Sha — paid ads built to convert strangers into bookings or calls, not social posts. Use when the user types /ads, says "make Facebook ads", "make me some ads", or asks for paid creative.
---

# /ads — Facebook ads

**An ad is not a post.** That distinction is the whole skill. A post is read by
people who already follow her and is scored on saves and forwards. An ad
interrupts a stranger mid-scroll and is scored on one thing: did they book, or
did they call.

Read `CLAUDE.md` first. Every invariant applies here — especially **7, never
discount**, which puts this work directly against the standard salon-ads
playbook. See below.

---

## What the research actually says

Verified against sources, not assumed. Re-check if a year has passed.

### Creative

- **1080×1350 (4:5).** The tallest ratio Meta serves uncropped in feed and the
  most phone screen you can occupy. Minimum 600×750. JPG or PNG, under 30 MB.
- **Less text on the image than an organic card.** The hard 20% text rule is
  gone, but [lighter text overlay still gets cheaper
  delivery](https://blog.adnabu.com/facebook-ads/facebook-ad-specs/). `make-ads.mjs`
  layouts carry roughly a third of the words `make-cards.mjs` does. Do not
  reuse a post card as an ad.
- **Margins are for feed, not Stories.** In feed the caption, headline and CTA
  render *below* the image, so the full Stories safe area (14% top / 20% bottom)
  just donates the best space to nothing. If a Stories placement is ever added,
  render 9:16 separately — do not stretch these.

### Copy limits

| Field | Limit | Note |
|---|---|---|
| Primary text | ~125 chars visible | Truncates to "… see more". Front-load the hook. |
| Headline | ~40 chars | Under 5 words reads best. |
| Description | ~30 chars | Desktop feed only, often dropped on mobile. |

### Campaign

- **Traffic vs Leads.** Leads usually converts better for salons but costs more:
  [~$1.92 CPC vs ~$0.70, ~$27.66 per lead](https://www.graphed.com/blog/facebook-ads-for-hair-salons).
  She has a booking system, so Traffic → Kairo is the shorter path for a Book Now
  ad. Use Leads with conversion location **Calls** for a Call Now ad.
- **Optimise for landing page views**, not link clicks. Clicks counts the tap;
  landing page views counts the page loading. On a small budget that gap is most
  of the money.
- **Radius 8 km** on the salon pin covers the real catchment. `brand.json` says
  12 km, which reaches the CBD and buys people who will not drive it.
- **"People living in this location"**, never the default "living in or recently
  in", which buys everyone who drove through once.
- **$10–20/day**, left alone for 7 days. The learning phase needs ~50 events;
  editing budget or creative resets it. That is the most common way a small
  account burns money.
- **Leave interests empty** at this radius. The audience is already small and
  stacking interests starves delivery.

## The invariant that fights the playbook

Every salon-ads guide recommends a **new-client discount**. Invariant 7 forbids
it. Do not quietly adopt one because the research says to.

Convert on **certainty** instead: a price quoted before she sits down, an honest
answer about what her hair needs, the calm mid-week appointment. What premium
services actually convert on is
[outcome and transformation, not price](https://www.blab.co/blog/how-to-position-your-business-to-attract-premium-clients).

Say so in the handover. If cost-per-click comes in badly above benchmark, the
no-discount stance is the first suspect — that is a real trade for Sha to make
knowingly, not a bug to fix silently.

## No AI photographs of hair

Invariant 2, and it bites harder in paid than organic: an AI "result" in an ad
is a claim about work she did not do, shown to strangers, with money behind it.
Typographic, rendered by Chromium, text exact.

**Say this in the handover every time:** a real photo of her own work will
almost certainly beat a typographic card, because
[before/after transformation is the highest-converting salon creative there
is](https://www.graphed.com/blog/facebook-ads-for-salons). The cards are the
strongest thing that can be built *without* photography. The moment she supplies
real client photos, test them against these.

---

## Running it

1. **Confirm which days need filling** before writing a word. Check
   `content/context/sha-notes.md`, and if the user names different days from
   Sha's own answer, flag the conflict rather than silently picking one.
2. **Two ads, two different jobs.** One Book Now, one Call Now. The user's
   standing instruction is to use only those two CTAs — no Learn More, no
   Send Message.
3. **Prices from `brand.json`.** `from: true` means the ad says "from".
4. Edit the `ADS` array in `scripts/make-ads.mjs`, then:
   ```bash
   cd sha-engine && node scripts/make-ads.mjs
   ```
5. **Look at every render with the Read tool.** Dead space, bad wrapping,
   numerals that misread. An ad you have not looked at is not finished.
6. Write `content/ads/CAMPAIGN.md`: creative, primary text, headline,
   description, CTA, destination, objective, targeting, budget, and the
   pre-flight checklist.
7. **State the measurement gap.** There is no Meta Pixel on the Kairo booking
   page, so Meta cannot see a booking, cannot optimise toward one, and cannot
   report cost-per-booking. Put UTMs on the destination URL and say plainly that
   the numbers are directional until a Pixel exists.
8. Commit, push, and `SendUserFile` the PNGs.

Ad copy does not go through the Critic — its rules are tuned for Instagram
captions and hashtags, which ads do not use. Voice rules from `CLAUDE.md` still
apply: no *obsessed*, no *slay*, max 2 emoji, speak to one person.
