# Facebook ads — round 2

Two ads built on Sha's own client photography. Creative rendered, copy written
to Meta's limits, targeting and budget specified.

> **Check this before you spend money.** You asked for **Thursday and Friday**.
> Sha told the system on 14 Aug that **Wednesday and Thursday** were her quiet
> days, and this week's organic posts say Wednesday and Thursday. The July growth
> plan says Thursday and Friday are her ~16 bookable hours. These say Thursday
> and Friday because that is what you asked for — but if it is wrong it is a
> one-word change and a re-render, and it is worse than useless if it is wrong.

---

## What changed from round 1, and why

Round 1 was a typographic card in her brand palette — the same system as the
organic posts. That was the mistake. A card works **in feed, for people who
already follow her**, where the brand is established and the job is to be saved.
To a stranger mid-scroll it is a slide with words on it.

These are built on **her actual work**: real client photography from her own
website, upscaled 2× through Picsart so a 4:5 crop out of a 9:16 original stays
sharp, warm-graded toward her palette, with a fine gold rule and a light film
grain so the type and the photograph sit in the same material world.

**Invariant 2 is intact, and this is precisely what it is for.** The rule bans
AI photographs of hair — not photographs. Every strand here is colour Sha
actually did. That is also why these cannot be mistaken for AI: they are a real
room, real light, a real client.

Two deliberately different layouts so the pair does not read as one template:

| | Ad 1 | Ad 2 |
|---|---|---|
| Layout | Full-bleed hero, ink scrim, type set into the base | Editorial spread — photo above, cream plate below |
| Feel | Dark, cinematic, desire-led | Light, magazine, trust-led |
| Job | Make her want the colour | Make her comfortable ringing |

---

## Ad 1 · Lived-in blonde → **Book Now**

**Creative:** `ad-01-lived-in.png` (1080×1350)

**Primary text** — first ~125 characters show before "… see more":

```
The point of a hand-painted blonde isn't how it looks on the day. It's how it looks in December, when you haven't been back yet.

A lived-in blonde starts at $340 — quoted before you sit down, nothing added at the counter. Three and a half hours: hand-painted balayage, a toner to finish, and a blow wave.

It's placed where the light would naturally hit and stops short of the root on purpose, so you get no hard line at eight weeks.

20+ years, K18 certified, colour only. Camberwell — Thursday and Friday are the quiet days.
```

**Headline** (34): `Still looks deliberate in December`
**Description** (27): `Camberwell · Thu & Fri open`
**CTA:** **Book Now**
**Destination:** `https://hairbysha-booking.onrender.com/book?utm_source=facebook&utm_medium=cpc&utm_campaign=r2-livedin`

## Ad 2 · The straight answer → **Call Now**

**Creative:** `ad-02-straight-answer.png` (1080×1350)

**Primary text:**

```
If you've been putting off colour because you don't know what to ask for, ring me. I'll tell you what your hair can take, and what it can't.

No upsell. Some weeks the honest answer is a $45 toner rather than a $340 balayage, and I'd rather you came back for four years than spent big once.

20+ years, K18 certified, colour only. Camberwell — Thursday and Friday are the quiet days.
```

**Headline** (27): `Ask what your hair can take`
**Description** (22): `Camberwell · Thu & Fri`
**CTA:** **Call Now**
**Destination:** `0452 611 799`

---

## Campaign setup

| | Ad 1 | Ad 2 |
|---|---|---|
| Objective | **Traffic** | **Leads** |
| Conversion location | Website | **Calls** |
| Optimisation | Landing page views | Call placements |
| Daily budget | $12 | $8 |

**Why Traffic, not Leads, for Ad 1.** Leads usually converts better for salons
but costs roughly triple per click
([~$1.92 vs ~$0.70, ~$27.66 per lead](https://www.graphed.com/blog/facebook-ads-for-hair-salons))
and adds a form she then has to chase. She already has Kairo. Straight there is
the shorter path.

**Optimise for landing page views, not link clicks.** Clicks counts the tap;
landing page views counts the page loading. On this budget that gap is most of
the money.

### Targeting

- **Location:** pin 1 Prospect Hill Rd, Camberwell VIC 3124, radius **8 km** —
  covers Glen Iris, Hawthorn, Canterbury, Balwyn, Surrey Hills, Kew.
  `brand.json` says 12 km, which reaches the CBD and buys people who will not
  drive it.
- **Set "People living in this location"**, not the default "living in or
  recently in", which buys everyone who drove through once.
- **Age** 28–55, **women**.
- **Interests: leave empty.** The radius already makes this small; stacking
  interests starves delivery. Add beauty/haircare only if the audience is
  under ~50k.

### Budget

**$20/day total, untouched for 7 days.** The learning phase needs ~50 events and
editing budget or creative resets it — the most common way a small account burns
money. Judge on **bookings in Kairo**, not likes.

---

## The measurement gap

**There is no Meta Pixel on the Kairo booking page.** Meta cannot see a
completed booking, cannot optimise toward people likely to book, and cannot
report cost-per-booking. It optimises for clicks and hopes.

1. **UTMs** *(already on the Ad 1 link, works today)* — count Facebook-sourced
   bookings by hand from Kairo's referrer data. Crude, free, honest.
2. **Install the Pixel on Kairo** — self-hosted, so it is a script tag plus a
   `Schedule` event on the confirmation screen. Then Meta optimises for actual
   bookings, which materially outperforms click-optimisation.

Until one exists the numbers are directional. Do not read "no conversions" as
failure — the dashboard cannot show them.

---

## Before you publish

- [ ] Confirm **Thursday and Friday** is right
- [ ] She can actually take bookings those days
- [ ] Ad 2's number goes to a phone she answers in work hours — a Call Now ad
      that rings out costs the same as one that converts
- [ ] Kairo loads on mobile and shows Thu/Fri availability
- [ ] Payment method set, ad account not restricted

## Next round

The single highest-value thing she can give us is a **before/after pair** on one
client. Transformation is the highest-converting creative in this category and
nothing else substitutes for it — everything here is one finished result, which
is the strongest thing buildable from the four photos that exist.

Also worth knowing: `photo-updo.jpg` is her warmest work but carries **a third
party's face reflected in the salon mirror**, so it is not usable behind ad
spend without that person's consent. `photo-layers.jpg` is cooler and flatter
and its tight crop read as a wall of hair with no shape. Both ads therefore draw
on `photo-balayage.jpg`, cropped to different regions.
