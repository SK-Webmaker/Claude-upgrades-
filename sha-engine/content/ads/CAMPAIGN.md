# Facebook ads — round 1

Two ads, built to fill **Thursday and Friday**. Ready to run: creative rendered,
copy written to Meta's character limits, targeting and budget specified.

> **One thing to check before you spend money.** You asked for Thursday and
> Friday. Sha told the system on 14 Aug that **Wednesday and Thursday** were her
> quiet days, and this week's organic posts say Wednesday and Thursday. The July
> growth plan says Thursday and Friday are her ~16 bookable hours. These ads say
> **Thursday and Friday** because that is what you asked for most recently — but
> if it is actually Wednesday and Thursday, tell me and I will re-render. It is
> a one-word change in two files and it is worse than useless if it is wrong.

---

## The deliberate deviation from the playbook

Every salon-ads guide says the same thing: run a **new-client discount**.
"First blowout $15. Book in 60 seconds." That is the standard advice and it
works.

**These ads do not do it**, because invariant 7 says never discount to fill a
quiet day — a price cut on a 20-year specialist teaches her audience to wait for
the next one, and it attracts the client who came for $15 and never returns at
$340.

So the conversion lever is **certainty instead of cheapness**. What premium
service ads actually convert on is [outcome and transformation rather than
price](https://www.blab.co/blog/how-to-position-your-business-to-attract-premium-clients),
and the thing nobody local offers is a number before you sit down. Ad 1 sells
the absence of a nasty surprise. Ad 2 sells being told the truth about your hair,
including when the honest answer is the $45 toner rather than the $340 balayage.

**Watch for:** if both ads underperform on cost-per-click against the ~$0.70
[2025 traffic benchmark](https://www.graphed.com/blog/facebook-ads-for-hair-salons),
the no-discount stance is the first suspect. That is a real trade and it is Sha's
call, not a bug to fix silently.

---

## Ad 1 · Price certainty → **Book Now**

**Creative:** `ad-01-price.png` (1080×1350)

**Primary text** — the first ~125 characters show before "… see more", so the
hook is front-loaded:

```
You shouldn't have to ask what it costs. A lived-in blonde with me starts at $340 — quoted before you sit down, nothing added at the counter.

Three and a half hours: hand-painted balayage, a toner to finish, and a blow wave. Built to grow out softly, so you're not back in six weeks.

20+ years, K18 certified, colour only. Thursday and Friday are the quiet days — you get the whole appointment at your own pace.

Camberwell, five minutes from Glen Iris, Canterbury and Surrey Hills.
```

**Headline** (26 chars): `Lived-in blonde, from $340`

**Description** (27 chars): `Camberwell · Thu & Fri open`

**Call to action:** **Book Now**
**Destination:** `https://hairbysha-booking.onrender.com/book?utm_source=facebook&utm_medium=cpc&utm_campaign=w2-price`

---

## Ad 2 · Talk first → **Call Now**

**Creative:** `ad-02-call.png` (1080×1350)

**Primary text:**

```
If you've been putting off colour because you don't know what to ask for, ring me. I'll tell you what your hair can take and what it can't.

No upsell. If all you need is a $45 toner, that's what I'll book you in for — I'd rather you came back for four years than spend big once.

20+ years, K18 certified, colour only. Thursday and Friday are the quiet days.

Camberwell.
```

**Headline** (24 chars): `Talk to a colourist first`

**Description** (22 chars): `Camberwell · Thu & Fri`

**Call to action:** **Call Now**
**Destination:** `0452 611 799`

---

## Campaign setup

| | Ad 1 | Ad 2 |
|---|---|---|
| Objective | **Traffic** | **Leads** |
| Conversion location | Website | **Calls** |
| Optimisation | Landing page views | Call placements |
| Daily budget | $12 | $8 |

**Why Traffic and not Leads for Ad 1.** Leads normally converts better for
salons, but it costs more —
[~$1.92 CPC against ~$0.70 on traffic, ~$27.66 per lead](https://www.graphed.com/blog/facebook-ads-for-hair-salons)
— and a lead form adds a step she then has to chase. She already has a booking
system. Sending straight to Kairo is the shorter path. Revisit if Ad 1 gets
clicks but no bookings.

**Optimise for landing page views, not link clicks.** Link clicks counts the tap;
landing page views counts the page actually loading. On a small budget the
difference is most of your money.

### Targeting

- **Location:** drop a pin on 1 Prospect Hill Rd, Camberwell VIC 3124, radius
  **8 km**. That covers Glen Iris, Hawthorn, Canterbury, Balwyn, Surrey Hills
  and Kew. `brand.json` says 12 km, which reaches into the CBD and buys people
  who will not drive it.
- **Critical:** set it to **"People living in this location"**, not the default
  "People living in or recently in". The default buys everyone who drove through
  Camberwell once.
- **Age:** 28–55. **Gender:** women.
- **Interests:** leave **empty** to start. The radius already makes this a small
  audience, and stacking interests on top starves delivery. Add
  beauty/haircare interests only if the audience is under ~50k.

### Budget and reading the result

Start at **$20/day total** and leave it alone for **7 days**. Meta's learning
phase needs ~50 events before delivery stabilises; changing budget or creative
resets it, which is the single most common way a small account burns money.

At $20/day you are buying roughly 25–30 landing page views a day. Judge it on
**bookings in Kairo**, not on likes.

---

## The measurement gap — read this

**There is no Meta Pixel on the Kairo booking page.** So Meta cannot see a
completed booking, cannot optimise toward people likely to book, and cannot
report cost-per-booking. It optimises for clicks and hopes.

Two ways to close it, in order of effort:

1. **UTM only** *(already in the Ad 1 link above, works today)* — if Kairo
   records a referrer or you can see it in its analytics, you can count bookings
   that came from Facebook by hand. Crude, free, honest.
2. **Install the Pixel on Kairo** — Kairo is self-hosted, so this is a script tag
   in the booking page template plus a `Purchase` or `Schedule` event on the
   confirmation screen. Then Meta can optimise for actual bookings, which
   typically outperforms click-optimisation by a wide margin.

Until one of those exists, treat the numbers as directional. Do not conclude the
ads failed because the dashboard shows no conversions — it cannot show them.

---

## Before you press publish

- [ ] Confirm **Thursday and Friday** is right (see the warning at the top)
- [ ] Check she can actually take the bookings those days
- [ ] Ad 2's phone number goes to a phone she answers during work hours — a Call
      Now ad that rings out costs the same as one that converts
- [ ] Kairo booking page loads on mobile and shows Thursday/Friday availability
- [ ] Meta Business Suite has a payment method and the ad account is not
      restricted
