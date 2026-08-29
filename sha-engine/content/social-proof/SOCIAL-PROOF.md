# Social proof — Facebook, Instagram, and the reviews underneath

The plan is right. The starting point is wrong, and that changes the order of
everything.

## The problem with step 1

The plan opens with *"log into the Google account that manages Hair by Sha's
Google Business Profile."*

**There isn't one.** The July growth audit found no Google Business Profile, and
a search on 28 Aug 2026 confirmed it — there is no Google rating for Hair by Sha
to display anywhere. The 4.7-star, 57-review Camberwell listing that comes up
belongs to **Hair Hut**, the salon she rents a chair inside. Not hers.

So "5.0 ★ on Google — 100+ reviews" is not a thing that can be posted. It is a
target.

**This is the one place in the whole system where getting it wrong does real
damage.** Every other mistake costs reach. A fabricated rating costs trust
permanently, and it fails in the most public way possible: someone taps "read
our reviews", finds nothing, and now doubts everything else on the page. The
entire reason to point at Google rather than write "5 stars" in the bio is that
Google is *verifiable*. Faking it removes the only thing that made it work.

**The renderer will not let it happen.** Every number and quote comes from
`content/reviews.json`. Leave it empty and the assets render with the slots
struck through and a "not ready to post" stamp across them. There is no way to
accidentally publish a rating that does not exist.

---

## What is ready to use today

| File | What it is | Ready? |
|---|---|---|
| `proof-06-qr-booking.png` | QR to her booking page, on a branded card | **Yes — use now** |
| `proof-05-highlight-cover.png` | Instagram Highlight cover, REVIEWS | **Yes — use now** |
| `proof-01-pinned.png` | The pinned rating card | Blocked until there is a rating |
| `proof-02/03/04-review.png` | Testimonial cards | Blocked until there are reviews |
| `proof-07-qr-review.png` | QR to leave a review | Not generated — needs the profile URL |

The booking QR is real and tested: it decodes to
`https://hairbysha-booking.onrender.com/book`. Print it, put it by the mirror,
put it on the counter. It is useful whether or not the review plan ever happens.

---

## The actual order of operations

### 1. Create the Google Business Profile — everything waits on this

She is a chair renter running an independent business, which entitles her to her
own profile at the same address as her host. Free, roughly an hour, needs
postcard or phone verification which takes a few days.

While setting it up: **hours must include Sunday 10am–2pm.** That single field is
what puts her in front of *"hairdresser open Sunday near me"*, a search with
almost no competition in the eastern suburbs.

### 2. Get the review link, then generate the QR

Profile → **Ask for reviews** → copy the short link. Put it into
`content/reviews.json` as `source.profileUrl`, then:

```bash
cd sha-engine && node scripts/make-social-proof.mjs
```

That generates `proof-07-qr-review.png` with a real, scannable code.

### 3. Get to about ten reviews before displaying anything

A pinned post reading "5.0 — 3 reviews" is worse than no pinned post. Ten is
where a rating starts to look like evidence rather than a coincidence.

How to get them, in order of what actually works:

- **Ask in the chair, at the end, out loud.** Nothing else comes close. "If you
  liked it, would you mind leaving me a Google review? It takes thirty seconds."
- **The QR card**, handed over at the same moment.
- **A follow-up text the next day**, while the hair still looks like it did when
  she left.

**Never offer anything in exchange.** Google prohibits incentivised reviews and
removes them; it can also get the profile suspended. A discount for a review is
the fastest way to lose the reviews she already has.

### 4. Fill in `content/reviews.json` and render

Paste each review **exactly as written** — no tidying the grammar, no
shortening, no merging two into one. First name and initial for the author, the
normal convention.

Pick reviews that mention: the colour result specifically, her expertise or the
consultation, blonde work or a correction, someone returning, or the one-on-one
feel of a private chair. "Lovely salon" proves nothing.

Then re-run the script. The stamps disappear and the assets become postable.

### 5. Pin it on Facebook

Post `proof-01-pinned.png`, then ⋯ → **Pin to top of Page**. A new visitor
should not have to scroll to find out she is any good.

**Caption for the pinned post:**

```
Every one of these was written by someone who sat in the chair.

You can read them all on Google — the link goes straight to the profile, so you can see who said what rather than taking my word for it.

Sundays are open now too, 10 til 2.

Read the reviews: [GOOGLE LINK]
Book: hairbysha-booking.onrender.com/book
```

**Caption for each testimonial post:**

```
Another one that made my week.

[FIRST NAME] came in for [SERVICE]. This is what she said afterwards, word for word.

More on Google — link below. And Sundays are open now, 10 til 2.

[GOOGLE LINK]
```

### 6. Instagram Highlight

Use `proof-05-highlight-cover.png` as the cover, call it **REVIEWS**, and put the
testimonial cards inside as stories. Add the link sticker to the last one so it
goes to Google. Someone landing from a Reel then sees proof in two taps.

### 7. The About section

Once the rating is real:

```
⭐ 5.0 on Google · Colour specialist · 20+ years · Sundays 10–2
```

Name the source. "5.0 on Google" is credible; a bare "5 stars" reads as
self-assessment.

---

## Where this sits against everything else

```
Google Business Profile        ← nothing works until this exists
        ↓
Reviews, asked for in the chair
        ↓
Facebook pinned card + testimonial posts
        ↓
Instagram REVIEWS highlight
        ↓
Website testimonials
        ↓
Booking page
```

The bottom four are quick. The top two are the whole job, and they are the two
nobody enjoys doing.

## On Canva

Not used, and not needed — these are rendered by the same Chromium pipeline as
the rest of the system, which means the type is exact, the brand is consistent
with the Sundays campaign, and regenerating all seven assets after adding a
review takes about four seconds. (Canva is also not currently authorised in this
session, so it was not an option regardless.)
