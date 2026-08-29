# Social proof — Facebook, Instagram, and the reviews underneath

Six real reviews are now on file, pulled from the Reviews section of
hairbyshacamberwell.com on 29 Aug 2026 and stored in `content/reviews.json`.
That unblocks most of this plan. One piece stays blocked, and it is worth being
precise about which.

## What is proven, and what is not

**The quotes are proven.** Six of them, with names and context, published on her
own site. One is bylined *Local Guide*, which is a Google Maps badge — so these
did originate on Google, as you said.

**The rating is not.** A star average and a review count are a claim about a
place a customer can go and check. There is still no publicly findable Google
Business Profile for Hair by Sha — and the tell is on her own website: the
"Read all reviews on Google" button links to a **Google search results page**,
not to a profile. Whoever built the site had no profile URL either. That link is
also actively working against her, because the results page it lands on surfaces
Hair Hut's 4.7 ★ / 57 reviews — her host salon's rating, not hers.

So the system now runs two separate gates:

| Gate | Needs | Status |
|---|---|---|
| Testimonial cards | a real quote | **Open — six rendered** |
| Rating card | `rating` + `reviewCount` + `profileUrl` | Still closed |

Without a rating on file the pinned card does **not** render a stamped
placeholder any more. It falls back to a claim the quotes genuinely support:
three named clients who followed her from Malvern to Armadale to Camberwell.
*Ten years. Three suburbs. Same clients.* That is stronger than a star average
and it creates no dead link.

Testimonial cards say **"In her words"** and cite the client's own context
("Local Guide · client of 10+ years") rather than "Verified on Google". Nothing
cites a platform unless there is a URL on file that actually reaches it. Once you
paste a real profile URL into `reviews.json`, every card switches to Google
branding automatically.

---

## The assets

| File | What it is | Ready? |
|---|---|---|
| `proof-01-pinned.png` | Pinned card — the tenure claim | **Yes — post now** |
| `proof-02-review.png` | Sonya Agarwal — the eye for what suits you | **Yes** |
| `proof-03-review.png` | Stella McCammon — ten years, three suburbs | **Yes** |
| `proof-04-review.png` | Nimali Samarakoon — since 2018, honest advice | **Yes** |
| `proof-05-review.png` | Uppsala Trinh — ten years, very honest | **Yes** |
| `proof-06-review.png` | Dimmy Alevizos — best blow waves, back to blonde | **Yes** |
| `proof-07-review.png` | Michelle Tissera — most welcoming salon | **Yes** |
| `proof-08-highlight-cover.png` | Instagram Highlight cover, REVIEWS | **Yes** |
| `proof-09-qr-booking.png` | QR to her booking page | **Yes** |
| `proof-10-qr-review.png` | QR to leave a review | Needs the profile URL |

The booking QR is real and tested — it decodes to
`https://hairbysha-booking.onrender.com/book`. Print it, put it by the mirror.

**Reviews are reproduced exactly as published** — spelling included. Michelle's
"Girlsss run don't walk!!" would fail the brand voice check if Sha wrote it. She
didn't; a client did. Correcting a customer's words to fit a style guide turns a
real review into copy. The Critic governs captions, not quotations.

Long reviews step the type down rather than getting trimmed. A specific review is
a persuasive review, and truncating one to fit a layout is editing it.

---

## Order of operations

### 1. Post the testimonial cards now

Nothing is waiting on Google for these. Seven cards, ready.

### 2. Fix the website's Google button this week

`Read all reviews on Google` currently points at a search page that shows a
competitor's rating. Until there is a real profile, point it at the on-page
reviews anchor instead, or remove it. It is a two-minute change and right now it
is sending traffic to Hair Hut.

### 3. Create the Google Business Profile

She is a chair renter running an independent business, which entitles her to her
own profile at the same address as her host. Free, roughly an hour, postcard or
phone verification takes a few days.

Do this even though the reviews already exist elsewhere — six quotes on a website
are marketing, the same six on a Google profile are search visibility. And while
setting it up: **hours must include Sunday 10am–2pm.** That single field is what
puts her in front of *"hairdresser open Sunday near me"*, a search with almost no
competition in the eastern suburbs.

**Note:** reviews cannot be migrated. If these six were left on an older listing
for the Malvern or Armadale location, that listing may still exist and be
claimable — worth checking before creating a new one from scratch, because
claiming it keeps the review history.

### 4. Get the review link, then generate the QR

Profile → **Ask for reviews** → copy the short link. Put it into
`content/reviews.json` as `source.profileUrl`, then:

```bash
cd sha-engine && node scripts/make-social-proof.mjs
```

That generates the review QR and re-brands every card to Google.

### 5. Fill in the rating, once it exists

Add `rating` and `reviewCount`, re-run, and `proof-01` switches from the tenure
card to the star-average card. Don't display a rating under about ten reviews —
"5.0 from 3 reviews" pinned to the top of the page is worse than no pinned post.

**Never offer anything in exchange for a review.** Google removes incentivised
reviews and can suspend the profile.

### 6. Pin it on Facebook

Post `proof-01-pinned.png`, then ⋯ → **Pin to top of Page**. A new visitor should
not have to scroll to find out she is any good.

### 7. Instagram Highlight

`proof-08-highlight-cover.png` as the cover, call it **REVIEWS**, testimonial
cards inside as stories. Link sticker on the last one. Someone landing from a
Reel then sees proof in two taps.

### 8. The About section

Only once the rating is real:

```
⭐ 5.0 on Google · Colour specialist · 20+ years · Sundays 10–2
```

Until then, the tenure line is the honest version:

```
Colour specialist · 20+ years · clients of 10+ years · Sundays 10–2
```

---

## The captions

**Pinned post** — use with `proof-01-pinned.png`:

```
Some of my clients have been with me for ten years.

Malvern, then Armadale, now Camberwell — and they came with me. That is the
part I am proudest of, more than any single colour.

Below is what a few of them said, in their own words.

Sundays are open now too, 10 til 2.

Book: hairbysha-booking.onrender.com/book
```

**Each testimonial post** — write the specific one, don't reuse a template:

```
Stella has been coming to me for ten years, across three suburbs.

She said this, word for word. I have not touched it.

Sundays are open now, 10 til 2 — book at the link.
```

Swap the first line per card: Nimali since 2018 · Uppsala over ten years ·
Dimmy came back to blonde · Sonya on getting the colour right for the face ·
Michelle on how the room feels.

**Once there is a Google profile**, add to both:

```
More on Google: [LINK]
```

---

## Where this sits

```
Reviews (six, on file)          ← done
        ↓
Testimonial posts + pinned card ← ready now
        ↓
Instagram REVIEWS highlight     ← ready now
        ↓
Google Business Profile         ← the blocker for everything below
        ↓
Rating card · review QR · "5.0 on Google" in the bio · Sunday search visibility
```

The top three can happen today. The bottom half is one hour of admin that
nobody enjoys, and it is worth more than anything above it.

## On Canva

Not used, and not needed — these render through the same Playwright/Chromium
pipeline as the rest of the system, on the brand's inlined Fraunces and Inter. The
type is exact, the palette matches the Sundays campaign, and regenerating all ten
assets after adding a review takes about four seconds. (Canva is also not
currently authorised in this session, so it was not an option regardless.)
