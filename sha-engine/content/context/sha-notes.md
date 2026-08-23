# What Sha tells the system

`/start` reads this file, then asks the weekly questions in chat and writes the
answers back here. You never have to fill it in by hand — but you can, and
anything already here is used as-is.

---

## Standing context

Last updated: **14 Aug 2026**

**Days that need filling**
> The important one. If Wednesdays and Thursdays are dead, posts get written to
> drive bookings *onto those days* — "two Wednesday spots left this week" beats
> a generic "book now", and it fills the gap that actually costs money.
> Write the day names, or "none" if the week is evenly booked.

**Wednesday and Thursday.** No count given, so posts say "Wednesday and Thursday
are the quiet ones this week" rather than naming a number of open slots.

**Services she wants more of**
> Chair time is not equal. A balayage is 3.5 hours at $340; a blow wave is 45
> minutes at $55. If she wants the colour work, the posts should sell colour.

**No preference — she wants the days filled, whatever fills them.** Content
still points at the $240–$420 colour band, because `brand.json` `priceAnchor`
says that is where the money is and a Wednesday filled with a $45 toner is worth
a fraction of the same Wednesday filled with a $340 balayage. Revisit if she
says otherwise.

**Services she does not want asked for**
> (e.g. "no more extensions", "no kids' cuts")

**Nothing excluded.**

**Anything coming up**
> A holiday, a price change, a new product line, a wedding or race-day push.

**Nothing.** No price changes, no time away.

**On camera**
> Config says `face_and_voice`. If that is wrong the video guides change — the
> talking-head format is one of the strongest available and it needs her face.

**Confirmed — face and voice both.** `face_and_voice` in `config/brand.json` is
correct. Talking-head guides are on the table.

---

## Weekly answers

`/start` asks these each week and appends the answers below. Newest first.

The published/not-published check is now automatic — `node src/cli.js posted`
matches the captions the system wrote against what is actually on the account,
so nobody has to remember. The questions are for what the API cannot see.

### Week of 2026-08-24

- **Days needing filling:** Wednesday, Thursday **and Friday**. Both Wed/Thu and
  Thu/Fri were selected, so Thursday is the constant and all three get named.
- **Filmed any guides:** No — and explicitly *not* because the guides were wrong.
  She ran out of time. Third week running that no video has been filmed.
- **Posted:** 2 of 3. `w2-spring` ($340 lived-in blonde) never went up.
- **New photos:** yes, being sent. Until they land, the gallery scrape from her
  own website is the library.
- **Promotion (operator's call):** $250 half foil + toner + treatment + blow dry,
  **limited time**. Recorded in `brand.json` → `promotions`. Invariant 7 allows it
  because it was explicitly asked for; it is not to be extended or repeated
  unprompted.
- **Focus requested:** blow waves, hard, all week.

### Week of 2026-08-17

- **Days needing filling:** Wednesday and Thursday.
- **Filmed any guides:** No — same reason none of the posts went up.
- **From the chair:** Nothing this week.
- **Anything to avoid:** Nothing. No price change, not away.
- **Why week 1 did not go up:** *the answer that mattered.* Three reasons, in her
  words: still figuring out how the system would work, **the tone felt off**, and
  **she never saw them**. Two of those are ours, not hers. The captions read as
  written copy rather than as her talking, and the finished files sat in the repo
  instead of arriving on her phone.

  What changed in response, week 2: every caption is written in speech —
  contractions, first person, addressed to one reader — and the images are sent
  directly to her rather than left in `content/cards/`. The formats were **not**
  discarded: the audience never saw them, so they are unrun, not failed.

### Week of 2026-08-10

- **Days needing filling:** _not asked — the run predated the question set_
- **Filmed any guides:** _not asked_
- **From the chair:** _not asked_
- **Anything to avoid:** _not asked_

---

## History

Append a dated line each week rather than overwriting, so patterns show up.

- **14 Aug 2026** — system moved into Claude Code, dashboard retired. Week 1
  pack produced: price transparency, purple shampoo myth, four-things list.
  23 published captions still carrying defects, none fixed yet.
- **14 Aug 2026** — week 2 run. Live read restored: Composio key accepted,
  176 followers, 7.48% average engagement, grade B — unchanged from the 14 Aug
  baseline because **0 of week 1's 3 posts were published**. Standing context
  filled in for the first time. Week 2 pack produced: mid-week quiet-day post,
  lived-in blonde at $340 before spring, four things winter did. Three video
  guides, two of them talking-head now that face and voice are confirmed.
  Still 23 published captions carrying defects, none fixed yet.
- **23 Aug 2026** — week 3 run, and the first week with real published numbers.
  Both cards that went up scored **1 like each — 0.56%, grade F**. The live read
  settles the format question: **video 8.11% across 22 posts, images 1.11%
  across 3**, and those three images are the only stills on the account. Cards
  retired; every post this week is built on her own photography. Pulled 15 real
  photos off hairbyshacamberwell.com to make that possible. Followers 176 to 180
  against a predicted 183. Caption defects 23 to 22 — one fixed.
